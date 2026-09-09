import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { obtenerDemo } from "./util/demo";

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

// Aquí había una purga de la caché ISR (`revalidar()`), copiada de `render-publico.spec.ts`.
// I-CI-01 la quita: purgar es ESCRIBIR en un recurso compartido — la etiqueta ISR de la invitación
// publicada— y `render-publico.spec.ts:207` mide justo eso, que el HTML se sirva de la caché
// (`x-nextjs-cache: HIT`) tras calentarla, sin tomar el mutex. Con dos o más workers, una purga de
// este fichero entre el calentamiento y la comprobación del otro da un MISS espurio.
// No se pierde nada: axe mide la accesibilidad del RENDER PUBLICADO, y una copia cacheada de ese
// mismo release es el mismo HTML. Estas dos pruebas quedan así de solo lectura, de verdad.

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
    // ya está en pantalla: bajo contención de CPU axe alcanzaba a muestrear en medio
    // (`bitacora/3c-adv.md` §6.2). El segundo `requestAnimationFrame` encadenado se ejecuta al
    // principio del fotograma SIGUIENTE, o sea con el anterior ya compuesto — estado observable del
    // navegador, no un `waitForTimeout` (prohibido por `06 §8.2` punto 2).
    // Va con tope: una pestaña sin repintar (compositor ocluido) no emite fotogramas y la espera se
    // quedaría colgada hasta agotar la prueba, con un error opaco en vez del informe de axe. Si el
    // tope salta, el `expect.poll` de abajo vuelve a muestrear igualmente.
    await Promise.race([
      new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))),
      new Promise<void>((listo) => setTimeout(listo, 1000)),
    ]);
  });
}

/**
 * La compuerta: CERO violaciones graves en el estado ESTABLE de la página. Se reintenta el análisis
 * (`expect.poll`, el mecanismo que `06 §8.2` punto 2 nombra) en vez de creerse el primer muestreo,
 * porque un repintado en curso da un resultado que no describe lo que lee una invitada — y el
 * fichero ya tiene medido que ese falso rojo aparece bajo carga y desaparece al repetir. No oculta
 * nada: una violación REAL sigue ahí en cada reintento y la prueba falla igual, con el informe
 * completo. Lo que NO hace, y conviene no creérselo: `expect.poll` para en la primera muestra que
 * pasa, así que no protege contra el falso VERDE que `bitacora/3c-adv.md` §6.2 también avisa —
 * contra eso solo vale que la página esté quieta antes de mirar, que es lo que hace
 * `esperarPinturaEstable()`.
 * Tope corto (8 s) a propósito: con las esperas de arriba (5 s de `toHaveCount` + hasta 30 s de
 * carga de imágenes) un poll largo se comería el `timeout: 30_000` de `playwright.config.ts` en
 * local, y una violación REAL saldría como «Test timeout» en vez de como el informe de axe.
 */
async function exigirCeroViolacionesGraves(page: import("@playwright/test").Page, donde: string): Promise<void> {
  await expect
    .poll(async () => violacionesGraves(page), { message: donde, timeout: 8_000, intervals: [1000, 2000, 2000] })
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
