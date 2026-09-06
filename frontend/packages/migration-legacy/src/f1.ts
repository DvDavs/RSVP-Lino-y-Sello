// src/f1.ts — lectura de F1 y clasificación de las hojas de una plantilla legada.
//
// F1 = el JSON crudo del repositorio, con `JSON.parse` y nada más (ADR-1R-C-01). No hay ningún
// `import` de un modelo del módulo antiguo en este paquete, y `test/frontera.test.ts` lo comprueba
// con `grep`: pasar por `EditorModels.kt` reproduce H-12 por construcción.

import fs from "node:fs";
import path from "node:path";
import { clasificar, validarTabla, type Clasificacion } from "./clasificador.ts";
import { enumerarHojas, type JsonValor } from "./hojas.ts";
import { PLANTILLAS, plantillaPorId, rutasF1, type PlantillaLegada } from "./plantillas.ts";
import { REGLAS_CONTENIDO } from "./reglas-contenido.ts";
import { REGLAS_VISUAL } from "./reglas-visual.ts";

/** Ruta por defecto de F1 dentro del repositorio. */
export const DIR_F1_POR_DEFECTO = "src/main/resources/data/mongo";

/** Raíz del repositorio, deducida desde este fichero (`frontend/packages/migration-legacy/src`). */
export function raizRepo(): string {
  return path.resolve(new URL("../../../..", import.meta.url).pathname);
}

export interface F1 {
  readonly plantilla: PlantillaLegada;
  readonly visual: JsonValor;
  readonly contenido: JsonValor;
  readonly rutaVisual: string;
  readonly rutaContenido: string;
}

export function leerF1(templateId: number, dirDatos: string): F1 {
  const p = plantillaPorId(templateId);
  const r = rutasF1(p, dirDatos);
  const visual = JSON.parse(fs.readFileSync(r.visual, "utf8")) as JsonValor;
  const contenido = JSON.parse(fs.readFileSync(r.contenido, "utf8")) as JsonValor;
  const tid = (visual as { templateId?: unknown }).templateId;
  if (tid !== templateId) {
    throw new Error(`${r.visual} declara templateId ${String(tid)} y el registro dice ${templateId} (plantillas.ts).`);
  }
  return { plantilla: p, visual, contenido, rutaVisual: r.visual, rutaContenido: r.contenido };
}

export interface ClasificacionPlantilla {
  readonly plantilla: PlantillaLegada;
  readonly visual: Clasificacion;
  readonly contenido: Clasificacion;
}

export function clasificarPlantilla(f1: F1): ClasificacionPlantilla {
  validarTabla(REGLAS_VISUAL);
  validarTabla(REGLAS_CONTENIDO);
  const coh = f1.plantilla.cohorte;
  return {
    plantilla: f1.plantilla,
    visual: clasificar(path.basename(f1.rutaVisual), enumerarHojas(f1.visual), REGLAS_VISUAL, coh),
    contenido: clasificar(path.basename(f1.rutaContenido), enumerarHojas(f1.contenido), REGLAS_CONTENIDO, coh),
  };
}

/** Clasifica las 9 plantillas. Es lo que mide el gate de «cero patrones sin mapear». */
export function clasificarTodas(dirDatos: string): ClasificacionPlantilla[] {
  return PLANTILLAS.map((p) => clasificarPlantilla(leerF1(p.templateId, dirDatos)));
}

/** Reglas declaradas que no casaron NI UNA hoja en las 9 plantillas: erratas o filas obsoletas. */
export function reglasMuertas(todas: readonly ClasificacionPlantilla[]): { visual: string[]; contenido: string[] } {
  const usadasV = new Set<string>(); const usadasC = new Set<string>();
  for (const t of todas) {
    for (const id of t.visual.reglasUsadas) usadasV.add(id);
    for (const id of t.contenido.reglasUsadas) usadasC.add(id);
  }
  return {
    visual: REGLAS_VISUAL.filter((r) => !usadasV.has(r.id)).map((r) => r.id),
    contenido: REGLAS_CONTENIDO.filter((r) => !usadasC.has(r.id)).map((r) => r.id),
  };
}
