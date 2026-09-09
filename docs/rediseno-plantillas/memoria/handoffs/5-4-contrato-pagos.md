# 5-4 · Contrato HTTP de planes y pagos (sesión E4) — lo que backend y frontend construyen a la vez

Fijado por el orquestador de E4 antes de lanzar a los agentes, sobre `diseno/12-producto-completo.md`
§A5.3 (tablas nuevas), §B3.3–B3.5 (pantallas) y §B4 (ADR-5-0B-01, puerta de publicación). Si el
agente de backend necesita apartarse de algo, lo anota aquí al final con fecha y avisa al orquestador.

## 0. Decisiones que no se reabren
- **Pago único por invitación** (supuesto de E1 en `preguntas-abiertas.md`; Stripe Checkout `mode=payment`).
- **El precio lo fija el servidor**: la petición de checkout lleva `invitationId` y `planCodigo`,
  nunca un importe. El importe sale de `product_plan.precio_centavos`.
- **El pago se da por bueno solo por el webhook** con firma verificada (`STRIPE_WEBHOOK_SECRET`) e
  idempotencia por `event.id`. Volver a `/pago` no cambia nada.
- **Moneda**: `producto.pagos.stripe.moneda` (`STRIPE_MONEDA`, `MXN` por defecto). Importes en centavos (`Long`).
- **La puerta de publicación** vive en `templates2.ReleaseService`: bloqueo `TPL_PLAN_UNPAID` (HTTP
  `402`) en `preflight` y `publish` cuando `invitation.is_paid` no es `true`.
- Errores del módulo de pagos con la MISMA forma que `templates2`: `{ "code": "PAY_…", "message": "…", "details": {…} }`.
- Sin `STRIPE_SECRET_KEY` el catálogo y la consulta del plan funcionan; **crear el checkout responde `503 PAY_NOT_CONFIGURED`** y el frontend lo dice (nunca un botón muerto).

## 1. Tablas nuevas (Flyway, `V42`, `V43`, `V44`; V41 la reserva E3)
```sql
product_plan(
  id bigserial PK, codigo varchar(40) UNIQUE NOT NULL, nombre varchar(80) NOT NULL,
  descripcion varchar(240) NOT NULL DEFAULT '', precio_centavos bigint NOT NULL CHECK (precio_centavos > 0),
  moneda char(3) NOT NULL DEFAULT 'MXN', invitados_max int NULL, incluye jsonb NOT NULL DEFAULT '[]',
  recomendado boolean NOT NULL DEFAULT false, activo boolean NOT NULL DEFAULT true, orden int NOT NULL DEFAULT 0,
  stripe_price_id varchar(80) NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())
-- siembra: sencillo (60 invitados), fiesta (150, recomendado), grande (sin límite). Precios de
-- ejemplo del catálogo inicial: 49900 / 89900 / 149900 centavos MXN (pregunta abierta al dueño).

product_payment(
  id bigserial PK, invitation_id bigint NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  customer_id bigint NOT NULL REFERENCES customer(id), product_plan_id bigint NOT NULL REFERENCES product_plan(id),
  estado varchar(20) NOT NULL CHECK (estado IN ('PENDIENTE','PAGADO','FALLIDO','CADUCADO','REEMBOLSADO')),
  importe_centavos bigint NOT NULL, moneda char(3) NOT NULL,
  stripe_checkout_session_id varchar(120) UNIQUE NULL, stripe_payment_intent_id varchar(120) UNIQUE NULL,
  pagado_en timestamptz NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())
-- índices: (invitation_id), (customer_id, created_at desc)

product_stripe_event(
  event_id varchar(120) PK, tipo varchar(80) NOT NULL, recibido_en timestamptz NOT NULL DEFAULT now(),
  procesado_en timestamptz NULL, resultado varchar(40) NULL)
-- idempotencia: INSERT primero; si ya existe, 200 sin volver a procesar.
```

## 2. Rutas

