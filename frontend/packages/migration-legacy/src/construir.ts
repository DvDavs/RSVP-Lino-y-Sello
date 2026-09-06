// src/construir.ts — `construirPaquete(templateId) → { manifest, theme, defaults, informeDePerdidas }`.
//
// El manifiesto es una FUNCIÓN de los datos legados, no una opinión: una sección se emite si su clave
// existe en F1 y un bloque se emite si al menos una hoja de F1 lo tiene como destino. Todo lo que no
// llega a un bloque acaba en una de las tres cubetas del informe, con su motivo escrito (P1).

import {
  DefaultsFile, TemplateManifest, ThemeSpec,
  type BlockSpec, type SectionSpec,
} from "@invitaciones/schema";
import { bloqueDe, SECCIONES, type BloqueCatalogo, type BloqueItemCatalogo } from "./catalogo.ts";
import type { HojaClasificada } from "./taxonomia.ts";
import { clasificarPlantilla, leerF1, type ClasificacionPlantilla, type F1 } from "./f1.ts";
import { ulidDeterminista } from "./hash.ts";
import { construirTema, type TemaConstruido } from "./tema.ts";
import { ErrorBloqueante, type EntradaAgregada, type EntradaPerdida, type InformePerdidas } from "./perdidas.ts";
import * as V from "./valores.ts";

export interface OpcionesConstruccion {
  readonly dirDatos: string;
  readonly version?: string;
  /** Decisiones de producto que desbloquean una regla `bloqueante` (`--decision <id>=<opcion>`). */
  readonly decisiones?: Readonly<Record<string, string>>;
}

export interface PaqueteConstruido {
  readonly slug: string;
  readonly version: string;
  readonly manifest: TemplateManifest;
  readonly theme: ThemeSpec;
  readonly defaults: DefaultsFile;
  readonly informeDePerdidas: InformePerdidas;
  /** Todas las hojas con su regla y su clase: es la prueba del gate de «cero patrones sin mapear». */
  readonly cobertura: readonly HojaClasificada[];
}

interface Contribucion {
  readonly hoja: HojaClasificada;
  readonly texto: string | null;
  readonly prioridad: number;
  readonly orden: readonly number[];
}

type Ranuras = Map<string, Contribucion[]>;
const clave = (blockId: string, item: string, itemBlock: string, campo: string): string =>
  `${blockId}\u0000${item}\u0000${itemBlock}\u0000${campo}`;

// -------------------------------------------------------------------------------------------------

export function construirPaquete(templateId: number, opciones: OpcionesConstruccion): PaqueteConstruido {
  const f1 = leerF1(templateId, opciones.dirDatos);
  const cls = clasificarPlantilla(f1);
  return construirDesde(f1, cls, opciones);
}

