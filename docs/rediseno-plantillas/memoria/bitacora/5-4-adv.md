# Bitácora 5-4-ADV · revisión adversarial de pagos y puerta de publicación (fase 5, sesión E4)

Rama `claude/fase-5-pagos-hmb028`. Territorio revisado: `modules/product/payments/**`, la puerta de
`modules/templates2` (`ReleaseService`, `InvitationAvailabilityReader`), migraciones V42–V44 y el
frontend de pagos (`lib/pagos/**`, `components/plan/**`, `components/pago/**`).
Contrato atacado: `handoffs/5-4-contrato-pagos.md` §4. Sin commit, sin push, sin reiniciar `:6003`.

**Veredicto: CERRABLE.** No queda ninguna objeción ALTA abierta **dentro** de mi territorio. La única
ALTA de todo el informe (**A-01**, `PUT /admin/invitations/{id}/mark-as-paid` sin comprobación de
propiedad) es el hallazgo S-03 del inventario, vive en `modules/admin/**` —prohibido en este encargo—
y queda **abierta con parche propuesto para E5**. Es la puerta trasera de todo el subsistema: quien
la cruce se salta el pago entero, así que la sesión E5 no debería cerrarse sin ella.

## Cómo se atacó

Dos posturas, las dos con evidencia reproducible y ninguna con "leí el código y parece correcto":

1. **Clienta con cuenta (rol USER)** contra el backend vivo de `:6003`, con dos cuentas sembradas por
   `scripts/seed/plan.sh` (A: invitaciones 5 y 6; B: 7 y 8) para poder pedir lo de la otra.
2. **Tercero sin cuenta**, es decir Stripe: el webhook. El secreto real de `:6003` no lo conozco (una
   firma calculada con el secreto de ejemplo del handoff se rechaza, lo cual ya es una prueba en sí),
   así que los doce escenarios de webhook se atacan con **pruebas Kotlin que calculan la firma de
   verdad** y, los de base de datos, contra el Postgres real de `PgTestCluster`.

Las siete objeciones corregidas nacieron **rojas**: `StripeWebhookAdversarialTest` se escribió antes
del arreglo y falló **7 de 10** (`expected: <PENDIENTE> but was: <PAGADO>` en cinco de ellas). Los
mensajes exactos están más abajo, en la evidencia de cada fila.

## Tabla de objeciones

