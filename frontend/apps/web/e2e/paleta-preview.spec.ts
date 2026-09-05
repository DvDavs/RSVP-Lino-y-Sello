// e2e/paleta-preview.spec.ts — bloque 3-5b: la vista previa de paleta al pasar el ratón
// (`04 §7.1` paso 8, `04 §9.3` `PREVIEW_THEME`) tiene que cambiar el COLOR del lienzo, no solo el
// atributo `data-theme-palette`.
//
// Por qué mide el valor COMPUTADO y no el atributo: comprobar `data-theme-palette` era exactamente
// el falso positivo del bloque 3-5 — el atributo cambiaba y los seis `--inv-color-*` se quedaban en
// la paleta anterior (`preguntas-abiertas.md` § "Fase 3 · 3-5", entrada ALTA).
//
// Contra el backend real (04 §20.3), sin `window.__seedManifestFixture`: desde 3-4b
// `GET .../document` entrega `theme` de verdad, así que el catálogo de paletas que pinta
// `ThemePicker` es el `theme.json` REAL de `boda-clasica@1.0.0`.
import { expect, test, type Frame, type Page } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** Los tres colores de `frontend/templates/boda-clasica/1.0.0/theme.json`, en el formato de `getComputedStyle`. */
const ACENTO_BLUSH = "#B05555";
const ACENTO_OLIVE = "#657446";
const FONDO_BLUSH = "#FDF7F5";
const FONDO_OLIVE = "#F7F5EE";

interface ViolacionCsp {
  directive: string;
  blockedURI: string;
}

async function marcoDelLienzo(page: Page): Promise<Frame> {
  await page.waitForFunction(
    () => [...document.querySelectorAll("iframe")].some((f) => (f.getAttribute("src") ?? "").includes("/canvas")),
    undefined,
    { timeout: 30_000 },
  );
  const marco = page.frames().find((f) => f.url().includes("/canvas"));
  if (!marco) throw new Error("El iframe del lienzo no está en la lista de frames");
  return marco;
}

/** Los seis `--inv-color-*` tal y como el navegador los resuelve DENTRO del lienzo. */
async function coloresDelLienzo(marco: Frame): Promise<{ paleta: string | null; acento: string; fondo: string }> {
  return marco.evaluate(() => {
    const raiz = document.querySelector("[data-theme-palette]");
    if (!raiz) throw new Error("El lienzo todavía no montó ThemeProvider");
    const estilo = getComputedStyle(raiz);
    return {
      paleta: raiz.getAttribute("data-theme-palette"),
      acento: estilo.getPropertyValue("--inv-color-accent").trim().toUpperCase(),
      fondo: estilo.getPropertyValue("--inv-color-bg").trim().toUpperCase(),
    };
  });
}

async function violacionesCsp(marco: Frame): Promise<ViolacionCsp[]> {
  return marco.evaluate(() => (window as unknown as { __cspViolations: ViolacionCsp[] }).__cspViolations ?? []);
}

test("vista previa de paleta · el color del lienzo cambia al pasar el ratón y vuelve al salir", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);

  await expect(page.getByTestId("section-row-cover")).toBeVisible({ timeout: 30_000 });
  // El catálogo llega del backend real (campo `theme` de 3-4b), no de un fixture.
  await expect(page.getByTestId("paleta-olive")).toBeVisible({ timeout: 20_000 });

  const marco = await marcoDelLienzo(page);
  await marco.waitForSelector("[data-theme-palette]", { timeout: 30_000 });
  const violacionesAlEmpezar = (await violacionesCsp(marco)).length;

  // ── ANTES: la paleta activa del documento ────────────────────────────────────────────────
  const antes = await coloresDelLienzo(marco);
  expect(antes.paleta).toBe("blush");
  expect(antes.acento).toBe(ACENTO_BLUSH);
  expect(antes.fondo).toBe(FONDO_BLUSH);

  // ── DURANTE: pasar el ratón por «olive» cambia el color DE VERDAD, al instante ────────────
  await page.getByTestId("paleta-olive").hover();
  // 1) el mensaje llega (esto ya pasaba antes del arreglo: era el falso positivo de 3-5)…
  await expect.poll(async () => (await coloresDelLienzo(marco)).paleta, { timeout: 5_000 }).toBe("olive");
  // 2) …y AHORA el color computado cambia de verdad (esto es lo que fallaba).
  await expect.poll(async () => (await coloresDelLienzo(marco)).acento, { timeout: 5_000 }).toBe(ACENTO_OLIVE);
  const durante = await coloresDelLienzo(marco);
  expect(durante.fondo).toBe(FONDO_OLIVE);

  // ── …y no escribe NADA: el documento del servidor sigue en `blush` (04 §7.1 paso 8) ───────
  const documento = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003"}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const cuerpo = (await documento.json()) as { composed: { theme: { paletteId: string } } };
  expect(cuerpo.composed.theme.paletteId).toBe("blush");
  // Tampoco hay nada que guardar: el indicador nunca sale de reposo.
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle");

  // ── DESPUÉS: al retirar el ratón vuelve al tema real ──────────────────────────────────────
  await page.getByRole("heading", { name: /secciones/i }).first().hover();
  await expect
    .poll(async () => (await coloresDelLienzo(marco)).acento, { timeout: 5_000 })
    .toBe(ACENTO_BLUSH);
  const despues = await coloresDelLienzo(marco);
  expect(despues.paleta).toBe("blush");
  expect(despues.fondo).toBe(FONDO_BLUSH);

  // ── CERO violaciones de CSP nuevas en todo el ciclo (la regresión que más miedo da) ───────
  const violaciones = await violacionesCsp(marco);
  const nuevas = violaciones.slice(violacionesAlEmpezar);
  expect(nuevas, JSON.stringify(nuevas)).toEqual([]);
  // Y ninguna de estilo en línea en NINGÚN momento: es la que mataría el tema entero.
  const deEstilo = violaciones.filter((v) => v.directive.startsWith("style-src"));
  expect(deEstilo, JSON.stringify(deEstilo)).toEqual([]);
});
