// components/invitados/utilidades.ts — formato compartido por la tabla, las tarjetas y los
// contadores: nada de lógica de red aquí (eso vive en `lib/invitados/api.ts`).
import type { TonoBadge } from "@invitaciones/ui";
import type { GuestStatus } from "@/lib/invitados/api";
import { textosInvitados as t } from "@/lib/invitados/textos";

export function etiquetaEstado(status: GuestStatus): string {
  if (status === "CONFIRMED") return t.estado.confirmada;
  if (status === "DECLINED") return t.estado.noAsiste;
  return t.estado.pendiente;
}

export function tonoEstado(status: GuestStatus): TonoBadge {
  if (status === "CONFIRMED") return "success";
  if (status === "DECLINED") return "danger";
  return "neutro";
}

export function nombreVisible(fullName: string | null): string {
  const limpio = fullName?.trim();
  return limpio && limpio.length > 0 ? limpio : t.tabla.sinNombre;
}

/** «hace 2 días» a partir de un ISO-8601. `null`/inválida → cadena vacía (no se inventa una fecha). */
export function formatoRelativo(iso: string | null, ahora: Date = new Date()): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const segundos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000));
  if (segundos < 60) return t.relativo.ahoraMismo;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return t.tabla.actualizadoHace(t.relativo.minutos(minutos));
  const horas = Math.round(minutos / 60);
  if (horas < 24) return t.tabla.actualizadoHace(t.relativo.horas(horas));
  const dias = Math.round(horas / 24);
  return t.tabla.actualizadoHace(t.relativo.dias(dias));
}
