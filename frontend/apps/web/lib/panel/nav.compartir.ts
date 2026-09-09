// lib/panel/nav.compartir.ts — entrada «Compartir» del panel del cliente.
//
// DUEÑA: sesión E2 (invitados / RSVP / compartir). Este fichero es tuyo. NO edites `nav.ts` ni
// `tipos.ts`.
import type { EntradaDeNavegacion } from "./tipos.ts";

/**
 * ÚNICA entrada condicional del registro: compartir una invitación que todavía no está publicada
 * entregaría a los invitados un enlace que no abre — es exactamente el defecto U-6 que la fase 3
 * midió y corrigió (`lib/enlace-publico.ts`). Mientras no haya release, la entrada no se pinta.
 *
 * Apunta a la pantalla de invitados (`/editor/[invitationId]/invitados`, bloque 5-3): ahí vive el
 * reparto por invitado (`components/invitados/AccionesInvitado.tsx`) y el bloque de compartir la
 * invitación en general (`components/invitados/CompartirInvitacion.tsx`, el enlace público
 * `/i/[publicToken]`, no el personal de nadie). Antes apuntaba al editor «para no inventar una ruta
 * que nadie sirve» — esa ruta ya existe y es donde tiene sentido compartir.
 */
export const entradaCompartir: EntradaDeNavegacion = {
  id: "compartir",
  etiqueta: "compartir",
  href: (invitationId) => `/editor/${encodeURIComponent(invitationId)}/invitados`,
  icono: "IconoCompartir",
  orden: 20,
  visible: (estado) => estado.publicada,
};
