#!/usr/bin/env -S node --experimental-strip-types
// src/cli.ts — la herramienta, tal como la usarán los agentes que conviertan las 9 plantillas.
//
//   pnpm --filter @invitaciones/migration-legacy run cobertura-hojas
//       mide el gate de «cero patrones de hoja sin clasificar» sobre los 18 ficheros de F1.
//
//   pnpm --filter @invitaciones/migration-legacy run convertir -- <templateId> [--decision id=opcion]…
//       construye el paquete en `frontend/templates/<slug>/1.0.0/`, escribe el informe de pérdidas y
//       la cobertura en `docs/rediseno-plantillas/evidencia/fase-4/<slug>/`, e imprime el `package_hash`.
//
//   … run convertir -- <templateId> --dry-run     construye y valida sin escribir nada.
//   … run gen:golden -- <templateId>              regenera el golden de composición.

import fs from "node:fs";
import path from "node:path";
import { lineaResumen } from "./clasificador.ts";
import { construirPaquete } from "./construir.ts";
import { escribirPaquete } from "./escribir.ts";
import { clasificarTodas, DIR_F1_POR_DEFECTO, raizRepo, reglasMuertas } from "./f1.ts";
import { generarGolden, verificarTextoVisible } from "./golden.ts";
import { ErrorBloqueante } from "./perdidas.ts";
import { plantillaPorId } from "./plantillas.ts";

const RAIZ = raizRepo();
const DIR_DATOS = path.join(RAIZ, DIR_F1_POR_DEFECTO);
const DIR_PLANTILLAS = path.join(RAIZ, "frontend/templates");
const DIR_EVIDENCIA = path.join(RAIZ, "docs/rediseno-plantillas/evidencia/fase-4");
const DIR_GOLDEN = path.join(RAIZ, "frontend/packages/migration-legacy/golden");

function decisionesDe(argv: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--decision") continue;
    const [k, v] = (argv[i + 1] ?? "").split("=");
    if (!k || !v) throw new Error("Uso: --decision <id>=<opcion>");
    out[k] = v;
  }
  return out;
}

function cobertura(): number {
  const todas = clasificarTodas(DIR_DATOS);
  let sin = 0;
  for (const t of todas) {
    console.log(lineaResumen(t.visual.resumen));
    console.log(lineaResumen(t.contenido.resumen));
    sin += t.visual.resumen.patronesSinMapear.length + t.contenido.resumen.patronesSinMapear.length;
  }
  console.log(`\nTOTAL de patrones de hoja SIN MAPEAR en los 9 pares: ${sin}  (el gate de ADR-1R-C-01 exige 0)`);
  const muertas = reglasMuertas(todas);
  console.log(`Reglas que no casaron ninguna hoja: ${muertas.visual.length + muertas.contenido.length} ` +
    `(${[...muertas.visual, ...muertas.contenido].join(", ") || "ninguna"})`);
  return sin === 0 ? 0 : 1;
}

function convertir(argv: readonly string[]): number {
  const templateId = Number(argv[0]);
  if (!Number.isInteger(templateId)) { console.error("Uso: convertir <templateId>"); return 2; }
  const p = plantillaPorId(templateId);
  const forzar = argv.includes("--forzar");
  if (p.yaCubierto && !forzar) {
    console.error(`El slug \`${p.slug}\` ya tiene un paquete publicado que NO sale de esta herramienta ` +
      `(${p.nota ?? ""}). Sobrescribirlo destruiría trabajo ajeno: usa --forzar sólo con una decisión escrita.`);
    return 3;
  }
  const paquete = construirPaquete(templateId, { dirDatos: DIR_DATOS, decisiones: decisionesDe(argv) });
  const inf = paquete.informeDePerdidas;
  console.log(`plantilla ${templateId} → ${paquete.slug}@${paquete.version} (cohorte de roles: ${p.cohorte})`);
  console.log(`  hojas ${inf.resumen.hojasTotales} · mapeadas ${inf.resumen.mapeadas} · presentación ${inf.resumen.presentacion} · descartadas ${inf.resumen.descartadas} · SIN MAPEAR ${inf.resumen.patronesSinMapear}`);
  console.log(`  pérdidas: aceptada ${inf.resumen.aceptadas} · a revisar ${inf.resumen.aRevisar} · bloqueante ${inf.resumen.bloqueantes}`);
  console.log(`  secciones ${paquete.manifest.sections.length} · bloques ${paquete.manifest.sections.reduce((n, s) => n + s.blocks.length, 0)} · defaults ${Object.keys(paquete.defaults.content).length}`);
  for (const c of inf.correccionesDeColor) console.log(`  color AA · ${c}`);
  if (argv.includes("--dry-run")) { console.log("  --dry-run: no se escribe nada."); return 0; }

  const e = escribirPaquete(paquete, DIR_PLANTILLAS, DIR_EVIDENCIA);
  console.log(`  escrito en ${path.relative(RAIZ, e.dirVersion)}`);
  console.log(`  informe   en ${path.relative(RAIZ, e.dirEvidencia)}`);
  console.log(`  package_hash = ${e.packageHash}`);

  const g = generarGolden(paquete, templateId, p.eventKind, p.planId);
  fs.mkdirSync(DIR_GOLDEN, { recursive: true });
  fs.writeFileSync(path.join(DIR_GOLDEN, `${paquete.slug}-${paquete.version}.golden.json`), JSON.stringify(g, null, 2) + "\n", "utf8");
  const v = verificarTextoVisible(paquete, g);
  console.log(`  golden: ${g.textoVisible.length} textos visibles · comprobados ${v.comprobados} · faltantes ${v.faltantes.length}`);
  for (const f of v.faltantes) console.log(`    FALTA ${f.legacyPointer} = ${JSON.stringify(f.texto)}`);
  if (inf.decisionesPendientes.length > 0) {
    console.log("  decisiones de producto pendientes: " +
      inf.decisionesPendientes.map((d) => `${d.id} (${d.hojas} hoja(s); ${d.opciones.join("|")})`).join(", "));
  }
  return v.faltantes.length === 0 ? 0 : 4;
}

function main(): number {
  const [orden, ...resto] = process.argv.slice(2);
  try {
    if (orden === "cobertura") return cobertura();
    if (orden === "convertir" || Number.isInteger(Number(orden))) {
      return convertir(orden === "convertir" ? resto : [orden ?? "", ...resto]);
    }
    console.error("Órdenes: cobertura | convertir <templateId> [--dry-run] [--forzar] [--decision id=opcion]");
    return 2;
  } catch (err) {
    if (err instanceof ErrorBloqueante) { console.error(err.message); return 5; }
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

process.exit(main());
