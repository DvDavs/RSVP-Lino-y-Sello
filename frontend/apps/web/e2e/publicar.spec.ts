// e2e/publicar.spec.ts — 04 §6.5, §7.1 pasos 10-12, contra el backend real: preflight → publicar →
// enlace, lista de bloqueos ACCIONABLE, y despublicar/rotar con sus estados de carga y error.
//
// La invitación de demostración (`invitacionSembrada()`) YA está publicada y al día
// (`sameAsActiveRelease: true`, verificado con `GET .../release/preflight` en esta sesión): publicar
// de nuevo es seguro (reutiliza el release activo) y se usa para el camino feliz y para el bloqueo
// temporal-y-restaurado. Despublicar/rotar cambian el enlace público de verdad, así que usan una
// invitación DESECHABLE (`crearInvitacionPublicable`) para no afectar otras pruebas ni al revisor de
// UX que abra la demo.
import { expect, test, type Page } from "@playwright/test";
import { aplicarOperaciones, borrarInvitacion, conLockDeInvitacionSembrada, invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";
import { crearInvitacionPublicable, documentoActual, restaurarBloque } from "./preparar-panel.ts";

test.use({ viewport: { width: 1440, height: 900 } });

test("publicar · sin bloqueos, camino feliz hasta el enlace y copiarlo", async ({ page }) => {
  // Bloque 3-6, política anti-flake (`contratos.md` §6): publica un release sobre la invitación
  // sembrada COMPARTIDA — bajo el mutex de `preparar.ts` (medido: ver ahí la evidencia completa).
  await conLockDeInvitacionSembrada(() => flujoPublicarFeliz(page));
});

async function flujoPublicarFeliz(page: Page): Promise<void> {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });

  await page.getByTestId("abrir-publicar").click();
  await expect(page.getByTestId("publish-dialog")).toBeVisible();
  await expect(page.getByText(/todo listo para publicar/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("confirmar-publicar")).toBeEnabled();

  await page.getByTestId("confirmar-publicar").click();
  await expect(page.getByTestId("enlace-publicado")).toBeVisible({ timeout: 15_000 });
  const enlace = await page.getByTestId("enlace-publicado").textContent();
  expect(enlace).toMatch(/^https?:\/\/.+\/i\//);

  await page.evaluate(() => {
    // jsdom/CDP: dar por bueno un `navigator.clipboard` que puede no estar disponible en el runner.
    (navigator as unknown as { clipboard: { writeText: (t: string) => Promise<void> } }).clipboard = {
      writeText: async () => undefined,
    };
  });
  await page.getByTestId("copiar-enlace").click();
  await expect(page.getByTestId("copiar-enlace")).toHaveText(/enlace copiado/i);

  await expect(page.getByRole("link", { name: /ver como invitado/i })).toHaveAttribute("href", enlace ?? "");
  await expect(page.getByRole("link", { name: /compartir por whatsapp/i })).toHaveAttribute("href", /wa\.me/);
}

test("publicar · un bloqueo real (texto de ejemplo) sale en la lista y es accionable", async ({ page }) => {
  // Bloque 3-6, política anti-flake (`contratos.md` §6): igual que la prueba anterior — ver ahí.
  await conLockDeInvitacionSembrada(() => flujoBloqueoReal(page));
});

async function flujoBloqueoReal(page: Page): Promise<void> {
  const token = await jwtDemo();
  const invitationId = invitacionSembrada();
  const antes = await documentoActual(invitationId, token);
  const tituloOriginal = antes.content["cover.title"];
  test.skip(tituloOriginal === undefined, "la invitación sembrada no tiene cover.title propio que restaurar");

  // `clearBlock` deja el bloque en su valor por defecto (`defaults.json`), que para un bloque
  // `required` es EXACTAMENTE `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` (H-03).
  const limpiar = await aplicarOperaciones(invitationId, token, [{ op: "clearBlock", blockId: "cover.title" }]);
  expect(limpiar.status).toBe(200);

  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByTestId("publish-dialog")).toBeVisible();
    await expect(page.getByText(/sigue con el texto de ejemplo/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("confirmar-publicar")).toBeDisabled();

    // Accionable: "Completar" lleva al panel de esa sección (04 §6.5).
    await page.getByRole("button", { name: /completar/i }).first().click();
    await expect(page.getByTestId("publish-dialog")).toBeHidden();
    await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();
  } finally {
    await restaurarBloque(invitationId, token, "cover.title", tituloOriginal);
  }
}