| id | sev. | escenario | evidencia reproducible | estado |
|---|---|---|---|---|
| **A-01** | **ALTA** | 5 · IDOR de administración | Vivo: MASTER crea un ADMIN nuevo → `POST /admin/administrators/users/create` `200`; ese ADMIN, que no creó a la clienta ni a la invitación, hace `PUT /admin/invitations/5/mark-as-paid` → `200 {"message":"La invitación ha sido marcada como pagada."}`; la dueña ve `{"invitationId":5,"pagada":true,…,"pagos":[]}` y la puerta de publicación se abre **sin una sola fila en `product_payment`** | **abierta · fuera de territorio (E5)**, parche propuesto abajo |
| **A-02** | MEDIA | 3 · `payment_status` ausente | `StripeWebhookAdversarialTest.kt:86`; antes del arreglo: `expected: <PENDIENTE> but was: <PAGADO>` | **corregida** · `StripeWebhookService.kt:115` |
| **A-03** | MEDIA | 3 · `amount_total`/`currency` ausentes o no numéricos | `StripeWebhookAdversarialTest.kt:103`, `:120`, `:136`; antes: `expected: <PENDIENTE> but was: <PAGADO>` en las tres | **corregida** · `StripeWebhookService.kt:123-124` |
| **A-04** | MEDIA | 3 · `data.object` que no es una `checkout.session` | `StripeWebhookAdversarialTest.kt:65`; antes: `solo una checkout.session abre la puerta ==> expected: <PENDIENTE> but was: <PAGADO>` | **corregida** · `StripeWebhookService.kt:113` |
| **A-05** | MEDIA | 4 · el reembolso **parcial** retiraba el release | `StripeWebhookAdversarialTest.kt:202`; antes: `un reembolso parcial no anula el plan ==> expected: <PAGADO> but was: <REEMBOLSADO>` | **corregida** · `StripeWebhookService.kt:173` + `:225` |
| **A-06** | MEDIA | 1 y 7 · cobro doble silencioso | `StripeWebhookAdversarialTest.kt:181`; antes: `Argument(s) are different!` (se anotaba `PROCESADO`) | **corregida** (detección) · `StripeWebhookService.kt:130,145-147`, `ProductPaymentsRepositories.kt:46` |
| **A-07** | MEDIA | 4 · el reembolso apagaba el enlace en origen pero **no en el borde** | `StripeWebhookAdversarialTest.kt:248` y `:266` | **corregida** · `StripeWebhookService.kt:180-187`, `ProductPaymentsRepositories.kt:162` |
| **A-08** | BAJA | 7 · dos checkouts simultáneos sobre la misma invitación | lectura: `CheckoutService.crear` no es transaccional ni toma cerrojo y `product_payment` no tiene unicidad por invitación; se crean dos filas `PENDIENTE` y dos sesiones | **abierta**, mitigada por A-06; parche propuesto abajo |
| **A-09** | BAJA | 3 · la prueba del cuerpo manipulado usaba un `ObjectMapper` que no es el de la aplicación | `PaymentsControllerTest`, prueba nueva `con el mapper de la aplicacion una clave desconocida en el checkout responde 400` | **corregida** (prueba) |
| A-10 | — | 1 · replay del **mismo** `event.id` | `ProductPaymentsPersistenceTest.un replay del mismo evento no vuelve a escribir` (Postgres real) + `StripeWebhookServiceTest:151` | **no aplica**: `ON CONFLICT DO NOTHING` sobre la PK; `200 {"duplicado":true}` y ni una escritura |
| A-11 | — | 1 · replay con **otro** `event.id` y la misma `checkout.session` | `StripeWebhookAdversarialTest.kt:159` (pasa ya antes del arreglo) | **no aplica**: la fila ya está `PAGADO` → `YA_PAGADO`, no se reescribe ni `pagado_en` ni `is_paid` |
| A-12 | — | 2 · firma ausente / de otro secreto / fuera de tolerancia / `v1` de otro payload / cuerpo firmado que no es evento | `StripeWebhookServiceTest:78,89,103,120,133,301`; vivo: `POST /public/stripe/webhook` sin cabecera → `400 PAY_WEBHOOK_SIGNATURE_INVALID`, y una firma calculada con el secreto de ejemplo del handoff → `400` (el secreto de `:6003` es otro) | **no aplica** |
| A-13 | — | 5 · IDOR de clienta | vivo: A pide `GET /product/payments/invitations/7` → `404 PAY_INVITATION_NOT_FOUND`; `POST …/checkout` sobre la 7 → `404` (mismo cuerpo que una inexistente); sin token → `401`; `GET …/pagos` de A → `{"pagos":[]}`, nunca los de B | **no aplica** |
| A-14 | — | 3 · precio o plan manipulados desde el navegador | vivo: `{"invitationId":5,"planCodigo":"fiesta","importe":1,"precioCentavos":1,"moneda":"USD","is_paid":true}` → `400 PAY_MALFORMED_JSON`; `planCodigo` inexistente/inactivo → `404 PAY_PLAN_NOT_FOUND`; invitación ya pagada → `409 PAY_ALREADY_PAID`; `invitationId` no numérico → `400`, nunca `500` | **no aplica** |
| A-15 | — | 6 · fugas | vivo: `GET /public/plans` no lleva `stripe_price_id` ni ningún dato de cuenta; los `details` de `PAY_INVITATION_NOT_FOUND` solo repiten el id que mandó quien pregunta; `PaymentsExceptionHandler` responde `{code,message,details}` y deja la traza en el log; los logs del webhook llevan `event.id`, `tipo` y `resultado`, y el de checkout `paymentId` e `invitationId` — ni correo ni importe | **no aplica** |
| A-16 | — | 7 · dos webhooks idénticos a la vez | `ProductPaymentsPersistenceTest.kt:142`: **dos conexiones JDBC reales** al mismo Postgres, sincronizadas con una barrera, insertando el mismo `event.id`; la suma de filas escritas es `1` y en la tabla queda una | **no aplica**: la exclusión la da la clave primaria, no un `if` |
| A-17 | — | 4 · publicar sin pagar | `PuertaDePagoIntegrationTest` (6 pruebas): `402 TPL_PLAN_UNPAID` en `publish`, `canPublish=false` con ese código el primero en `preflight`, **`is_paid = NULL` cuenta como no pagada**, y cero filas en `tpl_release`. Ninguna otra ruta publica: `rotatePublicToken` y `unpublish` no crean release, `POST /user/invitations/create` nace `isPaid = false` (`InvitationService.kt:76`) y el reembolso retira el `is_active` de verdad (`ProductPaymentsPersistenceTest.un reembolso quita is_paid y retira el release activo`) | **no aplica** |
| A-18 | — | 8 · frontend | `lib/pagos/enlaces.ts` exige el prefijo `https://checkout.stripe.com/` antes de `location.assign` (`OfertaDePlan.tsx:75-80`) y filtra `comprobanteUrl` a `https:` en las tres pantallas que lo pintan; `/pago` solo enseña «confirmado» cuando el backend responde `pagada: true` (`PantallaPago.tsx:71`), nunca por el `?sesion=` de la URL; no hay un solo `dangerouslySetInnerHTML` en `components/**` ni en `lib/pagos/**` | **no aplica**: era la objeción S-1/S-2 y **ya la corrigió la revisión 5-4-R1**, que encontré en el árbol; verificada, no duplicada |
| A-19 | — | 9 · pruebas dependientes del reloj o del orden | `build.gradle.kts` no declara `maxParallelForks`; las pruebas de pagos no usan `Thread.sleep` ni fechas absolutas del sistema (la firma usa `getTimeNow()` con tolerancia de 300 s y el caso caducado un `now - 3600` relativo); los datos se crean con `UUID` por prueba y `PuertaDePagoIntegrationTest` limpia su plantilla en `@BeforeEach` **y** en `@AfterEach` | **no aplica** |