### 2.1 Catálogo público — `GET /public/plans`
Sin sesión (`/public/**` es `permitAll`). Solo planes `activo = true`, ordenados por `orden`.
```json
{ "moneda": "MXN", "planes": [
  { "codigo": "fiesta", "nombre": "Fiesta", "descripcion": "…", "precioCentavos": 89900, "moneda": "MXN",
    "invitadosMax": 150, "incluye": ["Hasta 150 invitados", "Confirmaciones ilimitadas", "Enlace propio", "Galería de fotos"],
    "recomendado": true, "orden": 20 } ] }
```
`invitadosMax: null` = sin límite. `pagoEnLinea: boolean` a nivel raíz dice si el backend tiene
`STRIPE_SECRET_KEY` (para que `/precios` no prometa un pago que el servidor no puede abrir).

### 2.2 Plan de una invitación — `GET /product/payments/invitations/{invitationId}`
Rol USER/ADMIN/MASTER y **propiedad** por `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)`;
si no → `404 PAY_INVITATION_NOT_FOUND` (misma respuesta que inexistente: sin oráculo).
```json
{ "invitationId": 12, "pagada": true, "nombreEvento": "Boda de Ana y Luis",
  "plan": { "codigo": "fiesta", "nombre": "Fiesta", "precioCentavos": 89900, "moneda": "MXN", "invitadosMax": 150, "incluye": ["…"] },
  "pagadoEn": "2026-03-03T18:22:10Z",
  "pagos": [ { "id": 7, "estado": "PAGADO", "planCodigo": "fiesta", "planNombre": "Fiesta", "importeCentavos": 89900,
               "moneda": "MXN", "creadoEn": "…", "pagadoEn": "…", "comprobanteUrl": null } ],
  "pagoEnLinea": true }
```
`plan` y `pagadoEn` son `null` sin pago. `pagos` es el historial de ESA invitación (más reciente
primero). `nombreEvento` se saca del negocio existente (`invitation` + `event_type.name`; si no hay
nombre, `null` y el frontend pinta el tipo de evento). `comprobanteUrl` es la `receipt_url` del cargo
si Stripe la devolvió (nullable). Con `pagada = true` y sin fila en `product_payment` (invitación marcada
por un ADMIN o sembrada) → `plan: null`, `pagos: []`, `pagada: true`: el frontend lo enseña como
«Plan activo» sin importe.

### 2.3 Historial de la clienta — `GET /product/payments/pagos`
Todos los pagos de `customer_id = requesterId`, cada uno con `invitationId` y `nombreEvento`.
`{ "pagos": [ … ] }`. Nunca lleva pagos de otra cuenta.

### 2.4 Abrir Checkout — `POST /product/payments/checkout`
Cuerpo: `{ "invitationId": 12, "planCodigo": "fiesta" }`. Propiedad como en 2.2.
- `503 PAY_NOT_CONFIGURED` sin clave secreta.
- `404 PAY_PLAN_NOT_FOUND` si el plan no existe o no está activo.
- `409 PAY_ALREADY_PAID` si `invitation.is_paid = true`.
- Crea `product_payment` en `PENDIENTE` con el importe del servidor y una sesión de Checkout:
  `mode=payment`, `line_items[0].price_data = { currency, unit_amount = precio_centavos, product_data.name }`
  (o `price = stripe_price_id` si existe), `client_reference_id = invitationId`,
  `metadata = { invitationId, planCodigo, customerId, paymentId }`, `customer_email` del cliente,
  `success_url = ${app.frontend.url}/pago?inv={invitationId}&sesion={CHECKOUT_SESSION_ID}`,
  `cancel_url = ${app.frontend.url}/pago?inv={invitationId}&cancelado=1`.
- Respuesta `201 { "checkoutUrl": "https://checkout.stripe.com/…", "sessionId": "cs_test_…", "paymentId": 7 }`.
- `502 PAY_STRIPE_UNAVAILABLE` si Stripe falla (el `product_payment` queda `FALLIDO`).

