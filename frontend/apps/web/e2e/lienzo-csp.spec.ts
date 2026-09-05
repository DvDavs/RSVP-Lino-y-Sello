import { expect, test } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

// e2e/lienzo-csp.spec.ts — COMPUERTA del criterio **A4** de la compuerta A1-A8 (ADR-1R-F-02,
// `contratos.md §8`): **cero `securitypolicyviolation`** en el documento del lienzo, medido sobre
// `apps/web` (el producto), no sobre `spikes/canvas-gate`.
//
// HISTORIA, para que nadie la deshaga sin saberlo (I-03 / H-ADV-03): hasta esta revisión la única
// aserción de este archivo protegía `style-src`, y la rama de `script-src` era un `console.warn`
// SIN `expect`. El spec imprimía «script-src/eval sigue abierto» y salía `1 passed`. Con eso en
// verde, una inyección de script REALMENTE bloqueada por la CSP —el caso que esta prueba existe
// para detectar— también habría pasado, y `ADR-3-0b-01` seguía afirmando «A4 = 0 violaciones»
// apoyado en una medición hecha sobre el spike.
//
// Hoy la lista de toleradas está VACÍA y se afirma por igualdad: cualquier violación de cualquier
// directiva pone la prueba en rojo. La de `script-src`/`eval` de Zod que estaba en cuarentena desde
// 3-1 se cerró en I-03 sin tocar la CSP: `packages/schema/src/common.ts` importa
// `./canvas-runtime.ts` como su PRIMERA dependencia (`bitacora/3b-i03.md §2`, medido sobre el bundle
// servido: Turbopack funde `common.ts` con el chunk de Zod y lo evalúa antes de que corra el cuerpo
// de `canvas-protocol.ts`, que vive en otro chunk).
type Violacion = { directive: string; blockedURI: string; sourceFile?: string; lineNumber?: number };

/** Ventana del lienzo vista desde la prueba. NO se usa `declare global`: `lib/canvas-client.ts` ya
 *  declara `__bufferMensajes` con su tipo real y una segunda declaración lo rompería (TS2717).
 *  El `as` va SIEMPRE dentro de cada `page.evaluate`: el cuerpo se serializa y se ejecuta en el
 *  navegador, donde ninguna variable de este módulo existe — un ayudante en el ámbito exterior
 *  daría `v is not defined` en la página. Los tipos, en cambio, se borran al compilar. */
type VentanaLienzo = { __cspViolations?: Violacion[]; __bufferMensajes?: unknown; __INYECTADO?: number };

/**
 * Espera a que el documento del lienzo esté REALMENTE ejercitado, no solo servido.
 *
 * `__bufferMensajes` lo instala el `<script nonce>` del layout antes de que React hidrate y lo borra
 * `createCanvasClient` (`lib/canvas-client.ts:167-169`) al montar el componente de cliente. Que haya
 * pasado a `undefined` es la prueba de que el chunk de cliente —el que carga Zod y construye los
 * esquemas, es decir el que disparaba la violación— ya se evaluó. Sin esta espera, leer
 * `__cspViolations` demasiado pronto daría `[]` por no haber mirado, no por no haber violaciones.
 */
async function esperarLienzoEjercitado(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => Array.isArray((window as unknown as VentanaLienzo).__cspViolations));
  await page.waitForFunction(() => (window as unknown as VentanaLienzo).__bufferMensajes === undefined);
  // Colchón adicional: una violación tardía (una fuente, una imagen del CDN) no debe escaparse por
  // leer la lista antes de tiempo. No sustituye a la espera determinista de arriba, la complementa.
  await page.waitForLoadState("networkidle");
}

