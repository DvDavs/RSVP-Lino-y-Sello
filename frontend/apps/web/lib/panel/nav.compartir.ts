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
 * Hoy apunta al editor —que es donde vive «Publicar y compartir» desde 3C— para no inventar una
 * ruta que nadie sirve. E2 la cambia a su pantalla cuando la tenga.
 */
export const entradaCompartir: EntradaDeNavegacion = {
  id: "compartir",
  etiqueta: "compartir",
  href: (invitationId) => `/editor/${encodeURIComponent(invitationId)}`,
  icono: "IconoCompartir",
  orden: 20,
  visible: (estado) => estado.publicada,
};
