// src/golden.ts — golden de composición GENERADO (`06 §3`, ADR-1R-D-09: nunca se escribe a mano).
//
// Se compone el paquete recién construido contra `content: {}` con el `compose` REAL de
// `@invitaciones/schema` —el mismo que usan el editor y el render público (ADR-1R-C-03)— y se
// comprueba por TEXTO VISIBLE que reproduce lo que F1 (visual + contenido) trae mapeado. NO se compara
// JSON crudo: la forma cambia a propósito (ADR-001), así que comparar estructuras sólo detectaría el
// cambio que se quiere.
//
// Igualdad EXACTA tras la normalización de 6 pasos de `05 §6.2`, sin umbral difuso (ADR-1R-C-06).

import { compose, type BusinessSnapshot, type InvitationDocument } from "@invitaciones/schema";
import type { PaqueteConstruido } from "./construir.ts";
import { normalizarVisible } from "./valores.ts";

/** Negocio NEUTRO: el golden de PLANTILLA no depende de ninguna invitación. */
export function negocioNeutro(eventKind: BusinessSnapshot["eventKind"], planTier: number): BusinessSnapshot {
  return {
    invitationId: 1, date: null, time: null, hashtag: null, coverPhotoUrl: null,
    childrenAllowed: false, youngAllowed: false, eventKind, planTier, timezone: "America/Mexico_City",
  };
}

export function documentoVacio(p: PaqueteConstruido): InvitationDocument {
  return {
    schemaVersion: 1,
    template: { slug: p.slug, version: p.version },
    theme: { paletteId: p.theme.defaultPaletteId, fontSetId: p.theme.defaultFontSetId },
    structure: { sections: p.manifest.sections.map((s) => ({ key: s.key, variant: s.defaultVariant, visible: s.defaultVisible })) },
    content: {},
    attic: {},
    meta: { locale: "es-MX" },
  };
}

/** Texto visible del documento compuesto, en orden de página. */
export function textoVisible(resultado: ReturnType<typeof compose>): string[] {
  const out: string[] = [];
  const empujar = (v: unknown): void => {
    const x = v as { kind?: string; value?: string; items?: string[]; name?: string; doc?: { content: { content: { text: string }[] }[] }; formatted?: string; label?: string } | null;
    if (!x || typeof x !== "object") return;
    if (x.kind === "text") out.push(x.value ?? "");
    else if (x.kind === "person") out.push(x.name ?? "");
    else if (x.kind === "location") out.push(x.name ?? "");
    else if (x.kind === "listText") out.push(...(x.items ?? []));
    else if (x.kind === "choice") out.push(x.label ?? "");
    else if (x.kind === "richText") out.push(...(x.doc?.content ?? []).map((par) => par.content.map((s) => s.text).join("")));
  };
  for (const s of resultado.composed.sections) {
    if (!s.visible) continue;
    for (const b of s.blocks) {
      if ("items" in b) { for (const it of b.items) for (const ib of it.blocks) empujar(ib.value); }
      else empujar(b.value);
    }
  }
  return out.map((t) => t.trim()).filter((t) => t !== "");
}

export interface Golden {
  readonly plantilla: { readonly slug: string; readonly version: string; readonly templateId: number };
  readonly generadoPor: string;
  readonly textoVisible: readonly string[];
  readonly informeDeComposicion: unknown;
}

export function generarGolden(p: PaqueteConstruido, templateId: number, eventKind: BusinessSnapshot["eventKind"], planTier: number): Golden {
  const r = compose(
    { manifest: p.manifest, theme: p.theme, defaults: p.defaults },
    documentoVacio(p), negocioNeutro(eventKind, planTier), {}, "es-MX",
  );
  return {
    plantilla: { slug: p.slug, version: p.version, templateId },
    generadoPor: "compose() de @invitaciones/schema sobre content:{} — golden GENERADO, nunca escrito a mano (ADR-1R-D-09)",
    textoVisible: textoVisible(r),
    informeDeComposicion: r.report,
  };
}

export interface VerificacionTexto {
  /** Textos de F1 mapeados a un bloque que NO aparecen en la composición. Cero es la condición de éxito. */
  readonly faltantes: readonly { readonly legacyPointer: string; readonly texto: string }[];
  readonly comprobados: number;
}

/**
 * Comprueba por texto visible que el paquete reproduce lo que F1 trae mapeado. Sólo se exigen los
 * textos de hojas `mapeada` que llegaron a un bloque de contenido: los de negocio (`invitation.date`),
 * los de correlación y los que el informe declara «a revisar» no forman parte del contrato.
 */
export function verificarTextoVisible(p: PaqueteConstruido, golden: Golden): VerificacionTexto {
  const presentes = new Set(golden.textoVisible.map(normalizarVisible));
  const noExigibles = new Set(p.informeDePerdidas.aRevisar.map((e) => e.legacyPointer));
  // Un mismo texto puede llegar por dos punteros (p. ej. `/texts/familyIntro` y `/phrases/intro/0`).
  // Si el informe ya lo declara perdido por uno de ellos, no se exige por el otro: lo que importa es
  // que el TEXTO esté anotado, no cuántas veces aparece en F1.
  const textosAnotados = new Set(
    p.informeDePerdidas.aRevisar.map((e) => (typeof e.valor === "string" ? normalizarVisible(e.valor) : "")).filter((x) => x !== ""),
  );
  const faltantes: { legacyPointer: string; texto: string }[] = [];
  let comprobados = 0;
  for (const h of p.cobertura) {
    if (h.clase !== "mapeada" || typeof h.valor !== "string") continue;
    const d = h.destino;
    if (!d || (d.tipo !== "bloque" && d.tipo !== "itemBloque")) continue;
    if (noExigibles.has(h.puntero)) continue;
    if (textosAnotados.has(normalizarVisible(h.valor))) continue;
    const campo = d.campo ?? "valor";
    // Las URLs, las fechas y las horas cambian de forma a propósito (assetId, ISO, formateo): el
    // contrato es el TEXTO, no la representación.
    if (["url", "href", "mapHref", "dia", "hora", "textoLibre", "iso", "diaTexto", "mesTexto", "horaInicio", "horaFin", "opcion"].includes(campo)) continue;
    const t = h.valor.trim();
    if (t === "") continue;
    comprobados++;
    const n = normalizarVisible(t);
    if (![...presentes].some((x) => x === n || x.includes(n))) faltantes.push({ legacyPointer: h.puntero, texto: t });
  }
  return { faltantes, comprobados };
}
