// src/hojas.ts — enumerador de hojas de F1.
//
// F1 es el JSON CRUDO del repositorio, leído con `JSON.parse` (ADR-1R-C-01). Está PROHIBIDO pasar por
// `EditorModels.kt`/`DefaultContentConfig.kt`: `@get:JsonIgnore` sobre el getter de un parámetro de
// constructor bloquea la propiedad también al deserializar, y por ahí se pierden 4 rutas de contenido
// visible (H-12): `sectionEvent.itemsSinglePlace`, `sectionSuggestions.items[].type`,
// `itinerary[].locationButton`/`.locationDatetime` y `story[].image`.
//
// Una HOJA es todo valor que no es un objeto ni un array con elementos: escalares, `null`, el array
// vacío y el objeto vacío. Los dos últimos se enumeran a propósito: si no, un `items: []` desaparecería
// en silencio y P1 prohíbe exactamente eso.

import { escaparSegmento, patronDe } from "./puntero.ts";

export type ValorHoja = string | number | boolean | null;
/** Marcadores para los contenedores vacíos, que son hojas pero no llevan valor escalar. */
export const ARRAY_VACIO = Symbol("array vacío");
export const OBJETO_VACIO = Symbol("objeto vacío");

export interface Hoja {
  /** Puntero RFC 6901 exacto (con índices). Es la clave de correlación (ADR-1R-C-02). */
  readonly puntero: string;
  /** Puntero con los índices de array sustituidos por `*`. Es la unidad del gate de cobertura. */
  readonly patron: string;
  readonly valor: ValorHoja | typeof ARRAY_VACIO | typeof OBJETO_VACIO;
  /**
   * `id` legado más cercano hacia la raíz (`b-f1`, `event-1`, `msj2`, y `null` en 3 de 9 ficheros).
   * SÓLO trazabilidad para el informe: nunca se convierte en `blockId` ni en `itemId` (ADR-1R-C-02).
   */
  readonly idLegado: string | null;
}

export type JsonValor = ValorHoja | JsonValor[] | { [k: string]: JsonValor };

function esObjeto(v: JsonValor): v is { [k: string]: JsonValor } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Enumera TODAS las hojas del documento. El orden es el de recorrido en profundidad siguiendo el orden
 * de claves del JSON, que es estable porque `JSON.parse` conserva el orden de inserción para claves no
 * numéricas; ninguna clave de los 18 ficheros es un entero, verificado por `test/hojas.test.ts`.
 */
export function enumerarHojas(raiz: JsonValor): Hoja[] {
  const out: Hoja[] = [];
  const rec = (n: JsonValor, ptr: string, esIndice: boolean[], idLegado: string | null): void => {
    if (Array.isArray(n)) {
      if (n.length === 0) { out.push(hoja(ptr, esIndice, ARRAY_VACIO, idLegado)); return; }
      n.forEach((v, i) => rec(v, `${ptr}/${i}`, [...esIndice, true], idLegado));
      return;
    }
    if (esObjeto(n)) {
      const claves = Object.keys(n);
      if (claves.length === 0) { out.push(hoja(ptr, esIndice, OBJETO_VACIO, idLegado)); return; }
      const propio = typeof n["id"] === "string" ? n["id"] : idLegado;
      for (const k of claves) rec(n[k]!, `${ptr}/${escaparSegmento(k)}`, [...esIndice, false], propio);
      return;
    }
    out.push(hoja(ptr, esIndice, n, idLegado));
  };
  rec(raiz, "", [], null);
  return out;
}

function hoja(ptr: string, esIndice: boolean[], valor: Hoja["valor"], idLegado: string | null): Hoja {
  return { puntero: ptr, patron: patronDe(ptr, esIndice), valor, idLegado };
}

/** Valor escalar de una hoja, o `undefined` si es un contenedor vacío. */
export function escalar(h: Hoja): ValorHoja | undefined {
  return h.valor === ARRAY_VACIO || h.valor === OBJETO_VACIO ? undefined : h.valor;
}

/** Texto no vacío de una hoja, o `null`. Es lo único que puede convertirse en contenido visible. */
export function texto(h: Hoja): string | null {
  const v = escalar(h);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
