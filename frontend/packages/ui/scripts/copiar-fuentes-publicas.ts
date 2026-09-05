// packages/ui/scripts/copiar-fuentes-publicas.ts — parte de `pnpm run build` de @invitaciones/ui.
// Copia los `.woff2` autoalojados (manifiesto único en `../src/fonts/preload.ts`) desde
// `node_modules/@fontsource-variable/*/files/` hasta `apps/web/public/fonts/`, con el MISMO nombre
// de fichero, para que `RUTAS_PRECARGA` (rutas públicas `/fonts/*`) y los `@font-face` de
// `fonts.css` (mismas rutas) apunten a algo real sin depender del hash que el pipeline de CSS de
// Next asigna a los `url()` importados (ver comentario largo en `preload.ts`).
//
// `turbo.json`: la tarea `build` depende de `^build`, así que `apps/web` (que también hace `build`)
// espera a que este paquete termine el suyo antes de arrancar `next build`/`next start` — los
// ficheros ya están en `public/fonts/` cuando Next empieza a servir estáticos.
//
// Ejecutable directo con Node (sin compilar): Node 22 soporta "type stripping" de sintaxis TS
// simple y resuelve imports relativos con extensión `.ts` explícita (mismo permiso que
// `tsconfig.base.json` da al resto del monorepo con `allowImportingTsExtensions`).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { FUENTES_AUTOALOJADAS } from "../src/fonts/preload.ts";

const raizUi = path.resolve(import.meta.dirname, "..");
const destino = path.resolve(raizUi, "../../apps/web/public/fonts");

mkdirSync(destino, { recursive: true });

let copiados = 0;
for (const fuente of FUENTES_AUTOALOJADAS) {
  const origen = path.join(raizUi, fuente.rutaNodeModules);
  if (!existsSync(origen)) {
    throw new Error(
      `[copiar-fuentes-publicas] no existe ${origen}. ¿Falta "pnpm install" o cambió la versión de ${fuente.paquete}?`,
    );
  }
  copyFileSync(origen, path.join(destino, fuente.archivo));
  copiados += 1;
}

console.log(`[copiar-fuentes-publicas] ${copiados} ficheros .woff2 copiados a ${path.relative(raizUi, destino)}/`);
