// packages/template-kit/src/check.ts — `plantilla check`: el corazón del kit.
//
// No es "un validador más": el esquema ya valida. Lo que aquí se añade es lo que faltó en la
// medición de I-08 (`evidencia/fase-3/i08-plantilla-minima/`, 7 min 29 s y CUATRO intentos): decir
// QUÉ falta para el `type` concreto, cuáles son los roles válidos más cercanos y cómo se escribe un
// ejemplo mínimo. Nunca «0 are valid».
//
// Además comprueba lo que el esquema NO puede ver porque no está en los `.json`: el árbol del
// paquete (`01 §2.1`), los digestos reales de los assets (P5: se MIDEN y se escriben, jamás se
// teclean), los planes de migración, el contraste AA de las paletas y el hueco conocido de
// rol ↔ tipo de sección (ADR-4-0B-04: el backend no lo valida y la plantilla de I-08 se registró con
// un `familyGroup` dentro de una sección `event`).
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import {
  DefaultsFile, MigrationPlan, ROLES, TemplateManifest, ThemeSpec,
  describeBlockType, describeRole, explainBlockSpec, suggestClosest, suggestRole, suggestSectionType,
  validateManifest, type Violation,
} from "@invitaciones/schema";
import { describeSection, sectionCatalog, type CatalogSection, type CatalogSlot } from "@invitaciones/sections/catalog";
import { ETIQUETA_POR_ROL, itemIdDeterminista, textoDeRelleno } from "./nueva.ts";
import { fallosDeContraste, oscurecerHasta, type PaletteTokens } from "./contraste.ts";
import { ordenar, puntero, type Hallazgo } from "./formato.ts";
import {
  DIRECTORIOS_PERMITIDOS, FICHEROS_OBLIGATORIOS, PATRON_ASSET, leerJson, medirAssets, packageHash,
  recorrer, serializar, sha256, type ArchivoDelPaquete,
} from "./paquete.ts";

type Json = Record<string, unknown>;

export interface OpcionesCheck {
  readonly dir: string;
  /** `true` (por omisión): mide los assets y ESCRIBE sus `sha256`/`bytes` en el manifiesto (P5). */
  readonly escribir?: boolean;
  /** `true`: los avisos cuentan como errores (útil en integración continua). */
  readonly estricto?: boolean;
}

export interface ResultadoCheck {
  readonly hallazgos: readonly Hallazgo[];
  /** Ficheros del paquete reescritos por el propio `check`. */
  readonly escrituras: readonly string[];
  /** `package_hash` del paquete tal y como queda tras el check, o `undefined` si no se pudo leer. */
  readonly packageHash?: string;
  readonly ok: boolean;
}

const MANIFIESTO = "template.json";
const TEMA = "theme.json";
const DEFAULTS = "defaults.json";

/** Ejemplo mínimo de un tipo de bloque, en una línea, para la sugerencia. */
function ejemploMinimo(tipo: string): string {
  return JSON.stringify(describeBlockType(tipo).minimalSpec);
}

/** Ejemplo mínimo del VALOR de ese tipo de bloque, tal como se escribe en `defaults.json`. */
export function ejemploMinimoDeValor(tipo: string): string {
  return JSON.stringify(describeBlockType(tipo).minimalValue);
}

/**
 * El alfabeto de los identificadores del paquete (`itemId` y alias de asset): Crockford base32, que
 * excluye I, L, O y U para que nadie confunda un 1 con una l ni un 0 con una O. El esquema lo dice
 * como expresión regular (`/^[0-9A-HJKMNP-TV-Z]{26}$/`), que no es una frase en español: la bitácora
 * 4-5 §5 lo midió como «bastó a medias». Esta constante es la frase.
 */
const ALFABETO_EN_PALABRAS =
  "26 caracteres en MAYÚSCULAS y dígitos del alfabeto Crockford base32 " +
  "(0123456789ABCDEFGHJKMNPQRSTVWXYZ): NO admite las letras I, L, O ni U";

/** Un identificador válido, derivado de la semilla para que el mensaje sea estable y copiable. */
function idDeEjemplo(semilla: string): string {
  return itemIdDeterminista(semilla);
}

/** Los roles que tienen sentido en un tipo de sección, listados para la sugerencia. */
function rolesDe(tipoSeccion: string, tipoBloque?: string): string {
  const roles = ROLES.filter(r => {
    const info = describeRole(r);
    if (!info || !info.sectionTypes.includes(tipoSeccion)) return false;
    return tipoBloque === undefined || (info.blockTypes as readonly string[]).includes(tipoBloque);
  });
  return roles.length > 0 ? roles.join(", ") : "(ninguno declarado para ese tipo de sección)";
}

// ---------------------------------------------------------------------------------------------
// Ayuda por invariante. Cubre TODOS los códigos que `validateManifest` puede emitir: un hallazgo
// sin salida no es un hallazgo (y la prueba `ayuda-invariantes` comprueba la cobertura).
// ---------------------------------------------------------------------------------------------
export const AYUDA_INVARIANTE: Readonly<Record<string, string>> = {
  "I-01_RANGE_END_BEFORE_START": "en un valor `dateTimeRange`, `end` no puede ser anterior a `start`: corrige una de las dos fechas en `defaults.json`.",
  "I-02_CHOICE_UNKNOWN_OPTION": "el `optionId` del valor debe ser uno de los `options[].id` que declara ese bloque `choice` en `template.json`.",
  "I-03_ITEM_ID_DUPLICATE": "dos fichas del mismo grupo comparten `itemId`: cada ficha lleva su propio ULID de 26 caracteres.",
  "I-04_GROUP_SIZE_OUT_OF_BOUNDS": "el número de fichas del grupo en `defaults.json` tiene que estar entre el `min` y el `max` que declara el bloque.",
  "I-05_BUSINESS_FIELD_MISSING": "un bloque con `source: \"business\"` exige `businessField`; los valores admitidos son invitation.date, invitation.time, invitation.hashtag, invitation.coverPhotoUrl, invitation.childrenAllowed, invitation.youngAllowed.",
  "I-06_BUSINESS_TYPE_MISMATCH": "el `businessField` obliga al `type` del bloque (por ejemplo `invitation.date` exige `type: \"date\"`): cambia uno de los dos.",
  "I-07_GROUP_MIN_GT_MAX": "en un bloque `group`, `min` no puede ser mayor que `max`.",
  "I-08_DEFAULT_VARIANT_UNKNOWN": "`defaultVariant` tiene que ser una de las cadenas del array `variants` de esa misma sección.",
  "I-09_THEME_DEFAULT_UNKNOWN": "`defaultPaletteId` y `defaultFontSetId` de `theme.json` tienen que existir en `palettes[]` y en `fontSets[]`.",
  "I-10_DEFAULT_KEY_UNKNOWN": "toda clave de `defaults.json` tiene que ser un `blockId` declarado en `template.json` (no hay `defaultRef`: la clave ES el id del bloque).",
  "I-13_BLOCK_ID_DUPLICATE": "los `id` de bloque son únicos en TODO el manifiesto, no sólo dentro de su sección; dentro de un grupo, los `itemBlocks` son únicos entre sí.",
  "I-14_SECTION_KEY_DUPLICATE": "dos secciones declaran la misma `key`: la clave de sección es única en el manifiesto.",
  "I-15_BLOCK_KIND_MISMATCH": "el `kind` del valor de `defaults.json` tiene que ser igual al `type` del bloque en `template.json`.",
  "I-16_TEXT_TOO_LONG": "el texto de `defaults.json` se sale del `minLength`/`maxLength` que declara el bloque: acorta el texto o sube la restricción.",
  "I-18_ITEM_BLOCK_UNKNOWN": "una ficha del grupo trae una clave que no es ninguno de los `itemBlocks[].id` declarados por ese grupo.",
  "I-22_ITEM_BLOCK_SOURCE_NOT_USER": "dentro de un grupo repetible sólo cabe `source: \"user\"`: no hay dato de negocio indexado por ficha.",
  "I-25_GROUP_ROLE_MISMATCH": "los roles de grupo sólo valen en bloques `type: \"group\"`, y un bloque `group` sólo admite un rol de grupo.",
  "I-26_SINGLETON_ROLE_DUPLICATE": "ese rol es singleton: como mucho un bloque por manifiesto lo lleva. Cambia el rol de uno de los dos bloques o borra el duplicado.",
  "I-27_LOCALIZED_TEXT_MISSING_LOCALE": "todo texto localizado tiene que traer TODOS los locales de `manifest.locales`: añade la clave que falta.",
  "I-28_DEFAULT_FOR_BUSINESS_BLOCK": "un bloque `source: \"business\"` lee de Postgres: su entrada en `defaults.json` es contenido muerto y hay que borrarla.",
  "I-30_TEXT_MULTILINE_NOT_ALLOWED": "el valor lleva un salto de línea y el bloque declara `multiline: false`: quita el salto o pon `multiline: true`.",
};