### 2.5 Webhook — `POST /public/stripe/webhook`
Cuerpo **crudo** (no `@RequestBody` parseado: la firma se calcula sobre los bytes), cabecera
`Stripe-Signature`. `Webhook.constructEvent(payload, sigHeader, secretoWebhook)` del SDK.
- Sin `STRIPE_WEBHOOK_SECRET` → `503 PAY_NOT_CONFIGURED` (nunca se acepta sin verificar).
- Firma inválida, ausente o fuera de tolerancia (300 s) → `400 PAY_WEBHOOK_SIGNATURE_INVALID`, sin detalles.
- Idempotencia: `INSERT INTO product_stripe_event` primero; duplicado → `200 {"received":true,"duplicado":true}`.
- `checkout.session.completed` (con `payment_status = paid`) y `checkout.session.async_payment_succeeded`:
  busca `product_payment` por `stripe_checkout_session_id` (o por `metadata.paymentId`, comprobando que
  coincidan `invitationId` y `paymentId`), lo pasa a `PAGADO` con `stripe_payment_intent_id`, `pagado_en`,
  y **verifica que `amount_total` y `currency` de la sesión coinciden con el importe guardado**; si no
  coinciden → registra `resultado = 'IMPORTE_DISTINTO'`, NO marca pagada y responde `200` (Stripe no
  debe reintentar; queda para revisión manual y se loguea sin datos personales). Luego
  `UPDATE invitation SET is_paid = true, total_amount = importe_centavos / 100.0 WHERE id = ?` mediante
  un repositorio nativo propio del módulo (patrón `Templates2FlagRepository`), nunca `InvitationEntity`.
- `checkout.session.async_payment_failed` → `FALLIDO`; `checkout.session.expired` → `CADUCADO`.
- `charge.refunded` (reembolso total) y `charge.dispute.created`: pago a `REEMBOLSADO`,
  `is_paid = false`, y se retira el release activo (`ReleaseStore.unpublish` vía un servicio del
  producto que llame a `templates2` **solo** por su API pública de servicio, o por una consulta nativa
  `UPDATE tpl_release SET is_active=false, unpublished_at=now() WHERE invitation_id=? AND is_active`).
- Cualquier otro tipo → `200 {"received":true}` sin hacer nada.
- Respuesta siempre `200` tras procesar; si falla la base → `500` para que Stripe reintente (el evento
  se inserta en la misma transacción que el procesamiento, así un fallo no lo deja marcado como visto).

### 2.6 Puerta de publicación (`modules/templates2`, cambio mínimo con ADR)
- `TplErrorCode.TPL_PLAN_UNPAID(402)` + fila en `diseno/03-api.md §5` (lo exige `Templates2ExceptionHandlerTest`).
- `InvitationAvailabilityReader` lee además `i.is_paid` (`isPaid: Boolean`, `null` → `false`).
- `ReleaseService.preflight` y `publish`: si `!isPaid` → `PreflightFinding(code = "TPL_PLAN_UNPAID")`
  como primer bloqueo; `publish` lanza `PublishBlockedException(TPL_PLAN_UNPAID)` → `402`.
- Las fixtures de prueba de `templates2` que publican nacen con `is_paid = true` (parámetro
  `pagada = true` por defecto en `nuevaInvitacion`); una prueba nueva nace sin pagar y comprueba el 402
  y el `canPublish=false` con el código.

## 3. Códigos `PAY_*`
| código | HTTP | cuándo |
|---|---|---|
| `PAY_NOT_CONFIGURED` | 503 | sin `STRIPE_SECRET_KEY` (checkout) o sin `STRIPE_WEBHOOK_SECRET` (webhook) |
| `PAY_PLAN_NOT_FOUND` | 404 | `planCodigo` desconocido o inactivo |
| `PAY_INVITATION_NOT_FOUND` | 404 | invitación inexistente **o ajena** (misma respuesta) |
| `PAY_ALREADY_PAID` | 409 | la invitación ya está pagada |
| `PAY_WEBHOOK_SIGNATURE_INVALID` | 400 | firma ausente, inválida, de otra cuenta o caducada |
| `PAY_STRIPE_UNAVAILABLE` | 502 | Stripe rechaza o no responde al crear la sesión |
| `PAY_MALFORMED_JSON` | 400 | cuerpo no parseable o campos desconocidos |

