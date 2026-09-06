// src/puntero.ts — punteros RFC 6901 y el lenguaje de patrones con el que se escriben las reglas.
//
// La clave de correlación legado→nuevo es el PUNTERO de la hoja, nunca el `id` legado
// (ADR-1R-C-02: entre 20 y 103 ids duplicados por fichero y `id: null` en 3 de 9).
//
// Lenguaje de patrones (deliberadamente pequeño, para que la tabla de reglas sea legible):
//   `nombre`  segmento literal
//   `*`       exactamente un segmento (normalmente un índice de array); SE CAPTURA
//   `**`      uno o más segmentos, en cualquier posición; NO se captura
// No hay alternancia ni expresiones regulares: una regla que necesite dos formas se escribe dos veces,
// porque cada patrón lleva su decisión escrita y dos decisiones distintas no caben en una fila.
// `**` no captura a propósito: con dos `**` en el mismo patrón el reparto sería ambiguo, y una regla
// ambigua no es auditable.

/** RFC 6901 §4: `~` → `~0` y `/` → `~1`. */
export function escaparSegmento(seg: string): string {
  return seg.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Inversa de `escaparSegmento`. El orden importa: `~1` antes que `~0`. */
export function desescaparSegmento(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Construye un puntero RFC 6901 a partir de sus segmentos ya sin escapar. */
export function puntero(segmentos: readonly string[]): string {
  return segmentos.map((s) => "/" + escaparSegmento(s)).join("");
}

/** Parte un puntero RFC 6901 en segmentos desescapados. `""` (documento entero) → `[]`. */
export function segmentosDe(ptr: string): string[] {
  if (ptr === "") return [];
  if (!ptr.startsWith("/")) throw new Error(`Puntero RFC 6901 inválido (no empieza por "/"): ${ptr}`);
  return ptr.slice(1).split("/").map(desescaparSegmento);
}

/** Resultado de casar un puntero contra un patrón: los segmentos que capturó cada `*`. */
export interface Captura {
  /** Valor de cada `*` del patrón, en orden de aparición. */
  readonly comodines: readonly string[];
}

/**
 * Casa un puntero contra un patrón. Devuelve `null` si no casa.
 * Recursivo por `**` (uno o más segmentos). Los patrones de las tablas tienen a lo sumo dos `**`, así
 * que la explosión combinatoria no es un problema y el código se lee.
 */
export function casar(patron: string, ptr: string): Captura | null {
  const p = patron === "" ? [] : patron.slice(1).split("/");
  const s = ptr === "" ? [] : ptr.slice(1).split("/");
  const comodines: string[] = [];
  const rec = (i: number, j: number): boolean => {
    if (i === p.length) return j === s.length;
    const tok = p[i]!;
    if (tok === "**") {
      for (let k = j + 1; k <= s.length; k++) if (rec(i + 1, k)) return true;
      return false;
    }
    if (j >= s.length) return false;
    if (tok === "*") {
      comodines.push(desescaparSegmento(s[j]!));
      if (rec(i + 1, j + 1)) return true;
      comodines.pop();
      return false;
    }
    return tok === s[j] && rec(i + 1, j + 1);
  };
  return rec(0, 0) ? { comodines } : null;
}

/**
 * Patrón de un puntero concreto: cada segmento que es un índice de array se sustituye por `*`.
 * Es la unidad que cuenta el gate de «cero patrones sin mapear» de `ADR-1R-C-01`: 3 830 hojas de
 * `default_visual_bautizo.json` colapsan a 1 151 patrones, y es sobre patrones sobre lo que se
 * escribe una decisión.
 */
export function patronDe(ptr: string, esIndice: readonly boolean[]): string {
  const segs = ptr === "" ? [] : ptr.slice(1).split("/");
  return segs.map((s, i) => (esIndice[i] ? "*" : s)).map((s) => "/" + s).join("");
}

/**
 * Sustituye `{1}`, `{2}`… por el comodín correspondiente (1-based) de la captura, y `{1+1}` por ese
 * comodín MÁS uno. La forma `+1` existe porque los índices de array del legado son 0-based y los
 * grupos del paquete se numeran desde 1 (`family.group1`, `family.group2`), que es como los nombran
 * las reglas del fichero de contenido (`/family/parents` → primer grupo).
 */
export function expandir(plantilla: string, cap: Captura): string {
  return plantilla.replace(/\{(\d+)(?:\+(\d+))?\}/g, (_m, n: string, mas: string | undefined) => {
    const i = Number(n) - 1;
    const v = cap.comodines[i];
    if (v === undefined) throw new Error(`La plantilla "${plantilla}" pide el comodín ${n} y la regla sólo capturó ${cap.comodines.length}`);
    if (mas === undefined) return v;
    const k = Number(v);
    if (!Number.isInteger(k)) throw new Error(`La plantilla "${plantilla}" pide sumar a un comodín que no es un índice: ${JSON.stringify(v)}`);
    return String(k + Number(mas));
  });
}
