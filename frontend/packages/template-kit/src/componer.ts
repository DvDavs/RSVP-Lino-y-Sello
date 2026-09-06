// packages/template-kit/src/componer.ts — de un paquete en disco al `ComposedDocument` que pinta
// `packages/sections`, SIN backend y SIN base de datos.
//
// Es la mitad de Node de `preview` y de `capturas`: pura (salvo la lectura de los tres `.json`),
// probable sin navegador y sin servidor, y por eso vive en su propio módulo. El navegador solo
// recibe el resultado de aquí por HTTP (`/__preview/estado.json`).
//
// De dónde sale cada decisión:
//   · `compose(pkg, doc, business, assets, locale)` — `diseno/01 §5.1`. Los cinco parámetros son
//     obligatorios: `AssetIndex` es ENTRADA de la composición (objeción 1R O-03), nunca se resuelve
//     dentro. Aquí el índice apunta al propio servidor de previsualización, que sirve los ficheros
//     de `<paquete>/assets/` desde el disco.
//   · El documento se fabrica VACÍO (`content: {}`) a propósito: R2 (`01 §5.2`) hace que cada
//     bloque caiga a `defaults.json`, que es exactamente lo que el autor quiere ver. No se inventa
//     contenido de usuario.
//   · La estructura sale del manifiesto (`defaultVariant` + `defaultVisible`), no de una lista
//     escrita a mano: una sección nueva aparece en la previsualización sin tocar el kit.
//   · El `BusinessSnapshot` es de DEMOSTRACIÓN y está marcado como tal en la consola: los bloques
//     `source: "business"` (fecha y hora del evento) no existen en el paquete, los pone Postgres
//     (R4). Sin él, media portada se vería vacía y el autor creería que su plantilla está rota.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DefaultsFile, TemplateManifest, ThemeSpec, compose,
  type AssetIndex, type BusinessSnapshot, type CompositionReport, type ComposedDocument,
  type InvitationDocument, type Locale,
} from "@invitaciones/schema";
import { check } from "./check.ts";
import { formatearHallazgos, resumen, type Hallazgo } from "./formato.ts";

/** Fecha y hora de demostración del `BusinessSnapshot`. Fijas: la previsualización es determinista
 *  (R6/R9 — nada de `new Date()`, o dos capturas del mismo paquete diferirían). */
export const FECHA_DEMO = "2026-11-21";
export const HORA_DEMO = "17:30";

/** `BusinessSnapshot` de demostración: lo que Postgres pondría en una invitación real (R4). */
export function negocioDemo(eventKind: BusinessSnapshot["eventKind"], planTier = 3): BusinessSnapshot {
  return {
    invitationId: 1,
    date: FECHA_DEMO,
    time: HORA_DEMO,
    hashtag: "#EjemploDelKit",
    coverPhotoUrl: null,
    childrenAllowed: true,
    youngAllowed: true,
    eventKind,
    planTier,
    timezone: "America/Mexico_City",
  };
}

export interface OpcionesComponer {
  readonly dir: string;
  /** Base absoluta del servidor (`http://127.0.0.1:5310`): `AssetIndex.url` es `HttpUrl`. */
  readonly base: string;
  /** Paleta de `theme.json`; por omisión `defaultPaletteId`. */
  readonly paleta?: string;
  /** Conjunto de fuentes; por omisión `defaultFontSetId`. */
  readonly fuentes?: string;
  /** Idioma; por omisión el primero de `manifest.locales`. */
  readonly locale?: Locale;
  /** `true` (por omisión): los huecos de imagen sin valor se pintan con el marcador del kit. */
  readonly placeholders?: boolean;
}

export interface EstadoPreview {
  /** `true` sólo si `check` no encontró ni un ERROR: si es `false`, no hay documento que pintar. */
  readonly ok: boolean;
  readonly dir: string;
  readonly slug?: string;
  readonly version?: string;
  /** La salida de `check`, con el MISMO formato que la línea de órdenes (contrato de `formato.ts`). */
  readonly diagnostico: string;
  readonly hallazgos: readonly Hallazgo[];
  readonly composed?: ComposedDocument;
  readonly informe?: CompositionReport;
  /** Familias declaradas por `theme.json` y si el repositorio las tiene autoalojadas. */
  readonly fuentes: readonly FamiliaPedida[];
  /** Notas del previsualizador (no del paquete): demo de negocio, marcadores, fuentes de reserva. */
  readonly notas: readonly string[];
  /** Paletas y conjuntos de fuentes disponibles, para el conmutador de la consola. */
  readonly paletas: readonly { readonly id: string; readonly nombre: string }[];
  readonly conjuntosDeFuentes: readonly { readonly id: string; readonly nombre: string }[];
  /** Marca de tiempo del último cambio detectado (la usa la recarga). */
  readonly version_estado: number;
}

