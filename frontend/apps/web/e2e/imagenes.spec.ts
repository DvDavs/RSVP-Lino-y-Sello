// e2e/imagenes.spec.ts — 04 §13 completo contra el backend real: elegir archivo, recorte con
// proporción fija, subida (`POST …/assets`, cuerpo binario crudo), texto alternativo obligatorio y
// punto focal. El manifiesto se siembra (`preparar-panel.ts`); la subida, el recorte a `<canvas>` y
// el guardado del `assetId` son reales y sin mocks (04 §20.3).
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { API_BASE, invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";
import { documentoActual, restaurarBloque, sembrarManifiesto } from "./preparar-panel.ts";

test.use({ viewport: { width: 1440, height: 900 } });

const FOTO_PRUEBA = fileURLToPath(new URL("./fixtures/foto-prueba.png", import.meta.url));

test("imágenes · elegir, recortar, subir, alt obligatorio y punto focal", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const antes = await documentoActual(invitationId, token);
  const groomPhotoOriginal = antes.content["couple.groomPhoto"];

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("section-row-couple")).toBeVisible({ timeout: 20_000 });
  await sembrarManifiesto(page, invitationId);

  await page.getByTestId("section-row-couple").click();
  await expect(page.getByRole("heading", { name: /los novios/i })).toBeVisible();

  // Ámbito al campo del NOVIO: "couple.groomPhoto" y "couple.bridePhoto" comparten etiquetas
  // ("Cambiar foto", "Texto alternativo"…), así que cualquier locator sin ámbito es ambiguo.
  const campoNovio = page.locator('[id="campo-couple.groomPhoto"]');

  // ── elegir archivo → aparece el recorte con proporción fija (aspect: "square") ─────────────
  const inputArchivo = page.getByLabel("Elegir archivo para Foto del novio");
  await inputArchivo.setInputFiles(FOTO_PRUEBA);
  const usarEstaFoto = page.getByRole("button", { name: "Usar esta foto" });
  await expect(usarEstaFoto).toBeVisible({ timeout: 10_000 });

  // ── confirmar recorte → sube de verdad (POST …/assets, binario crudo) y guarda el assetId ──
  await usarEstaFoto.click();
  await expect(campoNovio.getByRole("button", { name: "Cambiar foto" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });

  const trasSubir = await documentoActual(invitationId, token);
  const valorGuardado = trasSubir.content["couple.groomPhoto"] as { kind: string; assetId?: string } | undefined;
  expect(valorGuardado?.kind).toBe("image");
  expect(valorGuardado?.assetId).toMatch(/^as_[0-9A-HJKMNP-TV-Z]{26}$/);

  // ── texto alternativo obligatorio (§17.4): sin él, no hay `alt` en el valor guardado ────────
  const alt = campoNovio.getByLabel("Texto alternativo");
  await alt.fill("El novio sonriendo");
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  const conAlt = await documentoActual(invitationId, token);
  expect((conAlt.content["couple.groomPhoto"] as { alt?: string }).alt).toBe("El novio sonriendo");

  // ── punto focal: mover el slider horizontal y comprobar que se guarda con aria-valuetext ───
  const focalHorizontal = campoNovio.getByLabel(/^horizontal$/i);
  await expect(focalHorizontal).toHaveAttribute("aria-valuetext", "centro");
  await focalHorizontal.fill("10");
  await focalHorizontal.dispatchEvent("change");
  await expect(page.locator("[data-save-state]")).toHaveAttribute("data-save-state", "idle", { timeout: 20_000 });
  const conFocal = await documentoActual(invitationId, token);
  expect((conFocal.content["couple.groomPhoto"] as { focal?: { x: number } }).focal?.x).toBeCloseTo(0.1, 5);

  await restaurarBloque(invitationId, token, "couple.groomPhoto", groomPhotoOriginal);
});

test("imágenes · un formato no admitido se rechaza antes de subir, con texto es-MX", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const peticiones: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes(`${API_BASE}/editor/invitations/${invitationId}/assets`) && r.method() === "POST") peticiones.push(r.url());
  });

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("section-row-couple")).toBeVisible({ timeout: 20_000 });
  await sembrarManifiesto(page, invitationId);
  await page.getByTestId("section-row-couple").click();

  // El propio buffer del PNG con nombre .svg: el navegador respeta el `accept`, así que se fuerza
  // el `<input type=file>` a aceptar cualquier extensión para probar la validación MANUAL (04 §13.2
  // paso 2, "se avisa ANTES de subir"), la misma defensa que si el selector del sistema operativo
  // deja pasar "todos los archivos".
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Elegir archivo para Foto del novio"]') as HTMLInputElement;
    input.removeAttribute("accept");
  });
  await page.getByLabel("Elegir archivo para Foto del novio").setInputFiles({
    name: "foto.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg></svg>"),
  });

  // `getByRole("alert")` a secas también resolvería el `#__next-route-announcer__` (vacío) de
  // Next.js: se filtra por texto para quedarse solo con el aviso real del campo.
  await expect(page.getByRole("alert").filter({ hasText: "Formato no admitido" })).toBeVisible();
  expect(peticiones).toEqual([]);
});
