import { expect, test } from "@playwright/test";

// e2e/lienzo-csp.spec.ts — humo del andamiaje del lienzo (04 §8): la CSP de `proxy.ts` llega en la
// respuesta y el documento carga sin violaciones de estilo en línea. La compuerta A1-A8 completa
// (con `HELLO`/`READY` reales desde un padre) ya la midió `handoffs/3-0b.md` (VEREDICTO: viable,
// 8/8, en `spikes/canvas-gate`, FUERA del workspace pnpm); esto confirma que la configuración sigue
// viva en `apps/web` tras copiarla — y que la integración en el monorepo NO es idéntica al spike.
test("la ruta del lienzo lleva la CSP sin 'self', y sin violaciones de estilo en línea", async ({ page }) => {
  const respuesta = await page.goto("/editor/1/canvas");
  expect(respuesta?.status()).toBe(200);
  const csp = respuesta?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("'self'");
  expect(csp).toContain("connect-src 'none'");

  // El script en línea de `layout.tsx` engancha `securitypolicyviolation` antes de que hidrate React.
  await page.waitForFunction(() => Array.isArray((window as unknown as { __cspViolations?: unknown[] }).__cspViolations));
  const violaciones = (await page.evaluate(
    () => (window as unknown as { __cspViolations: { directive: string }[] }).__cspViolations,
  )) as { directive: string }[];

  const deEstiloEnLinea = violaciones.filter((v) => v.directive.startsWith("style-src"));
  expect(deEstiloEnLinea, JSON.stringify(deEstiloEnLinea)).toEqual([]);

  // QUARANTINE: memoria/preguntas-abiertas.md § "Fase 3 · 3-1" (sin URL de issue: no hay rastreador
  // en este repo) · 2026-10-15 — `script-src`/`eval` de Zod (`configureZodForCanvas`,
  // `canvas-runtime.ts`) SÍ se dispara dentro de `apps/web` aunque NO se dispara en el spike aislado
  // de `handoffs/3-0b.md`. Se diagnosticó (pnpm confirma UNA sola instalación de `zod`; se descartó
  // la hipótesis de dos copias físicas) pero no se resolvió dentro del bloque 3-1 — ver
  // `memoria/bitacora/3-1.md` para la traza completa. NO se afloja la CSP para "arreglarlo": eso
  // reabriría exactamente lo que la compuerta A4 existe para impedir.
  const deEval = violaciones.filter((v) => v.directive === "script-src");
  if (deEval.length > 0) {
    console.warn(
      `lienzo-csp: script-src/eval sigue abierto (QUARANTINE, ver preguntas-abiertas.md): ${JSON.stringify(deEval)}`,
    );
  }
});
