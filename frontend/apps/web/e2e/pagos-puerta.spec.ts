// e2e/pagos-puerta.spec.ts — fase 5, sesión E4 (agente 5-4-E): la PUERTA de publicación por plan
// pagado (`ADR-5-0B-01`, `handoffs/5-4-contrato-pagos.md` §2.6). Contra el backend real, sin mocks
// (04 §20.3): una invitación sin pagar no puede publicarse, ni por API ni desde la interfaz, y el
// bloqueo lleva a la pantalla del plan.
//
// Este entorno NO tiene `STRIPE_SECRET_KEY`: `GET /public/plans` responde `pagoEnLinea:false`
// (verificado contra el backend vivo de esta sesión), así que `OfertaDePlan.tsx` nunca pinta el
// botón `plan-pagar` — pinta `plan-sin-pago-en-linea` (ver el componente: `pagoDisponible` exige
// `catalogo.pagoEnLinea === true`). Se comprueba esa rama, que es la real en este entorno.
import { expect, test } from "@playwright/test";
import { API_BASE, borrarInvitacion, customerIdDemo, cuentaNueva, jwtDemo, revisionActual, sesionDemo } from "./preparar.ts";
import { invitacionSinPagarPublicable } from "./preparar-pagos.ts";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe("pagos · la puerta de publicación (TPL_PLAN_UNPAID)", () => {
  test("API · sin pagar, el preflight bloquea y el release responde 402", async () => {
    const { token, customerId } = await cuentaNueva();
    // Invitación PROPIA de esta cuenta nueva (no la de `crearInvitacionPublicable`, que siempre usa
    // `customerIdDemo()` sin importar el token — `preparar-pagos.ts` explica por qué), publicable en
    // contenido y `is_paid=false`: el estado exacto que esta sesión añade a la puerta.
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    try {
      const preflight = await fetch(`${API_BASE}/editor/invitations/${invitationId}/release/preflight`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(preflight.status).toBe(200);
      const cuerpoPreflight = (await preflight.json()) as { canPublish: boolean; blockers: Array<{ code: string }> };
      expect(cuerpoPreflight.canPublish).toBe(false);
      expect(cuerpoPreflight.blockers[0]?.code).toBe("TPL_PLAN_UNPAID");

      const baseRevision = await revisionActual(invitationId, token);
      const release = await fetch(`${API_BASE}/editor/invitations/${invitationId}/release`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ baseRevision }),
      });
      expect(release.status).toBe(402);
      const cuerpoRelease = (await release.json()) as { code: string };
      expect(cuerpoRelease.code).toBe("TPL_PLAN_UNPAID");
    } finally {
      borrarInvitacion(invitationId);
    }
  });

  test("interfaz · el diálogo de publicar bloquea y lleva a la pantalla del plan", async ({ page }) => {
    test.slow();
    const token = await jwtDemo();
    const invitationId = await invitacionSinPagarPublicable(token, customerIdDemo());
    try {
      await sesionDemo(page, token);
      await page.goto(`/editor/${invitationId}`);
      await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });
      await page.getByTestId("abrir-publicar").click();
      await expect(page.getByTestId("publish-dialog")).toBeVisible();

      await expect(page.getByText(/falta el plan/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("confirmar-publicar")).toBeDisabled();

      const irAlPlan = page.getByTestId("publicar-ir-al-plan");
      await expect(irAlPlan).toBeVisible();
      await irAlPlan.click();

      await expect(page).toHaveURL(new RegExp(`/editor/${invitationId}/plan$`));
      await expect(page.getByTestId("plan-sin-pago")).toBeVisible({ timeout: 15_000 });
      // Sin `STRIPE_SECRET_KEY` en el backend, `catalogo.pagoEnLinea` es `false`: no hay botón
      // `plan-pagar` (`OfertaDePlan.tsx`, `pagoDisponible` exige `pagoEnLinea === true`) — se pinta
      // el bloque honesto de «el pago en línea todavía no está disponible».
      await expect(page.getByTestId("plan-sin-pago-en-linea")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("plan-pagar")).toHaveCount(0);
    } finally {
      borrarInvitacion(invitationId);
    }
  });
});
