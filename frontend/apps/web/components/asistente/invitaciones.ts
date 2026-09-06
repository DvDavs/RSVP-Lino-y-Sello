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
}

export const MAX_INVITACIONES_CONSULTADAS = 12;

/** Lista + estado real de cada invitación. Lanza si `/user/invitations/all` falla. */
export async function cargarInvitaciones(): Promise<readonly FilaInvitacion[]> {
  const lista = await listarInvitaciones();
  const recortada = lista.slice(0, MAX_INVITACIONES_CONSULTADAS);
  return Promise.all(recortada.map((inv) => filaDe(inv)));
}

async function filaDe(inv: InvitacionDelCliente): Promise<FilaInvitacion> {
  const comun = { ...inv, eventKind: eventKindDeNombre(inv.event), nivel: nivelDePlan(inv.plan) };
  try {
    const doc = await getDocument(inv.id);
    return { ...comun, estado: "con-plantilla", nombre: doc.composed ? tituloDe(doc.composed) : null };
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
  return disponibles[0] ?? null;
}
