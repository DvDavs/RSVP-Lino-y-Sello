#!/usr/bin/env node
// scripts/emit-css.ts — escribe `generated/tokens.css` y `generated/tailwind.css` desde src/*.ts.
// Node 22 ejecuta TypeScript sin transpilador (igual que `packages/sections/scripts/`).
//
//   node scripts/emit-css.ts            escribe los dos ficheros
//   node scripts/emit-css.ts --check    NO escribe: falla con código 1 si lo commiteado no coincide
//
// Los ficheros de `generated/` se commitean (los consume `apps/web` por `@import`), y
// `test/css-generado.test.ts` comprueba que siguen siendo exactamente lo que sale de la fuente.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FICHEROS_GENERADOS } from "../src/css.ts";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const comprobar = process.argv.includes("--check");

let diferencias = 0;
for (const fichero of FICHEROS_GENERADOS) {
  const destino = join(RAIZ, fichero.ruta);
  const contenido = fichero.contenido();
  if (comprobar) {
    let actual: string | null;
    try {
      actual = readFileSync(destino, "utf8");
    } catch {
      actual = null;
    }
    if (actual !== contenido) {
      diferencias++;
      console.error(
        actual === null
          ? `FALTA   ${fichero.ruta} (ejecuta \`pnpm run emit:css\`)`
          : `DIFIERE ${fichero.ruta} respecto a src/*.ts (ejecuta \`pnpm run emit:css\`)`,
      );
    } else {
      console.log(`OK      ${fichero.ruta}`);
    }
    continue;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  console.log(`escrito ${fichero.ruta} (${contenido.length} bytes)`);
}

if (comprobar && diferencias > 0) process.exit(1);
