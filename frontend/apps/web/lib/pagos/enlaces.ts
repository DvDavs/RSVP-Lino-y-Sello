// lib/pagos/enlaces.ts — las dos comprobaciones de frontera de las URLs que el backend de pagos
// devuelve y la interfaz convierte en navegación. Ninguna cadena que llegue por HTTP se pone en un
// `href` ni en `location.assign` sin pasar por aquí (revisión 5-4-R1, hallazgos S-1 y S-2).
//
// Vive en `lib/pagos` y no en cada pantalla porque las tres que las necesitan —`/pago`,
// `/editor/[id]/plan` y su historial— son la misma frontera contra el mismo backend.

/** Sin esto, `location.assign` iría a donde dijera el backend: un redirector abierto de regalo. */
const PREFIJO_CHECKOUT_STRIPE = "https://checkout.stripe.com/";

/**
 * Devuelve la URL solo si es absoluta y `https:`. Se usa con `comprobanteUrl` (la `receipt_url` de
 * Stripe, `handoffs/5-4-contrato-pagos.md` §2.2): un valor con esquema `javascript:` o `data:`
 * guardado en la base sería código ejecutable en cuanto alguien tocara el enlace.
 */
export function enlaceHttpsValido(crudo: string | null | undefined): string | null {
  if (typeof crudo !== "string" || crudo === "") return null;
  try {
    return new URL(crudo).protocol === "https:" ? crudo : null;
  } catch {
    return null;
  }
}

/**
 * `checkoutUrl` de `POST /product/payments/checkout` (§2.4). Solo se navega a Stripe Checkout: el
 * contrato promete `https://checkout.stripe.com/…` y esta pantalla no acepta nada más, ni siquiera
 * otro dominio de Stripe. Si el valor no encaja, quien llama enseña su error en vez de navegar.
 */
export function urlDeCheckoutDeStripe(crudo: string | null | undefined): string | null {
  const https = enlaceHttpsValido(crudo);
  return https !== null && https.startsWith(PREFIJO_CHECKOUT_STRIPE) ? https : null;
}
