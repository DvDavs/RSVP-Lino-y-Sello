// e2e/cambiar-fecha.spec.ts — EL TERCER VERBO DEL CRITERIO DE TERMINADO (U-3 / I-06).
//
// «La clienta cambia la fecha de su evento y la ve reflejada.» Hasta la fase 3-B era imposible:
// NINGUNA ruta de cliente escribía `invitation.date` — sólo `PUT /admin/invitations/{id}` con rol
// ADMIN (`InvitationAdminService.kt:414`) —, así que el editor enseñaba la fecha con candado y una
// frase que no llevaba a ninguna parte. `ADR-3-8-06` lo dejó escrito con todas las letras: «no
// existe "allí" que edite la fecha». Ahora existe: `PUT /editor/invitations/{id}/event`
// (`03 §3.20`, `ADR-3B-I06-01`), y esta prueba recorre el verbo entero **contra el backend real**:
// la clienta la cambia en el panel, la ve en el panel, está guardada en Postgres, el editor avisa de
// que hay que volver a publicar, y tras publicar el INVITADO la ve en el enlace público.
import { expect, test } from "@playwright/test";
import { API_BASE, borrarInvitacion, jwtDemo, sesionDemo, sql } from "./preparar.ts";
import { crearInvitacionPublicable, sembrarManifiesto } from "./preparar-panel.ts";

test.use({ viewport: { width: 1440, height: 900 } });

/** La que siembra `invitacionSinDocumento()`, y la misma que guarda el clúster de demostración. */
const FECHA_INICIAL = "18 de abril de 2027";
const FECHA_NUEVA_ISO = "2029-03-07";
const FECHA_NUEVA = "7 de marzo de 2029";

test("la clienta cambia la fecha de su evento desde el editor y sus invitados la ven", async ({ page, browser }) => {
  test.slow();
  const token = await jwtDemo();
  // Invitación propia y desechable: nunca se toca la de demostración compartida (`06 §8.2` punto 4).
  const invitationId = await crearInvitacionPublicable(token);

  try {
    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByTestId("section-row-cover")).toBeVisible({ timeout: 20_000 });
    await sembrarManifiesto(page, invitationId);
    await page.getByTestId("section-row-cover").click();

    // ── 1. La fecha ya no es un candado mudo: se ve, y hay un botón que SÍ la edita ──────────
    await expect(page.getByText(FECHA_INICIAL)).toBeVisible();
    const abrir = page.getByRole("button", { name: "Cambiar la fecha" });
    await expect(abrir).toBeVisible();

    // ── 2. La cambia ─────────────────────────────────────────────────────────────────────────
    await abrir.click();
    const campo = page.getByLabel("Nueva fecha del evento");
    await expect(campo).toBeVisible();
    await campo.fill(FECHA_NUEVA_ISO);

    const escritura = page.waitForResponse(
      (r) => r.url().endsWith(`/editor/invitations/${invitationId}/event`) && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Guardar la fecha" }).click();
    expect((await escritura).status(), "PUT …/event tiene que responder 200").toBe(200);

    // ── 3. La VE reflejada, ya formateada en es-MX por el servidor (R6: aquí no se formatea) ──
    await expect(page.getByText(FECHA_NUEVA)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(FECHA_INICIAL)).toHaveCount(0);
    await expect(page.getByText("Fecha actualizada.")).toBeVisible();

    // ── 4. Y está guardada de verdad en `invitation`, que es donde vive (bloque `business`) ───
    expect(sql(`SELECT date FROM invitation WHERE id = ${invitationId};`)).toBe(FECHA_NUEVA_ISO);

    // ── 5. Publica y su invitado ve la fecha nueva en el enlace público ───────────────────────
    const publicToken = await publicar(invitationId, token);
    const invitado = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const paginaInvitado = await invitado.newPage();
      await paginaInvitado.goto(`/i/${publicToken}`);
      // El `<time datetime>` de la portada: el valor crudo Y el texto formateado, los dos nuevos.
      // (`getByText` a secas casa tres veces —portada, «Los novios» y el `<h1>` para lectores—,
      //  que es en sí la prueba de que la fecha llegó a toda la invitación.)
      const fechaPublicada = paginaInvitado.locator(`time[datetime="${FECHA_NUEVA_ISO}"]`).first();
      await expect(fechaPublicada).toBeVisible({ timeout: 20_000 });
      await expect(fechaPublicada).toHaveText(FECHA_NUEVA);
    } finally {
      await invitado.close();
    }
  } finally {
    borrarInvitacion(invitationId);
  }
});

test("cambiar la fecha de una invitación YA publicada avisa de que hay que volver a publicar", async ({ page }) => {
  test.slow();
  const token = await jwtDemo();
  const invitationId = await crearInvitacionPublicable(token);

  try {
    // Se publica ANTES de tocar la fecha: es el caso en el que el release queda desactualizado.
    await publicar(invitationId, token);

    await sesionDemo(page, token);
    await page.goto(`/editor/${invitationId}`);
    await expect(page.getByTestId("section-row-cover")).toBeVisible({ timeout: 20_000 });
    await sembrarManifiesto(page, invitationId);
    await page.getByTestId("section-row-cover").click();

    await page.getByRole("button", { name: "Cambiar la fecha" }).click();
    await page.getByLabel("Nueva fecha del evento").fill("2029-11-30");
    const escritura = page.waitForResponse(
      (r) => r.url().endsWith(`/editor/invitations/${invitationId}/event`) && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Guardar la fecha" }).click();
    await escritura;

    // La invalidación NO es automática (`ADR-3B-I06-01`): se le dice qué falta y qué hacer.
    await expect(page.getByText(/Vuelve a publicar/i)).toBeVisible({ timeout: 10_000 });
  } finally {
    borrarInvitacion(invitationId);
  }
});

/** Publica por la ruta real y devuelve el `publicToken` del enlace que la clienta comparte. */
async function publicar(invitationId: number, token: string): Promise<string> {
  const documento = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const cuerpo = (await documento.json()) as { revision: number; publicToken: string };
  const release = await fetch(`${API_BASE}/editor/invitations/${invitationId}/release`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ baseRevision: cuerpo.revision }),
  });
  if (!release.ok) throw new Error(`POST …/release respondió ${release.status}`);
  return cuerpo.publicToken;
}
