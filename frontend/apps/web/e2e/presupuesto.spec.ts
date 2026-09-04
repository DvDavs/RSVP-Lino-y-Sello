import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// e2e/presupuesto.spec.ts — el presupuesto de JS como PRUEBA, no solo como paso de CI (04 §16.2,
// contratos §8). Corre la misma compuerta que `pnpm --filter web run budget` sobre el `.next` que
// acaba de construir el `webServer` de Playwright, así que no vuelve a compilar nada.
//
// Es una prueba que FALLA DE VERDAD si el presupuesto se rompe: no hay `skip`, ni umbral distinto,
// ni tolerancia. Hoy está en ROJO a propósito, con la medición exacta en el mensaje de fallo — ver
// `bitacora/3-3.md` §3 y `handoffs/3-3.md` §3.

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_WEB = path.resolve(AQUI, "..");

function correrCompuerta(env: Record<string, string> = {}): { codigo: number; salida: string } {
  try {
    const salida = execFileSync(process.execPath, [path.join(RAIZ_WEB, "scripts", "check-budget.mjs")], {
      cwd: RAIZ_WEB,
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { codigo: 0, salida };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { codigo: e.status ?? 1, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

test("el JS de primera carga de /i/[publicToken] cabe en el presupuesto de 150 KB gz", () => {
  const { codigo, salida } = correrCompuerta();
  expect(codigo, `salida literal de check-budget:\n${salida}`).toBe(0);
});

test("la compuerta de presupuesto rompe de verdad cuando se excede", () => {
  // Prueba NEGATIVA: sin ella, un `check-budget.mjs` que nunca falla pasaría por verde para siempre.
  // `CHECK_BUDGET_OVERRIDE_KB` existe solo para esto y jamás se usa en CI.
  const { codigo, salida } = correrCompuerta({ CHECK_BUDGET_OVERRIDE_KB: "1" });
  expect(codigo, salida).toBe(1);
  expect(salida).toContain("EXCEDIDO");
});

test("la compuerta mide el JS PROPIO de cada ruta, no solo el runtime común", () => {
  // Regresión de la corrección (A) de `check-budget.mjs`: antes, `/i/[publicToken]` y
  // `/editor/[invitationId]` daban EXACTAMENTE el mismo número (165,9 KB) porque solo se pesaba
  // `rootMainFiles`, que es común a todas las rutas. Con esa forma de medir, meter el chrome entero
  // en la ruta pública era indetectable. Si alguien vuelve a esa versión, esta prueba lo caza.
  const { salida } = correrCompuerta();
  expect(salida).toContain("JS propio de la ruta");
  // `check-budget.mjs` colorea su salida; se quitan los códigos ANSI antes de leer las cifras.
  // eslint-disable-next-line no-control-regex
  const limpia = salida.replace(/\u001b\[[0-9;]*m/g, "");
  const cifras = [...limpia.matchAll(/^(\/[^\s:]+): ([\d.]+) KB gz/gm)].map((m) => [m[1], m[2]] as const);
  expect(cifras.length, limpia).toBeGreaterThanOrEqual(2);
  const distintas = new Set(cifras.map(([, kb]) => kb));
  expect(distintas.size, `las dos rutas no pueden medir lo mismo:\n${limpia}`).toBeGreaterThan(1);
});
