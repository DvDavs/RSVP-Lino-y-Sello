// e2e/editor-nucleo.spec.ts — ciclo básico del núcleo contra el BACKEND REAL (04 §20.2, §20.3).
//
// Cubre lo que ninguna prueba de componente puede: que `:choose-template` sea de verdad el primer
// paso, que el lienzo aislado arranque de verdad dentro de `apps/web` (no en el spike), que un
// clic en el lienzo abra el bloque en el panel, y que el autoguardado escriba de verdad en Postgres.
//
// También produce las capturas de `docs/rediseno-plantillas/evidencia/fase-3/editor/`.
import { existsSync, mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  API_BASE,
  borrarInvitacion,
  invitacionSembrada,
  invitacionSinDocumento,
  jwtDemo,
  revisionActual,
  sesionDemo,
} from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/editor/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("núcleo del editor", () => {
  test("E-N1 · `:choose-template` es el primer paso: sin él, `GET .../document` da 404 y no crea nada", async ({ page }) => {
    const token = await jwtDemo();
    const invitationId = invitacionSinDocumento();
    try {
      // El contrato, comprobado por HTTP antes de mirar la interfaz (contratos §4, ADR-1R-X-03).
      const antes = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(antes.status).toBe(404);
      expect(((await antes.json()) as { code: string }).code).toBe("TPL_DOCUMENT_NOT_STARTED");

      await sesionDemo(page, token);
      await page.goto(`/editor/${invitationId}`);
      const catalogo = page.getByTestId("elegir-plantilla");
      await expect(catalogo).toBeVisible();
      await expect(page.getByRole("heading", { name: "Elige una plantilla" })).toBeVisible();
      await expect(page.getByTestId("elegir-boda-clasica")).toBeVisible();
      await page.screenshot({ path: `${EVIDENCIA}elegir-plantilla.png`, fullPage: false });

      await page.getByTestId("elegir-boda-clasica").click();
      // Tras elegir, el editor entra al armazón de dos paneles.
      await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
      // `revision` empieza en 0 tras `:choose-template`, no en 1 (`handoffs/3-0a.md` §4).
      expect(await revisionActual(invitationId, token)).toBe(0);
    } finally {
      borrarInvitacion(invitationId);
    }
  });

  test("E-N2 · el lienzo arranca, pinta la invitación y un clic abre el bloque en el panel", async ({ page }) => {
    const token = await jwtDemo();
    const invitationId = invitacionSembrada();
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);

    const marco = page.frameLocator('iframe[title="Vista previa de la invitación"]');
    // El saludo real `HELLO` → `READY` → `RENDER` dentro de `apps/web` (no en el spike).
    await expect(marco.locator(".lienzo-raiz")).toBeVisible({ timeout: 20_000 });
    await expect(marco.locator("section[data-section-key]").first()).toBeVisible();
    // Ninguna violación de `style-src`: la CSP del lienzo no habilita atributos `style` (3-0b §1).
    const violaciones = await page
      .frames()
      .find((f) => f.url().includes("/canvas"))!
      .evaluate(() => (window as unknown as { __cspViolations: { directive: string }[] }).__cspViolations ?? []);
    expect(violaciones.filter((v) => v.directive.startsWith("style-src"))).toEqual([]);

    // 04 §4: al hacer clic en un bloque el PANEL abre ese campo. El lienzo NO edita texto sobre sí
    // mismo — no hay ningún `contenteditable` en el árbol del lienzo.
    const editables = await page
      .frames()
      .find((f) => f.url().includes("/canvas"))!
      .locator("[contenteditable]")
      .count();
    expect(editables).toBe(0);

    // Se elige un bloque con TEXTO REAL a la vista (no el fondo decorativo de la portada): así el
    // recuadro de selección del lienzo y la fila resaltada del panel salen los dos en la captura.
    const bloqueConTexto = marco.locator("[data-block-id]").filter({ hasText: /\S/ }).first();
    await bloqueConTexto.scrollIntoViewIfNeeded();
    await bloqueConTexto.click();
    await expect(page.locator('aside [aria-current="true"]')).toBeVisible({ timeout: 10_000 });
    // El recuadro de selección lo dibuja `SelectionOverlay` de `@invitaciones/sections` cuando el
    // padre devuelve el `SELECT_BLOCK`: es el ciclo completo BLOCK_CLICKED → store → SELECT_BLOCK.
    await expect(marco.locator("[aria-hidden='true'] > span").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCIA}lienzo-con-seleccion.png` });
  });

  test("E-N3 · la vista móvil cambia el ancho del lienzo (flujo D, 04 §7.4)", async ({ page }) => {
    const token = await jwtDemo();
    const invitationId = invitacionSembrada();
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    const marco = page.frameLocator('iframe[title="Vista previa de la invitación"]');
    await expect(marco.locator(".lienzo-raiz")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("viewport-mobile").click();
    // El padre cambia el ancho del elemento…
    const ancho = await page.locator('iframe[title="Vista previa de la invitación"]').evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(ancho)).toBe(390);
    // …y el lienzo ajusta su propia raíz (`SET_VIEWPORT`).
    await expect(marco.locator('.lienzo-raiz[data-viewport="mobile"]')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}vista-movil.png` });
  });

  test("E-N4 · el autoguardado escribe de verdad: la revisión del servidor sube", async ({ page }) => {
    const token = await jwtDemo();
    const invitationId = invitacionSembrada();
    const antes = await revisionActual(invitationId, token);
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByRole("radiogroup", { name: "Ver la invitación en" })).toBeVisible({ timeout: 20_000 });
    // Se espera a que el lienzo haya pintado ANTES de tocar nada: si no, la captura de "Guardando…"
    // sale con el lienzo en blanco y no enseña lo que dice enseñar.
    await expect(page.frameLocator('iframe[title="Vista previa de la invitación"]').locator(".lienzo-raiz")).toBeVisible({
      timeout: 20_000,
    });

    // El lienzo se desplaza a la sección de los novios (`SCROLL_TO_SECTION`) y se espera a que su
    // título esté a la vista: así la captura de "Guardando…" enseña contenido real, no un hueco.
    await page.getByTestId("section-row-couple").click();
    await expect(
      page.frameLocator('iframe[title="Vista previa de la invitación"]').getByRole("heading", { name: "Los novios" }),
    ).toBeInViewport({ timeout: 10_000 });
    // Las fotos van con `loading="lazy"`: se espera a que estén decodificadas, o la captura sale con
    // los huecos en blanco y parece un fallo del editor cuando no lo es.
    const lienzo = page.frames().find((f) => f.url().includes("/canvas"));
    await lienzo?.waitForFunction(
      () => [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth > 0).length >= 3,
      undefined,
      { timeout: 15_000 },
    );

    // El guardado real contra localhost tarda decenas de milisegundos: para poder FOTOGRAFIAR el
    // estado "Guardando…" se retrasa la respuesta de esa ruta 1,5 s. No se simula nada — la petición
    // sale de verdad y el servidor la contesta de verdad; solo llega más tarde.
    await page.route("**/document/operations", async (ruta) => {
      await new Promise((resolver) => setTimeout(resolver, 1500));
      await ruta.continue();
    });

    // Una operación estructural: disparo inmediato (04 §12.1), sin esperar el debounce de 2 s.
    //
    // Se elige `story` a propósito. `SectionSpec.required` NO llega al cliente — ninguna de las 19
    // rutas devuelve el manifiesto (ver `preguntas-abiertas.md`, «Fase 3 · 3-4», pregunta 1) —, así
    // que ocultar una sección obligatoria da `422 TPL_OPERATION_INVALID` con `TPL_SECTION_REQUIRED`
    // (verificado por HTTP). El editor lo trata bien (descarta el lote y lo explica), pero eso no
    // es lo que mide esta prueba.
    const clave = await page.evaluate(() => {
      const s = (window as unknown as { __editorStore?: { getState: () => { composed: { sections: { key: string; visible: boolean }[] } } } }).__editorStore;
      const secciones = s?.getState().composed.sections ?? [];
      return secciones.find((x) => x.key === "story")?.key ?? secciones.find((x) => x.visible)?.key ?? null;
    });
    expect(clave).not.toBeNull();

    const indicador = page.locator('[data-save-state]');
    await page.evaluate((k) => {
      const s = (window as unknown as { __editorStore: { getState: () => { setSectionVisible: (k: string, v: boolean) => void } } }).__editorStore;
      s.getState().setSectionVisible(k as string, false);
    }, clave);

    // Se ve "Guardando…" y termina en guardado (04 §12.8: el indicador dice la verdad).
    await expect(indicador).toHaveAttribute("data-save-state", "saving", { timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCIA}guardando.png` });
    await expect(indicador).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
    await page.unroute("**/document/operations");

    const despues = await revisionActual(invitationId, token);
    expect(despues).toBeGreaterThan(antes);

    // Se deja como estaba para no romper la invitación de demostración del dueño.
    await page.evaluate((k) => {
      const s = (window as unknown as { __editorStore: { getState: () => { setSectionVisible: (k: string, v: boolean) => void } } }).__editorStore;
      s.getState().setSectionVisible(k as string, true);
    }, clave);
    await expect(indicador).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  });
});
