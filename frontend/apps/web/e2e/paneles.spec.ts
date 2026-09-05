// e2e/paneles.spec.ts — el panel de contenido completo (04 §6.2, §6.3, §7.1 pasos 5-6): seleccionar
// una sección, ver el selector de diseño, escribir en un campo con autoguardado real y ver un bloque
// de negocio en solo lectura CON explicación. Contra el backend real (04 §20.3); el único dato que no
// llega todavía por HTTP es `manifest` (`bitacora/3-5.md` §1), sembrado con
// `e2e/preparar-panel.ts` → `sembrarManifiesto` sobre el manifiesto REAL de la plantilla sembrada.
import { expect, test, type Page } from "@playwright/test";
import { conLockDeInvitacionSembrada, invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";
import { documentoActual, restaurarBloque, sembrarManifiesto } from "./preparar-panel.ts";

test.use({ viewport: { width: 1440, height: 900 } });

test("panel de contenido · variante, texto con autoguardado y bloque de negocio en solo lectura", async ({ page }) => {
  // Bloque 3-6, política anti-flake (`contratos.md` §6): escribe en la invitación sembrada
  // COMPARTIDA — bajo el mutex de `preparar.ts` (medido: ver ahí la evidencia completa).
  await conLockDeInvitacionSembrada(() => flujoPanel(page));
});

async function flujoPanel(page: Page): Promise<void> {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const antes = await documentoActual(invitationId, token);
  const tituloOriginal = antes.content["cover.title"];

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("section-row-cover")).toBeVisible({ timeout: 20_000 });
  await sembrarManifiesto(page, invitationId);

  await page.getByTestId("section-row-cover").click();
  await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();

  // ── "Diseño de la sección" — dos variantes, con diagrama SVG y etiqueta es-MX (no fotos) ────
  await expect(page.getByText("Diseño de la sección")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Pantalla completa" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Enmarcada" })).toBeVisible();

  // ── bloque de negocio (cover.date, source: business): solo lectura CON explicación ─────────
  await expect(page.getByText("Se toma de los datos de tu invitación.")).toBeVisible();
  // Nunca un <input disabled> mudo: no hay NINGÚN control de formulario para "Fecha del evento".
  await expect(page.getByRole("textbox", { name: /fecha del evento/i })).toHaveCount(0);

  // ── escribir en el título: autoguardado real contra el backend ─────────────────────────────
  const campo = page.getByRole("textbox", { name: "Nombres en portada" });
  await campo.fill("Ana & Luis · panel 3-5");
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  const despues = await documentoActual(invitationId, token);
  expect(despues.content["cover.title"]).toEqual({ kind: "text", value: "Ana & Luis · panel 3-5" });
  expect(despues.revision).toBeGreaterThan(antes.revision);

  await restaurarBloque(invitationId, token, "cover.title", tituloOriginal);
}
