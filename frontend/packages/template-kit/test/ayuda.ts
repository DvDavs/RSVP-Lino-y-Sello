// test/ayuda.ts — utilidades compartidas por las pruebas. No es una prueba.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "../src/check.ts";
import { formatearHallazgo, type Hallazgo } from "../src/formato.ts";

const AQUI = fileURLToPath(new URL(".", import.meta.url));
export const RAIZ_REPO = resolve(AQUI, "../../../..");
export const PAQUETES = resolve(RAIZ_REPO, "frontend/templates");

/** Copia un paquete de referencia a un directorio temporal para poder romperlo sin miedo. */
export function copiarPaquete(relativo: string): string {
  const destino = mkdtempSync(join(tmpdir(), "kit-"));
  const dir = join(destino, "paquete");
  cpSync(join(PAQUETES, relativo), dir, { recursive: true });
  return dir;
}

export function leerManifiesto(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(dir, "template.json"), "utf8")) as Record<string, unknown>;
}
export function escribirManifiesto(dir: string, m: unknown): void {
  writeFileSync(join(dir, "template.json"), JSON.stringify(m, null, 2) + "\n", "utf8");
}
export function leerTema(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(dir, "theme.json"), "utf8")) as Record<string, unknown>;
}
export function escribirTema(dir: string, t: unknown): void {
  writeFileSync(join(dir, "theme.json"), JSON.stringify(t, null, 2) + "\n", "utf8");
}
export function leerDefaults(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(dir, "defaults.json"), "utf8")) as Record<string, unknown>;
}
export function escribirDefaults(dir: string, d: unknown): void {
  writeFileSync(join(dir, "defaults.json"), JSON.stringify(d, null, 2) + "\n", "utf8");
}

/** El primer hallazgo con ese código, ya formateado con las tres líneas del contrato. */
export function mensajeDe(dir: string, codigo: string, escribir = true): string {
  const r = check({ dir, escribir });
  const h = r.hallazgos.find((x: Hallazgo) => x.codigo === codigo);
  if (!h) {
    throw new Error(
      `no hay ningún hallazgo ${codigo}; los que hay: ${r.hallazgos.map(x => x.codigo).join(", ") || "(ninguno)"}`,
    );
  }
  return formatearHallazgo(h);
}
