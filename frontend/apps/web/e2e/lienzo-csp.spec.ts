import { expect, test } from "@playwright/test";

// e2e/lienzo-csp.spec.ts — COMPUERTA de la CSP del lienzo (04 §8), criterio **A4** de la compuerta
// A1-A8 de ADR-1R-F-02 / contrato §8: **cero `securitypolicyviolation`** en el documento del lienzo.
//
// Hasta la revisión 3-ADV esto NO era una compuerta: la única aserción protegía `style-src` y la
// rama de `script-src` era un `console.warn` sin `expect`, así que la prueba imprimía «script-src/
// eval sigue abierto» y salía `1 passed` (H-ADV-03). Con eso en verde, una inyección REALMENTE
// bloqueada por la CSP —el caso que esta prueba existe para detectar— también habría pasado.
//
// Ahora la lista de violaciones toleradas está **vacía** y se afirma por igualdad, así que cualquier
// violación de cualquier directiva pone la prueba en rojo. La de `script-src`/`eval` de Zod que
// estaba en cuarentena desde 3-1 se **cerró** en 3-10: `packages/schema/src/common.ts` importa
// `./canvas-runtime.ts` como su primera dependencia, de modo que `jitless` queda puesto antes de que
// se construya el primer `z.object` aunque Turbopack funda `common.ts` con el chunk de Zod y lo
// evalúe al cargarlo (que es lo que rompía el arreglo de ADR-3-0b-02 dentro de `apps/web`).
type Violacion = { directive: string; blockedURI: string; sourceFile?: string; lineNumber?: number };

test("la ruta del lienzo lleva la CSP sin 'self' y NO produce ni una violación (A4)", async ({ page }) => {
  const respuesta = await page.goto("/editor/1/canvas");
  expect(respuesta?.status()).toBe(200);
  const csp = respuesta?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("'self'");
  expect(csp).toContain("connect-src 'none'");
  // Si alguien aflojara la CSP para "arreglar" una violación, A4 saldría verde por la razón
  // equivocada. Se afirma también lo que NO puede aparecer nunca en la cabecera.
  expect(csp, "la CSP del lienzo no puede admitir eval ni inline").not.toMatch(/unsafe-eval|unsafe-inline/);

  // El script en línea de `layout.tsx` engancha `securitypolicyviolation` antes de que hidrate React.
  await page.waitForFunction(() => Array.isArray((window as unknown as { __cspViolations?: unknown[] }).__cspViolations));
  // Da margen a que la hidratación y el primer `RENDER` terminen: una violación que llegara tarde
  // no debe escaparse por leer la lista demasiado pronto.
  await page.waitForLoadState("networkidle");
  const violaciones = (await page.evaluate(
    () => (window as unknown as { __cspViolations: Violacion[] }).__cspViolations,
  )) as Violacion[];

  // A4, literal: CERO eventos. La lista de toleradas está vacía a propósito — si alguna vez hubiera
  // que tolerar una, se añade AQUÍ, con nombre, y todo lo demás sigue en rojo.
  const TOLERADAS: Violacion[] = [];
  expect(violaciones, `A4 exige 0 securitypolicyviolation; se registraron: ${JSON.stringify(violaciones)}`)
    .toEqual(TOLERADAS);

  // Las dos familias que más importan, afirmadas por separado para que el fallo diga cuál se rompió.
  const deEstilo = violaciones.filter((v) => v.directive.startsWith("style-src"));
  expect(deEstilo, `violaciones de estilo: ${JSON.stringify(deEstilo)}`).toEqual([]);
  const deScript = violaciones.filter((v) => v.directive.startsWith("script-src"));
  expect(deScript, `violaciones de script: ${JSON.stringify(deScript)}`).toEqual([]);
});

// La compuerta anterior no podía distinguir «no hay violaciones» de «no miro las violaciones»: con
// sólo `style-src` afirmado, una inyección de script REALMENTE bloqueada pasaba en verde. Esta
// prueba inyecta una y comprueba las dos mitades a la vez: la CSP la bloquea (no se ejecuta) **y** el
// recolector la ve (`window.__cspViolations` deja de estar vacío). Si mañana alguien vaciara el
// recolector o quitara el `<script nonce>` del layout, la compuerta de arriba se volvería vacua y
// esta prueba lo diría.
test("una inyección de script bloqueada por la CSP SÍ se registra: la compuerta puede ponerse roja", async ({ page }) => {
  await page.goto("/editor/1/canvas");
  await page.waitForFunction(() => Array.isArray((window as unknown as { __cspViolations?: unknown[] }).__cspViolations));

  await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__INYECTADO = 1;";
    document.body.appendChild(s);
  });

  const ejecutado = await page.evaluate(() => (window as unknown as { __INYECTADO?: number }).__INYECTADO ?? null);
  expect(ejecutado, "la CSP debe impedir que el script inyectado se ejecute").toBeNull();

  const violaciones = (await page.evaluate(
    () => (window as unknown as { __cspViolations: Violacion[] }).__cspViolations,
  )) as Violacion[];
  const deScript = violaciones.filter((v) => v.directive.startsWith("script-src"));
  expect(deScript.length, `la inyección bloqueada tiene que dejar rastro: ${JSON.stringify(violaciones)}`)
    .toBeGreaterThan(0);
});