export function construirDesde(f1: F1, cls: ClasificacionPlantilla, opciones: OpcionesConstruccion): PaqueteConstruido {
  const version = opciones.version ?? "1.0.0";
  const decisiones = opciones.decisiones ?? {};
  const p = f1.plantilla;
  const hojas = [...cls.visual.hojas, ...cls.contenido.hojas];

  const sinMapear = cls.visual.resumen.patronesSinMapear.length + cls.contenido.resumen.patronesSinMapear.length;
  if (sinMapear > 0) {
    throw new Error(
      `GATE DE P1: ${sinMapear} patrón(es) de hoja sin clasificar (ADR-1R-C-01). No hay categoría comodín: ` +
      [...cls.visual.resumen.patronesSinMapear, ...cls.contenido.resumen.patronesSinMapear].join(", "),
    );
  }

  const aRevisar: EntradaPerdida[] = [];
  const bloqueantes: EntradaPerdida[] = [];
  const perdida = (h: HojaClasificada, cubeta: "a revisar" | "bloqueante", detalle?: string): EntradaPerdida => ({
    cubeta, legacyPointer: h.puntero, legacyId: h.idLegado, valor: h.valor,
    clasificacion: h.clase, reglaId: h.reglaId, motivo: h.motivo, evidencia: h.evidencia,
    ...(detalle ? { detalle } : {}), ...(h.decision ? { decision: h.decision } : {}),
  });

  // --- 1. bloqueantes de la tabla (sólo si REALMENTE hay valor: una hoja nula no es contenido) -----
  const decisionesPendientes = new Map<string, { opciones: readonly string[]; hojas: number }>();
  const bulletADetalle: HojaClasificada[] = [];
  for (const h of hojas) {
    if (h.clase !== "bloqueante") continue;
    const t = textoDe(h);
    if (t === null) continue;
    const d = h.decision;
    const elegida = d ? decisiones[d.id] : undefined;
    if (d && elegida !== undefined) {
      if (!d.opciones.includes(elegida)) {
        throw new Error(`--decision ${d.id}=${elegida} no es una opción declarada (${d.opciones.join("|")}).`);
      }
      if (elegida === "descartar") {
        aRevisar.push(perdida(h, "a revisar", `decisión del operador: ${d.id}=descartar`));
      } else {
        bulletADetalle.push(h);
      }
      continue;
    }
    if (d) {
      const prev = decisionesPendientes.get(d.id);
      decisionesPendientes.set(d.id, { opciones: d.opciones, hojas: (prev?.hojas ?? 0) + 1 });
    }
    bloqueantes.push(perdida(h, "bloqueante"));
  }

  // --- 2. ranuras ---------------------------------------------------------------------------------
  const ranuras: Ranuras = new Map();
  const itemsPorGrupo = new Map<string, string[]>();          // blockId → claves de ítem, en orden
  const idsLegadosPorItem = new Map<string, Set<string>>();   // `${blockId}\0${item}` → ids legados

  const anotaItem = (grupo: string, item: string): void => {
    const l = itemsPorGrupo.get(grupo) ?? [];
    if (!l.includes(item)) { l.push(item); itemsPorGrupo.set(grupo, l); }
  };

  for (const h of hojas) {
    const d = h.destino;
    if (!d) continue;
    if (d.tipo === "itemIdLegado") {
      const item = h.comodines[h.comodines.length - 1] ?? "0";
      anotaItem(d.ref, item);
      if (typeof h.valor === "string" && h.valor !== "") {
        const k = `${d.ref}\u0000${item}`;
        const s = idsLegadosPorItem.get(k) ?? new Set<string>();
        s.add(h.valor); idsLegadosPorItem.set(k, s);
      }
      continue;
    }
    const texto = textoDe(h);
    if (d.tipo === "bloque") {
      const orden = h.comodines.map(Number).filter((n) => Number.isFinite(n));
      empuja(ranuras, clave(d.ref, "", "", d.campo ?? "valor"), { hoja: h, texto, prioridad: h.prioridad, orden });
    } else if (d.tipo === "itemBloque") {
      const idx = d.itemIdx ?? h.comodines.length;
      const item = d.itemClave ?? h.comodines[idx - 1] ?? "0";
      anotaItem(d.ref, item);
      const orden = h.comodines.slice(idx).map(Number).filter((n) => Number.isFinite(n));
      empuja(ranuras, clave(d.ref, item, d.itemBlock, d.campo ?? "valor"), { hoja: h, texto, prioridad: h.prioridad, orden });
    }
  }
  for (const h of bulletADetalle) {
    // ADR propuesta 4-2-02: `bullet` ES el detalle de la regla de vestimenta.
    const item = h.comodines[h.comodines.length - 1] ?? "0";
    anotaItem("dressCode.rules", item);
    empuja(ranuras, clave("dressCode.rules", item, "detail", "valor"),
      { hoja: h, texto: textoDe(h), prioridad: 5, orden: [] });
  }

  // --- 3. qué bloques y qué secciones se emiten ---------------------------------------------------
  const refs = new Set<string>();
  for (const h of hojas) {
    const d = h.destino;
    if (d && (d.tipo === "bloque" || d.tipo === "itemBloque" || d.tipo === "itemIdLegado")) refs.add(d.ref);
  }
  const bloques: BloqueCatalogo[] = [];
  for (const ref of [...refs].sort()) {
    const b = bloqueDe(ref);
    if (b === null) {
      throw new Error(`La tabla de reglas manda a \`${ref}\` y \`catalogo.ts\` no lo declara. Los dos lados tienen que casar.`);
    }
    if (b.cohortes && !b.cohortes.includes(p.cohorte)) {
      throw new Error(`Cruce de cohortes: \`${ref}\` es de ${b.cohortes.join("/")} y la plantilla ${p.templateId} es ${p.cohorte}.`);
    }
    bloques.push(b);
  }

  // --- 4. defaults --------------------------------------------------------------------------------
  const anio = anioDeNegocio(hojas);
  const contenidoDefaults: Record<string, unknown> = {};
  const trazaDeItems: InformePerdidas["trazaDeItems"][number][] = [];
  const maxLenPorBloque = new Map<string, number>();

  for (const b of bloques) {
    if (b.tipo === "group") {
      const claves = ordenarItems(itemsPorGrupo.get(b.id) ?? []);
      const items: { itemId: string; values: Record<string, unknown> }[] = [];
      for (const [i, ck] of claves.entries()) {
        const itemId = ulidDeterminista(`${p.slug}|${version}|${b.id}|${i}`);
        trazaDeItems.push({
          grupo: b.id, indiceLegado: ck,
          legacyIds: [...(idsLegadosPorItem.get(`${b.id}\u0000${ck}`) ?? [])],
          itemId,
        });
        const values: Record<string, unknown> = {};
        for (const ib of b.itemBlocks ?? []) {
          const v = ensamblar(ib, ranuras, b.id, ck, anio, aRevisar, bloqueantes, maxLenPorBloque, `${b.id}.${ib.id}`, decisiones, decisionesPendientes);
          if (v !== undefined) values[ib.id] = v;
        }
        if (Object.keys(values).length > 0) items.push({ itemId, values });
      }
      if (items.length > 0) contenidoDefaults[b.id] = { kind: "group", items };
      continue;
    }
    if (b.fuente === "business") {
      // I-28: un `defaults.json` que traiga valor para un bloque `business` falla el registro.
      for (const c of contribuciones(ranuras, b.id, "", "", "*").filter((x) => x.texto !== null)) {
        aRevisar.push({
          cubeta: "a revisar", legacyPointer: c.hoja.puntero, legacyId: c.hoja.idLegado, valor: c.hoja.valor,
          clasificacion: c.hoja.clase, reglaId: c.hoja.reglaId, motivo: c.hoja.motivo, evidencia: c.hoja.evidencia,
          detalle: `bloque \`${b.id}\` con \`source:"business"\`: el valor se lee de Postgres y un default lo rechazaría el registro (I-28).`,
        });
      }
      continue;
    }
    const v = ensamblar(b, ranuras, b.id, "", anio, aRevisar, bloqueantes, maxLenPorBloque, b.id, decisiones, decisionesPendientes);
    if (v !== undefined) contenidoDefaults[b.id] = v;
  }

  if (bloqueantes.length > 0) throw new ErrorBloqueante(bloqueantes);

  // --- 5. manifiesto ------------------------------------------------------------------------------
  const seccionesConBloque = new Set(bloques.map((b) => b.seccion));
  const visiblePorSeccion = new Map<string, boolean>();
  const capacidades = new Set<string>();
  for (const h of hojas) {
    const d = h.destino;
    if (!d) continue;
    if (d.tipo === "estructura" && typeof h.valor === "boolean") visiblePorSeccion.set(d.seccion, h.valor);
    if (d.tipo === "capacidad" && h.valor === true) capacidades.add(d.capacidad);
  }
  if (refs.has("event.singlePlaceCards")) capacidades.add("singlePlace");
  if (refs.has("story.milestones")) capacidades.add("story");
  if (refs.has("gallery.hashtags")) capacidades.add("hashtags");
  if (refs.has("footer.music")) capacidades.add("music");

  const secciones: SectionSpec[] = [];
  for (const s of SECCIONES) {
    if (!seccionesConBloque.has(s.key)) continue;
    const bs = bloques.filter((b) => b.seccion === s.key).map((b) => aBlockSpec(b, maxLenPorBloque));
    if (bs.length === 0) continue;
    const visibleLegado = visiblePorSeccion.get(s.key);
    if (visibleLegado === false) {
      aRevisar.push({
        cubeta: "a revisar", legacyPointer: `/config/${s.legado}/visibility`, legacyId: null, valor: false,
        clasificacion: "mapeada", reglaId: "constructor", evidencia: "05 §4.3 decisión 1; H-24",
        motivo: "La plantilla legada marca la sección OCULTA, pero `mergeConfiguration` la pisa a `true` y es lo que el cliente ha estado viendo.",
        detalle: "Supuesto conservador tomado: `defaultVisible: true` (migrar no es el momento de cambiar el producto). Queda anotado para que el dueño decida.",
      });
    }
    const variantes: string[] = s.key === "event" && refs.has("event.singlePlaceCards")
      ? [...s.variantes] : s.variantes.filter((v) => v !== "single-place");
    secciones.push({
      key: s.key, type: s.tipo, title: { "es-MX": s.titulo },
      variants: variantes.length > 0 ? variantes : [s.variantePorDefecto],
      defaultVariant: s.variantePorDefecto,
      required: s.required, defaultVisible: true, blocks: bs,
    });
  }

  const manifest: TemplateManifest = TemplateManifest.parse({
    manifestVersion: 1, slug: p.slug, version,
    name: { "es-MX": p.nombre },
    description: { "es-MX": `Conversión del \`templateId\` ${p.templateId} (${p.slugLegado}) desde F1.` },
    eventKinds: [p.eventKind], minPlanTier: p.planId, locales: ["es-MX"],
    capabilities: [...capacidades].sort(),
    sections: secciones, assets: [], migrationsFrom: [],
  });

  // --- 6. tema ------------------------------------------------------------------------------------
  const tema = construirTema(entradaDeTema(cls), p.nombre);

  const defaults: DefaultsFile = DefaultsFile.parse({
    templateSlug: p.slug, templateVersion: version, content: contenidoDefaults,
  });
  const theme: ThemeSpec = ThemeSpec.parse(tema.theme);

  // --- 7. informe ---------------------------------------------------------------------------------
  const informe = armarInforme(f1, cls, version, tema, hojas, aRevisar, decisionesPendientes, trazaDeItems);
  return { slug: p.slug, version, manifest, theme, defaults, informeDePerdidas: informe, cobertura: hojas };
}