test("la ruta del lienzo lleva la CSP sin 'self' y NO produce ni una violación (A4)", async ({ page }) => {
  const respuesta = await page.goto("/editor/1/canvas");
  expect(respuesta?.status()).toBe(200);
  const csp = respuesta?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'none'");
  expect(csp).not.toContain("'self'");
  expect(csp).toContain("connect-src 'none'");
  // Si alguien aflojara la CSP para "arreglar" una violación, A4 saldría verde por la razón
  // equivocada. Se afirma también lo que la cabecera NO puede llevar nunca, y lo que SÍ debe llevar.
  expect(csp, "la CSP del lienzo no puede admitir eval ni inline").not.toMatch(/unsafe-eval|unsafe-inline/);
  expect(csp, "`script-src` tiene que seguir siendo host explícito + nonce").toMatch(/script-src [^;]*'nonce-/);

  await esperarLienzoEjercitado(page);
  const violaciones = (await page.evaluate(() => (window as unknown as VentanaLienzo).__cspViolations ?? [])) as Violacion[];

  // A4, literal: CERO eventos. La lista de toleradas está vacía A PROPÓSITO — si alguna vez hubiera
  // que tolerar una, se añade AQUÍ, con nombre y con su ADR, y todo lo demás sigue en rojo.
  const TOLERADAS: Violacion[] = [];
  expect(violaciones, `A4 exige 0 securitypolicyviolation; se registraron: ${JSON.stringify(violaciones)}`).toEqual(
    TOLERADAS,
  );

  // Las dos familias que más importan, afirmadas por separado para que el fallo diga cuál se rompió.
  const deEstilo = violaciones.filter((v) => v.directive.startsWith("style-src"));
  expect(deEstilo, `violaciones de estilo: ${JSON.stringify(deEstilo)}`).toEqual([]);
  const deScript = violaciones.filter((v) => v.directive.startsWith("script-src"));
  expect(deScript, `violaciones de script: ${JSON.stringify(deScript)}`).toEqual([]);
});

// La compuerta anterior no podía distinguir «no hay violaciones» de «no miro las violaciones». Esta
// prueba cierra esa distinción por construcción: inyecta un script que la CSP bloquea y comprueba
// las DOS mitades a la vez — que no se ejecuta (la CSP está viva) y que el recolector lo registra
// (la prueba de arriba no es vacua). Si mañana alguien quitara el `<script nonce>` del layout, o
// vaciara `__cspViolations`, o metiera `'unsafe-inline'`, esta prueba lo diría. Lo que NO demuestra
// es que la prueba de arriba se ponga roja: eso se demostró revirtiendo el `import` de `common.ts`
// y está en `bitacora/3b-i03.md §3` con la salida literal.
test("una inyección de script bloqueada por la CSP SÍ se registra: el recolector no es decorativo", async ({
  page,
}) => {
  await page.goto("/editor/1/canvas");
  await esperarLienzoEjercitado(page);
  // Se mide el INCREMENTO, no el total: así esta prueba sigue diciendo la verdad sobre el recolector
  // aunque la de arriba esté en rojo por una violación real. Dos compuertas, dos causas distintas.
  const antes = (
    await page.evaluate(() => (window as unknown as VentanaLienzo).__cspViolations ?? [])
  ).filter((x) => x.directive.startsWith("script-src")).length;

  await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__INYECTADO = 1;";
    document.body.appendChild(s);
  });

  expect(
    await page.evaluate(() => (window as unknown as VentanaLienzo).__INYECTADO ?? null),
    "la CSP debe impedir que el script inyectado se ejecute",
  ).toBeNull();

  // El evento `securitypolicyviolation` se despacha en una tarea aparte: se sondea en vez de leerlo
  // una sola vez, para que la prueba no dependa de cuántos viajes de ida y vuelta haya en medio.
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as unknown as VentanaLienzo).__cspViolations ?? [])).filter((x) =>
          x.directive.startsWith("script-src"),
        ).length,
      { message: "la inyección bloqueada tiene que dejar rastro en el mismo recolector que lee la prueba A4" },
    )
    .toBeGreaterThan(antes);
});

// Las dos pruebas de arriba miden el documento del lienzo servido SOLO — sin padre, el componente
// se queda en «Esperando al editor…» y ni `ThemeProvider` ni `SectionsRoot` llegan a montarse. Eso
// deja fuera justo el camino que `ADR-3-0b-01` señala como el más propenso a violar la CSP (un
// `style={{…}}` renderizado en servidor dentro del lienzo = violación de `style-src`, medido en el
// spike). Esta tercera prueba cierra el hueco: abre el EDITOR real, espera al saludo
// `HELLO`→`READY`→`RENDER` de verdad y a que el tema y las secciones estén pintados, y sólo
// entonces lee el recolector DENTRO del `<iframe>`. Es A4 sobre el producto terminado, no sobre el
// andamiaje. `editor-nucleo.spec.ts` hace algo parecido pero sólo afirma `style-src`; aquí la
// exigencia es cero violaciones de cualquier directiva.
test("A4 sobre el lienzo REALMENTE pintado: cero violaciones con tema y secciones montados", async ({ page }) => {
  // Arrancar el editor real (catálogo + documento + saludo + primer RENDER) no cabe en los 30 s por
  // defecto de `playwright.config.ts`; las tres esperas de abajo son de 30 s cada una.
  test.setTimeout(120_000);
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);

  const marco = page.frameLocator('iframe[title="Vista previa de la invitación"]');
  await expect(marco.locator(".lienzo-raiz")).toBeVisible({ timeout: 30_000 });
  await expect(marco.locator("[data-theme-palette]")).toBeVisible({ timeout: 30_000 });
  await expect(marco.locator("section[data-section-key]").first()).toBeVisible({ timeout: 30_000 });

  const frameLienzo = page.frames().find((f) => f.url().includes("/canvas"));
  expect(frameLienzo, "el iframe del lienzo tiene que estar en la lista de frames").toBeTruthy();
  const violaciones = (await frameLienzo!.evaluate(
    () => (window as unknown as VentanaLienzo).__cspViolations ?? [],
  )) as Violacion[];
  expect(violaciones, `A4 sobre el lienzo pintado: ${JSON.stringify(violaciones)}`).toEqual([]);
});