/** Traduce el `path` de una `Violation` a un puntero RFC 6901 sobre `template.json`/`defaults.json`. */
function punteroDeViolacion(v: Violation, manifiesto: Json | undefined): string {
  const partes = v.path.split(".");
  if (partes[0] === "defaults") return puntero(DEFAULTS, "content", partes.slice(1).join("."));
  if (partes[0] === "theme") return puntero(TEMA, ...partes.slice(1));
  if (partes[0] === "blocks" && manifiesto) {
    const id = partes.slice(1).join(".");
    const p = punteroDeBloque(manifiesto, id);
    if (p) return p;
  }
  if (partes[0] === "sections" && manifiesto) {
    const clave = partes[1] ?? "";
    const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
    const i = secciones.findIndex(s => s["key"] === clave);
    if (i >= 0) return puntero(MANIFIESTO, "sections", i, ...partes.slice(2));
  }
  return puntero(MANIFIESTO, ...partes);
}

/** Puntero al bloque `id` (o al `itemBlock` `grupo.item`) dentro del manifiesto crudo. */
export function punteroDeBloque(manifiesto: Json, id: string): string | undefined {
  const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
  for (const [i, s] of secciones.entries()) {
    const bloques = (s["blocks"] as Json[] | undefined) ?? [];
    for (const [j, b] of bloques.entries()) {
      if (b["id"] === id) return puntero(MANIFIESTO, "sections", i, "blocks", j);
      const items = (b["itemBlocks"] as Json[] | undefined) ?? [];
      for (const [k, ib] of items.entries()) {
        if (`${String(b["id"])}.${String(ib["id"])}` === id) {
          return puntero(MANIFIESTO, "sections", i, "blocks", j, "itemBlocks", k);
        }
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// 1. Bloques crudos: los DOS primeros fallos medidos de I-08 (rol inventado, `group` con
//    `constraints`) se diagnostican aquí, antes y aparte de Zod, para que el mensaje sea el bueno.
// ---------------------------------------------------------------------------------------------
export function revisarBloquesCrudos(manifiesto: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
  for (const [i, s] of secciones.entries()) {
    const tipoSeccion = typeof s["type"] === "string" ? (s["type"] as string) : "";
    const bloques = (s["blocks"] as Json[] | undefined) ?? [];
    for (const [j, b] of bloques.entries()) {
      salida.push(...revisarUnBloque(b, puntero(MANIFIESTO, "sections", i, "blocks", j), tipoSeccion));
      const items = (b["itemBlocks"] as Json[] | undefined) ?? [];
      for (const [k, ib] of items.entries()) {
        salida.push(...revisarUnBloque(
          ib, puntero(MANIFIESTO, "sections", i, "blocks", j, "itemBlocks", k), tipoSeccion,
        ));
      }
    }
  }
  return salida;
}

function revisarUnBloque(b: Json, base: string, tipoSeccion: string): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const e = explainBlockSpec(b);
  const id = typeof b["id"] === "string" ? (b["id"] as string) : "(sin id)";
  if (!e.known) {
    salida.push({
      severidad: "ERROR", codigo: "TPL_BLOCK_TYPE_UNKNOWN", puntero: `${base}/type`,
      problema: `El bloque "${id}" declara un \`type\` que no es ninguno de los 14 del catálogo cerrado.`,
      sugerencia: `${e.message} Ejemplo mínimo de un bloque de texto: ${ejemploMinimo("text")}`,
    });
    return salida;
  }
  const tipo = String(e.declaredType);
  if (e.missing.length > 0 || e.unknown.length > 0) {
    salida.push({
      severidad: "ERROR", codigo: "TPL_BLOCK_SPEC_INVALID", puntero: base,
      problema: `El bloque "${id}" no encaja en la rama \`type: "${tipo}"\` del esquema.`,
      sugerencia: `${e.message} Ejemplo mínimo: ${ejemploMinimo(tipo)}`,
    });
  }
  const rol = b["role"];
  if (typeof rol === "string" && describeRole(rol) === undefined) {
    const cerca = suggestRole(rol);
    salida.push({
      severidad: "ERROR", codigo: "TPL_ROLE_UNKNOWN", puntero: `${base}/role`,
      problema: `El rol "${rol}" del bloque "${id}" no está en el catálogo cerrado de ${ROLES.length} roles.`,
      sugerencia: cerca.length > 0
        ? `¿Quisiste decir ${cerca.map(r => `"${r}"`).join(", ")}? Roles admitidos en una sección "${tipoSeccion}" con bloques "${tipo}": ${rolesDe(tipoSeccion, tipo)}.`
        : `Roles admitidos en una sección "${tipoSeccion}" con bloques "${tipo}": ${rolesDe(tipoSeccion, tipo)}.`,
    });
  }
  return salida;
}

/**
 * Rutas de asset, sobre el manifiesto CRUDO. Va antes de Zod porque `AssetEntry.path` lleva la misma
 * expresión regular y su mensaje («Invalid string: must match pattern …») no dice qué hacer, mientras
 * que una ruta con `..` o con un subdirectorio es justo la clase de fallo que hay que explicar bien
 * (`09-verificacion-adversarial-seguridad.md` §2).
 */
export function revisarRutasDeAssets(manifiesto: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const assets = (manifiesto["assets"] as Json[] | undefined) ?? [];
  for (const [i, a] of assets.entries()) {
    const ruta = a["path"];
    if (typeof ruta !== "string" || PATRON_ASSET.test(ruta)) continue;
    salida.push({
      severidad: "ERROR", codigo: "TPL_ASSET_PATH_INVALID", puntero: puntero(MANIFIESTO, "assets", i, "path"),
      problema: `La ruta de asset "${ruta}" no cumple ^assets/[a-z0-9][a-z0-9._-]{0,99}$.`,
      sugerencia: "Los assets viven en `assets/`, sin subdirectorios, en minúsculas y sin `..`: renombra el archivo (por ejemplo `assets/preview.webp`) y apunta ahí la ruta.",
    });
  }
  return salida;
}

/**
 * Etiquetas del andamio que nadie sustituyó. El `label` de un bloque **no** es sólo el rótulo del
 * formulario del editor: `FamilySection.tsx:71` lo pinta bajo el nombre de cada persona y
 * `FamilySection.tsx:198` lo usa de `<h3>` del grupo cuando la sección no trae `groupTitle`. La
 * bitácora 4-5 (hallazgo 6) lo encontró mirando una captura, no por un mensaje: nada avisaba.
 * Aviso y no error: el texto del `label` es del autor, y un paquete con la etiqueta del catálogo es
 * válido, sólo probablemente no es lo que quería (`--estricto` lo pone rojo en integración continua).
 */
export function revisarEtiquetasDeAndamio(manifiesto: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
  for (const [i, s] of secciones.entries()) {
    const bloques = (s["blocks"] as Json[] | undefined) ?? [];
    for (const [j, b] of bloques.entries()) {
      salida.push(...unaEtiqueta(b, puntero(MANIFIESTO, "sections", i, "blocks", j)));
      const items = (b["itemBlocks"] as Json[] | undefined) ?? [];
      for (const [k, ib] of items.entries()) {
        salida.push(...unaEtiqueta(ib, puntero(MANIFIESTO, "sections", i, "blocks", j, "itemBlocks", k)));
      }
    }
  }
  return salida;
}

/** Todas las frases de ayuda del catálogo (las que escribía el andamio antes de ADR-4-1C-01). */
let TEXTOS_DEL_CATALOGO: Set<string> | undefined;
function textosDelCatalogo(): Set<string> {
  if (TEXTOS_DEL_CATALOGO === undefined) {
    const acc = new Set<string>();
    for (const ficha of Object.values(sectionCatalog) as readonly CatalogSection[]) {
      for (const slot of ficha.slots) {
        acc.add(textoDeRelleno(slot));
        for (const ib of slot.itemBlocks ?? []) acc.add(textoDeRelleno(ib as CatalogSlot));
      }
    }
    TEXTOS_DEL_CATALOGO = acc;
  }
  return TEXTOS_DEL_CATALOGO;
}

function unaEtiqueta(b: Json, base: string): readonly Hallazgo[] {
  const label = b["label"] as Json | undefined;
  const texto = label !== undefined && typeof label["es-MX"] === "string" ? (label["es-MX"] as string) : undefined;
  if (texto === undefined || !textosDelCatalogo().has(texto)) return [];
  const id = typeof b["id"] === "string" ? (b["id"] as string) : "(sin id)";
  const rol = typeof b["role"] === "string" ? (b["role"] as string) : "";
  const sugerido = ETIQUETA_POR_ROL[rol];
  // Coincidencia inocente: para algún hueco («Título de la sección») la frase del catálogo ES ya la
  // etiqueta presentable que escribe el andamio corregido. Nada que sustituir, nada que avisar.
  if (sugerido === texto) return [];
  return [{
    severidad: "AVISO", codigo: "TPL_LABEL_DE_ANDAMIO", puntero: `${base}/label/es-MX`,
    problema: `La etiqueta "${texto}" del bloque "${id}" es la frase con la que el catálogo describe ese hueco, no un texto tuyo.`,
    sugerencia: "El `label` no se queda en el editor: una sección `family` lo publica tal cual " +
      "(título del grupo y parentesco debajo de cada nombre, FamilySection.tsx:71,198). Escribe en " +
      `template.json una etiqueta corta y presentable${sugerido !== undefined ? ` (por ejemplo "${sugerido}")` : ""} y repite \`plantilla check\`.`,
  }];
}

/** Rol ↔ tipo de sección: el hueco que el backend NO valida (ADR-4-0B-04). Aviso, no error. */
export function revisarRolYSeccion(manifiesto: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
  for (const [i, s] of secciones.entries()) {
    const tipo = typeof s["type"] === "string" ? (s["type"] as string) : "";
    if (describeSection(tipo) === undefined) continue;
    const bloques = (s["blocks"] as Json[] | undefined) ?? [];
    for (const [j, b] of bloques.entries()) {
      const rol = b["role"];
      const info = typeof rol === "string" ? describeRole(rol) : undefined;
      if (info && !info.sectionTypes.includes(tipo)) {
        salida.push({
          severidad: "AVISO", codigo: "TPL_ROLE_SECTION_MISMATCH",
          puntero: puntero(MANIFIESTO, "sections", i, "blocks", j, "role"),
          problema: `El rol "${info.role}" no está declarado para secciones de tipo "${tipo}" (sí para: ${info.sectionTypes.join(", ")}).`,
          sugerencia: `Cambia el rol por uno de los de esta sección (${rolesDe(tipo, String(b["type"]))}) o mueve el bloque a una sección de tipo ${info.sectionTypes[0] ?? "compatible"}. El registro NO comprueba esto todavía (I-32 sin implementar, ADR-4-0B-04): si es a propósito, ignora el aviso.`,
        });
      }
    }
  }
  return salida;
}

/** Variantes declaradas que ningún componente sabe pintar (el fallo `portrait` de la I-08). */
export function revisarVariantes(manifiesto: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const secciones = (manifiesto["sections"] as Json[] | undefined) ?? [];
  for (const [i, s] of secciones.entries()) {
    const tipo = typeof s["type"] === "string" ? (s["type"] as string) : "";
    const ficha = describeSection(tipo);
    if (!ficha) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_SECTION_TYPE_UNKNOWN",
        puntero: puntero(MANIFIESTO, "sections", i, "type"),
        problema: `"${tipo}" no es uno de los 12 tipos de sección del catálogo cerrado.`,
        sugerencia: `¿Quisiste decir ${suggestSectionType(tipo).map(t => `"${t}"`).join(", ") || "alguno de los 12"}?`,
      });
      continue;
    }
    const conocidas = ficha.variants.map(v => v.id);
    for (const [k, v] of ((s["variants"] as string[] | undefined) ?? []).entries()) {
      if (!conocidas.includes(v)) {
        salida.push({
          severidad: "AVISO", codigo: "TPL_VARIANT_UNKNOWN",
          puntero: puntero(MANIFIESTO, "sections", i, "variants", k),
          problema: `La variante "${v}" no existe en el registro de secciones de tipo "${tipo}".`,
          sugerencia: `Las variantes que los componentes saben pintar son: ${conocidas.join(", ")}. Una variante inventada se registra sin error y se cae al render.`,
        });
      }
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 2. El check completo.
// ---------------------------------------------------------------------------------------------
export function check(opts: OpcionesCheck): ResultadoCheck {
  const escribir = opts.escribir ?? true;
  const hallazgos: Hallazgo[] = [];
  const escrituras: string[] = [];
  const dir = opts.dir;

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    hallazgos.push({
      severidad: "ERROR", codigo: "TPL_PACKAGE_NOT_FOUND", puntero: `${dir}#$`,
      problema: `No existe el directorio del paquete "${dir}".`,
      sugerencia: "Apunta a `frontend/templates/<slug>/<version>/`, el directorio que contiene template.json.",
    });
    return { hallazgos, escrituras, ok: false };
  }

  // 2.1 Árbol exacto (01 §2.1). Cualquier cosa no listada hace fallar el registro con
  //     TPL_PACKAGE_UNEXPECTED_FILE: mejor enterarse aquí.
  const entradas = recorrer(dir);
  for (const nombre of FICHEROS_OBLIGATORIOS) {
    if (!entradas.some(e => e.ruta === nombre && !e.esDirectorio)) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_PACKAGE_MISSING_FILE", puntero: `${nombre}#$`,
        problema: `Falta el fichero obligatorio ${nombre} del paquete.`,
        sugerencia: `Un paquete son siempre ${FICHEROS_OBLIGATORIOS.join(", ")} más, si hace falta, assets/ y migrations/ (01 §2.1). Genera el esqueleto con \`plantilla nueva\`.`,
      });
    }
  }
  for (const e of entradas) {
    const raiz = e.ruta.split("/")[0]!;
    const permitido = e.esDirectorio
      ? (DIRECTORIOS_PERMITIDOS as readonly string[]).includes(e.ruta)
      : (FICHEROS_OBLIGATORIOS as readonly string[]).includes(e.ruta) ||
        ((DIRECTORIOS_PERMITIDOS as readonly string[]).includes(raiz) && e.ruta.split("/").length === 2);
    if (!permitido) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_PACKAGE_UNEXPECTED_FILE", puntero: `${e.ruta}#$`,
        problema: `El paquete contiene "${e.ruta}", que no está en el árbol permitido de 01 §2.1.`,
        sugerencia: "Un paquete sólo admite template.json, theme.json, defaults.json, assets/<archivo> (sin subdirectorios) y migrations/<archivo>.json. Saca ese archivo del directorio de la versión: el registro lo rechaza con TPL_PACKAGE_UNEXPECTED_FILE.",
      });
    }
  }
  if (hallazgos.some(h => h.codigo === "TPL_PACKAGE_MISSING_FILE")) {
    return { hallazgos: ordenar(hallazgos), escrituras, ok: false };
  }

  // 2.2 Los tres .json: UTF-8 sin BOM y sintaxis válida.
  const leidos = FICHEROS_OBLIGATORIOS.map(n => ({ nombre: n, leido: leerJson(join(dir, n)) }));
  for (const { nombre, leido } of leidos) {
    if (!leido.ok) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_PACKAGE_JSON_INVALID", puntero: `${nombre}#$`,
        problema: `${nombre} no es JSON válido en UTF-8 sin BOM: ${leido.error}.`,
        sugerencia: "Corrige la sintaxis (comas sobrantes, comillas simples, comentarios) y guarda en UTF-8 sin marca de orden de bytes.",
      });
    }
  }
  if (hallazgos.some(h => h.codigo === "TPL_PACKAGE_JSON_INVALID")) {
    return { hallazgos: ordenar(hallazgos), escrituras, ok: false };
  }
  const crudoManifiesto = leidos[0]!.leido.valor as Json;
  const crudoTema = leidos[1]!.leido.valor as Json;
  const crudoDefaults = leidos[2]!.leido.valor as Json;

  // 2.3 Diagnóstico propio de los bloques, ANTES de Zod (los tres fallos medidos).
  hallazgos.push(...revisarBloquesCrudos(crudoManifiesto));
  hallazgos.push(...revisarRutasDeAssets(crudoManifiesto));
  hallazgos.push(...revisarVariantes(crudoManifiesto));
  hallazgos.push(...revisarRolYSeccion(crudoManifiesto));

  // 2.4 Esquema. Sólo se emiten los issues de Zod que el diagnóstico propio NO cubre ya.
  const cubiertos = new Set(hallazgos.map(h => h.puntero));
  const manifiesto = TemplateManifest.safeParse(crudoManifiesto);
  if (!manifiesto.success) {
    for (const issue of manifiesto.error.issues) {
      const p = puntero(MANIFIESTO, ...issue.path.map(x => String(x)));
      if ([...cubiertos].some(c => p.startsWith(c))) continue;
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_MANIFEST_INVALID", puntero: p,
        problema: `${issue.message} (${issue.code}).`,
        sugerencia: sugerenciaDeIssue(issue.path.map(x => String(x)), crudoManifiesto),
      });
    }
  }
  const tema = ThemeSpec.safeParse(crudoTema);
  if (!tema.success) {
    for (const issue of tema.error.issues) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_THEME_INVALID",
        puntero: puntero(TEMA, ...issue.path.map(x => String(x))),
        problema: `${issue.message} (${issue.code}).`,
        sugerencia: "theme.json es `{palettes:[{id,name,tokens:{bg,surface,ink,accent,accentInk,muted}}], fontSets:[{id,name,heading,body}], defaultPaletteId, defaultFontSetId}` (01 §2.6). Los seis tokens son obligatorios y son `#rrggbb`.",
      });
    }
  }
  const defaults = DefaultsFile.safeParse(crudoDefaults);
  if (!defaults.success) {
    for (const issue of defaults.error.issues) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_DEFAULTS_INVALID",
        puntero: puntero(DEFAULTS, ...issue.path.map(x => String(x))),
        problema: `${issue.message} (${issue.code}).`,
        sugerencia: sugerenciaDeDefaults(issue.path.map(x => String(x)), crudoManifiesto),
      });
    }
  }

  // 2.42 Etiquetas que el andamio escribió y nadie sustituyó: se PUBLICAN (ADR-4-1C-01).
  hallazgos.push(...revisarEtiquetasDeAndamio(crudoManifiesto));

  // 2.45 Marca ajena en el contenido de demostración (ADR-4-8-01): sobre el JSON crudo, no espera
  // a que el esquema valide, porque para el esquema este texto siempre es válido.
  hallazgos.push(...revisarMarcaAjena(crudoDefaults));

  // 2.5 Assets: se MIDEN y se escriben (P5). Nada de digestos tecleados.
  if (manifiesto.success) {
    hallazgos.push(...revisarAssets(dir, crudoManifiesto, manifiesto.data, escribir, escrituras));
  }

  // 2.6 Invariantes del paquete (las 30, `validateManifest`).
  if (manifiesto.success && tema.success && defaults.success) {
    for (const v of validateManifest(manifiesto.data, tema.data, defaults.data)) {
      hallazgos.push({
        severidad: "ERROR", codigo: v.code, puntero: punteroDeViolacion(v, crudoManifiesto),
        problema: `Invariante ${v.code} incumplida en \`${v.path}\`${v.detail ? `: ${v.detail}` : ""}.`,
        sugerencia: ayudaDeInvariante(v, manifiesto.data as unknown as Json),
      });
    }
    // Coherencia de `defaults.json` con el manifiesto (el registro lo comprueba: TPL_PACKAGE_DEFAULTS_MISMATCH).
    if (defaults.data.templateSlug !== manifiesto.data.slug ||
        defaults.data.templateVersion !== manifiesto.data.version) {
      hallazgos.push({
        severidad: "ERROR", codigo: "TPL_PACKAGE_DEFAULTS_MISMATCH", puntero: puntero(DEFAULTS, "templateVersion"),
        problema: `defaults.json dice ${defaults.data.templateSlug}@${defaults.data.templateVersion} y el manifiesto dice ${manifiesto.data.slug}@${manifiesto.data.version}.`,
        sugerencia: `Pon \`"templateSlug": "${manifiesto.data.slug}"\` y \`"templateVersion": "${manifiesto.data.version}"\` en defaults.json.`,
      });
    }
  }

  // 2.7 Migraciones: exactamente una por cada `migrationsFrom` (01 §2.1).
  if (manifiesto.success) hallazgos.push(...revisarMigraciones(dir, manifiesto.data, entradas.map(e => e.ruta)));

  // 2.8 Contraste AA de las paletas.
  if (tema.success) hallazgos.push(...revisarContraste(crudoTema));

  // 2.9 Tipografías: sólo familias que la superficie pública AUTOALOJA (ADR-1R-F-07).
  if (tema.success) hallazgos.push(...revisarFuentes(crudoTema));

  const hash = manifiesto.success ? hashDelPaquete(dir, entradas.map(e => e.ruta)) : undefined;
  const ordenados = ordenar(hallazgos);
  const errores = ordenados.filter(h => h.severidad === "ERROR").length;
  const avisos = ordenados.filter(h => h.severidad === "AVISO").length;
  const ok = errores === 0 && (!opts.estricto || avisos === 0);
  return { hallazgos: ordenados, escrituras, ...(hash ? { packageHash: hash } : {}), ok };
}

