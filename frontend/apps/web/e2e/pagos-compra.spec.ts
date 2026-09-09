// e2e/pagos-compra.spec.ts — fase 5, sesión E4 (agente 5-4-E): el flujo de compra completo con el
// webhook de Stripe SIMULADO (firma real, calculada con `STRIPE_WEBHOOK_SECRET`; sin
// `STRIPE_SECRET_KEY` en este entorno, `POST /product/payments/checkout` responde `503
// PAY_NOT_CONFIGURED`, así que el checkout en sí no se puede abrir — lo que se prueba es TODO lo que
// pasa después: el webhook marca pagada, la idempotencia, la verificación de firma e importe, el
// aislamiento por cuenta y las tres pantallas que leen el resultado).
//
// Cada `test` crea su propia cuenta/invitación/pago y limpia en `finally` (`pruebas-producto` §4).
//
// DESVIACIÓN DOCUMENTADA (h): `GET /public/plans` de este backend responde `pagoEnLinea:false`
// (verificado en vivo, sin `STRIPE_SECRET_KEY`). `TarjetaPlan.tsx` calcula
// `pagoDisponible = catalogo.pagoEnLinea && entornoConfigurado`, así que en ESTE entorno el botón
// «Elegir …» de `/precios` apunta SIEMPRE a `#contacto`, tenga o no la URL un `?inv=`: el camino
// `/editor/{id}/plan?plan=<codigo>` solo existe cuando el backend además tiene clave secreta de
// Stripe, cosa que esta sesión tiene prohibido tocar (brief: «no reinicies el backend»). Se prueba
// la rama real (honesta, G-01: nunca un botón que promete un pago que no se puede abrir) en vez de
// la que el wireframe da por hecha con Stripe configurado.
import { expect, test } from "@playwright/test";
import { API_BASE, borrarInvitacion, customerIdDemo, cuentaNueva, jwtDemo, revisionActual, sesionDemo } from "./preparar.ts";
import {
  borrarEventosDe,
  borrarPagosDe,
  enviarWebhook,
  eventoSesionCompletada,
  firmarWebhook,
  invitacionSinPagarPublicable,
  pagoPendiente,
  planRecomendado,
  sufijoUnico,
  type PlanRecomendado,
} from "./preparar-pagos.ts";

test.use({ viewport: { width: 1440, height: 900 } });

const SECRETO = process.env.STRIPE_WEBHOOK_SECRET;
const MENSAJE_SIN_SECRETO =
  "Falta STRIPE_WEBHOOK_SECRET en el entorno de esta corrida: exporta la variable del backend real " +
  "(ver docs/rediseno-plantillas/memoria/handoffs/5-4-E.md) antes de correr pagos-compra.spec.ts.";

interface PlanDeInvitacionDto {
  readonly pagada: boolean;
  readonly plan: { readonly codigo: string } | null;
  readonly pagos: ReadonlyArray<{ readonly estado: string; readonly id: number }>;
}

