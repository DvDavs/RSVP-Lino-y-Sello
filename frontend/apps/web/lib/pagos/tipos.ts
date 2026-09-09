// lib/pagos/tipos.ts — los tipos del contrato de planes y pagos (fase 5, sesión E4).
//
// Fuente: `docs/rediseno-plantillas/memoria/handoffs/5-4-contrato-pagos.md` §2 (rutas) y §3
// (códigos `PAY_*`). Este módulo NO valida nada (no hay un esquema Zod compartido para el
// transporte HTTP de pagos, igual que `lib/errors.ts` con `TplErrorResponse`): son las formas que
// `lib/pagos/cliente.ts` promete devolver, más el error tipado que lanza en su lugar.
//
// Ningún tipo de aquí calcula un precio: todo importe es el que manda el backend en centavos.

/** `03-api.md` §5 / contrato §3: los códigos `PAY_*` documentados, más el catch-all local. */
export const PAY_ERROR_CODES = [
  "PAY_NOT_CONFIGURED",
  "PAY_PLAN_NOT_FOUND",
  "PAY_INVITATION_NOT_FOUND",
  "PAY_ALREADY_PAID",
  "PAY_WEBHOOK_SIGNATURE_INVALID",
  "PAY_STRIPE_UNAVAILABLE",
  "PAY_MALFORMED_JSON",
  /** Catch-all de `lib/pagos/cliente.ts`: no-2xx sin `code` reconocible como `PAY_*`. */
  "PAY_DESCONOCIDO",
] as const;

export type PayErrorCode = (typeof PAY_ERROR_CODES)[number];

/**
 * Error tipado del módulo de pagos. Mismo papel que `ApiError` de `lib/errors.ts` (conserva el
 * `code` del backend) pero para el prefijo `PAY_*`, que vive en un módulo de producto distinto de
 * `templates2` y no comparte forma de error con él más que la envoltura `{code, message, details}`.
 *
 * `code` acepta cualquier `PAY_*` que el backend mande —incluido uno que el frontend todavía no
 * conoce—: `isKnownCode` dice si está en `PAY_ERROR_CODES`, para quien quiera decidir un mensaje
 * genérico sin fingir que reconoce el código.
 */
export class ErrorDePago extends Error {
  readonly kind = "pago-error" as const;
  readonly code: PayErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly isKnownCode: boolean;

  constructor(code: string, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ErrorDePago";
    this.isKnownCode = (PAY_ERROR_CODES as readonly string[]).includes(code);
    this.code = (this.isKnownCode ? code : "PAY_DESCONOCIDO") as PayErrorCode;
    this.status = status;
    this.details = details;
  }
}

/** `GET /public/plans` (§2.1) — un plan del catálogo público. */
export interface Plan {
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** Importe en centavos. Nunca se calcula en el frontend: es el que manda el servidor. */
  readonly precioCentavos: number;
  readonly moneda: string;
  /** `null` = sin límite de invitados. */
  readonly invitadosMax: number | null;
  /** Ya son frases listas para pintar («Hasta 150 invitados», «Galería de fotos»…). */
  readonly incluye: readonly string[];
  readonly recomendado: boolean;
  readonly orden: number;
}

/** `GET /public/plans` (§2.1) — respuesta completa. */
export interface CatalogoDePlanes {
  readonly moneda: string;
  readonly planes: readonly Plan[];
  /** ¿El backend tiene `STRIPE_SECRET_KEY`? Con `false`, ningún botón debe prometer un pago. */
  readonly pagoEnLinea: boolean;
}

/** `estado` de `product_payment` (§1, tabla `product_payment`). */
export type EstadoDePago = "PENDIENTE" | "PAGADO" | "FALLIDO" | "CADUCADO" | "REEMBOLSADO";

/**
 * Un pago del historial. Vale tanto para `pagos` dentro de `PlanDeInvitacion` (§2.2, sin
 * `invitationId`/`nombreEvento`: ya se sabe de qué invitación se trata) como para
 * `obtenerMisPagos()` (§2.3, con los dos, porque agrupa pagos de varias invitaciones).
 */
export interface Pago {
  readonly id: number;
  readonly estado: EstadoDePago;
  readonly planCodigo: string;
  readonly planNombre: string;
  readonly importeCentavos: number;
  readonly moneda: string;
  readonly creadoEn: string;
  readonly pagadoEn: string | null;
  /** `receipt_url` de Stripe si la hubo. */
  readonly comprobanteUrl: string | null;
  /** Solo presente en `obtenerMisPagos()` (§2.3). */
  readonly invitationId?: number;
  readonly nombreEvento?: string | null;
}

/**
 * `GET /product/payments/invitations/{invitationId}` (§2.2). El `plan` embebido es un resumen (sin
 * `descripcion`, `recomendado` ni `orden`: el backend no los manda aquí) — `null` sin pago.
 */
export interface PlanDeInvitacion {
  readonly invitationId: number;
  readonly pagada: boolean;
  readonly nombreEvento: string | null;
  readonly plan: Pick<Plan, "codigo" | "nombre" | "precioCentavos" | "moneda" | "invitadosMax" | "incluye"> | null;
  readonly pagadoEn: string | null;
  /** Historial de ESTA invitación, más reciente primero. */
  readonly pagos: readonly Pago[];
  readonly pagoEnLinea: boolean;
}

/** `POST /product/payments/checkout` (§2.4) — respuesta `201`. */
export interface CheckoutCreado {
  readonly checkoutUrl: string;
  readonly sessionId: string;
  readonly paymentId: number;
}
