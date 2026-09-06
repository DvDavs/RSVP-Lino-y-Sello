// src/escribir.ts — escritura del paquete en el árbol EXACTO de `01 §2.1` y cálculo del `package_hash`.
//
//   templates/<slug>/<version>/
//     template.json  theme.json  defaults.json      (obligatorios, UTF-8 sin BOM)
//     assets/                                       (0..200 archivos, sin subdirectorios)
//     migrations/                                   (opcional)
//
// Cualquier archivo que no esté en ese árbol hace fallar el registro con `TPL_PACKAGE_UNEXPECTED_FILE`,
// así que el informe de pérdidas y la cobertura NO se escriben aquí: van a
// `docs/rediseno-plantillas/evidencia/fase-4/<slug>/` (ADR-3-2d-03, misma razón por la que el arte de
// demostración vive en `<slug>/demo/`).

import fs from "node:fs";
import path from "node:path";
import { DefaultsFile, TemplateManifest, ThemeSpec } from "@invitaciones/schema";
import { packageHash } from "./hash.ts";
import type { PaqueteConstruido } from "./construir.ts";

export interface Escritura {
  readonly dirVersion: string;
  readonly dirEvidencia: string;
  readonly packageHash: string;
  readonly archivos: readonly string[];
}

/** JSON con 2 espacios y salto final, como los paquetes de referencia de `frontend/templates/`. */
const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

export function escribirPaquete(p: PaqueteConstruido, dirPlantillas: string, dirEvidenciaRaiz: string): Escritura {
  // Validar ANTES de escribir: un paquete que no valida no llega al disco (P1).
  TemplateManifest.parse(p.manifest);
  ThemeSpec.parse(p.theme);
  DefaultsFile.parse(p.defaults);
  verificarCoherencia(p);

  const dirVersion = path.join(dirPlantillas, p.slug, p.version);
  fs.rmSync(dirVersion, { recursive: true, force: true });
  fs.mkdirSync(dirVersion, { recursive: true });
  fs.writeFileSync(path.join(dirVersion, "template.json"), json(p.manifest), "utf8");
  fs.writeFileSync(path.join(dirVersion, "theme.json"), json(p.theme), "utf8");
  fs.writeFileSync(path.join(dirVersion, "defaults.json"), json(p.defaults), "utf8");

  const dirEvidencia = path.join(dirEvidenciaRaiz, p.slug);
  fs.mkdirSync(dirEvidencia, { recursive: true });
  fs.writeFileSync(path.join(dirEvidencia, "informe-de-perdidas.json"), json(p.informeDePerdidas), "utf8");
  fs.writeFileSync(path.join(dirEvidencia, "cobertura.json"), json(coberturaPorPatron(p)), "utf8");

  return {
    dirVersion, dirEvidencia, packageHash: packageHash(dirVersion),
    archivos: ["template.json", "theme.json", "defaults.json"],
  };
}

/**
 * Una decisión escrita POR PATRÓN: es el artefacto que prueba el gate de `ADR-1R-C-01` y el que hay que
 * leer para auditar la conversión. `cobertura.json` no viaja en el paquete (ver cabecera).
 */
export function coberturaPorPatron(p: PaqueteConstruido): unknown {
  const m = new Map<string, { patron: string; reglaId: string; clase: string; motivo: string; evidencia: string; destino: unknown; hojas: number }>();
  for (const h of p.cobertura) {
    const e = m.get(h.patron);
    if (e) { e.hojas++; continue; }
    m.set(h.patron, {
      patron: h.patron, reglaId: h.reglaId, clase: h.clase, motivo: h.motivo, evidencia: h.evidencia,
      destino: h.destino ?? h.presentacion ?? null, hojas: 1,
    });
  }
  const filas = [...m.values()].sort((a, b) => a.patron.localeCompare(b.patron));
  return {
    plantilla: { slug: p.slug, version: p.version },
    gate: "ADR-1R-C-01: cero patrones de hoja sin clasificar. No hay categoría comodín (P1).",
    patrones: filas.length,
    hojas: p.cobertura.length,
    filas,
  };
}

/** Comprobaciones que el esquema no puede expresar y que el registro sí exige (`01 §2.2`). */
function verificarCoherencia(p: PaqueteConstruido): void {
  const ids = new Set<string>();
  for (const s of p.manifest.sections) {
    for (const b of s.blocks) {
      if (ids.has(b.id)) throw new Error(`blockId duplicado en el manifiesto: ${b.id} (mata H-28)`);
      ids.add(b.id);
    }
    if (!s.variants.includes(s.defaultVariant)) {
      throw new Error(`I-08: la sección ${s.key} declara defaultVariant "${s.defaultVariant}" fuera de variants`);
    }
  }
  for (const k of Object.keys(p.defaults.content)) {
    if (!ids.has(k)) throw new Error(`I-10: defaults.json trae la clave "${k}", que no es un blockId del manifiesto`);
  }
  const negocio = new Set(
    p.manifest.sections.flatMap((s) => s.blocks).filter((b) => b.source === "business").map((b) => b.id),
  );
  for (const k of Object.keys(p.defaults.content)) {
    if (negocio.has(k)) throw new Error(`I-28: defaults.json trae valor para el bloque business "${k}"`);
  }
  const pal = new Set(p.theme.palettes.map((x) => x.id));
  const fs2 = new Set(p.theme.fontSets.map((x) => x.id));
  if (!pal.has(p.theme.defaultPaletteId) || !fs2.has(p.theme.defaultFontSetId)) {
    throw new Error("I-09: defaultPaletteId/defaultFontSetId fuera de palettes/fontSets");
  }
}