## Lo que corregí, y por qué así

Todo dentro de `modules/product/payments/**`. **No toqué** `SecurityConfig.kt`, `application.yml`,
`modules/admin/**`, `modules/user/**`, `e2e/**` ni `scripts/seed/comun.sh`, y en `templates2` no
cambié ni una línea: A-07 solo **importa** el evento de dominio que `ReleaseService` ya publica.

### 1. El webhook deja de leer «campo ausente» como «sí» (A-02, A-03, A-04)

`StripeWebhookService.completar` decidía con tres condiciones permisivas:
`if (estadoDePago != null && estadoDePago != "paid")`, `if (importe != null && importe != …)`,
`if (moneda != null && …)`. Es decir: **un evento firmado al que le faltaran `payment_status`,
`amount_total` o `currency` abría la puerta de publicación sin que nada se comparara con nada**, que
es justo lo contrario de lo que promete el contrato §2.5 («se verifica que `amount_total` y
`currency` de la sesión coinciden»). Ahora falta un dato ⇒ no se paga, se anota el resultado y se
responde `200`, exactamente el mismo criterio conservador que ya tenía `IMPORTE_DISTINTO`. Y antes de
leerle un solo campo se comprueba que `data.object` sea de verdad una `checkout.session`.

Sé que exige más que Stripe: si algún día llega una sesión completada sin `amount_total`, el cobro
queda anotado y sin marcar en vez de abrirse solo. Es la dirección correcta del error — lo caro no es
revisar un evento a mano, es publicar gratis una invitación que nadie pagó.

Resultados nuevos en `product_stripe_event.resultado` (`varchar(40)`, caben): `OBJETO_INESPERADO`,
`SIN_IMPORTE_COMPARABLE`, `PAGO_DUPLICADO`, `REEMBOLSO_PARCIAL`.

### 2. El reembolso parcial ya no apaga la invitación (A-05)

`charge.refunded` llega igual por devolver un peso que por devolverlo todo, y el código anterior
retiraba el release en los dos casos. Devolver un peso a una clienta le apagaba el enlace público que
sí había pagado. Ahora `charge.refunded` solo cierra la puerta si `refunded = true` o si
`amount_refunded >= amount`; si no trae ninguno de los dos datos se considera **parcial** (la duda no
apaga el enlace de nadie). `charge.dispute.created` sigue retirando **siempre**: ahí el dinero se fue
entero y el objeto ni siquiera habla de reembolsos — hay una prueba para ese caso.

### 3. El cobro doble se detecta (A-06)

`CheckoutService.crear` comprueba `invitation.is_paid`, pero nada impide abrir dos sesiones de
Checkout sobre la misma invitación y pagar las dos (A-08). Antes, el segundo webhook marcaba pagada
otra vez y se anotaba `PROCESADO`: la clienta pagaba dos veces y **nadie se enteraba**. Ahora se mide
—antes de escribir, o la propia fila contaría— si esa invitación ya tenía otro cobro `PAGADO`; si lo
tenía, la fila se marca igual (el dinero está tomado y negarlo no lo devuelve) pero el evento queda
como `PAGO_DUPLICADO` para que alguien lo reembolse a mano.

### 4. El reembolso invalida también el borde (A-07)

`InvitationPaymentFlagRepository.retirarReleaseActivo` apaga el enlace **en origen**, pero nadie
anunciaba `PublicRenderInvalidated`, así que el borde seguía sirviendo la invitación reembolsada
hasta que su caché caducara. Es literalmente el caso que ADR-2-6-01 describe para despublicar
(`ReleaseService.unpublish` sí lo anuncia) y un contracargo no puede dejar la invitación abierta unos
minutos más. Ahora, si la `UPDATE` afectó a alguna fila, se publica
`PublicRenderInvalidated(invitationId, publicToken, DESPUBLICADO)` **dentro** de la transacción del
webhook; lo consume `RevalidationNotifier` después del commit, así que un webhook que se revierte no
invalida nada. El `public_token` se lee con una consulta nativa de una sola columna
(`ProductPaymentsRepositories.kt:162`), fiel al criterio del módulo: aquí no se montan las entidades
de `templates2`.