export interface FamiliaPedida {
  readonly family: string;
  readonly weights: readonly number[];
  readonly rol: "heading" | "body";
}

function leerJson(dir: string, fichero: string): unknown {
  return JSON.parse(readFileSync(join(dir, fichero), "utf8")) as unknown;
}

/**
 * Índice de assets del paquete: `AssetEntry.id ?? AssetEntry.path` → URL servida por el propio
 * previsualizador. Se declaran las DOS claves cuando hay alias (I-09), porque `defaults.json` puede
 * referirse a cualquiera de las dos y `compose` sólo mira `assets[assetId]`.
 */
export function indiceDeAssets(manifiesto: TemplateManifest, base: string): AssetIndex {
  const idx: Record<string, { url: string }> = {};
  for (const a of manifiesto.assets ?? []) {
    const url = `${base}/__preview/asset/${a.path.replace(/^assets\//, "")}`;
    idx[a.path] = { url };
    if (a.id !== undefined && a.id !== "") idx[a.id] = { url };
  }
  return idx as AssetIndex;
}

/** Clave sintética de un marcador de posición: nunca choca con un `AssetEntry.id` real (lleva `:`). */
export function clavePlaceholder(blockId: string, itemId?: string): string {
  return itemId === undefined ? `kit:ph:${blockId}` : `kit:ph:${blockId}:${itemId}`;
}

interface ValorImagen { kind: "image"; assetId: string; alt: string; focal: { x: number; y: number } }

function imagenPlaceholder(assetId: string): ValorImagen {
  return { kind: "image", assetId, alt: "", focal: { x: 0.5, y: 0.5 } };
}

/**
 * Rellena los huecos de IMAGEN que no tienen valor con un marcador del kit, y devuelve las entradas
 * a inyectar en `defaults.content` más las claves de `AssetIndex` que las resuelven.
 *
 * Se inyecta en los DEFAULTS y no en `doc.content` por una razón medida: `compose` ignora
 * `doc.content` para todo bloque `source: "fixed"` (`compose.ts:204`), y `rsvp.background` de
 * `bautizo-elegante@1.0.0` es exactamente eso — por `doc.content` el marcador nunca llegaba. Además
 * la procedencia que sale es la verdadera (`default`/`fixed`), no un `user` inventado (R3).
 *
 * Sólo imágenes y sólo donde ya hay estructura: nunca fabrica ítems de un grupo vacío (R5 — «nada se
 * fabrica»: un grupo sin ítems en `defaults.json` SE VE vacío, que es la verdad del paquete).
 */
export function marcadores(
  manifiesto: TemplateManifest,
  defaults: DefaultsFile,
): { readonly content: Record<string, unknown>; readonly assets: Record<string, { url: string }>; readonly cuantos: number } {
  const content: Record<string, unknown> = {};
  const assets: Record<string, { url: string }> = {};
  let cuantos = 0;
  const marca = (clave: string): ValorImagen => {
    assets[clave] = { url: "" };            // la URL real la pone `componerPaquete` (necesita `base`)
    cuantos++;
    return imagenPlaceholder(clave);
  };

  for (const s of manifiesto.sections) {
    for (const b of s.blocks) {
      if (b.type === "image") {
        if (b.source === "business") continue;              // R4: lo pone Postgres, no el paquete
        if (defaults.content[b.id] !== undefined) continue; // ya trae su imagen de verdad
        content[b.id] = marca(clavePlaceholder(b.id));
        continue;
      }
      if (b.type !== "group") continue;
      const def = defaults.content[b.id] as { kind?: string; items?: readonly { itemId: string; values: Record<string, unknown> }[] } | undefined;
      if (def?.kind !== "group" || def.items === undefined || def.items.length === 0) continue;
      const huecosImagen = b.itemBlocks.filter(ib => ib.type === "image").map(ib => ib.id);
      if (huecosImagen.length === 0) continue;
      const items = def.items.map(it => {
        const values: Record<string, unknown> = { ...it.values };
        for (const id of huecosImagen) {
          if (values[id] === undefined) values[id] = marca(clavePlaceholder(`${b.id}.${id}`, it.itemId));
        }
        return { itemId: it.itemId, values };
      });
      content[b.id] = { kind: "group", items };
    }
  }
  return { content, assets, cuantos };
}

