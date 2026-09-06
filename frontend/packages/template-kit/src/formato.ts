// packages/template-kit/src/formato.ts — FORMATO ESTABLE de los mensajes del kit.
//
// Es contrato: la guía de 30 minutos cita estos mensajes literalmente y las pruebas los comparan con
// `toBe` sobre la cadena entera, no con `toContain`. Cambiar el formato rompe las dos cosas a la vez,
// que es exactamente lo que se quiere (ruidoso, nunca silencioso — P1).
//
// Un hallazgo son SIEMPRE tres líneas y nada más:
//
//   <SEVERIDAD> <CÓDIGO>  <fichero>#<puntero JSON>
//     <el problema, en una frase>
//     Sugerencia: <qué escribir para arreglarlo, sin abrir código>
//
// La primera línea es rejilla para `grep`; la segunda dice qué pasa; la tercera dice qué hacer.
// El puntero es RFC 6901 (`/sections/1/blocks/0/role`) precedido del fichero del paquete, para que
// se pueda pegar en un editor y caer en el sitio exacto. `$` significa "el fichero entero".

/** Severidad de un hallazgo. `CORREGIDO` no es un fallo: es algo que el kit arregló por ti (P5). */
export type Severidad = "ERROR" | "AVISO" | "CORREGIDO";

export interface Hallazgo {
  readonly severidad: Severidad;
  /** Código estable, `TPL_*`. Los que coinciden con un error del registro llevan su mismo nombre. */
  readonly codigo: string;
  /** `<fichero>#<puntero RFC 6901>`, o `<fichero>#$` para el fichero entero. */
  readonly puntero: string;
  /** El problema, en UNA frase terminada en punto. */
  readonly problema: string;
  /** Qué escribir para arreglarlo. Nunca vacío: un hallazgo sin salida no es un hallazgo. */
  readonly sugerencia: string;
}

/** Construye el puntero `<fichero>#<RFC 6901>` a partir de los segmentos del camino. */
export function puntero(fichero: string, ...segmentos: ReadonlyArray<string | number>): string {
  if (segmentos.length === 0) return `${fichero}#$`;
  const camino = segmentos
    .map(s => String(s).replace(/~/g, "~0").replace(/\//g, "~1"))
    .join("/");
  return `${fichero}#/${camino}`;
}

/** Las tres líneas de UN hallazgo. Sin salto final. */
export function formatearHallazgo(h: Hallazgo): string {
  return `${h.severidad} ${h.codigo}  ${h.puntero}\n  ${h.problema}\n  Sugerencia: ${h.sugerencia}`;
}

/** Los hallazgos, en orden, separados por una línea en blanco. Sin salto final. */
export function formatearHallazgos(hs: readonly Hallazgo[]): string {
  return hs.map(formatearHallazgo).join("\n\n");
}

export interface Recuento {
  readonly errores: number;
  readonly avisos: number;
  readonly corregidos: number;
}

export function contar(hs: readonly Hallazgo[]): Recuento {
  return {
    errores: hs.filter(h => h.severidad === "ERROR").length,
    avisos: hs.filter(h => h.severidad === "AVISO").length,
    corregidos: hs.filter(h => h.severidad === "CORREGIDO").length,
  };
}

/** Línea final de `check`, siempre la misma forma. */
export function resumen(hs: readonly Hallazgo[]): string {
  const { errores, avisos, corregidos } = contar(hs);
  return `${errores} error(es) · ${avisos} aviso(s) · ${corregidos} corregido(s)`;
}

/** Ordena por severidad (errores primero) y, dentro, por puntero: salida estable entre ejecuciones. */
export function ordenar(hs: readonly Hallazgo[]): readonly Hallazgo[] {
  const peso: Record<Severidad, number> = { ERROR: 0, AVISO: 1, CORREGIDO: 2 };
  return [...hs].sort(
    (a, b) => peso[a.severidad] - peso[b.severidad] || a.puntero.localeCompare(b.puntero) ||
      a.codigo.localeCompare(b.codigo),
  );
}
