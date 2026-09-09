import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { obtenerDemo, revalidar } from "./util/demo";

// e2e/a11y-publico.spec.ts — ADR-024: CERO violaciones `critical` o `serious` de axe sobre el render
// público REAL (la invitación publicada, no un estado vacío). Complementa `e2e/a11y.spec.ts`, que
// cubre los estados sin datos y es de otro bloque (no se toca).
//
// Se analiza el documento entero, no un fragmento: `04 §17.1` exige que el contraste se compruebe
// "ya pintado", y eso solo pasa con las 12 secciones montadas con el tema real.
//
// AISLAMIENTO (issue I-CI-01, `06 §8.2` punto 4) — por qué esta suite SIGUE midiendo la invitación
// de la demostración y no una propia, al contrario que `editor-3c-evidencia.spec.ts`:
//   · El SUJETO de esta compuerta es la invitación PUBLICADA COMPLETA: 12 secciones con textos
//     reales y las 13 fotos del arte de la paleta. Una invitación recién creada con
//     `:choose-template` trae los textos por defecto pero NINGUNA foto (los `assetId` de
//     `defaults.json` no se resuelven hasta que alguien sube el arte, `scripts/seed-demo.sh` §4):
//     axe mediría MENOS de lo que ve una invitada — justo el "estado vacío" que esta compuerta
//     prohíbe. Reproducirla entera exigiría rehacer `seed-demo.sh` (13 subidas + los lotes de
//     `demo-content.mjs`) dentro de cada prueba.
//   · Y no hace falta: estas dos pruebas **solo leen** la URL pública. La única prueba que muta la
//     invitación publicada (`render-publico.spec.ts`, la de la sección oculta) ya toma el mutex
//     `conLockDeInvitacionSembrada` y restaura lo que cambió.
// Lo que SÍ rompía bajo paralelismo está medido y es OTRA cosa: axe muestreaba `color-contrast`
// mientras el navegador todavía repintaba (los MISMOS cuatro nodos cada vez, y 3 de 3 en verde al
// ejecutar el fichero solo — `bitacora/3c-adv.md` §6.2). Es una carrera de MUESTREO, no de datos, y
// la arreglan `esperarPinturaEstable()` + el `expect.poll` de abajo; el mutex no la habría tocado.

// Misma purga que en `render-publico.spec.ts`: la ruta es ISR y axe debe medir la invitación
// publicada AHORA, no una versión cacheada de hasta cinco minutos antes.
test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName; // Playwright exige el primer parámetro de fixtures; no se usa ninguno aquí.
  const demo = await obtenerDemo();
  const base = (testInfo.project.use.baseURL as string | undefined) ?? "http://127.0.0.1:3000";
  await revalidar(base, demo.publicToken);
});

async function violacionesGraves(page: import("@playwright/test").Page) {
  const resultados = await new AxeBuilder({ page }).analyze();
  return resultados.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodos: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
    }));
}

/**
 * Bloque 3-6 (mide, no oculta — política anti-flake de `contratos.md` §6): `axe-core` sampleaba
 * ocasionalmente `color-contrast` ANTES de que el navegador terminara de aplicar la tipografía
 * autoalojada (`document.fonts` en carga = repintado en curso = colores/tamaños todavía
 * inestables). Medido en 3 corridas seguidas de este archivo (2 pruebas cada una, sin ningún
 * cambio de código entre ellas): 2 fallos de 6 ejecuciones, y la prueba que fallaba CAMBIABA de
 * corrida en corrida (una vez la de escritorio, otra vez la de móvil, con los mismos 4 nodos y el
 * mismo mensaje `color-contrast` los dos casos) — la firma exacta de una carrera de temporización,
 * no de un defecto de contraste real y estable (`bitacora/3-6.md` § "E-08/E-09" trae las 3 salidas
 * literales). `document.fonts.ready` es una señal de estado OBSERVABLE, no un `waitForTimeout`
 * (prohibido por `06 §8.2` punto 2): espera exactamente a que la tipografía real esté aplicada
 * antes de samplear — que es también el estado en el que un invitado de verdad LEE el texto.
 *
 * I-CI-01 (esta tarea) le añade la segunda mitad que faltaba: esperar también al FOTOGRAMA que
 * pinta esa tipografía. `bitacora/3c-adv.md` §6.2 midió que con `fonts.ready` a secas el fallo
 * seguía saliendo bajo `--workers=2`, con los mismos cuatro nodos, y que el fichero pasaba 3 de 3
 * ejecutándose solo: lo que faltaba no era carga de fuentes, era el repintado.
 */
async function esperarPinturaEstable(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // `fonts.ready` resuelve cuando las fuentes están CARGADAS, no cuando el repintado que provocan
    // está COMMITEADO: bajo contención de CPU (4 workers + backend + `next start` en 4 vCPU) axe
    // alcanzaba a muestrear en medio (`bitacora/3c-adv.md` §6.2). Dos `requestAnimationFrame`
    // encadenados devuelven el control DESPUÉS del siguiente fotograma pintado — estado observable
    // del navegador, no un `waitForTimeout` (prohibido por `06 §8.2` punto 2).
    await new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo())));
  });
}

/**
 * La compuerta: CERO violaciones graves en el estado ESTABLE de la página. Se reintenta el análisis
 * (`expect.poll`, el mecanismo que `06 §8.2` punto 2 nombra) en vez de creerse el primer muestreo,
 * porque un repintado en curso da un resultado que no describe lo que lee una invitada — y el
 * fichero ya tiene medido que ese falso rojo aparece bajo carga y desaparece al repetir. No oculta
 * nada: una violación REAL sigue ahí en cada reintento y la prueba falla igual, con el informe
 * completo. `bitacora/3c-adv.md` §6.2 avisa además del riesgo simétrico (un falso VERDE por
 * muestreo temprano); repetir hasta que el resultado se estabilice también lo reduce.
 */
async function exigirCeroViolacionesGraves(page: import("@playwright/test").Page, donde: string): Promise<void> {
  await expect
    .poll(async () => violacionesGraves(page), { message: donde, timeout: 20_000, intervals: [1000, 2000, 3000] })
    .toEqual([]);
}

test("invitación publicada: 0 violaciones axe críticas o serias", async ({ page }) => {
  const demo = await obtenerDemo();
  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("h1")).toHaveCount(1);

  // Las imágenes perezosas se fuerzan a cargar: una imagen sin pintar no participa en las reglas de
  // contraste ni de `image-alt`, y la prueba estaría midiendo menos de lo que ve el invitado.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30_000 },
  );
  await esperarPinturaEstable(page);

  await exigirCeroViolacionesGraves(page, "invitación publicada · escritorio");
});

test("invitación publicada en móvil (390x844): 0 violaciones axe críticas o serias", async ({ page }) => {
  // El contraste y los objetivos táctiles (2.5.8) dependen del ancho: la escala tipográfica es
  // `clamp()` y varias secciones cambian de disposición. Se mide donde de verdad se abre.
  const demo = await obtenerDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("h1")).toHaveCount(1);
  await esperarPinturaEstable(page);
  await exigirCeroViolacionesGraves(page, "invitación publicada · móvil 390x844");
});
