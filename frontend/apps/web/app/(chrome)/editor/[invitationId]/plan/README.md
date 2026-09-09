# `/editor/[invitationId]/plan` — sesión **E4** (pagos)

Implementada (ya no es el marcador del andamio 5-0d). El plan de ESTA invitación: cuál es, qué
incluye, en qué estado está el pago y cómo cambiarlo. Desde aquí sale la ida a Stripe Checkout, cuya
vuelta aterriza en `/pago`. Es el destino de la entrada «Plan» del registro (`lib/panel/nav.plan.ts`)
y de la puerta de publicación (ADR-5-0B-01): `PublishDialog.tsx` enlaza aquí cuando el preflight trae
`TPL_PLAN_UNPAID`.

## Ficheros
- `page.tsx` — server component mínimo: `metadata` (`robots: noindex`) y el límite de `Suspense`
  que exige `useSearchParams` (lee `?plan=<codigo>`).
- `loading.tsx` — frontera de Next para la transición de ruta (skeleton). La carga de DATOS es
  interna al client component (el token vive en `sessionStorage`, P8): no hay `error.tsx` propio
  porque `PantallaPlan` nunca lanza — sus tres estados de fallo (sin sesión, cargando, error) se
  pintan a mano; un fallo de verdad lo cubre `app/(chrome)/editor/[invitationId]/error.tsx`.
- `frontend/apps/web/components/plan/` — `PantallaPlan.tsx` (orquestador de estado: sin sesión /
  cargando / error / listo), `BarraDelPanel.tsx` (nav del panel a partir de `navegacionVisible`),
  `OfertaDePlan.tsx` (estado SIN pago — es el estado vacío de la pantalla y la oferta), `PlanPagado.tsx`
  (estado CON pago), `HistorialDePagos.tsx` (tabla de pagos, siempre visible con datos), `formato.ts`
  (fechas es-MX de esta pantalla).

## Backend que consume
`GET /product/payments/invitations/{id}` y `POST /product/payments/checkout` de `templates2`
(`docs/rediseno-plantillas/memoria/handoffs/5-4-contrato-pagos.md` §2.2/§2.4), a través de
`lib/pagos/cliente.ts` (de B1, sin editar). El precio y el estado los manda SIEMPRE el backend: el
frontend no calcula importes ni decide qué está pagado.

## Notas
- La clave publicable de Stripe se lee con `lib/env.ts` (`clavePublicableDeStripeDelEntorno()` /
  `pagoEnLineaDisponible()`), nunca con `process.env` suelto.
- Sin clave configurada (o sin `catalogo.pagoEnLinea` del backend) NO se pinta el botón de pago; la
  oferta se sigue viendo, con la nota honesta y `ContactoParaContratar`. Un `PAY_NOT_CONFIGURED`
  reactivo (al intentar pagar) cae en el mismo estado. Nunca un botón muerto.
- `/acceso?volver=<ruta>` (no `?siguiente=`): es el único parámetro que lee `AsistenteAcceso.tsx`
  (`destinoSeguro(parametros.get("volver"))`) — ver pregunta abierta 5-4-B2 sobre
  `TarjetaPlan.tsx`, que usa `?siguiente=` y no volvería a esta pantalla tras entrar.