### 5. Dos pruebas que faltaban (A-09, A-16)

- `PaymentsControllerTest` probaba el cuerpo manipulado con el convertidor por defecto de
  `standaloneSetup`, que **ignora** las claves que sobran; el `ObjectMapper` real de la aplicación es
  el de `templates2` y trae `FAIL_ON_UNKNOWN_PROPERTIES`, o sea que en producción ese cuerpo se
  **rechaza** con `400`. La prueba nueva monta ese mapper y lo fija, para que nadie afloje sin querer
  la puerta por la que entrarían `importe` o `is_paid`.
- La idempotencia del webhook se probaba en serie. La prueba nueva la ataca con **dos conexiones
  reales y una barrera**: exactamente una de las dos entregas inserta.

## Cifras reales

- `./gradlew test --tests '*product*' --tests '*Release*'`: **94 pruebas, 0 fallos**
  (`StripeWebhookAdversarialTest` 12, `StripeWebhookServiceTest` 18, `PaymentsControllerTest` 21,
  `ProductPaymentsPersistenceTest` 11, `ReleaseIntegrationTest` 14, el resto de salud y repositorio).
- `./gradlew check` completo: **1351 pruebas, 0 fallos**, 94 clases (partía de 1337; +14 nuevas),
  incluidos `jacocoTestCoverageVerification` y `verifyJsonSchemaEmitted`.
- **Antes** de corregir, con las pruebas nuevas ya escritas: `10 tests completed, 7 failed`.
- Frontend: **no lo toqué** (la revisión 5-4-R1 ya había corregido S-1 y S-2 en el árbol), así que no
  corro su suite; lo revisado se detalla en A-18.

## Abierto, con el parche propuesto

### A-01 · `PUT /admin/invitations/{id}/mark-as-paid` no comprueba propiedad — **es de E5**

`InvitationAdminService.markAsPaid(id, updatedBy)` (`.kt:107-118`) recibe el `updatedBy` y **no lo
usa para autorizar nada**: busca la invitación por id y la marca. La ruta cuelga de `/admin/**`, que
`SecurityConfig` abre a `ADMIN` y `MASTER`. Consecuencia medida en vivo: **cualquier ADMIN regala el
plan a cualquier clienta del sistema**, aunque no la haya creado, y con ello abre la puerta de
publicación sin pasar por Stripe. Es el hallazgo S-03 de `12-producto-completo.md:476-489` y sigue
igual. Parche propuesto (una línea, en territorio de E5):

```kotlin
fun markAsPaid(id: Long, updatedBy: Long) {
    if (!hierarchyValidationService.validateInvitationAccess(updatedBy, id)) {
        throw UnauthorizedAccessException("No tienes permisos para modificar esta invitación")
    }
    …
}
```

Conviene además que E5 deje rastro de quién la marcó (hoy solo queda `updated_by`) y decida si un
`is_paid` puesto a mano debería crear una fila en `product_payment` con importe `0` y estado propio,
para que el historial no mienta por omisión.

### A-08 · dos checkouts simultáneos sobre la misma invitación

Se pueden abrir dos sesiones de Checkout de la misma invitación y pagar las dos. A-06 lo detecta
**después** (`PAGO_DUPLICADO`), pero no lo impide. No lo cierro yo porque las dos salidas razonables
son decisiones de producto, no del revisor: (a) **índice parcial único**
`CREATE UNIQUE INDEX ON product_payment (invitation_id) WHERE estado = 'PENDIENTE'` y reutilizar la
sesión abierta —hay que decidir qué hacer cuando esa sesión ya caducó en Stripe—; o (b) dejarlo como
está y resolverlo por reembolso manual con el aviso que A-06 ya deja anotado. La (a) exige migración
nueva (V45), que no es de este encargo.

## Lo que no pude comprobar

- **No hay cuenta de Stripe.** Ni un solo evento real ha pasado por este webhook, y `:6003` tiene un
  `STRIPE_WEBHOOK_SECRET` que no conozco (bien: lo intenté con el del handoff y me lo rechazó). Todo
  lo de firma e importe está probado con firmas calculadas en la prueba. La forma exacta del objeto
  de `charge.dispute.created` sigue siendo una suposición razonada, igual que decía 5-4-A.
- **A-01 mutó el entorno vivo**: la invitación `5` de mi propia siembra (`cliente-plan-1922-…`) quedó
  marcada como pagada al demostrarlo, y no hay ruta para deshacerlo. Es una invitación mía, no toca
  ninguna otra siembra ni el e2e de nadie.