## 4. Seguridad (lo que revisa el adversario al final)
- Ninguna ruta acepta importe, moneda ni `is_paid` del cliente.
- El webhook es la única escritura de `is_paid = true` en el módulo nuevo; se comprueba `amount_total`.
- `event.id` es clave primaria: un replay no vuelve a escribir nada.
- La firma se verifica con el secreto de ESTA cuenta: una firma de otra cuenta de Stripe falla.
- `GET …/invitations/{id}` y `…/pagos` filtran por propiedad; un id ajeno → `404`.
- Los logs del webhook llevan `event.id` y `tipo`, nunca correo ni importe del cliente.

## 5. Frontend (`apps/web/lib/pagos/**`)
- `lib/pagos/tipos.ts`: los tipos de arriba (`CatalogoDePlanes`, `Plan`, `PlanDeInvitacion`, `Pago`, `CheckoutCreado`).
- `lib/pagos/cliente.ts`: `obtenerCatalogo()`, `obtenerPlanDeInvitacion(id)`, `obtenerMisPagos()`,
  `crearCheckout(id, planCodigo)`. Usa `getApiBaseUrl()` y `getAuthToken()` de `lib/api-client.ts`
  (no se edita ese fichero); clasifica errores `PAY_*` en `ErrorDePago { code, status, message }` y los
  `401/403` sin código como sesión caducada (mismo criterio que `api-client.ts`).
- `lib/pagos/dinero.ts`: `formatearImporte(centavos, moneda)` → `$899.00 MXN` con `Intl.NumberFormat("es-MX")`.
- Nada calcula ni muestra un precio que no venga del backend.

---

## Nota del backend (5-4-A, 2026-09-09) — cinco apartamientos, todos menores

Implementado el §1–§4 completo. Lo que **no** salió exactamente como estaba escrito:

1. **`moneda` es `varchar(3)`, no `char(3)`** (V42 y V43). Postgres implementa `char(n)` como
   `bpchar` y `ddl-auto: validate` se niega a arrancar contra un campo `String`: «wrong column type
   encountered in column [moneda] in table [product_payment]; found [bpchar (Types#CHAR)], but
   expecting [varchar(3) (Types#VARCHAR)]». Comprobado. Sin efecto en el JSON.
2. **`product_payment` gana `comprobante_url varchar(500)`.** El §2.2 pide `comprobanteUrl` en la
   respuesta pero la tabla del §1 no tenía columna donde guardarla. Se rellena con la `receipt_url`
   del cargo cuando llega en `charge.refunded`; en `checkout.session.completed` la sesión no la trae.
3. **Dos códigos más de los siete del §3**: `PAY_INTERNAL(500)` —el advice declara un handler de
   `Exception` y ninguna respuesta puede salir sin `code`— y `PAY_MALFORMED_JSON` cubriendo además un
   caso nuevo: un cuerpo **firmado correctamente** pero que no es un evento de Stripe (cuerpo vacío o
   que no es un objeto JSON) revienta dentro de `Webhook.constructEvent` tras verificar la firma.
   Eso no es firma inválida y no debe salir como `500`.
4. **`POST …/checkout` no es transaccional**, y las escrituras de `product_payment` viven en un bean
   aparte (`PaymentWriteService`). Dos motivos: mantener abierta una transacción de Postgres mientras
   se espera a Stripe agota el pool, y `@Transactional(REQUIRES_NEW)` llamado desde la misma clase no
   pasa por el proxy — el `FALLIDO` se habría escrito dentro de la transacción que la excepción
   revierte, es decir, nunca.
5. **Todos los DTO de lectura llevan `@JsonInclude(ALWAYS)`.** El `ObjectMapper` de la aplicación es
   el de `templates2` (`Templates2JsonConfig.kt:35`; un bean de tipo `ObjectMapper` desactiva el de
   Spring Boot por `@ConditionalOnMissingBean`) y trae `serializationInclusion(NON_NULL)`. Sin la
   anotación, `invitadosMax`, `plan` y `pagadoEn` **desaparecían** del JSON en vez de viajar como
   `null`, y el §2.1/§2.2 se apoya en que `null` significa algo. Verificado contra el backend vivo.
   **Es información que el frontend debe conocer**: cualquier campo nullable nuevo de cualquier
   sesión necesita la anotación o se cae de la respuesta.