async function obtenerPlan(invitationId: number, token: string): Promise<{ status: number; body: PlanDeInvitacionDto }> {
  const r = await fetch(`${API_BASE}/product/payments/invitations/${invitationId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: r.status, body: (await r.json()) as PlanDeInvitacionDto };
}

test.describe("pagos · compra con webhook simulado", () => {
  test("webhook firmado marca pagada; el replay del mismo evento es idempotente", async () => {
    test.skip(!SECRETO, MENSAJE_SIN_SECRETO);
    const secreto = SECRETO as string;
    const sufijo = sufijoUnico();
    const { token, customerId } = await cuentaNueva();
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    let plan: PlanRecomendado;
    let paymentId: number;
    try {
      plan = await planRecomendado();
      const sessionId = `cs_test_e2e_${sufijo}`;
      paymentId = pagoPendiente(invitationId, customerId, plan, sessionId);

      const payload = eventoSesionCompletada({
        eventId: `evt_e2e_${sufijo}_completado`,
        sessionId,
        paymentId,
        invitationId,
        planCodigo: plan.codigo,
        amountTotal: plan.precioCentavos,
        currency: plan.moneda,
      });
      const firma = firmarWebhook(payload, secreto);

      const primera = await enviarWebhook(payload, firma);
      expect(primera.status).toBe(200);
      expect((primera.json as { received: boolean }).received).toBe(true);
      expect((primera.json as { duplicado?: boolean }).duplicado).toBeFalsy();

      const trasPagar = await obtenerPlan(invitationId, token);
      expect(trasPagar.status).toBe(200);
      expect(trasPagar.body.pagada).toBe(true);
      expect(trasPagar.body.plan?.codigo).toBe(plan.codigo);
      expect(trasPagar.body.pagos).toHaveLength(1);
      expect(trasPagar.body.pagos[0]?.estado).toBe("PAGADO");

      // ── replay: el MISMO evento, la MISMA firma ──────────────────────────────────────────────
      const segunda = await enviarWebhook(payload, firma);
      expect(segunda.status).toBe(200);
      expect((segunda.json as { duplicado?: boolean }).duplicado).toBe(true);

      const trasReplay = await obtenerPlan(invitationId, token);
      expect(trasReplay.body.pagos).toHaveLength(1);
      expect(trasReplay.body.pagos.filter((p) => p.estado === "PAGADO")).toHaveLength(1);
    } finally {
      borrarPagosDe(invitationId);
      borrarEventosDe(sufijo);
      borrarInvitacion(invitationId);
    }
  });

  test("firma inválida, ausente o caducada: el webhook rechaza y no marca pagada", async () => {
    test.skip(!SECRETO, MENSAJE_SIN_SECRETO);
    const secreto = SECRETO as string;
    const sufijo = sufijoUnico();
    const { token, customerId } = await cuentaNueva();
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    try {
      const plan = await planRecomendado();
      const sessionId = `cs_test_e2e_${sufijo}`;
      const paymentId = pagoPendiente(invitationId, customerId, plan, sessionId);
      const payload = eventoSesionCompletada({
        eventId: `evt_e2e_${sufijo}_firma`,
        sessionId,
        paymentId,
        invitationId,
        planCodigo: plan.codigo,
        amountTotal: plan.precioCentavos,
        currency: plan.moneda,
      });

      // a) otro secreto
      const otraFirma = firmarWebhook(payload, "whsec_otra_cuenta_no_es_esta");
      const rOtraFirma = await enviarWebhook(payload, otraFirma);
      expect(rOtraFirma.status).toBe(400);
      expect((rOtraFirma.json as { code?: string }).code).toBe("PAY_WEBHOOK_SIGNATURE_INVALID");

      // b) sin cabecera
      const rSinCabecera = await enviarWebhook(payload);
      expect(rSinCabecera.status).toBe(400);

      // c) `t` de hace 10 minutos (tolerancia real: 300 s)
      const hace10Min = Math.floor(Date.now() / 1000) - 600;
      const firmaVieja = firmarWebhook(payload, secreto, hace10Min);
      const rFirmaVieja = await enviarWebhook(payload, firmaVieja);
      expect(rFirmaVieja.status).toBe(400);

      const plan1 = await obtenerPlan(invitationId, token);
      expect(plan1.body.pagada).toBe(false);
    } finally {
      borrarPagosDe(invitationId);
      borrarEventosDe(sufijo);
      borrarInvitacion(invitationId);
    }
  });

  test("un importe manipulado no marca la invitación como pagada", async () => {
    test.skip(!SECRETO, MENSAJE_SIN_SECRETO);
    const secreto = SECRETO as string;
    const sufijo = sufijoUnico();
    const { token, customerId } = await cuentaNueva();
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    try {
      const plan = await planRecomendado();
      const sessionId = `cs_test_e2e_${sufijo}`;
      const paymentId = pagoPendiente(invitationId, customerId, plan, sessionId);

      // La sesión de Stripe "dice" que se cobraron 100 centavos, muy por debajo del precio real.
      const payload = eventoSesionCompletada({
        eventId: `evt_e2e_${sufijo}_importe`,
        sessionId,
        paymentId,
        invitationId,
        planCodigo: plan.codigo,
        amountTotal: 100,
        currency: plan.moneda,
      });
      const firma = firmarWebhook(payload, secreto);
      const r = await enviarWebhook(payload, firma);
      // El backend no reintenta: procesa, registra `IMPORTE_DISTINTO` y responde 200 igualmente.
      expect(r.status).toBe(200);

      const trasIntento = await obtenerPlan(invitationId, token);
      expect(trasIntento.body.pagada).toBe(false);
    } finally {
      borrarPagosDe(invitationId);
      borrarEventosDe(sufijo);
      borrarInvitacion(invitationId);
    }
  });

  test("IDOR: una cuenta ajena no ve el pago ni la invitación de otra", async () => {
    test.skip(!SECRETO, MENSAJE_SIN_SECRETO);
    const secreto = SECRETO as string;
    const sufijo = sufijoUnico();
    const { token, customerId } = await cuentaNueva();
    const ajena = await cuentaNueva();
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    try {
      const plan = await planRecomendado();
      const sessionId = `cs_test_e2e_${sufijo}`;
      const paymentId = pagoPendiente(invitationId, customerId, plan, sessionId);
      const payload = eventoSesionCompletada({
        eventId: `evt_e2e_${sufijo}_idor`,
        sessionId,
        paymentId,
        invitationId,
        planCodigo: plan.codigo,
        amountTotal: plan.precioCentavos,
        currency: plan.moneda,
      });
      const firma = firmarWebhook(payload, secreto);
      const r = await enviarWebhook(payload, firma);
      expect(r.status).toBe(200);

      // La dueña sí la ve.
      const dueña = await obtenerPlan(invitationId, token);
      expect(dueña.status).toBe(200);
      expect(dueña.body.pagada).toBe(true);

      // La cuenta ajena, no: 404, misma respuesta que una invitación inexistente.
      const rAjena = await fetch(`${API_BASE}/product/payments/invitations/${invitationId}`, {
        headers: { authorization: `Bearer ${ajena.token}` },
      });
      expect(rAjena.status).toBe(404);
      const cuerpoAjeno = (await rAjena.json()) as { code?: string };
      expect(cuerpoAjeno.code).toBe("PAY_INVITATION_NOT_FOUND");

      // Y el historial de la cuenta ajena no trae ESTE paymentId.
      const rHistorialAjeno = await fetch(`${API_BASE}/product/payments/pagos`, {
        headers: { authorization: `Bearer ${ajena.token}` },
      });
      expect(rHistorialAjeno.status).toBe(200);
      const historialAjeno = (await rHistorialAjeno.json()) as { pagos: Array<{ id: number }> };
      expect(historialAjeno.pagos.some((p) => p.id === paymentId)).toBe(false);
    } finally {
      borrarPagosDe(invitationId);
      borrarEventosDe(sufijo);
      borrarInvitacion(invitationId);
    }
  });

  test("interfaz: plan pagado, /pago confirmado y cancelado, y ya se puede publicar", async ({ page }) => {
    test.skip(!SECRETO, MENSAJE_SIN_SECRETO);
    test.slow();
    const secreto = SECRETO as string;
    const sufijo = sufijoUnico();
    const token = await jwtDemo();
    const customerId = customerIdDemo();
    const invitationId = await invitacionSinPagarPublicable(token, customerId);
    try {
      const plan = await planRecomendado();
      const sessionId = `cs_test_e2e_${sufijo}`;
      const paymentId = pagoPendiente(invitationId, customerId, plan, sessionId);
      const payload = eventoSesionCompletada({
        eventId: `evt_e2e_${sufijo}_interfaz`,
        sessionId,
        paymentId,
        invitationId,
        planCodigo: plan.codigo,
        amountTotal: plan.precioCentavos,
        currency: plan.moneda,
      });
      const r = await enviarWebhook(payload, firmarWebhook(payload, secreto));
      expect(r.status).toBe(200);

      await sesionDemo(page, token);

      // ── /editor/{id}/plan: plan-con-pago con el nombre del plan, historial con una fila ────────
      await page.goto(`/editor/${invitationId}/plan`);
      const conPago = page.getByTestId("plan-con-pago");
      await expect(conPago).toBeVisible({ timeout: 15_000 });
      await expect(conPago).toContainText(plan.codigo === "sencillo" ? "Sencillo" : plan.codigo === "grande" ? "Grande" : "Fiesta");
      await expect(page.getByTestId("plan-historial")).toBeVisible();
      await expect(page.getByTestId(`plan-historial-fila-${paymentId}`)).toBeVisible();

      // ── /pago?inv={id}&sesion=<sessionId>: confirmado (el backend YA dice pagada, sin esperar) ──
      await page.goto(`/pago?inv=${invitationId}&sesion=${sessionId}`);
      await expect(page.getByTestId("pago-confirmado")).toBeVisible({ timeout: 15_000 });

      // ── /pago?inv={id}&cancelado=1: cancelado, pase lo que pase con el estado del pago ─────────
      await page.goto(`/pago?inv=${invitationId}&cancelado=1`);
      await expect(page.getByTestId("pago-cancelado")).toBeVisible({ timeout: 10_000 });

      // ── ya se puede publicar (la puerta TPL_PLAN_UNPAID se abrió) ───────────────────────────────
      const baseRevision = await revisionActual(invitationId, token);
      const release = await fetch(`${API_BASE}/editor/invitations/${invitationId}/release`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ baseRevision }),
      });
      expect(release.status).toBe(201);
    } finally {
      borrarPagosDe(invitationId);
      borrarEventosDe(sufijo);
      borrarInvitacion(invitationId);
    }
  });

  test("/precios muestra el catálogo real con tres planes y sus botones", async ({ page }) => {
    await page.goto("/precios");
    const catalogo = page.getByTestId("precios-catalogo");
    await expect(catalogo).toBeVisible({ timeout: 15_000 });

    for (const codigo of ["sencillo", "fiesta", "grande"]) {
      await expect(page.getByTestId(`precios-plan-${codigo}`)).toBeVisible();
      await expect(page.getByTestId(`precios-elegir-${codigo}`)).toBeVisible();
    }
    // Recomendado: exactamente uno.
    await expect(page.getByText("Recomendado")).toHaveCount(1);

    // Ver la desviación documentada arriba: sin `STRIPE_SECRET_KEY` en el backend, `pagoEnLinea`
    // es `false` y NINGÚN botón de esta pantalla promete un pago (G-01) — van a `#contacto`, con o
    // sin `?inv=`. Se prueba la rama real, no la que exigiría reconfigurar el backend.
    await expect(page.getByTestId("precios-elegir-fiesta")).toHaveAttribute("href", "#contacto");
    await expect(page.getByText(/el pago en línea todavía no está disponible/i).first()).toBeVisible();

    const token = await jwtDemo();
    const invitationId = await invitacionSinPagarPublicable(token, customerIdDemo());
    try {
      await page.goto(`/precios?inv=${invitationId}`);
      await expect(page.getByTestId("precios-catalogo")).toBeVisible({ timeout: 15_000 });
      // Mismo backend, mismo `pagoEnLinea:false`: el `?inv=` no cambia el destino honesto.
      await expect(page.getByTestId("precios-elegir-fiesta")).toHaveAttribute("href", "#contacto");
    } finally {
      borrarInvitacion(invitationId);
    }
  });
});