/** Sugerencia para un issue de Zod que no cubre el diagnóstico propio. */
function sugerenciaDeIssue(camino: readonly string[], crudo: Json): string {
  if (camino[0] === "sections" && camino[2] === "blocks") {
    const s = ((crudo["sections"] as Json[] | undefined) ?? [])[Number(camino[1])];
    const b = ((s?.["blocks"] as Json[] | undefined) ?? [])[Number(camino[3])];
    const tipo = b && typeof b["type"] === "string" ? (b["type"] as string) : undefined;
    if (tipo && ROLES.length > 0) {
      const e = explainBlockSpec(b);
      return `${e.message} Ejemplo mínimo: ${ejemploMinimo(tipo)}`;
    }
  }
  if (camino[0] === "assets" && camino[2] === "id") {
    return `El \`id\` de una entrada de \`assets\` es el alias con el que defaults.json referencia esa imagen: ` +
      `\`as_\` seguido de ${ALFABETO_EN_PALABRAS}. Por ejemplo "as_${idDeEjemplo(camino.join("/"))}". ` +
      "Lo inventas tú (no hace falta que sea un ULID de verdad) y tiene que ser único en el paquete.";
  }
  const raiz = camino[0] ?? "";
  const forma = "template.json es `{manifestVersion:1, slug, version, name, eventKinds, locales, sections:[…]}` más los opcionales `description, minPlanTier, capabilities, previewImage, assets, migrationsFrom` (01 §2.2).";
  return raiz === "" ? forma : `Corrige \`${camino.join(".")}\`. ${forma}`;
}

