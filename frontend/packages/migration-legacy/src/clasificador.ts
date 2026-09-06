// src/clasificador.ts — el motor del gate mecánico de `ADR-1R-C-01`.
//
// Las reglas son DATOS (`reglas-visual.ts`, `reglas-contenido.ts`), no `if` repartidos por el código:
// una tabla de patrón de puntero → destino, con una decisión escrita por fila, que es lo que pide
// `05 §4.1` y lo que no cabe escribir a mano fila a fila (≈250 filas por plantilla, 2 123 patrones
// distintos sobre los 18 ficheros).
//
// Orden de evaluación: PRIMERA regla que casa. Las tablas se escriben de lo específico a lo general y
// `validarTabla` comprueba mecánicamente que ninguna regla queda muerta bajo otra, que es la forma de
// que «primera que casa» no esconda una errata.

import { casar, expandir, type Captura } from "./puntero.ts";
import type { Hoja } from "./hojas.ts";
import { escalar } from "./hojas.ts";
import type { Cohorte } from "./plantillas.ts";
import type { Clase, Destino, HojaClasificada, Regla, ResumenClasificacion } from "./taxonomia.ts";

export class ErrorTabla extends Error {
  constructor(mensaje: string) { super(mensaje); this.name = "ErrorTabla"; }
}

/** Comprueba las obligaciones que la taxonomía impone a una tabla ANTES de usarla. */
export function validarTabla(reglas: readonly Regla[]): void {
  const vistos = new Set<string>();
  for (const r of reglas) {
    if (vistos.has(r.id)) throw new ErrorTabla(`Regla duplicada: ${r.id}`);
    vistos.add(r.id);
    if (!r.patron.startsWith("/")) throw new ErrorTabla(`Regla ${r.id}: el patrón debe empezar por "/" (${r.patron})`);
    if (r.motivo.trim() === "") throw new ErrorTabla(`Regla ${r.id}: falta el motivo escrito (P1)`);
    if (r.evidencia.trim() === "") throw new ErrorTabla(`Regla ${r.id}: falta la cita de evidencia`);
    if (r.clase === "mapeada" && r.destino === undefined) throw new ErrorTabla(`Regla ${r.id}: clase "mapeada" sin destino`);
    if (r.clase !== "mapeada" && r.destino !== undefined) throw new ErrorTabla(`Regla ${r.id}: sólo "mapeada" lleva destino`);
    if (r.clase === "presentacion" && r.presentacion === undefined) throw new ErrorTabla(`Regla ${r.id}: clase "presentacion" sin destino de presentación`);
    if (r.clase !== "presentacion" && r.presentacion !== undefined) throw new ErrorTabla(`Regla ${r.id}: sólo "presentacion" lleva destino de presentación`);
    // `**` fuera del final es un error del autor de la regla, y `casar` lo lanza: se detecta aquí.
    casar(r.patron, "/sonda/de/validacion");
  }
}

function expandirDestino(d: Destino, cap: Captura): Destino {
  switch (d.tipo) {
    case "bloque": return { ...d, ref: expandir(d.ref, cap) };
    case "itemBloque": return { ...d, ref: expandir(d.ref, cap) };
    case "itemIdLegado": return { ...d, ref: expandir(d.ref, cap) };
    default: return d;
  }
}

export interface Clasificacion {
  readonly hojas: readonly HojaClasificada[];
  readonly sinMapear: readonly Hoja[];
  readonly resumen: ResumenClasificacion;
  /** Ids de regla que casaron al menos una hoja. Alimenta la detección de reglas muertas. */
  readonly reglasUsadas: ReadonlySet<string>;
}

export function clasificar(
  fichero: string, hojas: readonly Hoja[], reglas: readonly Regla[], cohorte: Cohorte,
): Clasificacion {
  const out: HojaClasificada[] = [];
  const sinMapear: Hoja[] = [];
  const usadas = new Set<string>();
  const cuenta: Record<Clase, number> = { mapeada: 0, presentacion: 0, descartada: 0, bloqueante: 0 };

  for (const h of hojas) {
    let casada: { r: Regla; cap: Captura } | null = null;
    for (const r of reglas) {
      if (r.cohortes && !r.cohortes.includes(cohorte)) continue;
      const cap = casar(r.patron, h.puntero);
      if (cap) { casada = { r, cap }; break; }
    }
    if (!casada) { sinMapear.push(h); continue; }
    const { r, cap } = casada;
    usadas.add(r.id);
    cuenta[r.clase]++;
    out.push({
      puntero: h.puntero, patron: h.patron, idLegado: h.idLegado, valor: escalar(h) ?? null,
      clase: r.clase, reglaId: r.id, motivo: r.motivo, evidencia: r.evidencia,
      ...(r.destino ? { destino: expandirDestino(r.destino, cap) } : {}),
      ...(r.presentacion ? { presentacion: r.presentacion } : {}),
      comodines: cap.comodines, prioridad: r.prioridad ?? 0,
      ...(r.decision ? { decision: r.decision } : {}),
    });
  }

  const patronesSinMapear = [...new Set(sinMapear.map((h) => h.patron))].sort();
  return {
    hojas: out, sinMapear, reglasUsadas: usadas,
    resumen: {
      fichero, hojas: hojas.length, patrones: new Set(hojas.map((h) => h.patron)).size,
      mapeadas: cuenta.mapeada, presentacion: cuenta.presentacion,
      descartadas: cuenta.descartada, bloqueantes: cuenta.bloqueante,
      patronesSinMapear, hojasSinMapear: sinMapear.length,
    },
  };
}

/** Formato de una línea de la tabla de cobertura, igual que la medición de `05 §4.1`. */
export function lineaResumen(r: ResumenClasificacion): string {
  return [
    r.fichero.padEnd(36),
    "hojas=", String(r.hojas).padStart(5),
    " mapeadas=", String(r.mapeadas).padStart(4),
    " presentacion=", String(r.presentacion).padStart(5),
    " descartadas=", String(r.descartadas).padStart(3),
    " bloqueantes=", String(r.bloqueantes).padStart(3),
    " SIN MAPEAR=", String(r.patronesSinMapear.length).padStart(4),
  ].join("");
}