// -------------------------------------------------------------------------------------------------
// Ensamblado de valores
// -------------------------------------------------------------------------------------------------

function empuja(r: Ranuras, k: string, c: Contribucion): void {
  const l = r.get(k) ?? []; l.push(c); r.set(k, l);
}

function contribuciones(r: Ranuras, blockId: string, item: string, itemBlock: string, campo: string): Contribucion[] {
  if (campo !== "*") return r.get(clave(blockId, item, itemBlock, campo)) ?? [];
  const pref = `${blockId}\u0000${item}\u0000${itemBlock}\u0000`;
  return [...r.entries()].filter(([k]) => k.startsWith(pref)).flatMap(([, v]) => v);
}

function textoDe(h: HojaClasificada): string | null {
  if (typeof h.valor !== "string") return null;
  const t = h.valor.trim();
  return t === "" ? null : t;
}

/**
 * Elige la contribución ganadora de una ranura: mayor prioridad, y a igualdad el orden del recorrido.
 * Las que pierden con un texto DISTINTO no se tiran: van a «a revisar» con los dos punteros (P1).
 */
function ganadora(cs: readonly Contribucion[], aRevisar: EntradaPerdida[]): Contribucion | null {
  const conTexto = cs.filter((c) => c.texto !== null);
  if (conTexto.length === 0) return null;
  const orden = [...conTexto].sort((a, b) => b.prioridad - a.prioridad);
  const g = orden[0]!;
  for (const c of orden.slice(1)) {
    if (V.normalizarVisible(c.texto!) === V.normalizarVisible(g.texto!)) continue;
    aRevisar.push({
      cubeta: "a revisar", legacyPointer: c.hoja.puntero, legacyId: c.hoja.idLegado, valor: c.hoja.valor,
      clasificacion: c.hoja.clase, reglaId: c.hoja.reglaId, motivo: c.hoja.motivo, evidencia: c.hoja.evidencia,
      detalle: `COLISIÓN de fuentes en la misma ranura: gana ${g.hoja.puntero} = ${JSON.stringify(g.hoja.valor)} (prioridad ${g.prioridad} frente a ${c.prioridad}). Este valor NO se pierde en silencio: queda aquí para que el dueño decida.`,
    });
  }
  return g;
}