/**
 * Sugerencia para un issue de Zod de `defaults.json`. La versión anterior repetía la forma general
 * del fichero y nada más: la bitácora 4-5 §4 midió que **no basta** (dos rondas de tanteo para
 * averiguar la forma de un `richText`). Ahora resuelve el tipo del bloque en el manifiesto y trae el
 * **ejemplo mínimo del valor**, igual que `TPL_BLOCK_SPEC_INVALID` trae el del `BlockSpec`.
 */
export function sugerenciaDeDefaults(camino: readonly string[], manifiesto: Json): string {
  const forma = "defaults.json es `{templateSlug, templateVersion, content:{ \"<blockId>\": <valor> }}`; el valor lleva `kind` igual al `type` del bloque.";
  if (camino[0] !== "content" || camino[1] === undefined) return forma;
  const ultimo = camino[camino.length - 1];
  if (ultimo === "itemId") {
    return `Cada ficha de un grupo lleva su \`itemId\`: ${ALFABETO_EN_PALABRAS}. ` +
      `Por ejemplo "${idDeEjemplo(camino.join("/"))}". Es lo que hace que al reordenar o regenerar ` +
      "no se pierda lo que escribiste en esa ficha (P2, merge por id estable), y no se ve en la invitación.";
  }
  if (ultimo === "assetId") {
    return `Un \`assetId\` es el alias de una imagen del propio paquete: \`as_\` seguido de ${ALFABETO_EN_PALABRAS}. ` +
      `Por ejemplo "as_${idDeEjemplo(camino.join("/"))}". Tiene que ser exactamente el mismo \`id\` que declaras ` +
      "en la entrada de `assets` de template.json; si no está declarado ahí, la imagen no resuelve (I-09).";
  }
  const resuelto = tipoDelValor(manifiesto, camino);
  if (resuelto === undefined) return forma;
  const info = describeBlockType(resuelto.tipo);
  return `El bloque "${resuelto.id}" es de tipo \`${resuelto.tipo}\`: ${info.summary} ` +
    `Campos obligatorios del valor: ${info.value.required.join(", ")}. ` +
    `Ejemplo mínimo, copiable tal cual en defaults.json: ${ejemploMinimoDeValor(resuelto.tipo)}. ` +
    `La forma de cualquier tipo de bloque, sin abrir código: \`pnpm plantilla bloque ${resuelto.tipo}\`.`;
}

