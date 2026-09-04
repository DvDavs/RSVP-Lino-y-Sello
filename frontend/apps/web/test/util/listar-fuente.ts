// test/util/listar-fuente.ts — lista archivos fuente de app/, components/ y lib/ (sin node_modules,
// .next, tests, ni generados) para pruebas de grep mecánico (p. ej. tokens-no-leak.test.ts).
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const DIRECTORIOS_RAIZ = ["app", "components", "lib"];
const EXTENSIONES = new Set([".ts", ".tsx", ".css"]);

export function listarArchivosFuente(raizProyecto: string): string[] {
  const archivos: string[] = [];
  for (const dir of DIRECTORIOS_RAIZ) {
    const rutaAbsoluta = path.join(raizProyecto, dir);
    recorrer(rutaAbsoluta, archivos);
  }
  return archivos;
}

function recorrer(dir: string, acumulador: string[]): void {
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return;
  }
  for (const nombre of entradas) {
    const rutaCompleta = path.join(dir, nombre);
    const info = statSync(rutaCompleta);
    if (info.isDirectory()) {
      recorrer(rutaCompleta, acumulador);
      continue;
    }
    if (nombre.endsWith(".test.ts") || nombre.endsWith(".test.tsx")) continue;
    const ext = path.extname(nombre);
    if (EXTENSIONES.has(ext)) acumulador.push(rutaCompleta);
  }
}
