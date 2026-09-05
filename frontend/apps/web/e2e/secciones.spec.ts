// e2e/secciones.spec.ts — E-03/E-04/E-05 de `04 §20.2`: reordenar con ratón, con SOLO teclado y con
// el menú `⋮` sin arrastre (requisito AA 2.5.7) deben producir el MISMO resultado.
//
// Contra el backend REAL (04 §20.3): se lee el orden final por HTTP (`GET .../document`), no solo del
// DOM, para que un bloque de arrastre que "se ve bien" pero no llegó a enviar `reorderSections` no
// pase la prueba por accidente.
import { expect, test, type Page } from "@playwright/test";
import { sembrarManifiesto } from "./preparar-panel.ts";
import { API_BASE, aplicarOperaciones, invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

test.use({ viewport: { width: 1440, height: 900 } });

async function ordenDeSecciones(invitationId: number, token: string): Promise<string[]> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const cuerpo = (await r.json()) as { composed: { sections: { key: string }[] } };
  return cuerpo.composed.sections.map((s) => s.key);
}

async function esperarOrdenEnPantalla(page: Page, orden: string[]): Promise<void> {
  await expect(async () => {
    const filas = await page.locator('[data-testid^="section-row-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")?.replace("section-row-", "")),
    );
    expect(filas).toEqual(orden);
  }).toPass({ timeout: 10_000 });
}

/** `reorderSections` es inmediata (04 §12.1: estructural, sin debounce), pero sigue viajando por red
 *  — hay que esperar a que el indicador confirme la vuelta del servidor antes de leer por HTTP. */
async function esperarGuardado(page: Page): Promise<void> {
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
}

/**
 * Arrastra el asa de `claveOrigen` hasta soltarla sobre la fila de `claveDestino`, con
 * `PointerSensor` de verdad (mousedown → varios mousemove pequeños → mouseup): dnd-kit solo empieza
 * a arrastrar tras superar `activationConstraint.distance` (8px, `04 §14.1`) y recalcula la colisión
 * por frame, así que hacen falta pasos intermedios de verdad, no un salto directo. Reintenta la
 * gesticulación completa (no un truco de JavaScript) si el navegador la deja pasar sin que dnd-kit
 * llegue a registrar la posición final — visto de forma intermitente bajo carga en esta sesión.
 */
