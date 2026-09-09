# `/pago` — sesión **E4** (pagos con Stripe)

La vuelta de Stripe Checkout: `success_url` (`/pago?inv=<id>&sesion=<cs_…>`) y `cancel_url`
(`/pago?inv=<id>&cancelado=1`) que el backend declara al crear la sesión de Checkout, construidos
sobre `FRONTEND_URL` (`handoffs/5-4-contrato-pagos.md` §2.4).

## Regla que esta pantalla NO puede romper

**El pago se da por bueno por el webhook, nunca por haber vuelto a esta URL.** Cualquiera puede
teclear `/pago?inv=1&sesion=lo-que-sea`. `components/pago/PantallaPago.tsx` siempre consulta
`GET /product/payments/invitations/{id}` (`lib/pagos/cliente.ts::obtenerPlanDeInvitacion`) y pinta
lo que el backend contesta — nunca decide "pagado" por el `?sesion=` de la URL. El webhook
(`modules/product/payments`) verifica la firma con `STRIPE_WEBHOOK_SECRET` y es idempotente por
`event.id`.

## Los tres estados (una sola ruta)

- **Cancelado** — sin `inv` válido, o `?cancelado=1`: es el vacío de la ruta. «Volver a intentar»
  vuelve a `/editor/<inv>/plan` (o `/editor` sin `inv`).
- **Esperando** — hay `inv` y `?sesion=`, y el backend todavía dice `pagada:false`: sondea
  `obtenerPlanDeInvitacion` cada 3 s (máximo ~60 s); pasado el minuto, ofrece soporte y «Ver mi
  plan» sin dejar de poder confirmarse si el webhook llega después. Sin `?sesion=` y `pagada:false`
  no hay nada que esperar: se enseña como cancelado.
- **Confirmado** — el backend dice `pagada:true`: sello (`Seal` + `IconoExito`), el plan y el
  evento (si el backend los manda), el importe del pago más reciente, y salida a la invitación o al
  plan.

Además: `SessionError` (sin sesión de cuenta) manda a `/acceso?siguiente=/pago?inv=…` y
`ErrorDePago`/otro error ofrece reintentar y soporte. Nunca un botón muerto.

## Backend que consume

`modules/product/payments`: `GET /product/payments/invitations/{invitationId}` (con sesión, filtra
por propiedad). Nunca escribe `is_paid` desde el cliente.

## Ficheros que E4 puede tocar desde aquí

Los mismos que en `/precios/README.md`: esta carpeta entera, `components/pago/**`,
`lib/pagos/**`, `lib/panel/nav.pago.ts` si existiera su entrada, e inserciones en `lib/i18n.ts`
bajo `sitio.pago`.

## Notas del andamio

- Grupo `(sitio)`: hereda cabecera y pie de `MarcoSitio`, que ya envuelve el contenido en
  `<main id="contenido">`. Esta pantalla no añade un segundo `<main>`.
- `noindex` es **permanente** aquí (`robots: {index:false, follow:false}` en `page.tsx`): la URL
  lleva identificadores de sesión de compra y no tiene sentido fuera del flujo de vuelta.
