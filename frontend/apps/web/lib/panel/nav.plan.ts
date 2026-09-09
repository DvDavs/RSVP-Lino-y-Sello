// lib/panel/nav.plan.ts — entrada «Plan» del panel del cliente.
//
// DUEÑA: sesión E4 (pagos). Este fichero es tuyo. NO edites `nav.ts` ni `tipos.ts`.
import type { EntradaDeNavegacion } from "./tipos.ts";

/**
 * Siempre visible: el plan es lo que la clienta consulta —y cambia— antes de publicar, no después.
 * Va la última de la barra porque es administración de la cuenta, no trabajo sobre la invitación.
 */
export const entradaPlan: EntradaDeNavegacion = {
  id: "plan",
  etiqueta: "plan",
  href: (invitationId) => `/editor/${encodeURIComponent(invitationId)}/plan`,
  icono: "IconoPlan",
  orden: 30,
  visible: () => true,
};