async function arrastrarAsa(page: Page, claveOrigen: string, claveDestino: string, ordenEsperado: string[]): Promise<void> {
  for (let intento = 1; intento <= 3; intento++) {
    const asa = page.getByTestId(`section-handle-${claveOrigen}`);
    const filaDestino = page.getByTestId(`section-row-${claveDestino}`);
    const cajaAsa = await asa.boundingBox();
    const cajaDestino = await filaDestino.boundingBox();
    if (!cajaAsa || !cajaDestino) throw new Error("No pude medir las filas de sección");
    const xInicio = cajaAsa.x + cajaAsa.width / 2;
    const yInicio = cajaAsa.y + cajaAsa.height / 2;
    const yFin = cajaDestino.y + cajaDestino.height - 4;

    await page.mouse.move(xInicio, yInicio);
    await page.mouse.down();
    await page.mouse.move(xInicio, yInicio + 12); // supera el umbral de activación (8px)
    await page.waitForTimeout(200);
    const pasos = 14;
    for (let i = 1; i <= pasos; i++) {
      await page.mouse.move(xInicio, yInicio + 12 + ((yFin - (yInicio + 12)) * i) / pasos);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(250);
    await page.mouse.up();

    try {
      await esperarOrdenEnPantalla(page, ordenEsperado);
      return;
    } catch (error) {
      if (intento === 3) throw error;
    }
  }
}

test("E-03/E-04/E-05 · ratón, teclado y menú ⋮ producen el MISMO reorderSections", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const ordenOriginal = await ordenDeSecciones(invitationId, token);
  test.skip(ordenOriginal.length < 3, "la invitación sembrada necesita al menos 3 secciones para esta prueba");
  const [a, b] = ordenOriginal;
  // El resultado esperado, IGUAL en las tres vías: la primera sección baja a la segunda posición.
  const ordenEsperado = [ordenOriginal[1], ordenOriginal[0], ...ordenOriginal.slice(2)];

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await esperarOrdenEnPantalla(page, ordenOriginal);

  // ── E-03: ratón — arrastrar el asa de la primera fila sobre la segunda ────────────────────
  await arrastrarAsa(page, a, b, ordenEsperado);
  await esperarGuardado(page);
  expect(await ordenDeSecciones(invitationId, token)).toEqual(ordenEsperado);

  // Revertir por HTTP antes de la siguiente vía (04 §14: misma operación, `reorderSections`).
  let limpieza = await aplicarOperaciones(invitationId, token, [{ op: "reorderSections", order: ordenOriginal }]);
  expect(limpieza.status).toBe(200);
  await page.reload();
  await esperarOrdenEnPantalla(page, ordenOriginal);

  // ── E-04: SOLO teclado — Espacio levanta, flecha abajo mueve, Espacio suelta (04 §14.2) ────
  for (let intento = 1; intento <= 3; intento++) {
    await page.getByTestId(`section-handle-${a}`).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    await page.keyboard.press("Space");
    try {
      await esperarOrdenEnPantalla(page, ordenEsperado);
      break;
    } catch (error) {
      if (intento === 3) throw error;
      // Puede haber quedado "levantada" a medias: Escape cancela y se reintenta desde el principio.
      await page.keyboard.press("Escape");
      await esperarOrdenEnPantalla(page, ordenOriginal);
    }
  }
  await esperarGuardado(page);
  expect(await ordenDeSecciones(invitationId, token)).toEqual(ordenEsperado);

  limpieza = await aplicarOperaciones(invitationId, token, [{ op: "reorderSections", order: ordenOriginal }]);
  expect(limpieza.status).toBe(200);
  await page.reload();
  await esperarOrdenEnPantalla(page, ordenOriginal);

  // ── E-05: menú ⋮ sin arrastre — requisito AA 2.5.7 (04 §14.4) ──────────────────────────────
  await page.getByTestId(`section-menu-${a}`).click();
  await page.getByTestId(`section-bajar-${a}`).click();
  await esperarOrdenEnPantalla(page, ordenEsperado);
  await esperarGuardado(page);
  expect(await ordenDeSecciones(invitationId, token)).toEqual(ordenEsperado);

  // ── limpieza final: devolver la invitación de demostración a su orden original ─────────────
  limpieza = await aplicarOperaciones(invitationId, token, [{ op: "reorderSections", order: ordenOriginal }]);
  expect(limpieza.status).toBe(200);
});

test("U-18/E-toggle · una sección required:true no tiene interruptor y una normal sí", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  const filas = page.locator('[data-testid^="section-row-"]');
  await expect(filas.first()).toBeVisible({ timeout: 20_000 });

  // El contrato nuevo (`manifest` en `GET .../document`) todavía no existe (`bitacora/3-5.md`), así
  // que aquí se sustituye por el mismo fixture real que usa el resto de la suite — sin él,
  // `findSectionSpec` no puede CONFIRMAR que una sección es opcional y `SectionList.tsx` trata TODAS
  // como obligatorias por seguridad (nunca un interruptor sobre algo que no se sabe si se puede
  // ocultar). Ver la prueba gemela sin manifiesto un poco más abajo.
  await sembrarManifiesto(page, invitationId);
  await expect(filas.first()).toBeVisible({ timeout: 20_000 });

  const total = await filas.count();
  let vioSiempreVisible = false;
  let vioInterruptor = false;
  for (let i = 0; i < total; i++) {
    const fila = filas.nth(i);
    if ((await fila.getByText("Siempre visible").count()) > 0) vioSiempreVisible = true;
    if ((await fila.getByRole("switch").count()) > 0) vioInterruptor = true;
  }
  expect(vioSiempreVisible).toBe(true);
  expect(vioInterruptor).toBe(true);
});

test("U-18/E-degradado · sin manifiesto ninguna fila ofrece interruptor (nunca «opcional» a ciegas)", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  const filas = page.locator('[data-testid^="section-row-"]');
  await expect(filas.first()).toBeVisible({ timeout: 20_000 });

  const total = await filas.count();
  for (let i = 0; i < total; i++) {
    const fila = filas.nth(i);
    await expect(fila.getByRole("switch")).toHaveCount(0);
    await expect(fila.getByText("Siempre visible")).toBeVisible();
  }
});
