// e2e/asistente.spec.ts — el asistente de creación de `/editor` (fase 3-C, 3C-6) contra el
// BACKEND REAL, sin un solo mock de la API (`04 §20.3`).
//
// Lo que estas pruebas demuestran, y por qué cada una existe:
//   1. Los CUATRO pasos de punta a punta, verificando por HTTP que la plantilla quedó aplicada y
//      que los datos básicos llegaron al documento y a `invitation.date`. Un paso que «se ve bien»
//      pero no manda nada no puede pasar por aquí.
//   2. El FILTRO POR TIPO DE EVENTO: una invitación de XV años no ve «Boda clásica». Es el cierre
//      de UX-N-02 (`bitacora/3b-adv.md` §8.1), la fricción que llevó a una clienta a poner «Los
//      novios» en la invitación de su hija.
//   3. El BLOQUEO POR PLAN con motivo y salida: una invitación de plan Básico ve «Requiere el plan
//      2» y un enlace que lleva a algún sitio, nunca un botón deshabilitado y mudo.
//   4. `axe` sin violaciones graves en los tres pasos con contenido.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  API_BASE,
  TEMPLATE_BODA_BASICO,
  TEMPLATE_QUINCE_PREMIUM,
  borrarInvitacion,
  invitacionSinDocumento,
  jwtDemo,
  sesionDemo,
} from "./preparar.ts";

async function sinViolacionesGraves(page: Page): Promise<void> {
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
}

interface DocumentoServidor {
  revision: number;
  document: { content: Record<string, unknown> };
  templateVersion: { slug: string; version: string };
}

async function leerDocumento(invitationId: number, token: string): Promise<DocumentoServidor> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`GET .../document → ${r.status}`);
  return (await r.json()) as DocumentoServidor;
}

async function leerFecha(invitationId: number, token: string): Promise<string> {
  const r = await fetch(`${API_BASE}/user/invitations/all`, { headers: { authorization: `Bearer ${token}` } });
  const lista = (await r.json()) as Array<{ id: number; date: string }>;
  return lista.find((i) => i.id === invitationId)?.date ?? "";
}

