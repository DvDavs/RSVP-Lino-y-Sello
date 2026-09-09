// e2e/preparar-pagos.ts — ayudantes de MI bloque (fase 5, sesión E4 / agente 5-4-E) para los e2e de
// pagos, aparte de `preparar.ts` y `preparar-panel.ts` (no se tocan, `06 §8.2` punto 4 / brief de
// esta sesión). Todo contra el BACKEND REAL, sin mocks (04 §20.3): la única simulación es Stripe en
// sí mismo — su webhook, con una firma calculada de verdad con `STRIPE_WEBHOOK_SECRET`.
//
// El secreto se lee SIEMPRE de `process.env.STRIPE_WEBHOOK_SECRET`, nunca de un literal aquí: los
// specs que lo necesitan hacen `test.skip` con un mensaje claro si falta (nunca se copia a un
// fichero del repo).
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { API_BASE, TEMPLATE_BODA_PREMIUM, revisionActual, sql } from "./preparar.ts";

const FOTO_VERTICAL = fileURLToPath(new URL("./fixtures/foto-vertical.png", import.meta.url));

/** Sufijo corto y único para IDs de prueba (`cs_test_e2e_<sufijo>`, `evt_e2e_<sufijo>...`). */
export function sufijoUnico(): string {
  return `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}

// ── Invitación sin pagar, publicable ────────────────────────────────────────────────────────────

/**
 * Igual que `invitacionSinDocumento` de `preparar.ts` (misma plantilla, mismas nueve columnas
 * booleanas y `total_amount` rellenas a la fuerza — `InvitationEntity` las mapea a primitivos de
 * Kotlin y un NULL revienta cualquier ruta del editor, `handoffs/3-0a.md` §3), cambiando solo
 * `is_paid` a `false`: es el estado real de una invitación recién creada, antes del contrato de
 * pagos (`is_paid` por defecto en la tabla, sin el `pagada = true` que forzaba `templates2` para
 * sus propias fixtures).
 */
export function invitacionSinPagar(customerId: number, templateId = TEMPLATE_BODA_PREMIUM): number {
  const id = sql(`INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished,
      all_events_same_location, uses_templates2, date, time, hashtag, cover_photo_url,
      children_allowed, young_allowed, has_music, has_gallery, has_extra_modules, total_amount,
      created_at, updated_at)
    VALUES (${customerId}, ${templateId}, true, false, false, false, true, '2027-04-18', '17:00', '#PruebaE2EPagos', '',
      false, true, true, true, true, 0, now(), now()) RETURNING id;`);
  return Number(id);
}

/**
 * `crearInvitacionPublicable` de `preparar-panel.ts` (área prohibida de este bloque) SIEMPRE crea
 * la invitación bajo `customerIdDemo()` — `invitacionSinDocumento()` sin argumentos, dentro de esa
 * función, usa su propio valor por defecto — sin importar de QUIÉN sea el `token` que se le pase.
 * Sirve tal cual a los specs existentes (`publicar.spec.ts`, `cambiar-fecha.spec.ts`), que siempre
 * usan `jwtDemo()`. Este bloque SÍ necesita invitaciones de cuentas propias y ajenas de verdad (IDOR,
 * `pagos-compra.spec.ts` caso f) — de ahí esta variante, misma receta (choose-template + subir un
 * asset + los cuatro bloques que bloquean `canPublish`) pero con el `customerId` correcto.
 */
async function subirAsset(invitationId: number, token: string, ruta: string, contentType: string): Promise<string> {
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/assets`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": contentType },
    body: readFileSync(ruta),
  });
  if (!r.ok) throw new Error(`POST .../assets respondió ${r.status}`);
  const cuerpo = (await r.json()) as { assetId: string };
  return cuerpo.assetId;
}

/** Invitación PROPIA de `customerId` (dueña real, no la demo), sin pagar (`is_paid=false`) y con
 *  contenido publicable (mismos cuatro bloques que `crearInvitacionPublicable`). */