/**
 * Tipo del valor al que apunta un camino de `defaults.json`, leído del manifiesto:
 * `content/<blockId>` es el bloque, y `content/<blockId>/items/<n>/values/<itemBlockId>` el bloque
 * de dentro de una ficha del grupo.
 */
function tipoDelValor(manifiesto: Json, camino: readonly string[]): { id: string; tipo: string } | undefined {
  const blockId = camino[1]!;
  for (const s of (manifiesto["sections"] as Json[] | undefined) ?? []) {
    for (const b of (s["blocks"] as Json[] | undefined) ?? []) {
      if (b["id"] !== blockId) continue;
      if (camino[2] === "items" && camino[4] === "values" && camino[5] !== undefined) {
        const ib = ((b["itemBlocks"] as Json[] | undefined) ?? [])
          .find(x => x["id"] === camino[5] || `${blockId}.${String(x["id"])}` === camino[5]);
        if (ib !== undefined && typeof ib["type"] === "string") {
          return { id: `${blockId} → ${String(ib["id"])}`, tipo: ib["type"] as string };
        }
        return undefined;
      }
      if (typeof b["type"] === "string") return { id: blockId, tipo: b["type"] as string };
    }
  }
  return undefined;
}

function ayudaDeInvariante(v: Violation, manifiesto: Json): string {
  const base = AYUDA_INVARIANTE[v.code] ??
    "consulta `diseno/01-dominio-y-esquema.md §2` para la forma exacta de este campo.";
  if (v.code === "I-10_DEFAULT_KEY_UNKNOWN") {
    const ids = ((manifiesto["sections"] as Array<{ blocks: Array<{ id: string }> }> | undefined) ?? [])
      .flatMap(s => s.blocks.map(b => b.id));
    const clave = v.path.replace(/^defaults\./, "");
    const cerca = suggestClosest(clave, ids, 3).map(s => s.value);
    return `${base}${cerca.length > 0 ? ` ¿Quisiste decir ${cerca.map(c => `"${c}"`).join(", ")}?` : ` Ids declarados: ${ids.join(", ")}.`}`;
  }
  return base;
}

// ---------------------------------------------------------------------------------------------
// 3. Assets.
// ---------------------------------------------------------------------------------------------
interface EntradaAsset { id?: string; path: string; sha256: string; contentType: string; bytes: number }

