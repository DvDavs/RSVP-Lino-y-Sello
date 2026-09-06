// packages/template-kit/src/nueva.ts — `plantilla nueva`: el andamio.
//
// Criterio duro del encargo: **lo que emite `nueva` pasa `check` sin una sola corrección**. Para que
// eso se sostenga cuando el esquema cambie, cada `BlockSpec` se construye recorriendo
// `describeBlockType(type).spec.required` (introspección de Zod, `packages/schema/src/introspect.ts`)
// y NO una lista escrita aquí: si `blocks.ts` añade un campo obligatorio que el kit no sabe rellenar,
// el generador **lanza** en vez de emitir un `template.json` inválido. Es la regla 2 que hereda
// `memoria/handoffs/4-0b.md` y la mecánica ya probada en `packages/sections/test/kit-scaffold.test.ts`.
//
// El vocabulario (qué secciones existen, qué huecos tiene cada una, qué rol va en cada hueco, qué
// variantes admite) sale entero de `@invitaciones/sections/catalog`. Aquí no se transcribe ni un rol.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DefaultsFile, SECTION_TYPES, TemplateManifest, ThemeSpec, describeBlockType, validateManifest,
} from "@invitaciones/schema";
import {
  blockIdFor, describeSection, scaffoldSlots, sectionCatalog,
  type CatalogSlot,
} from "@invitaciones/sections/catalog";
import { fallosDeContraste, oscurecerHasta, type PaletteTokens } from "./contraste.ts";
import { serializar } from "./paquete.ts";

type Json = Record<string, unknown>;

/** Tipos de evento del catálogo cerrado (`common.ts:61`). Se declara para poder sugerir al fallar. */
export const TIPOS_DE_EVENTO = [
  "wedding", "quince", "baptism", "communion", "confirmation", "birthday", "graduation", "generic",
] as const;
export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number];

/** Secciones del andamio por defecto: la misma lista de cinco que midió I-08. */
export const SECCIONES_POR_DEFECTO = ["cover", "celebrant", "event", "rsvp", "footer"] as const;

export interface OpcionesNueva {
  readonly slug: string;
  readonly evento: TipoDeEvento;
  readonly secciones: readonly string[];
  readonly version?: string;
  /** Nombre visible; por omisión se deriva del slug. */
  readonly nombre?: string;
  readonly descripcion?: string;
}

export interface PaqueteGenerado {
  readonly manifest: Json;
  readonly theme: Json;
  readonly defaults: Json;
}

// ---------------------------------------------------------------------------------------------
// 1. Paleta: se ELIGE el color, nunca el umbral (ADR-3-2d-04). Las dos paletas del andamio se
//    corrigen en tiempo de generación con la fórmula de `packages/sections/src/theme/contrast.ts`
//    hasta cumplir las nueve parejas, y `generarTema` lanza si aun así alguna falla.
// ---------------------------------------------------------------------------------------------
interface SemillaDePaleta {
  readonly id: string;
  readonly nombre: string;
  readonly bg: string;
  readonly surface: string;
  readonly ink: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly muted: string;
}

/** Dos paletas neutras de partida (una cálida, una fría). El corrector las lleva a AA si hace falta. */
export const SEMILLAS: readonly SemillaDePaleta[] = [
  {
    id: "arena", nombre: "Arena",
    bg: "#FAF7F2", surface: "#FFFFFF", ink: "#2E2A26", accent: "#8C6A45", accentInk: "#FFFFFF", muted: "#6E655C",
  },
  {
    id: "tinta", nombre: "Tinta",
    bg: "#F5F7FA", surface: "#FFFFFF", ink: "#232B33", accent: "#3C5A78", accentInk: "#FFFFFF", muted: "#5A6672",
  },
];

/** Corrige `accent` y `muted` de una semilla hasta que las nueve parejas cumplen. */
export function paletaAA(semilla: SemillaDePaleta): PaletteTokens {
  const fondos = [semilla.bg, semilla.surface];
  const accent = oscurecerHasta(semilla.accent, fondos, 4.5) ?? "#000000";
  const muted = oscurecerHasta(semilla.muted, fondos, 4.5) ?? "#000000";
  const tokens: PaletteTokens = {
    bg: semilla.bg, surface: semilla.surface, ink: semilla.ink,
    accent, accentInk: semilla.accentInk, muted,
  };
  const fallos = fallosDeContraste(tokens);
  if (fallos.length > 0) {
    throw new Error(
      `andamio: la paleta "${semilla.id}" no llega a AA ni corregida: ` +
      fallos.map(f => `${f.pair} ${f.ratio.toFixed(2)}:1 < ${f.threshold.toFixed(1)}:1`).join(", "),
    );
  }
  return tokens;
}

