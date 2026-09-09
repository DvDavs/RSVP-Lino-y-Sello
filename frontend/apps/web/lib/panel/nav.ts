// lib/panel/nav.ts — el REGISTRO de navegación del panel del cliente (fase 5, andamio 5-0d).
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
// ║ CADA SESIÓN EDITA SOLO SU `nav.<area>.ts`. ESTE FICHERO NO SE TOCA.                           ║
// ║   E2 → `nav.invitados.ts` y `nav.compartir.ts`   ·   E4 → `nav.plan.ts`                       ║
// ║ Añadir un área nueva (que no existe hoy) es lo único que obliga a tocar `nav.ts`, y entonces  ║
// ║ lo hace el orquestador al integrar, no una sesión en paralelo.                                ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
//
// POR QUÉ EXISTE. La fase 5 la escriben cuatro sesiones a la vez. Si las tres entradas de la barra
// vivieran en un único fichero, las tres sesiones lo editarían y cada integración sería un conflicto
// en la misma línea. Con un fichero por área, el compositor es el único punto compartido y es
// exactamente lo que nadie edita.
//
// ORDEN DETERMINISTA. Nunca por orden de importación: un `import` movido de sitio no puede cambiar
// la barra que ve la clienta. Se ordena por `orden` y, cuando dos entradas empatan, por `id` en
// orden alfabético estable (`localeCompare` con la configuración regional fijada, no la del
// sistema). `nav.test.ts` lo comprueba, y también que no haya dos ids iguales: dos áreas que
// eligieran el mismo `id` romperían la clave de React y el resaltado de la ruta activa.
import { entradaCompartir } from "./nav.compartir.ts";
import { entradaInvitados } from "./nav.invitados.ts";
import { entradaPlan } from "./nav.plan.ts";
import type { EntradaDeNavegacion, EstadoDeInvitacion } from "./tipos.ts";

/** Sin ordenar y sin filtrar: la materia prima, tal y como la declara cada área. */
const DECLARADAS: readonly EntradaDeNavegacion[] = [entradaInvitados, entradaPlan, entradaCompartir];

/** `orden` asc; empate → `id` alfabético. Determinista y estable entre servidor y cliente. */
function compararEntradas(a: EntradaDeNavegacion, b: EntradaDeNavegacion): number {
  if (a.orden !== b.orden) return a.orden - b.orden;
  return a.id.localeCompare(b.id, "es-MX");
}

/**
 * El registro completo, ya ordenado. Incluye las entradas condicionales: quien pinta la barra filtra
 * con `navegacionVisible`, y quien quiera enseñarlas todas (una página de ajustes, una prueba) las
 * tiene aquí sin volver a ordenar.
 */
export const NAVEGACION_DEL_PANEL: readonly EntradaDeNavegacion[] = [...DECLARADAS].sort(compararEntradas);

/** Las entradas que se pintan con ESTE estado de la invitación, en el mismo orden determinista. */
export function navegacionVisible(estado: EstadoDeInvitacion): readonly EntradaDeNavegacion[] {
  return NAVEGACION_DEL_PANEL.filter((entrada) => entrada.visible(estado));
}

export type { EntradaDeNavegacion, EstadoDeInvitacion } from "./tipos.ts";
