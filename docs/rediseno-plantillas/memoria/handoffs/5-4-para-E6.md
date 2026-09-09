# 5-4 (sesión E4, planes y pagos con Stripe) → E6 · qué hay, cómo se merge y qué queda

Rama `claude/fase-5-pagos-hmb028`, desde el commit de cimientos `9a4cd56`. Hash final en el reporte
del orquestador y en `bitacora/5-4-orquestador.md`. El nombre de rama lo impuso el entorno remoto
(el prompt decía `claude/fase-5-pagos`); está anotado en `prompts/fase-5/E4-pagos-stripe.md`.

## 1. Lo que hay (todo con pruebas en verde con salida real)
| Área | Dónde | Qué |
|---|---|---|
| Backend | `modules/product/payments/**` | `GET /public/plans` · `GET /product/payments/invitations/{id}` · `GET /product/payments/pagos` · `POST /product/payments/checkout` · `POST /public/stripe/webhook` (firma verificada, idempotencia por `event.id`, comprobación de `amount_total`/`currency`, reembolso total retira el release e invalida el borde) |
| Esquema | `V42__create_product_plan.sql`, `V43__create_product_payment.sql`, `V44__create_product_stripe_event.sql` | catálogo de venta (3 planes sembrados con precios DE EJEMPLO), registro del cobro, idempotencia |
| Puerta | `templates2`: `TplErrorCode.TPL_PLAN_UNPAID(402)`, `InvitationAvailability.isPaid`, `ReleaseService.bloqueos`, fila en `diseno/03-api.md §5` | `preflight` → `canPublish=false` con `TPL_PLAN_UNPAID` primero; `POST …/release` → `402`; `is_paid = NULL` cuenta como no pagada |
| Dependencia | `build.gradle.kts` | `com.stripe:stripe-java:29.5.0` (una línea) |
| Frontend | `lib/pagos/**` (cliente tipado, `enlaces.ts`, `dinero.ts`), `app/(chrome)/(sitio)/precios/**` + `components/precios/**`, `app/(chrome)/(sitio)/pago/**` + `components/pago/**`, `app/(chrome)/editor/[invitationId]/plan/**` + `components/plan/**` | las tres pantallas del wireframe B3.3–B3.5 con carga/vacío/error/sin pago en línea |
| Ficheros ajenos tocados (mínimo, aditivo) | `components/editor/PublishDialog.tsx` (+29/−9: `TPL_PLAN_UNPAID` como bloqueo conocido y enlace «Elegir plan»), `components/asistente/PasoListo.tsx` (+7/−1: botón «Elegir plan»), `lib/i18n.ts` (solo inserciones: `sitio.precios`, `sitio.pago`, `panel.plan`, `panel.navegacion`, `editor.publicar.bloqueo.TPL_PLAN_UNPAID`, `asistente.listo.notaPlan`) | E6: al mergear, conservar ambas partes; ninguna clave se renombró ni se borró |
| e2e | `e2e/pagos-puerta.spec.ts`, `e2e/pagos-compra.spec.ts`, `e2e/preparar-pagos.ts` | 8 pruebas, aisladas por spec (ADR-5-E1-03); 16/16 con `--workers=4 --repeat-each=2` |
| Siembra | `scripts/seed/plan.sh` (+`SEED_PLAN_CODIGO`) | sin cambios en `comun.sh` |
| Evidencia | `docs/rediseno-plantillas/evidencia/fase-5/e4/` (21 capturas + README) | tomadas contra backend real |

## 2. Variables de entorno (sin valores en ningún fichero)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONEDA` (por defecto `MXN`), `FRONTEND_URL`
(reutilizada para `success_url`/`cancel_url`), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend; hoy no se
usa para redirigir porque Checkout devuelve una URL, pero `lib/env.ts` sigue validándola).
**Sin claves el producto funciona**: catálogo y consulta de plan responden; checkout `503 PAY_NOT_CONFIGURED`
(la interfaz lo dice: «El pago en línea todavía no está disponible»); webhook `503`.
**CI**: `pagos-compra.spec.ts` lee `STRIPE_WEBHOOK_SECRET` del entorno y se salta con mensaje si falta.
El job e2e debe exportar un valor de prueba (cualquier cadena; el spec firma con ella) **y arrancar el
backend con esa misma variable**. Ninguna variable nueva hizo falta en `application.yml`.

## 3. Cómo probar el webhook a mano
`handoffs/5-4-A.md` trae el snippet con `openssl`/`crypto.createHmac` (`t=<ts>,v1=<hmac>` sobre
`"<ts>.<payload>"`, tolerancia 300 s, `amount_total` igual al importe guardado; replay → `duplicado:true`).

## 4. Conflictos previsibles al mergear (orden sugerido: E2 → E3 → E4 → E5)
- `lib/i18n.ts`: inserciones en bloques distintos; conflictos triviales de contexto, conservar ambas.
- `components/editor/PublishDialog.tsx` y `components/asistente/PasoListo.tsx`: solo E4 los toca en la
  fase 5 según el reparto; si E2 añadió algo en `PublishDialog` (compartir), el diff de E4 es aditivo.
- `docs/rediseno-plantillas/diseno/03-api.md §5`: una fila nueva (`TPL_PLAN_UNPAID`); la prueba de
  paridad `Templates2ExceptionHandlerTest` cae si la fila se pierde en el merge.
- `src/test/.../templates2/api/EditorTestSupport.kt` y `persistence/IntegrationTestBase.kt`: parámetro
  `pagada = true` en las fixtures que insertan `invitation`. Si E2/E5 tocaron esas fixtures, conservar el parámetro.
- `decisiones.md`, `preguntas-abiertas.md`: solo se añadió al final.
- Migraciones: E4 usa `V42`–`V44`. E3 reservó `V41`. Si otra sesión usó `V42+`, renumerar las de E4
  (son tres ficheros sin dependencias entre sesiones).
- `ProductPropertiesConfig.kt`: E4 **no** lo tocó.

## 5. Lo que queda abierto (y de quién es)
- **A-01 ALTA, de E5** (S-03): `PUT /admin/invitations/{id}/mark-as-paid` sin jerarquía abre la puerta
  a cualquier ADMIN. Parche de tres líneas en `bitacora/5-4-adv.md §Abierto`.
- Precios reales de los planes, `stripe_price_id` frente a `price_data`, política de reembolso,
  sondeo de `/pago` limitado a 60 s: `preguntas-abiertas.md` (secciones 5-4-A, 5-4-B2, 5-4-B3, 5-4-ADV).
- Correos de pago recibido / reembolsado: transporte de E3; E4 no manda ninguno.
- Eventos `IMPORTE_DISTINTO` y `PAGO_DUPLICADO` quedan en `product_stripe_event` y nadie los enseña: candidato a `/admin` (E5).
- Dos checkouts simultáneos sobre la misma invitación (A-08 BAJA): detectado, no prevenido; exigiría `V45`.
- Alta de invitación para rol USER (ADR-5-0B-01 punto 5): no es de E4; el flujo de compra se probó con la siembra.
- `formatearImporte` devuelve `$899.00` (Intl es-MX) y no `$899.00 MXN` como decía el contrato §5: decisión
  del orquestador dejarlo así mientras solo se venda en MXN; si se añade otra moneda, añadir el código.
- Rojo conocido y ajeno: `components/sitio/portada.test.tsx` (desde `bfdcbaa`); lo cierra E6 con las imágenes.
- `next build` genera `frontend/apps/web/AGENTS.md` y `CLAUDE.md` (Next 16); no se commitean.
