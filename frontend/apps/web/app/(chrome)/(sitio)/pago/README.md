# `/pago` — sesión **E4** (pagos con Stripe)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no llama al backend.

## Qué pantalla va aquí
La vuelta de Stripe Checkout: éxito y cancelación. Es el `success_url` / `cancel_url` que E4 declara
al crear la sesión de Checkout, construidos sobre `FRONTEND_URL` en el backend.

## Regla que esta pantalla NO puede romper
**El pago se da por bueno por el webhook, nunca por haber vuelto a esta URL.** Cualquiera puede
teclear `/pago?exito=1`. Esta página consulta el estado real de la invitación al backend y, si el
webhook todavía no ha llegado, dice que el pago se está confirmando — no promete lo que no sabe.
El webhook (`modules/product/payments`) verifica la firma con `STRIPE_WEBHOOK_SECRET` y es idempotente
por `event.id`.

## Backend que consume
`modules/product/payments`: estado del pago de la invitación. Nunca escribe `is_paid` desde el cliente.

## Ficheros que E4 puede tocar desde aquí
Los mismos que en `/precios/README.md`.

## Notas del andamio
- Grupo `(sitio)`, por eso `contenedor="div"` (ver `/precios/README.md`).
- `noindex` es **permanente** aquí, no temporal.
