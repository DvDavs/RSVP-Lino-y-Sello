// components/asistente/invitaciones.ts — «Mis invitaciones» del asistente: qué invitaciones tiene
// la clienta y cuáles están todavía sin plantilla (que son a las que el asistente puede aplicarle
// una).
//
// Por qué hace falta sondear el documento de cada invitación: `/user/invitations/all` es del módulo
// ANTIGUO y no sabe nada de `templates2`; la única forma de saber si una invitación ya tiene
// documento es `GET …/document`, que responde `404 TPL_DOCUMENT_NOT_STARTED` cuando no lo tiene
// (contratos §4, ADR-1R-X-03). Se sondean como mucho doce: esto es una pantalla, no un barrido.
import type { EventKind } from "@invitaciones/schema";
import { ApiError, getDocument, listarInvitaciones, type InvitacionDelCliente } from "@/lib/api-client";
import { tituloDe } from "@/app/(public)/_componentes/composed-lectura";
import { nivelDePlan, type NivelDePlan } from "./catalogo.ts";
import { eventKindDeNombre } from "./tipos-de-evento.ts";

export type EstadoInvitacion = "sin-plantilla" | "con-plantilla" | "sin-acceso";

export interface FilaInvitacion extends InvitacionDelCliente {
  readonly estado: EstadoInvitacion;
  /** Nombre HUMANO leído del documento («Mariana & Rodrigo»); `null` si aún no hay documento. */
  readonly nombre: string | null;
  readonly eventKind: EventKind;
  readonly nivel: NivelDePlan;
  /**
   * ¿Está publicada AHORA MISMO? Es `activeRelease !== null` de `GET …/document` (contratos §4),
   * la misma fuente que mira el diálogo de publicar: no se infiere del `status` del módulo antiguo.
   */
  readonly publicada: boolean;
  /**
   * `publicToken` y `publicUrl` de `GET …/document`, para armar el enlace de las invitadas con
   * `lib/enlace-publico.ts` (el mismo que usa el diálogo de publicar: el servidor devuelve
   * `http://localhost/i/…` en desarrollo y ese ayudante lo corrige con el origen real). Son `null`
   * mientras no haya documento: sin documento no hay `public_token` que enseñar.
   */
  readonly publicToken: string | null;
  readonly publicUrl: string | null;
}

export const MAX_INVITACIONES_CONSULTADAS = 12;

/** Lista + estado real de cada invitación. Lanza si `/user/invitations/all` falla. */
export async function cargarInvitaciones(): Promise<readonly FilaInvitacion[]> {
  const lista = await listarInvitaciones();
  const recortada = lista.slice(0, MAX_INVITACIONES_CONSULTADAS);
  return Promise.all(recortada.map((inv) => filaDe(inv)));
}

/**
 * Estado real de UNA invitación. Se exporta (fase 5, E3) porque el asistente la reusa justo
 * después de un alta (`POST /product/invitations`, `crear-invitacion.ts`): la fila que arma es
 * IDÉNTICA a la que produciría un refresco completo de `cargarInvitaciones()`, sin repetir la
 * lógica de qué `code` significa qué estado.
 */
export async function filaDe(inv: InvitacionDelCliente): Promise<FilaInvitacion> {
  const comun = {
    ...inv,
    eventKind: eventKindDeNombre(inv.event),
    nivel: nivelDePlan(inv.plan),
    publicada: false,
    publicToken: null,
    publicUrl: null,
  };
  try {
    const doc = await getDocument(inv.id);
    return {
      ...comun,
      estado: "con-plantilla",
      nombre: doc.composed ? tituloDe(doc.composed) : null,
      // 3C-UX G-06: el enlace público desaparecía al cerrar el panel de publicar y no había forma
      // de recuperarlo sin volver a publicar. Ya viene en ESTA respuesta, que además es la que el
      // asistente ya pedía para saber si la invitación tiene documento: cero peticiones nuevas.
      publicada: doc.activeRelease !== null && doc.activeRelease !== undefined,
      publicToken: doc.publicToken ?? null,
      publicUrl: doc.publicUrl ?? null,
    };
  } catch (error: unknown) {
    if (error instanceof ApiError && error.code === "TPL_DOCUMENT_NOT_STARTED") {
      return { ...comun, estado: "sin-plantilla", nombre: null };
    }
    if (error instanceof ApiError && (error.code === "TPL_FORBIDDEN" || error.code === "TPL_NOT_MIGRATED")) {
      return { ...comun, estado: "sin-acceso", nombre: null };
    }
    // Cualquier otro fallo se trata como «ya empezada»: la clienta entra a su editor, que sabe
    // explicar lo que pase. Nunca se le ofrece un camino que puede no funcionar.
    return { ...comun, estado: "con-plantilla", nombre: null };
  }
}

/** Las que el asistente puede usar: existen, son suyas y todavía no tienen plantilla. */
export function sinPlantilla(filas: readonly FilaInvitacion[]): readonly FilaInvitacion[] {
  return filas.filter((f) => f.estado === "sin-plantilla");
}

/**
 * A cuál se le aplica la plantilla: la que venga por la URL si sigue siendo válida, si no la
 * primera sin plantilla. `null` cuando no hay ninguna disponible.
 *
 * `tipoPreferido` es el `?tipo=` de la portada (3C-UX G-02, punto 3): si hay una invitación libre
 * registrada con ESE tipo, es la que se usa; si no la hay, se sigue con la primera libre y la
 * pantalla lo explica con «Tu invitación está registrada como …» en vez de ignorar el parámetro.
 *
 * `incluirConPlantilla` es el caso de los pasos 3 y 4: en cuanto el asistente aplica la plantilla,
 * ESA invitación deja de estar «sin plantilla» — pero sigue siendo la del asistente. Sin esta
 * puerta, recargar el paso 3 dejaba la pantalla sin invitación objetivo y el guardado se caía en
 * silencio. Nunca se abre desde el paso 1: aplicar una plantilla ENCIMA de otra manda contenido al
 * `attic` y eso exige confirmación explícita (`04 §7.3`), que vive en el editor, no aquí.
 */
export function invitacionObjetivo(
  filas: readonly FilaInvitacion[],
  preferida: number | null,
  incluirConPlantilla = false,
  tipoPreferido: EventKind | null = null,
): FilaInvitacion | null {
  const disponibles = sinPlantilla(filas);
  if (preferida !== null) {
    const elegida = disponibles.find((f) => f.id === preferida);
    if (elegida) return elegida;
    if (incluirConPlantilla) {
      const yaEmpezada = filas.find((f) => f.id === preferida && f.estado === "con-plantilla");
      if (yaEmpezada) return yaEmpezada;
    }
  }
  if (tipoPreferido !== null) {
    const delTipo = disponibles.find((f) => f.eventKind === tipoPreferido);
    if (delTipo) return delTipo;
  }
  return disponibles[0] ?? null;
}
