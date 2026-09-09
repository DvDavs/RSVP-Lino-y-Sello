# `/precios` — sesión **E4** (pagos con Stripe)

El catálogo real de planes: `GET /public/plans` pedido desde el navegador
(`components/precios/PantallaPrecios.tsx`, vía `lib/pagos/cliente.ts`), con lo que incluye cada plan,
su precio (formateado con `lib/pagos/dinero.ts`, nunca calculado aquí) y el botón que lleva a abrir
Stripe Checkout. Es la página a la que apunta «Ver planes» desde la portada, desde el asistente y
desde la puerta de publicación (`ADR-5-0B-01`: editar y previsualizar son gratis; publicar y
compartir exigen pago).

El botón «Elegir <plan>» **nunca** abre un checkout desde aquí: con `?inv=<id>` en la URL (llega
desde la puerta de publicación) enlaza a `/editor/<id>/plan?plan=<codigo>`, que es quien de verdad
llama a `crearCheckout`. Sin `?inv`, lleva a `/acceso?siguiente=/editor` («Empieza gratis»).

## Backend que consume
`modules/product/payments` (`GET /public/plans`, sin sesión). La clave publicable viaja por
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y se lee con `lib/env.ts::pagoEnLineaDisponible()`; la secreta
**nunca** llega al frontend. El pago solo se ofrece cuando el catálogo dice `pagoEnLinea: true` Y el
entorno tiene la clave publicable — cualquiera de las dos en falso, la interfaz lo dice y manda al
contacto en vez de abrir un botón muerto.

## Ficheros que E4 puede tocar desde aquí
- esta carpeta entera, `app/(chrome)/(sitio)/pago/**`, `app/(chrome)/editor/[invitationId]/plan/**`,
- `lib/pagos/**` (`tipos.ts`, `cliente.ts`, `dinero.ts`),
- `lib/panel/nav.plan.ts` (su entrada del registro),
- sus propios componentes (`components/precios/**`) y sus pruebas.

## Ficheros que NO puede tocar
`lib/panel/nav.ts` y `lib/panel/tipos.ts` (compositor compartido), `nav.invitados.ts` y
`nav.compartir.ts` (E2), `lib/api-client.ts` y `lib/env.ts` (solo se pueden IMPORTAR).

## Notas
- Va en el grupo `(sitio)`: hereda cabecera y pie de `MarcoSitio`, que ya envuelve el contenido en
  `<main id="contenido">`. El componente de esta pantalla no añade un segundo `<main>`
  (`landmark-no-duplicate-main`).
- Esta es una página de venta y SÍ se indexa (`robots: {index:true, follow:true}` en `page.tsx`).