function revisarAssets(
  dir: string, crudo: Json, manifiesto: TemplateManifest, escribir: boolean, escrituras: string[],
): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const declarados = manifiesto.assets as readonly EntradaAsset[];
  const medidos = medirAssets(dir);
  const porRuta = new Map(medidos.map(m => [m.path, m]));
  let corregido = false;
  const nuevos: EntradaAsset[] = [];

  for (const [i, a] of declarados.entries()) {
    const p = puntero(MANIFIESTO, "assets", i);
    const m = porRuta.get(a.path);
    if (!m) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_ASSET_FILE_MISSING", puntero: `${p}/path`,
        problema: `El manifiesto declara "${a.path}" pero ese archivo no está en el paquete.`,
        sugerencia: `Copia el archivo a ${join(dir, a.path)} y vuelve a ejecutar \`plantilla check\` (mide el sha256 y los bytes por ti), o borra la entrada del manifiesto.`,
      });
      nuevos.push(a);
      continue;
    }
    if (!m.contentType) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_ASSET_CONTENT_TYPE_UNKNOWN", puntero: `${p}/contentType`,
        problema: `La extensión de "${a.path}" no está en el enum cerrado de AssetEntry.contentType.`,
        sugerencia: "Los tipos admitidos son image/webp, image/png, image/jpeg, image/svg+xml, audio/mpeg y font/woff2: convierte el archivo o quítalo del paquete.",
      });
      nuevos.push(a);
      continue;
    }
    const desviado = a.sha256 !== m.sha256 || a.bytes !== m.bytes || a.contentType !== m.contentType;
    if (desviado && escribir) {
      corregido = true;
      salida.push({
        severidad: "CORREGIDO", codigo: "TPL_ASSET_DIGEST_MEDIDO", puntero: p,
        problema: `Los datos declarados de "${a.path}" no coincidían con el archivo real y se han medido de nuevo.`,
        sugerencia: `Escrito sha256:${m.sha256.slice(0, 16)}… bytes:${m.bytes} contentType:${m.contentType}. Los digestos NUNCA se teclean (P5): los mide \`plantilla check\`.`,
      });
    } else if (desviado) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_ASSET_DIGEST_MISMATCH", puntero: p,
        problema: `El manifiesto declara "${a.path}" con sha256 ${a.sha256.slice(0, 16)}… y ${a.bytes} bytes, pero el archivo real es ${m.sha256.slice(0, 16)}… y ${m.bytes} bytes.`,
        sugerencia: `Ejecuta \`pnpm plantilla check ${dir}\` sin \`--no-escribir\` y el kit mide y escribe el digesto correcto; no lo teclees (P5). El registro rechaza el paquete con 422 TPL_PACKAGE_ASSET_MISMATCH.`,
      });
    }
    nuevos.push({ ...(a.id ? { id: a.id } : {}), path: a.path, sha256: m.sha256, contentType: m.contentType, bytes: m.bytes });
  }

  // Archivos presentes en `assets/` que el manifiesto no declara: el registro los rechaza (P1).
  for (const m of medidos) {
    if (!declarados.some(a => a.path === m.path)) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_PACKAGE_UNEXPECTED_FILE", puntero: `${m.path}#$`,
        problema: `El archivo "${m.path}" está en el paquete pero el manifiesto no lo declara.`,
        sugerencia: `Añade a \`assets\` la entrada {"path":"${m.path}","sha256":"${m.sha256}","contentType":"${m.contentType ?? "image/webp"}","bytes":${m.bytes}} o borra el archivo. Nada se ignora en silencio (P1).`,
      });
    }
  }

  // Alias de asset (I-09, ADR-3B-I09-01): únicos, y todo `assetId` de defaults.json declarado.
  const alias = declarados.map(a => a.id).filter((x): x is string => typeof x === "string");
  for (const [i, a] of declarados.entries()) {
    if (a.id && alias.filter(x => x === a.id).length > 1) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_ASSET_ALIAS_DUPLICATE", puntero: puntero(MANIFIESTO, "assets", i, "id"),
        problema: `Dos assets del manifiesto declaran el mismo alias "${a.id}".`,
        sugerencia: "Cada `AssetEntry.id` es único en el paquete: es la clave con la que `defaults.json` referencia la imagen.",
      });
    }
  }

  // previewImage: opcional, pero si está tiene que ser uno de los assets declarados (01 §2.2).
  const preview = manifiesto.previewImage;
  if (preview !== undefined && !declarados.some(a => a.path === preview)) {
    const cerca = suggestClosest(preview, declarados.map(a => a.path), 3).map(s => s.value);
    salida.push({
      severidad: "ERROR", codigo: "TPL_PREVIEW_IMAGE_NOT_DECLARED", puntero: puntero(MANIFIESTO, "previewImage"),
      problema: `previewImage apunta a "${preview}", que no está entre los ${declarados.length} assets declarados.`,
      sugerencia: cerca.length > 0
        ? `¿Quisiste decir "${cerca[0]}"? previewImage tiene que ser exactamente el \`path\` de una entrada de \`assets\`.`
        : "Declara primero la imagen en `assets` (el kit mide su sha256 y sus bytes) y luego apunta `previewImage` a ese mismo `path`.",
    });
  }

  if (corregido && escribir) {
    const nuevoManifiesto = { ...crudo, assets: nuevos };
    writeFileSync(join(dir, MANIFIESTO), serializar(nuevoManifiesto), "utf8");
    escrituras.push(MANIFIESTO);
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 4. Migraciones.
// ---------------------------------------------------------------------------------------------
function revisarMigraciones(
  dir: string, manifiesto: TemplateManifest, rutas: readonly string[],
): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const presentes = rutas.filter(r => r.startsWith("migrations/") && r.endsWith(".json"));
  const esperados = manifiesto.migrationsFrom.map(from => `migrations/${from}-to-${manifiesto.version}.json`);
  for (const [i, from] of manifiesto.migrationsFrom.entries()) {
    const esperado = esperados[i]!;
    if (!presentes.includes(esperado)) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_MIGRATION_PLAN_MISSING",
        puntero: puntero(MANIFIESTO, "migrationsFrom", i),
        problema: `El manifiesto declara migración desde ${from} pero falta ${esperado}.`,
        sugerencia: `Crea ${esperado} con \`{"templateSlug":"${manifiesto.slug}","from":"${from}","to":"${manifiesto.version}","ops":[]}\` y añade las operaciones que cubran lo que desaparece o se estrecha (01 §6.2). Ojo: es \`ops\`, no \`operations\`.`,
      });
      continue;
    }
    const leido = leerJson(join(dir, esperado));
    if (!leido.ok) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_MIGRATION_PLAN_INVALID", puntero: `${esperado}#$`,
        problema: `${esperado} no es JSON válido: ${leido.error}.`,
        sugerencia: "Corrige la sintaxis del plan de migración.",
      });
      continue;
    }
    const plan = MigrationPlan.safeParse(leido.valor);
    if (!plan.success) {
      for (const issue of plan.error.issues) {
        salida.push({
          severidad: "ERROR", codigo: "TPL_MIGRATION_PLAN_INVALID",
          puntero: puntero(esperado, ...issue.path.map(x => String(x))),
          problema: `${issue.message} (${issue.code}).`,
          sugerencia: "Un MigrationPlan es `{templateSlug, from, to, ops:[…]}` — NO `{from, to, operations}` (handoffs/4-0a.md §3.5). Las 11 operaciones están en 01 §6.2.",
        });
      }
      continue;
    }
    if (plan.data.templateSlug !== manifiesto.slug || plan.data.from !== from ||
        plan.data.to !== manifiesto.version) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_MIGRATION_PLAN_MISMATCH", puntero: `${esperado}#$`,
        problema: `El plan dice ${plan.data.templateSlug} ${plan.data.from}→${plan.data.to} y el nombre del archivo exige ${manifiesto.slug} ${from}→${manifiesto.version}.`,
        sugerencia: `Pon \`"templateSlug":"${manifiesto.slug}"\`, \`"from":"${from}"\` y \`"to":"${manifiesto.version}"\` dentro del plan.`,
      });
    }
  }
  for (const r of presentes) {
    if (!esperados.includes(r)) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_MIGRATION_PLAN_ORPHAN", puntero: `${r}#$`,
        problema: `${r} no corresponde a ninguna versión de \`migrationsFrom\`.`,
        sugerencia: `Añade "${basename(r).replace(`-to-${manifiesto.version}.json`, "")}" a \`migrationsFrom\` del manifiesto o borra el archivo: migrations/ lleva exactamente un plan por cada versión de origen (01 §2.1).`,
      });
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 5. Contraste.
// ---------------------------------------------------------------------------------------------
function revisarContraste(crudoTema: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const paletas = (crudoTema["palettes"] as Array<{ id: string; tokens: PaletteTokens }> | undefined) ?? [];
  for (const [i, p] of paletas.entries()) {
    const fallos = fallosDeContraste(p.tokens);
    if (fallos.length === 0) continue;
    const detalle = fallos
      .map(f => `${f.pair} ${f.hexA}/${f.hexB} = ${f.ratio.toFixed(2)}:1 < ${f.threshold.toFixed(1)}:1 (${f.reason})`)
      .join("; ");
    // Los fondos no se tocan: se oscurece la TINTA. Y se propone el hexadecimal exacto, calculado
    // con la misma fórmula, para que el autor no tenga que buscar un color a ojo.
    const aCorregir = [...new Set(
      fallos.flatMap(f => [f.a, f.b]).filter(t => t !== "bg" && t !== "surface" && t !== "accentInk"),
    )];
    const propuesta = aCorregir
      .map(t => {
        const nuevo = oscurecerHasta(p.tokens[t], [p.tokens.bg, p.tokens.surface], 4.5);
        return nuevo ? `${t}: ${p.tokens[t]} → ${nuevo}` : `${t}: ningún oscurecido cumple`;
      })
      .join("; ");
    salida.push({
      severidad: "ERROR", codigo: "TPL_PALETTE_CONTRAST_BELOW_AA", puntero: puntero(TEMA, "palettes", i, "tokens"),
      problema: `La paleta "${p.id}" incumple ${fallos.length} de las 9 parejas de contraste WCAG 2.2 AA: ${detalle}.`,
      sugerencia: `Oscurece la tinta, nunca bajes el umbral (contratos.md §12.4). Valores que sí cumplen, calculados con la misma fórmula: ${propuesta}.`,
    });
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 5-bis. Tipografías: sólo las familias que la superficie pública AUTOALOJA (ADR-1R-F-07).
//
// `apps/web/app/(public)/publico.css` es el ÚNICO sitio donde el producto autoaloja tipografías, y
// la superficie pública NUNCA pide una fuente a un tercero en tiempo de ejecución. Una plantilla que
// declara una familia que ese archivo no importa no se pinta con esa familia: se pinta con la pila
// de reserva (Georgia / la sans del sistema) y nada avisa. Eso es lo que midió
// `apps/web/test/fuentes-autoalojadas.test.ts` sobre el catálogo entero; aquí la MISMA compuerta
// llega al paquete suelto, antes de que entre al catálogo y antes de registrarlo.
//
// La lista NO se teclea: se DERIVA de los `@import "@fontsource/<familia>/<peso>.css"` de ese mismo
// `.css`, con el mismo patrón que usa esa prueba. Si mañana el producto autoaloja otra familia, esta
// compuerta la acepta sin que nadie edite este archivo. `FAMILIAS_AUTOALOJADAS_RESERVA` es sólo el
// valor de reserva de cuando el kit corre fuera del monorepo y no encuentra el `.css`;
// `check.test.ts` comprueba que coincide con lo que el `.css` declara de verdad, para que no pueda
// quedarse vieja en silencio.
// ---------------------------------------------------------------------------------------------

export interface FamiliaAutoalojada {
  readonly family: string;
  /** Los pesos que `publico.css` importa de verdad para esa familia, de menor a mayor. */
  readonly weights: readonly number[];
}

/** Valor de reserva: lo que `apps/web/app/(public)/publico.css` importaba al escribir esto. */
export const FAMILIAS_AUTOALOJADAS_RESERVA: readonly FamiliaAutoalojada[] = [
  { family: "Cormorant Garamond", weights: [400, 600] },
  { family: "Inter", weights: [400, 500] },
  { family: "Playfair Display", weights: [400, 700] },
  { family: "Source Sans 3", weights: [400, 600] },
];

const PUBLICO_CSS_REL = join("apps", "web", "app", "(public)", "publico.css");

/** `"source-sans-3"` → `"Source Sans 3"`: la inversa de la convención de nombre de Fontsource. */
export function familiaDeSlugFontsource(slug: string): string {
  return slug.split("-").filter(p => p.length > 0).map(p => p[0]!.toUpperCase() + p.slice(1)).join(" ");
}

/** `"Source Sans 3"` → `"source-sans-3"` (convención de nombre de paquete de Fontsource). */
export function slugFontsource(family: string): string {
  return family.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Los pares familia+peso de `@import "@fontsource/<familia>/<peso>.css"`, agrupados por familia. */
export function familiasDeCss(css: string): readonly FamiliaAutoalojada[] {
  const porFamilia = new Map<string, number[]>();
  for (const m of css.matchAll(/@import\s+"@fontsource\/([^"/]+)\/(\d+)\.css"/g)) {
    const familia = familiaDeSlugFontsource(m[1]!);
    const peso = Number(m[2]);
    const pesos = porFamilia.get(familia) ?? [];
    if (!pesos.includes(peso)) pesos.push(peso);
    porFamilia.set(familia, pesos);
  }
  return [...porFamilia.entries()]
    .map(([family, weights]) => ({ family, weights: [...weights].sort((a, b) => a - b) }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

/** Sube directorio a directorio buscando `apps/web/app/(public)/publico.css`. */
export function rutaPublicoCss(desde: string = import.meta.dirname): string | undefined {
  let dir = desde;
  for (let i = 0; i < 16; i++) {
    const candidato = join(dir, PUBLICO_CSS_REL);
    if (existsSync(candidato)) return candidato;
    const padre = dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  return undefined;
}

let cacheAutoalojadas: readonly FamiliaAutoalojada[] | undefined;

/** Las familias que el producto autoaloja HOY, leídas de `publico.css` (reserva si no se encuentra). */
export function familiasAutoalojadas(): readonly FamiliaAutoalojada[] {
  if (cacheAutoalojadas !== undefined) return cacheAutoalojadas;
  const ruta = rutaPublicoCss();
  const leidas = ruta === undefined ? [] : familiasDeCss(readFileSync(ruta, "utf8"));
  cacheAutoalojadas = leidas.length > 0 ? leidas : FAMILIAS_AUTOALOJADAS_RESERVA;
  return cacheAutoalojadas;
}

/**
 * Clase tipográfica: el criterio ESCRITO con el que se elige la familia autoalojada más cercana.
 * No hay forma automática de medir el parecido entre dos tipos de letra; se clasifica por familia
 * declarada y la clase dice, en una frase, qué se conserva y qué se pierde (ADR-4-6-01).
 */
export type ClaseTipografica =
  | "serif-old-style" | "serif-alto-contraste" | "sans-geometrica" | "sans-neogrotesca"
  | "sans-humanista" | "script";

/** Familias conocidas → su clase. Las 5 del catálogo legado y las que el kit ve de verdad. */
const CLASE_POR_FAMILIA: Readonly<Record<string, ClaseTipografica>> = {
  "cormorant garamond": "serif-old-style", "eb garamond": "serif-old-style", "garamond": "serif-old-style",
  "lora": "serif-old-style", "georgia": "serif-old-style", "times new roman": "serif-old-style",
  "crimson text": "serif-old-style",
  "playfair display": "serif-alto-contraste", "prata": "serif-alto-contraste",
  "bodoni moda": "serif-alto-contraste", "didot": "serif-alto-contraste",
  "poppins": "sans-geometrica", "montserrat": "sans-geometrica", "futura": "sans-geometrica",
  "raleway": "sans-geometrica",
  "inter": "sans-neogrotesca", "work sans": "sans-neogrotesca", "helvetica": "sans-neogrotesca",
  "arial": "sans-neogrotesca", "roboto": "sans-neogrotesca",
  "source sans 3": "sans-humanista", "open sans": "sans-humanista", "lato": "sans-humanista",
  "nunito sans": "sans-humanista", "pt sans": "sans-humanista",
  "great vibes": "script", "sacramento": "script", "dancing script": "script",
  "parisienne": "script", "allura": "script", "alex brush": "script",
};

/** Destino por clase, en orden de preferencia; se coge el primero que el producto autoaloje HOY. */
const DESTINO_POR_CLASE: Readonly<Record<ClaseTipografica, readonly string[]>> = {
  "serif-old-style": ["Cormorant Garamond", "Playfair Display"],
  "serif-alto-contraste": ["Playfair Display", "Cormorant Garamond"],
  "script": ["Cormorant Garamond", "Playfair Display"],
  "sans-geometrica": ["Inter", "Source Sans 3"],
  "sans-neogrotesca": ["Inter", "Source Sans 3"],
  "sans-humanista": ["Source Sans 3", "Inter"],
};

/** El motivo, escrito, de por qué esa clase va a esa familia. Se copia tal cual al informe. */
function motivoDeClase(clase: ClaseTipografica, original: string, destino: string): string {
  switch (clase) {
    case "script":
      return `«${original}» es una tipografía MANUSCRITA (script) y NINGUNA de las familias que el producto autoaloja lo es: no hay equivalente. Se sustituye por «${destino}», la serif de titular de trazo más caligráfico y mayor contraste de las autoalojadas; el titular pierde la letra manuscrita y hay que restaurarlo en la fase de arte.`;
    case "serif-old-style":
      return `«${original}» es una serif de eje humanista (old style); «${destino}» es la autoalojada de la misma clase.`;
    case "serif-alto-contraste":
      return `«${original}» es una serif de alto contraste (didona/transicional) de titular; «${destino}» es la autoalojada de la misma clase.`;
    case "sans-geometrica":
      return `«${original}» es una sans geométrica; entre las autoalojadas la más próxima en color de página y altura de x es «${destino}» (neogrotesca). Se pierde el trazo geométrico, no la legibilidad.`;
    case "sans-neogrotesca":
      return `«${original}» es una sans neogrotesca de texto; «${destino}» es la autoalojada de la misma clase.`;
    case "sans-humanista":
      return `«${original}» es una sans humanista de texto; «${destino}» es la autoalojada de la misma clase.`;
  }
}

export interface RemapeoDeFamilia {
  readonly original: string;
  readonly family: string;
  readonly weights: readonly number[];
  readonly clase: ClaseTipografica;
  /** `true` cuando la familia ORIGINAL ya la autoaloja el producto: no hay sustitución. */
  readonly yaAutoalojada: boolean;
  readonly motivo: string;
}

/**
 * La familia autoalojada más cercana a `familia`, con su motivo escrito y los pesos que el producto
 * importa de verdad para ella. Es la MISMA función que usa la sugerencia de `check` y el remapeo de
 * `@invitaciones/migration-legacy`: un solo criterio, escrito una sola vez (ADR-4-6-01).
 */
export function remapearAFamiliaAutoalojada(familia: string, rol: "heading" | "body"): RemapeoDeFamilia {
  const disponibles = familiasAutoalojadas();
  const catalogo = new Map(disponibles.map(f => [f.family, f.weights]));
  const pesosOriginal = catalogo.get(familia.trim());
  const claveConocida = CLASE_POR_FAMILIA[familia.trim().toLowerCase()];
  const clase: ClaseTipografica = claveConocida ?? (rol === "heading" ? "serif-old-style" : "sans-neogrotesca");
  if (pesosOriginal !== undefined) {
    return {
      original: familia, family: familia.trim(), weights: pesosOriginal, clase, yaAutoalojada: true,
      motivo: `«${familia.trim()}» ya la autoaloja la superficie pública (apps/web/app/(public)/publico.css): no se remapea.`,
    };
  }
  const destino = DESTINO_POR_CLASE[clase].find(f => catalogo.has(f)) ?? disponibles[0]?.family ?? "Inter";
  const motivoBase = claveConocida === undefined
    ? `«${familia.trim()}» no está clasificada en la tabla del kit; por su papel (${rol === "heading" ? "titular" : "texto"}) se le asigna la clase «${clase}». `
    : "";
  return {
    original: familia, family: destino, weights: catalogo.get(destino) ?? [400], clase, yaAutoalojada: false,
    motivo: motivoBase + motivoDeClase(clase, familia.trim(), destino),
  };
}

interface CaraDeclarada { readonly family?: unknown; readonly weights?: unknown }

function revisarFuentes(crudoTema: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const disponibles = familiasAutoalojadas();
  const catalogo = new Set(disponibles.map(f => f.family));
  const lista = disponibles.map(f => `${f.family} (${f.weights.join(", ")})`).join(", ");
  const sets = (crudoTema["fontSets"] as Array<{ id?: unknown; heading?: CaraDeclarada; body?: CaraDeclarada }> | undefined) ?? [];
  for (const [i, fs] of sets.entries()) {
    for (const rol of ["heading", "body"] as const) {
      const familia = fs[rol]?.family;
      if (typeof familia !== "string" || catalogo.has(familia)) continue;
      const sug = remapearAFamiliaAutoalojada(familia, rol);
      salida.push({
        severidad: "ERROR", codigo: "TPL_FONT_NOT_SELF_HOSTED",
        puntero: puntero(TEMA, "fontSets", i, rol, "family"),
        problema: `El fontSet "${String(fs.id)}" declara la familia "${familia}" en ${rol} y la superficie pública NO la autoaloja: esa invitación se pintaría con la pila de reserva (Georgia / la sans del sistema).`,
        sugerencia: `Familias autoalojadas hoy, con sus pesos, en apps/web/app/(public)/publico.css: ${lista}. La más cercana a "${familia}" es "${sug.family}" con pesos [${sug.weights.join(", ")}] — ${sug.motivo} Escríbela en theme.json, o autoaloja la original (\`pnpm add @fontsource/${slugFontsource(familia)}\` en apps/web y su \`@import\` en publico.css): la superficie pública nunca pide una fuente a un tercero en tiempo de ejecución (ADR-1R-F-07).`,
      });
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 6. Marca ajena en el contenido de demostración (ADR-4-8-01).
//
// El esquema no puede saber que un `text` es contenido legítimo: "Invitaciones Digitales Agape
// 2021. All Rights Reserved." valida perfectamente. Se coló en 10 de 11 plantillas (heredado del
// catálogo antiguo, `C-FOOTER-TEXT` en migration-legacy/src/reglas-contenido.ts copia el texto del
// pie sin sanear) y ninguna prueba lo cazaba. Esto SÍ lo caza: nombre del proveedor anterior y su
// dominio, buscados en cualquier cadena de `defaults.json`, no sólo en el pie.
// ---------------------------------------------------------------------------------------------
interface MarcaAjena { readonly patron: RegExp; readonly etiqueta: string }

const MARCAS_AJENAS: readonly MarcaAjena[] = [
  { patron: /agape/i, etiqueta: "el proveedor del catálogo antiguo («Invitaciones Digitales Agape»)" },
  { patron: /invitacionesdigitales/i, etiqueta: "un dominio del proveedor del catálogo antiguo («invitacionesdigitales…»)" },
];

/** Recorre cualquier cadena dentro del valor de un bloque de `defaults.json` buscando marca ajena. */
function buscarMarcaAjena(
  nodo: unknown, blockId: string, camino: ReadonlyArray<string | number>, salida: Hallazgo[],
): void {
  if (typeof nodo === "string") {
    const marca = MARCAS_AJENAS.find(m => m.patron.test(nodo));
    if (marca) {
      salida.push({
        severidad: "ERROR", codigo: "TPL_THIRD_PARTY_BRAND", puntero: puntero(DEFAULTS, ...camino),
        problema: `El contenido de demostración del bloque "${blockId}" menciona ${marca.etiqueta}: "${nodo}".`,
        sugerencia: "Lino & Sello es la marca del producto (D-02): quita la mención al proveedor anterior. Para un pie de invitación, escribe un texto neutro que no anuncie a nadie, por ejemplo \"Todos los derechos reservados\".",
      });
    }
    return;
  }
  if (Array.isArray(nodo)) {
    nodo.forEach((v, i) => buscarMarcaAjena(v, blockId, [...camino, i], salida));
    return;
  }
  if (nodo && typeof nodo === "object") {
    for (const [k, v] of Object.entries(nodo as Json)) buscarMarcaAjena(v, blockId, [...camino, k], salida);
  }
}

function revisarMarcaAjena(crudoDefaults: Json): readonly Hallazgo[] {
  const salida: Hallazgo[] = [];
  const contenido = crudoDefaults["content"];
  if (contenido && typeof contenido === "object") {
    for (const [blockId, valor] of Object.entries(contenido as Json)) {
      buscarMarcaAjena(valor, blockId, ["content", blockId], salida);
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------------------------
// 7. `package_hash` del paquete tal y como queda (01 §2.1).
// ---------------------------------------------------------------------------------------------
export function hashDelPaquete(dir: string, rutas: readonly string[]): string | undefined {
  const archivos: ArchivoDelPaquete[] = [];
  for (const ruta of [...rutas].sort()) {
    const completo = join(dir, ruta);
    if (!existsSync(completo) || !statSync(completo).isFile()) continue;
    if (ruta.endsWith(".json")) {
      const leido = leerJson(completo);
      if (!leido.ok) return undefined;
      archivos.push({ ruta, json: leido.valor });
    } else {
      archivos.push({ ruta, bytes: readFileSync(completo) });
    }
  }
  return packageHash(archivos);
}

export { sha256 };