test("despublicar y rotar el enlace, con sus estados de carga", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);

  page.on("dialog", (d) => void d.accept());

  await sesionDemo(page, token);
  await page.goto(`/editor/${invitationId}`);
  await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });
  await page.getByTestId("abrir-publicar").click();
  await expect(page.getByTestId("confirmar-publicar")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("confirmar-publicar").click();
  await expect(page.getByTestId("enlace-publicado")).toBeVisible({ timeout: 15_000 });
  const enlaceOriginal = await page.getByTestId("enlace-publicado").textContent();

  // ── rotar: el enlace cambia y el anterior queda invalidado (04 §6.5, "Generar un enlace nuevo") ──
  await page.getByRole("button", { name: /generar un enlace nuevo/i }).click();
  await expect(async () => {
    const actual = await page.getByTestId("enlace-publicado").textContent();
    expect(actual).not.toBe(enlaceOriginal);
  }).toPass({ timeout: 10_000 });

  // ── despublicar: la invitación deja de estar visible para los invitados ────────────────────
  await page.getByRole("button", { name: /^despublicar$/i }).click();
  await expect(page.getByText(/ya no está visible para tus invitados/i)).toBeVisible({ timeout: 10_000 });

  borrarInvitacion(invitationId);
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Cierre de la fase 3-C · las graves del recorrido de UX (`bitacora/3c-ux.md §4`), contra el backend
// real y sobre una invitación DESECHABLE recién creada, que es el estado en el que la clienta las
// encontró: fecha del evento puesta y TODO lo demás en su contenido de ejemplo.
// ───────────────────────────────────────────────────────────────────────────────────────────────

test("G-04 + G-05 · con el itinerario de ejemplo la revisión NO dice «Todo listo» y lo enumera", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);

  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByTestId("publish-dialog")).toBeVisible();

    // G-04 · la fecha del evento (18 de abril de 2027) contra el itinerario de EJEMPLO del paquete
    // (12 de diciembre de 2026). Antes esto se publicaba con «Todo listo para publicar».
    const avisoFechas = page.getByTestId("aviso-fechas");
    await expect(avisoFechas).toBeVisible({ timeout: 15_000 });
    await expect(avisoFechas).toContainText("18 de abril de 2027");
    await expect(avisoFechas).toContainText(/diciembre de 2026/);
    await expect(page.getByText(/todo listo para publicar/i)).toHaveCount(0);

    // G-05 · el contenido de ejemplo que la invitada leería, sección por sección y entre comillas.
    await expect(page.getByTestId("lista-ejemplos")).toBeVisible();
    await expect(page.getByTestId("ejemplo-family")).toContainText("«");
    // Una sección de ejemplo entera y no obligatoria se puede ocultar de un toque.
    await expect(page.getByTestId("ocultar-seccion-family")).toBeVisible();

    // Solo bloquean los obligatorios (`03 §6`): se puede publicar, pero el botón no dice «todo listo».
    await expect(page.getByTestId("confirmar-publicar")).toBeEnabled();
    await expect(page.getByTestId("confirmar-publicar")).toHaveText(/de todos modos/i);
    await expect(page.getByTestId("resumen-avisos")).toContainText(/sin terminar/i);

    // «Ocultar sección» aplica la operación de verdad: la sección desaparece de la lista.
    await page.getByTestId("ocultar-seccion-family").click();
    await expect(page.getByTestId("ejemplo-family")).toHaveCount(0);
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("G-06 · el enlace público sigue ahí al cerrar el panel y al recargar el editor", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);

  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId("abrir-publicar").click();
    await expect(page.getByTestId("confirmar-publicar")).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId("confirmar-publicar").click();
    const enlace = await page.getByTestId("enlace-publicado").textContent({ timeout: 15_000 });
    expect(enlace).toMatch(/^https?:\/\/.+\/i\//);

    // Se cierra el panel: antes, aquí desaparecía el enlace del producto entero.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("publish-dialog")).toBeHidden();
    await expect(page.getByTestId("estado-publicacion").first()).toContainText(/publicada/i);
    await expect(page.getByTestId("abrir-compartir")).toBeVisible();

    // Y sigue estando después de recargar, que es lo que hizo la revisora de UX.
    await page.reload();
    await expect(page.getByTestId("abrir-compartir")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("estado-publicacion").first()).toContainText(/publicada/i);
    await page.getByTestId("abrir-compartir").click();
    await expect(page.getByTestId("enlace-publicado")).toHaveText(enlace ?? "");
    await expect(page.getByRole("link", { name: /compartir por whatsapp/i })).toHaveAttribute("href", /wa\.me/);
  } finally {
    borrarInvitacion(invitationId);
  }
});