export function generarTema(): Json {
  return {
    palettes: SEMILLAS.map(s => ({
      id: s.id, name: { "es-MX": s.nombre }, tokens: paletaAA(s),
    })),
    fontSets: [{
      id: "clasica", name: { "es-MX": "Clásica" },
      // `source: "bundled"`: el proxy de este entorno bloquea Google Fonts (CLAUDE.md, entorno
      // remoto) y las familias llegan por npm/Fontsource. Nunca `"google"` en un andamio.
      heading: { family: "Cormorant Garamond", weights: [400, 600], source: "bundled" },
      body: { family: "Inter", weights: [400, 600], source: "bundled" },
    }],
    defaultPaletteId: SEMILLAS[0]!.id,
    defaultFontSetId: "clasica",
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Bloques: cada campo obligatorio de la rama del `oneOf`, resuelto desde el hueco del catálogo.
// ---------------------------------------------------------------------------------------------
/** Valor de UN campo obligatorio de la rama, a partir del hueco. Lanza si el kit no sabe rellenarlo. */
export function campoObligatorio(campo: string, slot: CatalogSlot, blockId: string): unknown {
  switch (campo) {
    case "id": return blockId;
    case "type": return slot.type;
    case "role": return slot.role;
    case "label": return { "es-MX": etiquetaPresentable(slot) };
    case "itemLabel": return { "es-MX": slot.itemLabel ?? "Elemento" };
    case "itemBlocks":
      return (slot.itemBlocks ?? []).filter(i => i.scaffold).map(i => bloque(i, i.blockId));
    case "options":
      return [{ id: "opcion-1", label: { "es-MX": "Primera opción" } }];
    default:
      throw new Error(
        `andamio: el esquema exige el campo "${campo}" en un bloque "${slot.type}" y el kit no sabe rellenarlo`,
      );
  }
}

/**
 * Etiqueta es-MX de un bloque del andamio. **No** se deriva del `purpose` del catálogo: ese texto es
 * ayuda para quien programa («Lista repetible de personas de la familia con su etiqueta») y el
 * `label` NO se queda en el editor — `packages/sections/src/sections/FamilySection.tsx:71,198`
 * publica el `label` de un bloque `person` bajo el nombre y el de un `group` como `<h3>` cuando la
 * sección no trae `groupTitle`. Un andamio que escriba ahí prosa de desarrollador la enseña a los
 * invitados (bitácora 4-5, hallazgo 6). Tabla curada y corta, en es-MX, sin emojis (ADR-4-1C-01).
 */
export const ETIQUETA_POR_ROL: Readonly<Record<string, string>> = {
  amenityDetail: "Detalles",
  amenityImage: "Imagen",
  amenityLink: "Enlace",
  amenityList: "Amenidades",
  amenityName: "Nombre",
  backgroundMusic: "Música de fondo",
  backgroundMusicEnabled: "Reproducir la música",
  celebrantA: "Celebrante 1",
  celebrantAPhoto: "Foto de celebrante 1",
  celebrantAText: "Texto de celebrante 1",
  celebrantB: "Celebrante 2",
  celebrantBPhoto: "Foto de celebrante 2",
  celebrantBText: "Texto de celebrante 2",
  celebrantsDate: "Fecha",
  celebrantsHeading: "Encabezado",
  celebrantsMessage: "Mensaje conjunto",
  coverBackground: "Fondo de portada",
  coverButtonLabel: "Texto del botón",
  coverButtonLink: "Destino del botón",
  coverDate: "Fecha del evento",
  coverImage: "Foto de portada",
  coverSubtitle: "Subtítulo",
  coverTitle: "Título de portada",
  decorative: "Adorno",
  dressCodeDetail: "Descripción",
  dressCodeImage: "Imagen",
  dressCodeRules: "Reglas",
  dressCodeTitle: "Nombre de la regla",
  eventCards: "Momentos",
  eventDate: "Fecha",
  eventLocationNote: "Nota del lugar",
  eventMapLink: "Mapa",
  eventNote: "Nota",
  eventPlace: "Dónde",
  eventTime: "Hora",
  eventTitle: "Nombre del momento",
  eventWhen: "Cuándo",
  familyGroup: "Familia",
  familyGroupTitle: "Título del grupo",
  familyIntro: "Introducción",
  footerLink: "Enlace",
  footerLogo: "Firma",
  footerNote: "Nota de cierre",
  galleryIntro: "Introducción",
  galleryPhoto: "Foto",
  galleryPhotos: "Fotos",
  giftOptionDetail: "Detalles",
  giftOptionImage: "Imagen",
  giftOptionKind: "Tipo",
  giftOptionLink: "Enlace",
  giftOptionTitle: "Nombre de la opción",
  giftOptions: "Opciones de regalo",
  godparentA: "Madrina o padrino 1",
  godparentB: "Madrina o padrino 2",
  hashtag: "Etiqueta",
  hashtagLink: "Enlace",
  hashtagList: "Etiquetas",
  hashtagPlatform: "Red social",
  honoree: "Persona homenajeada",
  honoreeMessage: "Mensaje",
  honoreePhoto: "Foto",
  parentA1: "Madre o padre 1",
  parentA2: "Madre o padre 2",
  parentB1: "Madre o padre 3",
  parentB2: "Madre o padre 4",
  personLabel: "Parentesco",
  personList: "Personas",
  personName: "Nombre",
  personPhoto: "Foto",
  personPhotoVisible: "Mostrar la foto",
  rsvpBackground: "Fondo",
  rsvpChildrenAllowed: "Se admiten niños",
  rsvpDeadline: "Fecha límite",
  rsvpKidsNote: "Nota sobre menores",
  rsvpNote: "Nota",
  rsvpYoungAllowed: "Se admiten jóvenes",
  sectionBackground: "Fondo de la sección",
  sectionIntro: "Introducción",
  sectionTitle: "Título de la sección",
  storyBody: "Relato",
  storyDate: "Fecha",
  storyImage: "Imagen",
  storyMilestones: "Hitos",
  storyTitle: "Título del hito",
  suggestionDetail: "Detalles",
  suggestionImage: "Imagen",
  suggestionLink: "Enlace",
  suggestionList: "Recomendaciones",
  suggestionName: "Nombre",
  witness: "Testigo",
};

/**
 * Etiqueta presentable del hueco. **Lanza** si el catálogo trae un hueco de andamio cuyo rol no está
 * en la tabla: igual que `campoObligatorio`, el andamio prefiere reventar aquí (y poner roja la
 * prueba `nueva: todos los huecos del andamio tienen etiqueta presentable`) antes que publicar la
 * frase de ayuda del catálogo como texto de cara al invitado.
 */
export function etiquetaPresentable(slot: CatalogSlot): string {
  const e = ETIQUETA_POR_ROL[slot.role];
  if (e === undefined) {
    throw new Error(
      `andamio: el hueco "${slot.blockId}" (rol "${slot.role}") no tiene etiqueta presentable; ` +
      "añádela a ETIQUETA_POR_ROL en packages/template-kit/src/nueva.ts (el `purpose` del catálogo " +
      "NO vale: FamilySection publica el label)",
    );
  }
  return e;
}

/**
 * Texto de RELLENO de `defaults.json`: la primera frase del propósito del hueco, en ≤ 200 caracteres
 * (I-27). Describe qué va ahí y el autor lo sustituye en el minuto 5-15 de la guía; a diferencia del
 * `label`, esto vive en `defaults.json`, que la guía y el checklist mandan reescribir entero.
 */
export function textoDeRelleno(slot: CatalogSlot): string {
  const frase = slot.purpose.split(".")[0]!.trim();
  const corta = frase.length > 0 ? frase : slot.blockId;
  return corta.length > 200 ? corta.slice(0, 197) + "..." : corta;
}

/** Un `BlockSpec` completo, derivado de la introspección + el hueco del catálogo. */
export function bloque(slot: CatalogSlot, blockId: string): Json {
  const rama = describeBlockType(slot.type).spec;
  const out: Json = {};
  for (const campo of rama.required) out[campo] = campoObligatorio(campo, slot, blockId);
  if (slot.required) out["required"] = true;
  if (slot.type === "group") {
    out["min"] = slot.min ?? 1;
    out["max"] = slot.max ?? 6;
  }
  if (slot.source) {
    out["source"] = slot.source;
    out["editable"] = false;
    out["aiEditable"] = false;
  }
  if (slot.businessField) out["businessField"] = slot.businessField;
  return out;
}

// ---------------------------------------------------------------------------------------------
// 3. Contenido de demostración: `defaults.json`.
// ---------------------------------------------------------------------------------------------
const ALFABETO_ULID = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * `itemId` ULID DETERMINISTA, derivado del paquete y del bloque. Determinista a propósito: dos
 * ejecuciones de `nueva` con los mismos argumentos producen los mismos bytes, y por tanto el mismo
 * `package_hash` (ADR-008: registrar dos veces el mismo paquete es un no-op, no una versión nueva).
 */
export function itemIdDeterminista(semilla: string): string {
  const bytes = createHash("sha256").update(semilla).digest();
  let out = "";
  for (let i = 0; i < 26; i++) out += ALFABETO_ULID[bytes[i]! % 32];
  return out;
}

/**
 * Valor de demostración de un bloque escalar, o `undefined` si el kit no debe escribir ninguno.
 * `image` y `audio` se OMITEN a propósito: su valor exige un `assetId`, y un `assetId` que el
 * manifiesto no declare como alias de un asset no resuelve y deja el bloque en `provenance:"empty"`
 * sin que nadie se entere (I-09, ADR-3B-I09-01). El andamio no trae imágenes: las pone el autor.
 */
export function valorDemo(slot: CatalogSlot): Json | undefined {
  if (slot.type === "image" || slot.type === "audio") return undefined;
  if (slot.type === "group") return undefined;      // lo arma `valorDeGrupo`
  const minimo = describeBlockType(slot.type).minimalValue as Json;
  if (slot.type === "text") return { kind: "text", value: textoDeRelleno(slot) };
  if (slot.type === "choice") return { kind: "choice", optionId: "opcion-1" };
  return { ...minimo };
}

/** Valor de un grupo: exactamente `min` fichas (I-04 exige `min ≤ items.length ≤ max`). */
export function valorDeGrupo(slot: CatalogSlot, blockId: string, slug: string): Json {
  const min = slot.min ?? 1;
  const items: Json[] = [];
  for (let i = 0; i < min; i++) {
    const values: Json = {};
    for (const item of (slot.itemBlocks ?? []).filter(x => x.scaffold)) {
      const v = valorDemo(item);
      if (v) values[item.blockId] = v;
    }
    items.push({ itemId: itemIdDeterminista(`${slug}|${blockId}|${i}`), values });
  }
  return { kind: "group", items };
}

// ---------------------------------------------------------------------------------------------
// 4. El paquete entero.
// ---------------------------------------------------------------------------------------------
/** Clave de sección única: el tipo, y `<tipo>2`, `<tipo>3`… si se pide el mismo tipo varias veces. */
function claveDeSeccion(tipo: string, usadas: Set<string>): string {
  if (!usadas.has(tipo)) { usadas.add(tipo); return tipo; }
  for (let n = 2; ; n++) {
    const k = `${tipo}${n}`;
    if (!usadas.has(k)) { usadas.add(k); return k; }
  }
}

export function generarPaquete(opts: OpcionesNueva): PaqueteGenerado {
  const version = opts.version ?? "1.0.0";
  const usadas = new Set<string>();
  // I-26: un rol singleton no puede repetirse en TODO el manifiesto. Si se piden dos secciones del
  // mismo tipo, el andamio deja el hueco singleton sólo en la primera en vez de emitir un
  // manifiesto que el registro rechazaría.
  const singletonUsado = new Set<string>();
  const contenido: Json = {};

  const secciones = opts.secciones.map(tipo => {
    const ficha = describeSection(tipo);
    if (!ficha) throw new Error(`andamio: "${tipo}" no es un tipo de sección del catálogo cerrado`);
    const clave = claveDeSeccion(tipo, usadas);
    const huecos = scaffoldSlots(ficha.type).filter(slot => {
      if (!slot.singletonRole) return true;
      if (singletonUsado.has(slot.role)) return false;
      singletonUsado.add(slot.role);
      return true;
    });
    const bloques = huecos.map(slot => {
      const blockId = blockIdFor(clave, slot);
      const spec = bloque(slot, blockId);
      // I-28: un `defaults` para un bloque `business` es contenido muerto y falla el registro.
      if (!slot.source) {
        const valor = slot.type === "group"
          ? valorDeGrupo(slot, blockId, opts.slug)
          : valorDemo(slot);
        if (valor) contenido[blockId] = valor;
      }
      return spec;
    });
    return {
      key: clave,
      type: ficha.type,
      title: { "es-MX": ficha.name },
      variants: ficha.variants.map(v => v.id),
      defaultVariant: ficha.defaultVariant,
      required: ficha.cardinality === "1",
      defaultVisible: true,
      blocks: bloques,
    };
  });

  const manifest: Json = {
    manifestVersion: 1,
    slug: opts.slug,
    version,
    name: { "es-MX": opts.nombre ?? nombreDesdeSlug(opts.slug) },
    ...(opts.descripcion ? { description: { "es-MX": opts.descripcion } } : {}),
    eventKinds: [opts.evento],
    minPlanTier: 1,
    locales: ["es-MX"],
    capabilities: [],
    sections: secciones,
    // Sin `previewImage` y sin `assets`: el andamio no inventa imágenes. La miniatura la genera
    // `plantilla preview` (bloque 4-1B) y entonces sí entra en `assets[]` con su digesto medido.
    assets: [],
    migrationsFrom: [],
  };
  const defaults: Json = { templateSlug: opts.slug, templateVersion: version, content: contenido };
  return { manifest, theme: generarTema(), defaults };
}

function nombreDesdeSlug(slug: string): string {
  return slug.split("-").map(p => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p)).join(" ");
}

/**
 * Comprobación interna del andamio ANTES de escribir nada: los tres esquemas y las 30 invariantes.
 * Que el andamio se valide a sí mismo es lo que hace cierto «pasa `check` sin una sola corrección»
 * incluso si alguien cambia el catálogo: aquí revienta, no en el registro.
 */
export function validarGenerado(p: PaqueteGenerado): void {
  const manifest = TemplateManifest.parse(p.manifest);
  const theme = ThemeSpec.parse(p.theme);
  const defaults = DefaultsFile.parse(p.defaults);
  const violaciones = validateManifest(manifest, theme, defaults);
  if (violaciones.length > 0) {
    throw new Error(
      "andamio: el paquete generado viola invariantes: " +
      violaciones.map(v => `${v.code}@${v.path}${v.detail ? ` (${v.detail})` : ""}`).join(", "),
    );
  }
}

export interface ResultadoNueva {
  readonly dir: string;
  readonly ficheros: readonly string[];
  readonly secciones: number;
  readonly bloques: number;
  readonly lineas: number;
}

/** Escribe el paquete en `<destino>/<slug>/<version>/`. No crea `assets/`: no hay ninguno. */
export function escribirPaquete(destino: string, opts: OpcionesNueva): ResultadoNueva {
  const p = generarPaquete(opts);
  validarGenerado(p);
  const version = opts.version ?? "1.0.0";
  const dir = join(destino, opts.slug, version);
  mkdirSync(dir, { recursive: true });
  const ficheros: string[] = [];
  for (const [nombre, valor] of [
    ["template.json", p.manifest], ["theme.json", p.theme], ["defaults.json", p.defaults],
  ] as const) {
    writeFileSync(join(dir, nombre), serializar(valor), "utf8");
    ficheros.push(nombre);
  }
  const secciones = (p.manifest["sections"] as Json[]).length;
  const bloques = (p.manifest["sections"] as Array<{ blocks: unknown[] }>)
    .reduce((n, s) => n + s.blocks.length, 0);
  return { dir, ficheros, secciones, bloques, lineas: serializar(p.manifest).split("\n").length };
}

/** Los 12 tipos de sección, para el `--help` y para el mensaje de error de `--secciones`. */
export const TIPOS_DE_SECCION: readonly string[] = SECTION_TYPES;
export { sectionCatalog };
