// lib/dnd-announcements.ts — instrucciones y anuncios ARIA en es-MX para TODO reordenar con
// `dnd-kit` del editor (04 §14.3, obligatorios). Una sola fuente para `SectionList`, `GroupField` y
// `PhotoManager`, con el nombre de cada fila/tarjeta como parámetro — el texto exacto es el de `04`.
import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";

export const INSTRUCCIONES_TECLADO: ScreenReaderInstructions = {
  draggable:
    "Para reordenar, pulsa la tecla Espacio sobre el asa. Con la lista levantada, usa las flechas " +
    "arriba y abajo para mover el elemento. Pulsa Espacio de nuevo para soltarlo, o Escape para cancelar.",
};

/** `nombreDe`/`posicionDe` cierran sobre el orden VIGENTE en el momento del evento. */
export function crearAnuncios(nombreDe: (id: string) => string, posicionDe: (id: string) => number, total: number): Announcements {
  return {
    onDragStart({ active }) {
      return `Has levantado ${nombreDe(String(active.id))}. Está en la posición ${posicionDe(String(active.id))} de ${total}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return "";
      return `${nombreDe(String(active.id))} se movió a la posición ${posicionDe(String(over.id))} de ${total}.`;
    },
    onDragEnd({ active, over }) {
      if (!over) return `Se soltó ${nombreDe(String(active.id))} y volvió a su posición original.`;
      return `${nombreDe(String(active.id))} quedó en la posición ${posicionDe(String(over.id))} de ${total}.`;
    },
    onDragCancel({ active }) {
      return `Se canceló el movimiento. ${nombreDe(String(active.id))} volvió a la posición ${posicionDe(String(active.id))}.`;
    },
  };
}
