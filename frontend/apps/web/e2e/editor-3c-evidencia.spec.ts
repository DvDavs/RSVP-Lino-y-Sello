// e2e/editor-3c-evidencia.spec.ts — compuerta y evidencia del chrome del editor rediseñado
// (fase 3-C, bloque 3, tarea 3C-7).
//
// Dos cosas, cada una sobre SU PROPIA invitación (`06 §8.2` punto 4; ver `conEditorPropio` abajo):
//   1. `axe` AA sin violaciones críticas ni serias en las TRES vistas del editor de escritorio
//      —lista de secciones, panel de un bloque y diálogo de publicación—, que es donde vive todo lo
//      que esta tarea rehízo. El editor a 390 ya lo cubre `a11y-pantallas-nuevas.spec.ts`.
//   2. Capturas a 390 y a 1440 en `docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/`
//      (`3c-b3-comun.md`, regla 8).
import { existsSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  borrarInvitacion,
  conLockDeInvitacionSembrada,
  cuentaNueva,
  invitacionConDocumento,
  invitacionSembrada,
  jwtDemo,
  sesionDemo,
} from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/3c-7/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

/**
 * `exclude("iframe")` deja fuera el LIENZO: dentro va la invitación de la clienta, que la pinta
 * `packages/sections` (zona prohibida de esta tarea y de este bloque). Lo que se mide aquí es el
 * CHROME. Medido: con el lienzo dentro, `axe` reporta una violación `serious` `aria-hidden-focus`
 * en `.RsvpSection-module__…__backdrop` de la plantilla — anotada en `preguntas-abiertas.md` para
 * quien mantenga `packages/sections`, no arreglable desde aquí.
 */
async function sinViolacionesGraves(page: Page, donde: string): Promise<void> {
  const resultados = await new AxeBuilder({ page }).exclude("iframe").analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, `${donde}\n${JSON.stringify(graves, null, 2)}`).toEqual([]);
}

/**
 * AISLAMIENTO DE DATOS (`06 §8.2` punto 4, issue I-CI-01): cada prueba abre el editor sobre una
 * invitación **suya**, de una cuenta **suya**, y la borra al terminar.
 *
 * Antes esto llamaba a `invitacionSembrada()` a pelo: LA invitación de la demostración, compartida
 * por otros ocho ficheros, y sin el mutex `conLockDeInvitacionSembrada`. Las dos pruebas de este
 * fichero entraban a la vez en la misma invitación y la segunda se quedaba sin lienzo — medido en
 * el runner de GitHub, no supuesto: con `--workers=2` fue el ÚNICO fallo de las 79
 * (corrida 34052672869), y obligó al CI a serializar con `--workers=1` (ADR-CI-01).
 *
 * Se crea cuenta nueva y no una invitación más de la cuenta de demostración porque el `POST
 * /auth/token` concurrente de la MISMA cuenta hace 500 en el módulo `auth` antiguo
 * (`preparar.ts` § `cuentaNueva`, `contratos.md §6`); `cuentaNueva()` acuña un correo distinto por
 * llamada, así que dos pruebas en paralelo nunca comparten ni la cuenta ni la invitación.
 *
 * Lo usa la prueba de `axe`, que mide el CHROME y no depende del contenido. La de CAPTURAS no
 * puede: ver el comentario de esa prueba, más abajo.
 */
async function conEditorPropio(page: Page, cuerpo: () => Promise<void>): Promise<void> {
  const cuenta = await cuentaNueva();
  const invitationId = await invitacionConDocumento(cuenta.token, cuenta.customerId);
  try {
    await sesionDemo(page, cuenta.token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible({ timeout: 30_000 });
    await cuerpo();
  } finally {
    borrarInvitacion(invitationId);
  }
}

test("editor de escritorio · axe AA sin violaciones graves en lista, panel de bloque y publicación", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conEditorPropio(page, async () => {
    await sinViolacionesGraves(page, "lista de secciones + apariencia");

    // Panel de un bloque: campos, variante de sección y bloque de solo lectura.
    await page.getByTestId("section-row-cover").click();
    await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();
    await sinViolacionesGraves(page, "panel de bloque (portada)");

    // Diálogo de publicación con su lista de revisión.
    await page.getByRole("button", { name: "Volver a secciones" }).click();
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByRole("dialog", { name: "Publicar invitación" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("confirmar-publicar")).toBeVisible();
    await sinViolacionesGraves(page, "diálogo de publicación");
    await page.keyboard.press("Escape");
  });
});

/**
 * Esta prueba SÍ usa la invitación sembrada, y con el mutex — es la excepción razonada a la regla
 * de «cada prueba, la suya» (`06 §8.2` punto 4), por dos motivos MEDIDOS:
 *   1. Es evidencia: las cinco capturas viven versionadas en `docs/rediseno-plantillas/evidencia/`
 *      y enseñan la invitación de la demostración CON su arte. Una invitación recién creada no
 *      tiene fotos (los `assetId` de `defaults.json` no se resuelven hasta subir el arte,
 *      `scripts/seed-demo.sh` §4): la evidencia del repositorio dejaría de ser la que produce la
 *      prueba.
 *   2. El lienzo de una invitación NUEVA es un render en FRÍO de las doce secciones. En el runner
 *      agotó los 30 s del `toBeVisible` **dos veces seguidas** (corrida 34299786630, con 2
 *      workers) y de paso se llevó por delante a `teclado-editor` E-10a, que esperaba el MISMO
 *      `.lienzo-raiz` en otro worker: es un pico de CPU, no un fallo de aislamiento. Sobre la
 *      invitación sembrada el lienzo ya está caliente.
 * El mutex cubre lo que la regla pide de verdad aquí: que nadie cambie la invitación mientras se
 * la fotografía. La prueba de `axe` de arriba —la que SÍ chocaba con esta— ya no la comparte.
 */
test("capturas del editor a 1440 y a 390 (evidencia del bloque 3)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await conLockDeInvitacionSembrada(async () => {
    await sesionDemo(page, await jwtDemo());
    await page.goto(`/editor/${invitacionSembrada()}`);
    await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible({ timeout: 30_000 });
    await expect(page.frameLocator('iframe[title="Vista previa de la invitación"]').locator(".lienzo-raiz")).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: `${EVIDENCIA}editor-1440.png` });

    await page.getByTestId("section-row-cover").click();
    await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}panel-de-bloque-1440.png` });

    await page.getByRole("button", { name: "Volver a secciones" }).click();
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByRole("dialog", { name: "Publicar invitación" })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCIA}publicar-1440.png` });
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("tablist", { name: "Qué quieres ver" })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCIA}editor-390.png` });
    await page.getByRole("tab", { name: "Vista previa" }).click();
    await page.screenshot({ path: `${EVIDENCIA}vista-previa-390.png` });
  });
});
