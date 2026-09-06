// packages/template-kit/bin/plantilla.mjs — el arranque de `pnpm plantilla`.
//
// JavaScript plano y CERO dependencias a propósito: es el único fichero del kit que tiene que poder
// ejecutarse en una copia del repositorio SIN `node_modules`. La bitácora 4-5 (§1) midió el primer
// palo de la prueba cronometrada: en un worktree recién creado, `pnpm plantilla doctor` no fallaba
// con un diagnóstico sino con `sh: 1: tsx: not found` / `spawn ENOENT`, es decir, el comando que
// existe justamente para decirte qué falta en el entorno ni siquiera llegaba a arrancar. Este
// lanzador comprueba antes lo que `tsx src/cli.ts` da por hecho y, si falta, imprime el mismo
// diagnóstico de `doctor` («FALTA … + el arreglo copiable») en vez del error del shell.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = resolve(KIT, "../..");

/** Lo que `tsx src/cli.ts` necesita ya instalado para poder siquiera importar el CLI. */
const REQUISITOS = [
  { ruta: join(KIT, "node_modules"), que: "las dependencias del propio kit" },
  { ruta: join(KIT, "node_modules/.bin/tsx"), que: "el runner de TypeScript (`tsx`)" },
  { ruta: join(FRONTEND, "node_modules"), que: "las dependencias de la raíz del monorepo" },
  { ruta: join(FRONTEND, "packages/schema/node_modules"), que: "las dependencias de @invitaciones/schema" },
  { ruta: join(FRONTEND, "packages/sections/node_modules"), que: "las dependencias de @invitaciones/sections" },
];

const faltan = REQUISITOS.filter(r => !existsSync(r.ruta));
if (faltan.length > 0) {
  const lista = faltan.map(r => `      - ${r.que} (${r.ruta})`).join("\n");
  process.stdout.write(
    "FALTA Dependencias instaladas: el monorepo no está instalado del todo, así que `plantilla` no puede arrancar\n" +
    `${lista}\n` +
    "      `cd frontend && pnpm install` (instala TODO el workspace, no sólo el kit; tarda unos segundos\n" +
    "      si el store de pnpm ya está caliente). Después repite este mismo comando.\n" +
    "\n1 comprobación(es) · 1 sin resolver · 0 aviso(s)\n",
  );
  process.exit(1);
}

const r = spawnSync(join(KIT, "node_modules/.bin/tsx"), [join(KIT, "src/cli.ts"), ...process.argv.slice(2)], {
  stdio: "inherit",
  // `INIT_CWD` es lo que usa el CLI para resolver rutas relativas (src/cli.ts:resolverDir); pnpm ya
  // lo pone en el entorno del script y `spawnSync` lo hereda, pero si alguien invoca este fichero a
  // mano fuera de pnpm se rellena con el directorio actual para que se comporte igual.
  env: { ...process.env, INIT_CWD: process.env["INIT_CWD"] ?? process.cwd() },
});
process.exit(r.status ?? 1);