export async function invitacionSinPagarPublicable(
  token: string,
  customerId: number,
  templateId = TEMPLATE_BODA_PREMIUM,
): Promise<number> {
  const invitationId = invitacionSinPagar(customerId, templateId);
  const choose = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document:choose-template`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ templateSlug: "boda-clasica", templateVersion: "1.0.0" }),
  });
  if (!choose.ok) throw new Error(`:choose-template respondió ${choose.status}`);

  const assetPortada = await subirAsset(invitationId, token, FOTO_VERTICAL, "image/png");
  const baseRevision = await revisionActual(invitationId, token);
  const r = await fetch(`${API_BASE}/editor/invitations/${invitationId}/document/operations`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      baseRevision,
      clientBatchId: `pagos${Date.now().toString(36)}`,
      operations: [
        { op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "Ana & Luis" } },
        { op: "setBlock", blockId: "couple.groom", value: { kind: "person", name: "Luis" } },
        { op: "setBlock", blockId: "couple.bride", value: { kind: "person", name: "Ana" } },
        { op: "setBlock", blockId: "cover.image", value: { kind: "image", assetId: assetPortada, alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } } },
      ],
    }),
  });
  if (!r.ok) throw new Error(`No pude dejar publicable la invitación de prueba (HTTP ${r.status})`);
  return invitationId;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────────────────────────

export interface PlanRecomendado {
  readonly codigo: string;
  readonly precioCentavos: number;
  readonly moneda: string;
}

/** `GET /public/plans` (sin sesión) → el plan marcado `recomendado`. */
export async function planRecomendado(): Promise<PlanRecomendado> {
  const r = await fetch(`${API_BASE}/public/plans`);
  if (!r.ok) throw new Error(`GET /public/plans respondió ${r.status}`);
  const cuerpo = (await r.json()) as {
    planes: Array<{ codigo: string; precioCentavos: number; moneda: string; recomendado: boolean }>;
  };
  const plan = cuerpo.planes.find((p) => p.recomendado);
  if (!plan) throw new Error("El catálogo no trae ningún plan recomendado");
  return { codigo: plan.codigo, precioCentavos: plan.precioCentavos, moneda: plan.moneda };
}

// ── Pago pendiente, por SQL (no hay ruta: crearlo de verdad exige `STRIPE_SECRET_KEY`, ausente en
//    este entorno — `POST /product/payments/checkout` responde `503`) ─────────────────────────────

/**
 * Fila `PENDIENTE` en `product_payment`, lista para que el webhook simulado la marque `PAGADA`.
 * `sessionId` debe ser único por prueba (`cs_test_e2e_<sufijo>`): la columna es `UNIQUE`.
 */
export function pagoPendiente(
  invitationId: number,
  customerId: number,
  plan: PlanRecomendado,
  sessionId: string,
  importeCentavos = plan.precioCentavos,
): number {
  const planId = sql(`SELECT id FROM product_plan WHERE codigo = '${plan.codigo}';`);
  if (!planId) throw new Error(`No hay product_plan con código '${plan.codigo}'`);
  const id = sql(`INSERT INTO product_payment
      (invitation_id, customer_id, product_plan_id, estado, importe_centavos, moneda,
       stripe_checkout_session_id, created_at, updated_at)
    VALUES (${invitationId}, ${customerId}, ${planId}, 'PENDIENTE', ${importeCentavos}, '${plan.moneda}',
       '${sessionId}', now(), now()) RETURNING id;`);
  return Number(id);
}

// ── El webhook simulado ─────────────────────────────────────────────────────────────────────────

/**
 * `t=<t>,v1=<hmac>` — la misma forma que exige el SDK de Stripe (`Webhook.constructEvent`),
 * `crypto.createHmac("sha256", secret).update(`${t}.${payload}`)`. Tolerancia del backend: 300 s.
 */
export function firmarWebhook(payload: string, secret: string, t: number = Math.floor(Date.now() / 1000)): string {
  const hmac = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${hmac}`;
}

export interface RespuestaWebhook {
  readonly status: number;
  readonly json: unknown;
}

/** `POST /public/stripe/webhook`, cuerpo crudo + `Stripe-Signature`. */
export async function enviarWebhook(payload: string, firma?: string): Promise<RespuestaWebhook> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (firma !== undefined) headers["Stripe-Signature"] = firma;
  const r = await fetch(`${API_BASE}/public/stripe/webhook`, { method: "POST", headers, body: payload });
  const texto = await r.text();
  let json: unknown;
  try {
    json = texto.length > 0 ? JSON.parse(texto) : undefined;
  } catch {
    json = texto;
  }
  return { status: r.status, json };
}

export interface DatosEventoSesionCompletada {
  readonly eventId: string;
  readonly sessionId: string;
  readonly paymentId: number;
  readonly invitationId: number;
  readonly planCodigo: string;
  readonly amountTotal: number;
  readonly currency: string;
}

/**
 * `checkout.session.completed`, `payment_status: "paid"` — forma exacta verificada contra el
 * backend vivo en `handoffs/5-4-A.md` §"Probar el webhook a mano". Sin saltos de línea: la firma se
 * calcula sobre los bytes exactos que se envían.
 */
export function eventoSesionCompletada(datos: DatosEventoSesionCompletada): string {
  const evento = {
    id: datos.eventId,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: datos.sessionId,
        object: "checkout.session",
        payment_status: "paid",
        amount_total: datos.amountTotal,
        currency: datos.currency.toLowerCase(),
        payment_intent: `pi_test_${datos.sessionId}`,
        metadata: {
          invitationId: String(datos.invitationId),
          paymentId: String(datos.paymentId),
          planCodigo: datos.planCodigo,
        },
      },
    },
  };
  return JSON.stringify(evento);
}

// ── Limpieza ─────────────────────────────────────────────────────────────────────────────────────

/** Antes de `borrarInvitacion`: `product_payment.invitation_id` no tiene `ON DELETE CASCADE` desde
 *  el lado de la invitación en todos los entornos de prueba — se borra explícito por prudencia. */
export function borrarPagosDe(invitationId: number): void {
  try {
    sql(`DELETE FROM product_payment WHERE invitation_id = ${invitationId};`);
  } catch {
    /* puede no haber ninguno */
  }
}

/** Filas de `product_stripe_event` de esta prueba, por el sufijo con el que se nombraron los `evt_e2e_*`. */
export function borrarEventosDe(sufijo: string): void {
  try {
    sql(`DELETE FROM product_stripe_event WHERE event_id LIKE 'evt_e2e_${sufijo}%';`);
  } catch {
    /* puede no haber ninguno */
  }
}
