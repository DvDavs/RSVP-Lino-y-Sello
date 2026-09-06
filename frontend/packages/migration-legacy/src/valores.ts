// src/valores.ts — conversión de los valores legados (texto libre) a los 13 valores escalares del
// catálogo cerrado. Ninguna función INVENTA: cuando el dato no se puede representar devuelven `null`
// con un motivo, y el constructor lo anota como pérdida. Es R5 («nada se fabrica») aplicado a la
// migración.

import type { z } from "zod";
import { RichDoc as EsquemaRichDoc } from "@invitaciones/schema";

/** Forma normativa: `blocks.ts` `RichDoc`. Aqui se infiere del MISMO esquema, no se redeclara (P1). */
export type RichDoc = z.infer<typeof EsquemaRichDoc>;

export interface Conversion<T> {
  readonly valor: T | null;
  /** Motivo cuando `valor === null`. Va literal al informe de pérdidas. */
  readonly motivo?: string;
}

const ok = <T>(valor: T): Conversion<T> => ({ valor });
const no = <T>(motivo: string): Conversion<T> => ({ valor: null, motivo });

/** Meses en español, con y sin acento, tal como aparecen en F1 (`"Diciembre"`, `"Julio"`). */
const MESES = [
  ["enero"], ["febrero"], ["marzo"], ["abril"], ["mayo"], ["junio"],
  ["julio"], ["agosto"], ["septiembre", "setiembre"], ["octubre"], ["noviembre"], ["diciembre"],
];

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function mesDe(texto: string): number | null {
  const t = sinAcentos(texto);
  for (let i = 0; i < MESES.length; i++) if (MESES[i]!.some((m) => t.includes(m))) return i + 1;
  return null;
}

const dosDigitos = (n: number): string => String(n).padStart(2, "0");

/**
 * Fecha en español libre → `YYYY-MM-DD`. Cubre las formas reales de F1 [V]:
 * `"Miércoles 31, Diciembre"`, `"Miércoles 31, Diciembre, 2025"`, `"26 de Julio, 2023"`,
 * `"Fecha límite para confirmar tu asistencia 26 de Julio, 2023. De lo contrario…"`, `"2025-12-31"`.
 * `anioPorDefecto` cierra la ambigüedad del año ausente: sale de `invitation.date` (05 §4.3 decisión 3).
 */
export function fechaEs(texto: string, anioPorDefecto: number | null): Conversion<string> {
  const t = texto.trim();
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return ok(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const mes = mesDe(t);
  if (mes === null) return no(`no contiene un mes en español reconocible: ${JSON.stringify(texto)}`);
  const dia = /(?:^|[^\d])(\d{1,2})(?:[^\d]|$)/.exec(t);
  if (!dia) return no(`no contiene día: ${JSON.stringify(texto)}`);
  const anio = /(\d{4})/.exec(t);
  const y = anio ? Number(anio[1]) : anioPorDefecto;
  if (y === null) {
    return no(`fecha sin año (${JSON.stringify(texto)}) y sin \`invitation.date\` del que tomarlo (05 §4.3 decisión 3)`);
  }
  const d = Number(dia[1]);
  if (d < 1 || d > 31) return no(`día fuera de rango: ${JSON.stringify(texto)}`);
  return ok(`${y}-${dosDigitos(mes)}-${dosDigitos(d)}`);
}

/** `"4:30 PM"`, `"16:30"`, `"7:00 pm"` → `HH:mm` en 24 h. */
export function hora(texto: string): Conversion<string> {
  const t = texto.trim().toLowerCase().replace(/\s+/g, " ");
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/.exec(t);
  if (!m) return no(`no es una hora reconocible: ${JSON.stringify(texto)}`);
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const sufijo = m[3]?.replace(/\./g, "");
  if (sufijo === "pm" && h < 12) h += 12;
  if (sufijo === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return no(`hora fuera de rango: ${JSON.stringify(texto)}`);
  return ok(`${dosDigitos(h)}:${dosDigitos(min)}`);
}

/** `HttpUrl` de `common.ts`: `^https?://…`, ≤ 2048. `"#"` y las rutas relativas NO valen. */
export function urlHttp(texto: string): Conversion<string> {
  const t = texto.trim();
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(t)) {
    return no(`no es una URL http(s) absoluta y \`HttpUrl\` la rechazaría: ${JSON.stringify(texto)}`);
  }
  if (t.length > 2048) return no("URL de más de 2048 caracteres");
  return ok(t);
}

/**
 * Texto plano → `RichDoc`. Un párrafo por línea no vacía, sin marcas: el legado no tiene marcado,
 * así que inventar `bold`/`italic` sería fabricar (R5). Límites del esquema: ≤40 párrafos, ≤50 spans.
 */
export function richDoc(parrafos: readonly string[]): Conversion<RichDoc> {
  const ps = parrafos.flatMap((p) => p.split(/\r?\n/)).map((p) => p.trim()).filter((p) => p !== "");
  if (ps.length === 0) return no("sin texto");
  if (ps.length > 40) return no(`${ps.length} párrafos: \`RichDoc\` admite 40 como máximo`);
  return ok({
    type: "doc",
    content: ps.map((p) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text: p }] })),
  });
}

/** Icono FontAwesome → opción del `choice` `hashtagPlatform`. Cerrado: lo que no está, no se inventa. */
export function plataformaDeIcono(icono: string): Conversion<string> {
  const t = icono.toLowerCase();
  for (const [aguja, opcion] of [["facebook", "facebook"], ["instagram", "instagram"], ["tiktok", "tiktok"], ["twitter", "x"], ["fa-x", "x"]] as const) {
    if (t.includes(aguja)) return ok(opcion);
  }
  return no(`icono sin plataforma reconocible en el \`choice\` \`hashtagPlatform\`: ${JSON.stringify(icono)}`);
}

/** Normaliza el `type` legado de la mesa de regalos al `choice` `giftOptionKind`. */
export function tipoRegalo(valor: string): Conversion<string> {
  const t = valor.trim().toLowerCase();
  if (t === "cash" || t === "digital" || t === "store") return ok(t);
  return no(`\`giftOptionKind\` sólo declara cash|digital|store y el legado trae ${JSON.stringify(valor)} (I-02: no se coacciona)`);
}

/**
 * Normalización de texto visible de `05 §6.2` para comparar antes/después: recorta, colapsa espacios
 * (incluido ` `), quita comillas tipográficas y acentos, y pasa a minúsculas. Sin umbral difuso:
 * la igualdad es exacta tras normalizar (ADR-1R-C-06).
 */
export function normalizarVisible(s: string): string {
  return sinAcentos(
    s.replace(/[\u00a0\u2007\u202f\u2009]/g, " ")
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
