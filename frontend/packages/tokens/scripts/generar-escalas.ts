#!/usr/bin/env node
// scripts/generar-escalas.ts — imprime las escalas OKLCH → hex de las tres paletas y las tablas
// markdown de `11 §1.2`. Es la reproducibilidad de la fórmula: la matemática está en `src/oklch.ts`
// y los parámetros (matiz, croma máximo, tablas L y de croma) en `src/paletas.ts`; este script solo
// los muestra. No escribe nada: los hex NO se commitean como datos, se derivan.
//
//   node scripts/generar-escalas.ts          tabla legible
//   node scripts/generar-escalas.ts --md     tablas markdown para el documento de dirección
import {
  C_NEUTRO, DEFINICIONES, F_CROMA, L_NEUTRO, L_PASO, MATICES, PALETAS, PASOS, PASOS_NEUTROS,
} from "../src/paletas.ts";

const md = process.argv.includes("--md");

if (md) {
  for (const def of DEFINICIONES) {
    const p = PALETAS[def.id];
    console.log(`#### Paleta ${p.id.toUpperCase()} — ${p.nombre}\n\n${p.lema}\n`);
    console.log(`| Rol (matiz OKLCH) | ${PASOS.join(" | ")} |`);
    console.log(`|---|${PASOS.map(() => "---").join("|")}|`);
    for (const matiz of MATICES) {
      const e = p.escalas[matiz];
      console.log(`| \`${matiz}\` · ${e.nombre} (${e.h}°) | ${PASOS.map((s) => `\`${e.pasos[s]}\``).join(" | ")} |`);
    }
    console.log(`\n| Neutros cálidos (${p.neutral.h}°) | ${PASOS_NEUTROS.join(" | ")} |`);
    console.log(`|---|${PASOS_NEUTROS.map(() => "---").join("|")}|`);
    console.log(`| \`neutral\` · ${p.neutral.nombre} | ${PASOS_NEUTROS.map((s) => `\`${p.neutral.pasos[s]}\``).join(" | ")} |\n`);
  }
} else {
  console.log("Luminosidad OKLCH por paso:", PASOS.map((p) => `${p}=${L_PASO[p]}`).join(" "));
  console.log("Croma (× máximo) por paso:", PASOS.map((p) => `${p}=${F_CROMA[p]}`).join(" "));
  console.log("Neutros — L:", PASOS_NEUTROS.map((p) => `${p}=${L_NEUTRO[p]}`).join(" "));
  console.log("Neutros — C:", PASOS_NEUTROS.map((p) => `${p}=${C_NEUTRO[p]}`).join(" "));
  for (const def of DEFINICIONES) {
    const p = PALETAS[def.id];
    console.log(`\n[${p.id}] ${p.nombre}`);
    for (const matiz of MATICES) {
      const e = p.escalas[matiz];
      console.log(`  ${matiz.padEnd(9)} ${e.nombre.padEnd(12)}`, PASOS.map((s) => e.pasos[s]).join(" "));
    }
    console.log(`  neutral   ${p.neutral.nombre.padEnd(12)}`, PASOS_NEUTROS.map((s) => p.neutral.pasos[s]).join(" "));
  }
}