/** Documento de invitación mínimo: estructura del manifiesto, tema por defecto, contenido vacío. */
export function documentoDeDefaults(
  manifiesto: TemplateManifest,
  tema: ThemeSpec,
  content: Record<string, unknown>,
  paletteId: string,
  fontSetId: string,
  locale: Locale,
): InvitationDocument {
  return {
    schemaVersion: 1,
    template: { slug: manifiesto.slug, version: manifiesto.version },
    theme: { paletteId, fontSetId },
    structure: {
      sections: manifiesto.sections.map(s => ({
        key: s.key, variant: s.defaultVariant, visible: s.defaultVisible,
      })),
    },
    content: content as InvitationDocument["content"],
    attic: {},
    meta: { locale },
  } as InvitationDocument;
}

/** El paquete de `dir`, compuesto y listo para pintar — o el diagnóstico de por qué no se puede. */
export function componerPaquete(opts: OpcionesComponer): EstadoPreview {
  const { dir, base } = opts;
  const conMarcadores = opts.placeholders !== false;
  // `escribir: false`: previsualizar NUNCA modifica el paquete. Un digesto desviado se ve como
  // ERROR en la consola, que es lo que el autor necesita saber antes de registrar (`check.ts`).
  const c = check({ dir, escribir: false });
  const cabecera = [`plantilla check ${dir}`];
  if (c.hallazgos.length > 0) cabecera.push("", formatearHallazgos(c.hallazgos));
  cabecera.push("", resumen(c.hallazgos));
  const diagnostico = cabecera.join("\n");

  if (!c.ok) {
    return {
      ok: false, dir, diagnostico, hallazgos: c.hallazgos, fuentes: [], notas: [],
      paletas: [], conjuntosDeFuentes: [], version_estado: Date.now(),
    };
  }

  const manifiesto = TemplateManifest.parse(leerJson(dir, "template.json"));
  const tema = ThemeSpec.parse(leerJson(dir, "theme.json"));
  const defaults = DefaultsFile.parse(leerJson(dir, "defaults.json"));

  const locale = (opts.locale ?? manifiesto.locales[0] ?? "es-MX") as Locale;
  const paletteId = opts.paleta ?? tema.defaultPaletteId;
  const fontSetId = opts.fuentes ?? tema.defaultFontSetId;

  const assets: Record<string, { url: string }> = { ...(indiceDeAssets(manifiesto, base) as Record<string, { url: string }>) };
  const notas: string[] = [];
  let defaultsEfectivos = defaults;
  if (conMarcadores) {
    const m = marcadores(manifiesto, defaults);
    defaultsEfectivos = { ...defaults, content: { ...defaults.content, ...m.content } as DefaultsFile["content"] };
    for (const clave of Object.keys(m.assets)) {
      assets[clave] = { url: `${base}/__preview/marcador.svg?b=${encodeURIComponent(clave)}` };
    }
    if (m.cuantos > 0) {
      notas.push(
        `${m.cuantos} hueco(s) de imagen sin valor se pintan con el marcador del kit. ` +
        `Con \`--sin-marcadores\` los ves como los verá un invitado: vacíos (R5).`,
      );
    }
  }

  const negocio = negocioDemo(manifiesto.eventKinds[0] ?? "generic", manifiesto.minPlanTier);
  notas.push(
    `Fecha y hora son de DEMOSTRACIÓN (${FECHA_DEMO} ${HORA_DEMO}): los bloques \`source: "business"\` ` +
    `no viven en el paquete, los pone Postgres al componer la invitación real (R4).`,
  );

  // `content: {}` — el documento no lleva NADA del cliente: R2 hace que todo caiga a los defaults,
  // que es justo lo que el autor quiere ver de su paquete.
  const doc = documentoDeDefaults(manifiesto, tema, {}, paletteId, fontSetId, locale);
  const { composed, report } = compose(
    { manifest: manifiesto, theme: tema, defaults: defaultsEfectivos },
    doc, negocio, assets as AssetIndex, locale,
  );

  const familias: FamiliaPedida[] = [
    { family: composed.theme.fonts.heading.family, weights: composed.theme.fonts.heading.weights, rol: "heading" },
    { family: composed.theme.fonts.body.family, weights: composed.theme.fonts.body.weights, rol: "body" },
  ];

  return {
    ok: true, dir, slug: manifiesto.slug, version: manifiesto.version,
    diagnostico, hallazgos: c.hallazgos, composed, informe: report,
    fuentes: familias, notas,
    paletas: tema.palettes.map(p => ({ id: p.id, nombre: p.name[locale] ?? p.name["es-MX"] ?? p.id })),
    conjuntosDeFuentes: tema.fontSets.map(f => ({ id: f.id, nombre: f.name[locale] ?? f.name["es-MX"] ?? f.id })),
    version_estado: Date.now(),
  };
}
