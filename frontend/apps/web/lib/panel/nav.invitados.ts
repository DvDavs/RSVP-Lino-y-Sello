// lib/panel/nav.invitados.ts — entrada «Invitados» del panel del cliente.
//
// DUEÑA: sesión E2 (invitados / RSVP / compartir). Este fichero es tuyo: amplíalo, cámbiale el
// orden o añade sub-entradas si tu diseño lo pide. NO edites `nav.ts` ni `tipos.ts`.
import type { EntradaDeNavegacion } from "./tipos.ts";

/**
 * Siempre visible: la lista de invitados se arma ANTES de publicar (es justo lo que se hace
 * mientras la invitación todavía es un borrador), así que no depende del estado de publicación.
 */
export const entradaInvitados: EntradaDeNavegacion = {
  id: "invitados",
  etiqueta: "invitados",
  href: (invitationId) => `/editor/${encodeURIComponent(invitationId)}/invitados`,
  icono: "IconoInvitados",
  orden: 10,
  visible: () => true,
};