test("los cuatro pasos: tipo de evento → plantilla → datos básicos → abrir mi invitación", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento(); // Boda · plan Premium
  const novio = `Luis Hernández ${Date.now().toString(36)}`;

  try {
    await sesionDemo(page, token);
    await page.goto(`/editor?inv=${invitationId}`);

    // ── Paso 1 ────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "¿Qué vamos a celebrar?", level: 1 })).toBeVisible({ timeout: 20_000 });
    expect(await page.getByText("Paso 1 de 4").isVisible()).toBe(true);
    // El tipo con el que la invitación quedó REGISTRADA viene preseleccionado y marcado.
    const boda = page.getByRole("radio", { name: /Boda/ });
    await expect(boda).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(page.getByText("Tu evento")).toBeVisible();
    await sinViolacionesGraves(page);

    await page.getByTestId("asistente-continuar").click();

    // ── Paso 2 ────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Elige el punto de partida", level: 1 })).toBeVisible();
    expect(await page.getByText("Paso 2 de 4").isVisible()).toBe(true);
    await expect(page.getByRole("heading", { name: "Boda clásica", level: 2 })).toBeVisible({ timeout: 20_000 });
    // Filtrado por tipo: la plantilla de XV no aparece aquí.
    await expect(page.getByRole("heading", { name: "XV Jardín", level: 2 })).toHaveCount(0);
    await sinViolacionesGraves(page);

    await page.getByTestId("asistente-usar-boda-clasica").click();

    // ── Paso 3 ────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Los datos básicos", level: 1 })).toBeVisible({ timeout: 30_000 });
    // La plantilla YA está aplicada en el servidor (no solo en la pantalla).
    expect((await leerDocumento(invitationId, token)).templateVersion.slug).toBe("boda-clasica");
    // Las etiquetas las pone la plantilla, no el asistente.
    await page.getByRole("textbox", { name: "Novio" }).fill(novio);
    await page.getByLabel("Fecha del evento").fill("2027-05-22");
    await sinViolacionesGraves(page);

    await page.getByTestId("asistente-continuar").click();

    // ── Paso 4 ────────────────────────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Tu invitación ya tiene diseño", level: 1 })).toBeVisible({ timeout: 30_000 });
    // Lo escrito llegó al DOCUMENTO y a la fecha de negocio, por sus rutas reales.
    const documento = await leerDocumento(invitationId, token);
    expect(documento.document.content["couple.groom"]).toEqual({ kind: "person", name: novio });
    expect(await leerFecha(invitationId, token)).toBe("2027-05-22");

    await page.getByTestId("asistente-abrir-editor").click();
    await expect(page).toHaveURL(new RegExp(`/editor/${invitationId}$`), { timeout: 30_000 });
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("UX-N-02 cerrada: una invitación de XV años NO ve las plantillas de boda", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento(TEMPLATE_QUINCE_PREMIUM);
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor?inv=${invitationId}`);
    await expect(page.getByRole("radio", { name: /XV años/ })).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Continuar con XV años" })).toBeVisible();

    // La petición que se manda es la que faltaba: `?eventKind=quince`.
    const peticion = page.waitForRequest((r) => r.url().includes("/editor/templates2/catalog?eventKind=quince"));
    await page.getByTestId("asistente-continuar").click();
    await peticion;

    await expect(page.getByRole("heading", { name: "XV Jardín", level: 2 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Boda clásica", level: 2 })).toHaveCount(0);
    await expect(page.getByTestId("asistente-usar-boda-clasica")).toHaveCount(0);
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("bloqueo por plan: motivo a la vista y una salida real, nunca un control mudo", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento(TEMPLATE_BODA_BASICO); // Boda · plan Básico
  try {
    await sesionDemo(page, token);
    await page.goto(`/editor?paso=plantilla&tipo=wedding&inv=${invitationId}`);
    await expect(page.getByRole("heading", { name: "Boda clásica", level: 2 })).toBeVisible({ timeout: 20_000 });

    // «Boda clásica» exige el plan 2 y esta invitación es de plan 1.
    await expect(page.getByText("Requiere el plan 2").first()).toBeVisible();
    await expect(page.getByTestId("asistente-usar-boda-clasica")).toHaveCount(0);
    const salida = page.getByRole("link", { name: "Ver qué incluye el plan 2" });
    await expect(salida).toBeVisible();
    await expect(salida).toHaveAttribute("href", "/ayuda#planes");

    // Y la salida lleva a algún sitio de verdad (no a «#»).
    expect(await page.locator('a[href="#"]').count()).toBe(0);
    await salida.click();
    await expect(page.getByRole("heading", { name: "Una plantilla dice que necesita otro plan" })).toBeVisible();
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("en el teléfono (390×844) cabe todo y los botones del asistente quedan a la vista", async ({ page }) => {
  const token = await jwtDemo();
  const invitationId = invitacionSinDocumento();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await sesionDemo(page, token);
    await page.goto(`/editor?inv=${invitationId}`);
    await expect(page.getByRole("heading", { name: "¿Qué vamos a celebrar?", level: 1 })).toBeVisible({ timeout: 20_000 });

    const desborde = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(desborde.scroll, "el cuerpo no puede desbordar a lo ancho a 390 px").toBeLessThanOrEqual(desborde.cliente);

    // El botón de continuar vive en la barra fija de abajo: se ve sin desplazarse.
    const continuar = page.getByTestId("asistente-continuar");
    await expect(continuar).toBeInViewport();
    const caja = await continuar.boundingBox();
    expect(caja?.height ?? 0, "objetivo táctil ≥ 24 px (WCAG 2.2 AA 2.5.8)").toBeGreaterThanOrEqual(24);
    await sinViolacionesGraves(page);
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("sin sesión, `/editor` lleva a la pantalla de acceso con el retorno puesto", async ({ page }) => {
  await page.goto("/editor");
  await expect(page).toHaveURL(/\/acceso\?volver=%2Feditor$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
});
