# `/precios` — sesión **E4** (pagos con Stripe)

**Esto es un marcador del andamio 5-0d y se sustituye ENTERO.** Hoy no lee nada y no llama al backend.

## Qué pantalla va aquí
El catálogo de planes con lo que incluye cada uno y su precio, y el botón que abre Stripe Checkout.
Es la página a la que apunta «Ver planes» desde la portada, desde el asistente y desde la puerta de
publicación (`ADR-5-0B-01`: editar y previsualizar son gratis; publicar y compartir exigen pago).

## Backend que consume
El catálogo de planes de `modules/master/plans` (o el que 5-0b-A determine que hay que crear) y, para
la compra, `modules/product/payments`. La clave publicable viaja por `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
y se lee con `lib/env.ts`; la secreta **nunca** llega al frontend.

## Ficheros que E4 puede tocar desde aquí
- esta carpeta entera, `app/(chrome)/(sitio)/pago/**`, `app/(chrome)/editor/[invitationId]/plan/**`,
- `lib/panel/nav.plan.ts` (su entrada del registro),
- sus propios componentes y sus pruebas.

## Ficheros que NO puede tocar
`lib/panel/nav.ts` y `lib/panel/tipos.ts` (compositor compartido), `nav.invitados.ts` y
`nav.compartir.ts` (E2), y `lib/env.ts` salvo para AÑADIR su variable si le faltara alguna.

## Notas del andamio
- Va en el grupo `(sitio)`: hereda cabecera y pie de `MarcoSitio`, que ya envuelve el contenido en
  `<main id="contenido">`. Por eso el marcador pasa `contenedor="div"`: dos `<main>` en el mismo
  documento son una violación de axe (`landmark-no-duplicate-main`).
- El `robots: noindex` es **temporal** y solo mientras sea marcador. Esta es una página de venta:
  E4 la quita al publicar los planes.