/** Todas las contribuciones del grupo de reglas ganador, en el orden de los comodines (listas). */
function listaGanadora(cs: readonly Contribucion[], aRevisar: EntradaPerdida[]): Contribucion[] {
  const conTexto = cs.filter((c) => c.texto !== null);
  if (conTexto.length === 0) return [];
  const maxP = Math.max(...conTexto.map((c) => c.prioridad));
  const gana = conTexto.filter((c) => c.prioridad === maxP)
    .sort((a, b) => compararOrden(a.orden, b.orden));
  for (const c of conTexto.filter((c) => c.prioridad !== maxP)) {
    if (gana.some((g) => V.normalizarVisible(g.texto!) === V.normalizarVisible(c.texto!))) continue;
    aRevisar.push({
      cubeta: "a revisar", legacyPointer: c.hoja.puntero, legacyId: c.hoja.idLegado, valor: c.hoja.valor,
      clasificacion: c.hoja.clase, reglaId: c.hoja.reglaId, motivo: c.hoja.motivo, evidencia: c.hoja.evidencia,
      detalle: `Lista con dos fuentes: gana la de prioridad ${maxP}. Este elemento queda anotado en vez de perderse.`,
    });
  }
  return gana;
}

function compararOrden(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? -1) - (b[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

type DefBloque = BloqueCatalogo | BloqueItemCatalogo;

/**
 * Decisiones de producto que puede destapar el CONSTRUCTOR (no la tabla): un `listText` legado con más
 * de 12 elementos o con un elemento de más de 200 caracteres no cabe en el catálogo cerrado
 * (`ListTextValue`, I-04/I-16). Por defecto BLOQUEA (05 §4.3 decisión 4: nunca se descarta en
 * silencio) y el operador la resuelve con `--decision`.
 */
export const DECISIONES_DEL_CONSTRUCTOR = {
  "listtext-mas-de-12": ["recortar-a-12"],
  "listtext-elemento-largo": ["omitir-elemento", "recortar-a-200"],
} as const;

function ensamblar(
  b: DefBloque, r: Ranuras, blockId: string, item: string, anio: number | null,
  aRevisar: EntradaPerdida[], bloqueantes: EntradaPerdida[], maxLen: Map<string, number>, claveLongitud: string,
  decisiones: Readonly<Record<string, string>>, pendientes: Map<string, { opciones: readonly string[]; hojas: number }>,
): unknown {
  const esItem = "id" in b && blockId !== b.id;
  const itemBlock = esItem ? b.id : "";
  const c = (campo: string): Contribucion[] => contribuciones(r, blockId, item, itemBlock, campo);
  const marca = (x: Contribucion, detalle: string, cubeta: "a revisar" | "bloqueante" = "a revisar"): void => {
    const e: EntradaPerdida = {
      cubeta, legacyPointer: x.hoja.puntero, legacyId: x.hoja.idLegado, valor: x.hoja.valor,
      clasificacion: x.hoja.clase, reglaId: x.hoja.reglaId, motivo: x.hoja.motivo, evidencia: x.hoja.evidencia, detalle,
    };
    (cubeta === "bloqueante" ? bloqueantes : aRevisar).push(e);
  };

  switch (b.tipo) {
    case "text": {
      const g = ganadora(c("valor"), aRevisar);
      if (!g) return undefined;
      const s = g.texto!;
      if (s.length > 2000) { marca(g, `texto de ${s.length} caracteres: \`TextValue\` admite 2000 (I-16)`, "bloqueante"); return undefined; }
      maxLen.set(claveLongitud, Math.max(maxLen.get(claveLongitud) ?? 0, s.length));
      return { kind: "text", value: s };
    }
    case "richText": {
      const cs = listaGanadora(c("valor"), aRevisar);
      if (cs.length === 0) return undefined;
      const conv = V.richDoc(cs.map((x) => x.texto!));
      if (conv.valor === null) { marca(cs[0]!, conv.motivo!); return undefined; }
      return { kind: "richText", doc: conv.valor };
    }
    case "listText": {
      const cs = listaGanadora(c("valor"), aRevisar);
      if (cs.length === 0) return undefined;
      let restantes = cs;
      if (restantes.length > 12) {
        const d = "listtext-mas-de-12";
        if (decisiones[d] === "recortar-a-12") {
          for (const x of restantes.slice(12)) marca(x, `decisión del operador ${d}=recortar-a-12: el elemento no entra en \`ListTextValue\` (máximo 12, I-04)`);
          restantes = restantes.slice(0, 12);
        } else {
          anotaPendiente(pendientes, d, restantes.length - 12);
          marca(cs[0]!, `${restantes.length} elementos: \`ListTextValue\` admite 12 (I-04). Se desbloquea con --decision ${d}=recortar-a-12, o ampliando el spec por ADR.`, "bloqueante");
          return undefined;
        }
      }
      const items: string[] = [];
      for (const x of restantes) {
        const t = x.texto!;
        if (t.length <= 200) { items.push(t); continue; }
        const d = "listtext-elemento-largo";
        if (decisiones[d] === "recortar-a-200") { marca(x, `decisión del operador ${d}=recortar-a-200: elemento de ${t.length} caracteres recortado`); items.push(t.slice(0, 200)); }
        else if (decisiones[d] === "omitir-elemento") { marca(x, `decisión del operador ${d}=omitir-elemento: elemento de ${t.length} caracteres omitido del default`); }
        else {
          anotaPendiente(pendientes, d, 1);
          marca(x, `elemento de ${t.length} caracteres: el máximo de \`ListTextValue\` es 200 (I-16). Se desbloquea con --decision ${d}=omitir-elemento|recortar-a-200, o ampliando el spec por ADR.`, "bloqueante");
          return undefined;
        }
      }
      return items.length > 0 ? { kind: "listText", items } : undefined;
    }
    case "image": case "audio": {
      for (const x of c("url").filter((x) => x.texto !== null)) {
        marca(x, "URL externa de F1. NO se descarga (el proxy de este entorno bloquea los bancos de imágenes) y el documento no admite URLs: sólo `assetId` opaco (ADR-021). El bloque queda sin default (`provenance:\"empty\"`, R5) hasta que se suba el archivo por la ruta HTTP de assets.");
      }
      return undefined;
    }
    case "date": {
      const g = ganadora([...c("iso"), ...c("textoLibre")], aRevisar);
      if (!g) return undefined;
      const conv = V.fechaEs(g.texto!, anio);
      if (conv.valor === null) { marca(g, conv.motivo!); return undefined; }
      return { kind: "date", value: conv.valor };
    }
    case "time": {
      const g = ganadora(c("valor"), aRevisar);
      if (!g) return undefined;
      const conv = V.hora(g.texto!);
      if (conv.valor === null) { marca(g, conv.motivo!); return undefined; }
      return { kind: "time", value: conv.valor };
    }
    case "dateTimeRange": {
      const fecha = ganadora([...c("diaTexto"), ...c("mesTexto")].length > 0
        ? [combinarFecha(c("diaTexto"), c("mesTexto"))].filter((x): x is Contribucion => x !== null) : [], aRevisar);
      const ini = ganadora(c("horaInicio"), aRevisar);
      const fin = ganadora(c("horaFin"), aRevisar);
      if (!fecha) { if (ini) marca(ini, "hay hora pero no fecha: un `dateTimeRange` exige `YYYY-MM-DDTHH:mm` y no se inventa la fecha (R5)"); return undefined; }
      const cf = V.fechaEs(fecha.texto!, anio);
      if (cf.valor === null) { marca(fecha, cf.motivo!); return undefined; }
      const ci = ini ? V.hora(ini.texto!) : { valor: "00:00" as string | null };
      if (ci.valor === null) { marca(ini!, ci.motivo!); return undefined; }
      const out: Record<string, unknown> = { kind: "dateTimeRange", start: `${cf.valor}T${ci.valor}` };
      if (fin) {
        const cff = V.hora(fin.texto!);
        if (cff.valor === null) marca(fin, cff.motivo!);
        else if (cff.valor < ci.valor) marca(fin, `I-01 exige \`end >= start\` y el legado trae ${JSON.stringify(fin.hoja.valor)} antes de ${ci.valor}`);
        else out["end"] = `${cf.valor}T${cff.valor}`;
      }
      return out;
    }
    case "link": {
      const g = ganadora(c("href"), aRevisar);
      if (!g) return undefined;
      const conv = V.urlHttp(g.texto!);
      if (conv.valor === null) { marca(g, conv.motivo!); return undefined; }
      return { kind: "link", href: conv.valor };
    }
    case "location": {
      const n = ganadora(c("nombre"), aRevisar);
      const m = ganadora(c("mapHref"), aRevisar);
      if (!n) { if (m) marca(m, "hay enlace al mapa pero no nombre de lugar: `LocationValue.name` es obligatorio (1..120) y no se inventa (R5)"); return undefined; }
      const nombre = n.texto!.slice(0, 120);
      if (n.texto!.length > 120) marca(n, `nombre de lugar de ${n.texto!.length} caracteres recortado a 120 (\`LocationValue.name\`)`);
      const out: Record<string, unknown> = { kind: "location", name: nombre };
      if (m) {
        const conv = V.urlHttp(m.texto!);
        if (conv.valor === null) marca(m, conv.motivo!); else out["mapHref"] = conv.valor;
      }
      return out;
    }
    case "choice": {
      const g = ganadora(c("opcion"), aRevisar);
      if (!g) return undefined;
      const conv = b.rol === "hashtagPlatform" ? V.plataformaDeIcono(g.texto!) : V.tipoRegalo(g.texto!);
      if (conv.valor === null) { marca(g, conv.motivo!); return undefined; }
      const ids = (b.opciones ?? []).map((o) => o.id);
      if (!ids.includes(conv.valor)) { marca(g, `la opción \`${conv.valor}\` no está declarada en el \`ChoiceSpec\` (I-02)`); return undefined; }
      return { kind: "choice", optionId: conv.valor };
    }
    case "boolean": {
      const cs = c("valor");
      const b0 = cs.find((x) => typeof x.hoja.valor === "boolean");
      return b0 ? { kind: "boolean", value: b0.hoja.valor as boolean } : undefined;
    }
    case "person": {
      const g = ganadora(c("nombre"), aRevisar);
      if (!g) return undefined;
      if (g.texto!.length > 120) { marca(g, `nombre de ${g.texto!.length} caracteres: \`PersonValue.name\` admite 120`); return undefined; }
      return { kind: "person", name: g.texto! };
    }
    default: return undefined;
  }
}

/** Une `"Miércoles 31"` + `"Diciembre"` en una sola cadena para `fechaEs`. */
function combinarFecha(dia: readonly Contribucion[], mes: readonly Contribucion[]): Contribucion | null {
  const d = dia.find((x) => x.texto !== null);
  const m = mes.find((x) => x.texto !== null);
  if (!d && !m) return null;
  const base = d ?? m!;
  return { ...base, texto: [d?.texto, m?.texto].filter((x) => x != null).join(", ") };
}

/** Año de `invitation.date` (`/date` del fichero de contenido) para las fechas legadas sin año. */
function anioDeNegocio(hojas: readonly HojaClasificada[]): number | null {
  const h = hojas.find((x) => x.destino?.tipo === "negocio" && x.destino.campo === "invitation.date");
  if (!h || typeof h.valor !== "string") return null;
  const m = /^(\d{4})-/.exec(h.valor);
  return m ? Number(m[1]) : null;
}

function anotaPendiente(m: Map<string, { opciones: readonly string[]; hojas: number }>, id: string, n: number): void {
  const opciones = DECISIONES_DEL_CONSTRUCTOR[id as keyof typeof DECISIONES_DEL_CONSTRUCTOR];
  const prev = m.get(id);
  m.set(id, { opciones, hojas: (prev?.hojas ?? 0) + n });
}

function ordenarItems(claves: readonly string[]): string[] {
  const numericas = claves.every((c) => /^\d+$/.test(c));
  return numericas ? [...claves].sort((a, b) => Number(a) - Number(b)) : [...claves];
}

// -------------------------------------------------------------------------------------------------

function aBlockSpec(b: BloqueCatalogo, maxLen: Map<string, number>): BlockSpec {
  const base: Record<string, unknown> = {
    id: b.id, type: b.tipo, role: b.rol, label: { "es-MX": b.etiqueta },
    required: b.requerido ?? false, editable: b.editable ?? true,
    source: b.fuente ?? "user", aiEditable: b.fuente === "business" || b.fuente === "fixed" ? false : true,
  };
  if (b.ayuda) base["help"] = { "es-MX": b.ayuda };
  if (b.campoNegocio) base["businessField"] = b.campoNegocio;
  aplicarRestricciones(base, b, maxLen, b.id);
  if (b.tipo === "group") {
    base["min"] = 0;
    base["max"] = b.maxItems ?? 12;
    base["reorderable"] = true;
    base["itemLabel"] = { "es-MX": b.etiquetaItem ?? "Elemento" };
    base["itemBlocks"] = (b.itemBlocks ?? []).map((ib) => {
      const s: Record<string, unknown> = {
        id: ib.id, type: ib.tipo, role: ib.rol, label: { "es-MX": ib.etiqueta },
        required: false, editable: true, source: "user", aiEditable: true,
      };
      aplicarRestricciones(s, ib, maxLen, `${b.id}.${ib.id}`);
      return s;
    });
  }
  return base as unknown as BlockSpec;
}

function aplicarRestricciones(s: Record<string, unknown>, b: DefBloque, maxLen: Map<string, number>, claveLongitud: string): void {
  const medido = maxLen.get(claveLongitud) ?? 0;
  if (b.tipo === "text") {
    const declarado = ("maxLength" in b ? b.maxLength : undefined) ?? 200;
    const max = Math.min(2000, Math.max(declarado, Math.ceil(medido / 50) * 50));
    s["constraints"] = { minLength: 0, maxLength: max, multiline: ("multilinea" in b && b.multilinea) === true };
  } else if (b.tipo === "richText") {
    s["constraints"] = { maxLength: 8000 };
  } else if (b.tipo === "listText") {
    s["constraints"] = { minItems: 0, maxItems: 12, maxItemLength: 200 };
  } else if (b.tipo === "image") {
    s["constraints"] = { aspect: "free", maxBytes: 8388608 };
  } else if (b.tipo === "audio") {
    s["constraints"] = { maxBytes: 8388608 };
  } else if (b.tipo === "date" || b.tipo === "time" || b.tipo === "dateTimeRange") {
    s["formatId"] = b.formatId ?? (b.tipo === "date" ? "long" : b.tipo === "time" ? "h12" : "long-h12");
  } else if (b.tipo === "choice") {
    s["options"] = (b.opciones ?? []).map((o) => ({ id: o.id, label: { "es-MX": o.etiqueta } }));
  }
}

function entradaDeTema(cls: ClasificacionPlantilla) {
  const hojas = cls.visual.hojas;
  const arr = (prefijo: string): number[] | null => {
    const xs = hojas.filter((h) => h.puntero.startsWith(prefijo) && typeof h.valor === "number");
    return xs.length >= 3 ? xs.map((h) => h.valor as number) : null;
  };
  const fondos = new Map<string, number[]>();
  for (const h of hojas) {
    const m = /^\/config\/(section\w+)\/backgroundColor\/content\/(\d+)$/.exec(h.puntero);
    if (!m || typeof h.valor !== "number") continue;
    const l = fondos.get(m[1]!) ?? []; l[Number(m[2])] = h.valor; fondos.set(m[1]!, l);
  }
  const familias = new Map<string, { veces: number; enTitulo: number }>();
  for (const h of hojas) {
    if (!h.puntero.endsWith("/fontFamily") || typeof h.valor !== "string" || h.valor === "") continue;
    const f = familias.get(h.valor) ?? { veces: 0, enTitulo: 0 };
    f.veces++;
    // Titular = la familia de los títulos DE SECCIÓN (`/config/sectionX/title|heading/fontFamily`).
    // Los títulos de TARJETA (`items/*/title`) no cuentan: en las 9 plantillas usan la fuente de texto,
    // y contarlos invertía el juego (medido: «Poppins» como titular y «Great Vibes» como cuerpo) [V].
    if (/^\/config\/section\w+\/(title|heading)\/fontFamily$/.test(h.puntero)) f.enTitulo++;
    familias.set(h.valor, f);
  }
  return {
    primario: arr("/config/settings/primaryColor/"),
    secundario: arr("/config/settings/secondaryColor/"),
    fondos: [...fondos.values()],
    fuentes: [...familias.entries()].map(([familia, f]) => ({ familia, ...f })),
  };
}

function armarInforme(
  f1: F1, cls: ClasificacionPlantilla, version: string, tema: TemaConstruido,
  hojas: readonly HojaClasificada[], aRevisar: readonly EntradaPerdida[],
  decisiones: ReadonlyMap<string, { opciones: readonly string[]; hojas: number }>,
  trazaDeItems: InformePerdidas["trazaDeItems"],
): InformePerdidas {
  const agregadas = new Map<string, EntradaAgregada>();
  for (const h of hojas) {
    if (h.clase === "mapeada") continue;
    if (h.clase === "bloqueante") continue;
    const k = `${h.reglaId}\u0000${h.patron}`;
    const a = agregadas.get(k);
    if (a) {
      agregadas.set(k, { ...a, hojas: a.hojas + 1,
        ejemplos: a.ejemplos.length < 3 && h.valor !== null
          ? [...a.ejemplos, { legacyPointer: h.puntero, legacyId: h.idLegado, valor: h.valor }] : a.ejemplos });
    } else {
      agregadas.set(k, {
        reglaId: h.reglaId, patron: h.patron, clasificacion: h.clase, motivo: h.motivo, evidencia: h.evidencia,
        hojas: 1, ejemplos: h.valor !== null ? [{ legacyPointer: h.puntero, legacyId: h.idLegado, valor: h.valor }] : [],
      });
    }
  }
  const p = f1.plantilla;
  const r1 = cls.visual.resumen, r2 = cls.contenido.resumen;
  return {
    plantilla: { templateId: p.templateId, slug: p.slug, version, nombre: p.nombre, cohorte: p.cohorte },
    fuentes: [f1.rutaVisual, f1.rutaContenido],
    generadoPor: "@invitaciones/migration-legacy (ADR-1R-C-01/02/03): F1 leído con JSON.parse, jamás por EditorModels.kt",
    resumen: {
      hojasTotales: r1.hojas + r2.hojas,
      mapeadas: r1.mapeadas + r2.mapeadas,
      presentacion: r1.presentacion + r2.presentacion,
      descartadas: r1.descartadas + r2.descartadas,
      patronesSinMapear: r1.patronesSinMapear.length + r2.patronesSinMapear.length,
      aceptadas: [...agregadas.values()].reduce((n, a) => n + a.hojas, 0),
      aRevisar: aRevisar.length,
      bloqueantes: 0,
    },
    criterioDelTema: tema.comentario,
    contrasteMedido: tema.contraste,
    correccionesDeColor: tema.correcciones,
    aceptada: [...agregadas.values()].sort((a, b) => a.patron.localeCompare(b.patron)),
    aRevisar: [...aRevisar].sort((a, b) => a.legacyPointer.localeCompare(b.legacyPointer)),
    bloqueante: [],
    decisionesPendientes: [...decisiones.entries()].map(([id, d]) => ({ id, opciones: d.opciones, hojas: d.hojas })),
    trazaDeItems,
  };
}
