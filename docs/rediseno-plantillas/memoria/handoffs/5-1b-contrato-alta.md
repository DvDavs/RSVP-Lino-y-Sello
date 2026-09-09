# 5-1b · Contrato del alta de invitación por el rol USER

Autor: **5-E3-A1** · 2026-09-09 · ADR-5-E3-A1-01…05 (propuestas). Lo consumen **E2**, **E4** y el
asistente: basta este documento, no hace falta leer el código. **Verificado contra el backend real**
(`:6003`); las respuestas de abajo están copiadas de esa corrida.

> ## ⚠ CAMBIOS DEL 2026-09-09 (agente **5-E3-C2**, arreglo de R1-05/R1-11/R1-12/R1-15)
> **Este contrato ha cambiado. Si ya lo habías leído, lee al menos estos cuatro puntos.**
> 1. **Hay ruta de borrado**: `DELETE /product/invitations/{invitationId}` → `204`. Es la salida que
>    el `409` del tope siempre prometió. Contrato completo en **§1 bis**.
> 2. **Códigos de error nuevos**: `429 PRD_TOO_MANY_REQUESTS` (freno de caudal, en las dos rutas),
>    `404 PRD_INVITATION_NOT_FOUND` y `409 PRD_INVITATION_NOT_DELETABLE` (solo en el borrado). §4.
> 3. **La ventana del doble clic cambió de criterio**: ahora exige que coincida **el cuerpo entero**,
>    no solo `eventKind`+`eventDate`+`eventTime`. Dos altas del mismo evento con `hashtag` distinto
>    son **dos** invitaciones (`201` cada una), no una. Y la respuesta del `200` sale de la fila
>    guardada, no de la petición. §3.
> 4. **E4**: ya existe la fila puente de plan 2 y **hay que repuntarla al cobrar**; sin eso, la
>    invitación pagada sigue viendo bloqueadas las plantillas de plan 2. §7 y
>    `handoffs/5-E3-C2-para-E4.md`.

## 1. Ruta — `POST /product/invitations`, crea **una** invitación vacía del dueño del token

- Roles `USER`, `ADMIN`, `MASTER` (`@PreAuthorize` de clase, ADR-1R-B-10). Sin token → `401`; no hay
  rol autenticado fuera de esos tres, así que hoy **no existe un `403` por rol** en esta ruta.
  Cabeceras: `Authorization: Bearer <jwt>` y `Content-Type: application/json`.

## 1 bis. Ruta — `DELETE /product/invitations/{invitationId}`, borra **un borrador suyo**

*Añadida por 5-E3-C2 (R1-05). Es la acción que el mensaje del `409` del tope ya prometía y que no
existía: el único borrado del sistema era `DELETE /master/invitations/{id}/force`, de rol MASTER.*

- Mismos roles y misma autenticación que el alta. `Authorization: Bearer <jwt>`, sin cuerpo.
- **`204 No Content`, sin cuerpo**, cuando se borra. Libera cupo de inmediato: la siguiente alta pasa.
- Solo borra si la invitación es **suya**, **no está pagada** (`is_paid = false`), **no tiene ninguna
  publicación** en `tpl_release` (ni activa ni retirada) y nació de `templates2` (`uses_templates2`).
- **Es destructivo y no hay papelera.** Se lleva por cascada el documento y sus revisiones, los
  releases, los invitados y sus confirmaciones, y encola las imágenes de S3 para su borrado. El
  frontend **debe** pedir confirmación explícita antes de llamar.
- Una invitación **ajena** y una **inexistente** devuelven el mismo `404 PRD_INVITATION_NOT_FOUND`
  con el mismo cuerpo: esta ruta no sirve para averiguar qué ids existen.

## 2. Payload

| Campo | Tipo | Oblig. | Regla |
|---|---|---|---|
| `eventKind` | string | **sí** | uno de `wedding` `quince` `baptism` `communion` `confirmation` `birthday` `graduation` `generic` (espejo de `frontend/packages/schema/src/common.ts:61-63`); texto libre → `400` |
| `eventDate` | string | **sí** | `YYYY-MM-DD`, fecha real, **no anterior a hoy** en `America/Mexico_City` y **≤ 10 años** |
| `eventTime` | string | **sí** | `HH:MM` en 24 h |
| `childrenAllowed` | boolean | no | por defecto **`true`** |
| `youngAllowed` | boolean | no | por defecto **`true`** |
| `hashtag` | string | no | ≤ 100 caracteres, se recorta; por defecto `""` |

Los dos `*Allowed` nacen en `true` porque el backend de invitados rechaza con `400` un invitado con
niños sobre una invitación que no los admite y **hoy no hay ruta que edite esas columnas**.
**Todo campo desconocido se ignora en silencio** —un dueño (`customerId`, `ownerId`…) o un estado
(`isPaid`, `id`, `templateSlug`) puestos a mano no se aceptan ni se rechazan: se ignoran—, porque el
`customer_id` sale **siempre** de `authentication.userId()`. *Aviso para E2/E4/E5*: lo garantiza
`@JsonIgnoreProperties(ignoreUnknown = true)` en el DTO; el `ObjectMapper` de la aplicación es el
**estricto** de `templates2` (ADR-5-E3-A1-05), así que sin la anotación un campo de más da `400` — y
`standaloneSetup` de MockMvc **no lo detecta**.

## 3. Respuesta `201 Created`

```json
{"invitationId":3,"eventKind":"quince","eventDate":"2027-05-01","eventTime":"17:30",
 "childrenAllowed":true,"youngAllowed":true,"hashtag":"#Prueba","isPaid":false,"isEnabled":true,
 "isFinished":false,"usesTemplates2":true,"createdAt":"2026-09-09T04:57:23.695173932Z"}
```

Solo datos de **esa** invitación: ningún id ajeno, ningún conteo, ninguna lista. Sin `Location`:
todavía no hay `GET /product/invitations/{id}` al que apuntar.
**Doble clic** (cambiado por E3-C2, R1-11). `200 OK` en un solo caso: reenvío del mismo dueño con
**el cuerpo entero idéntico** —`eventKind`, `eventDate`, `eventTime`, `hashtag`, `childrenAllowed` y
`youngAllowed`—, sobre un borrador aún sin documento y **en menos de 60 s**; distínguelos por el
estado, no por el cuerpo. Basta que cambie **un** campo para que sea un alta nueva con `201`: dos
altas del mismo evento con hashtag distinto son dos invitaciones, y antes colapsaban en una.
El cuerpo del `200` es **la fila tal como está en la base** —incluidos `hashtag`, los dos permisos,
`isPaid`, `isEnabled`, `isFinished` y `createdAt`—, nunca un eco de la petición: si lo que respondes
no es lo que mandaste, lo que vale es lo que responde el backend.
**No hay idempotencia por clave de cliente**: detrás de esa ventana solo está el tope de 3, así que el
**frontend debe** deshabilitar el botón al primer envío y no reintentar solo un `5xx` (dos envíos con
datos distintos son dos invitaciones legítimas).

## 4. Errores

Cuerpo `{timestamp, statusCode, code, message, details}`, misma forma que `TplErrorResponse` (`contratos.md §4`) y `timestamp` en `dd/MM/yyyy HH:mm:ss`. El `code` es estable; el `message`, es-MX.

| Estado | `code` | Cuándo |
|---|---|---|
| `401` | — (cuerpo del núcleo, sin `code`) | sin token o token inválido |
| `400` | `PRD_MALFORMED_JSON` | el cuerpo no es JSON válido, o un campo trae otro tipo |
| `400` | `PRD_FIELD_REQUIRED` | falta o viene vacío `eventKind`, `eventDate` o `eventTime`; `details.field` |
| `400` | `PRD_EVENT_KIND_INVALID` | `eventKind` fuera de los ocho; `details.allowed` trae la lista |
| `400` | `PRD_DATE_INVALID` | `eventDate` no es `YYYY-MM-DD` o no existe (`2027-02-30`) |
| `400` | `PRD_DATE_IN_PAST` | `eventDate` anterior a hoy; `details.today` |
| `400` | `PRD_DATE_TOO_FAR` | `eventDate` a más de 10 años; `details.maxDate` |
| `400` | `PRD_TIME_INVALID` | `eventTime` no es `HH:MM` de 24 h |
| `400` | `PRD_HASHTAG_TOO_LONG` | `hashtag` de más de 100 caracteres; `details.max` |
| `409` | `PRD_DRAFT_LIMIT_REACHED` | ya tiene **3 borradores**; `details.limit`, `details.current` |
| `429` | `PRD_TOO_MANY_REQUESTS` | freno de caudal de este subpaquete. **Cubos separados por operación y por cuenta** (corregido el 2026-09-09, agente 5-E3-C4, R2-01): 20 altas y 30 borrados por cuenta y 15 min. Agotar el alta **no** deja sin borrado —esa es la salida del tope de tres— y ninguna clienta puede bloquear a otra: ya no hay cubo por IP salvo que el despliegue declare un proxy de confianza. Cuerpo **constante**: no dice qué cubo saltó ni cuánto falta. Se reintenta más tarde, no de inmediato |
| `500` | `PRD_TEMPLATE_BRIDGE_MISSING` | falta la fila puente de `V42`/`V44` para ese `eventKind` (entorno mal migrado) |
| `500` | `PRD_INTERNAL` | cualquier otra; cuerpo mudo |

Y **solo en `DELETE /product/invitations/{invitationId}`**:

| Estado | `code` | Cuándo |
|---|---|---|
| `400` | `PRD_PATH_PARAM_INVALID` | el `{invitationId}` de la ruta no es un número |
| `404` | `PRD_INVITATION_NOT_FOUND` | no existe **o no es suya**; el mismo cuerpo para los dos casos |
| `409` | `PRD_INVITATION_NOT_DELETABLE` | es suya pero ya no es un borrador. `details.reason`: `paid` (está pagada), `published` (llegó a publicarse) o `legacy` (es del módulo antiguo) |

**Borrador** = invitación **suya**, con `uses_templates2`, viva y **sin release activo** en
`tpl_release`; publicar o borrar libera cupo. El conteo va acotado a su `customer_id`, nunca en
memoria. Respuesta real del `409`:
`{"code":"PRD_DRAFT_LIMIT_REACHED","message":"Ya tienes 3 invitaciones sin publicar. Publica una o
elimina la que no vayas a usar para crear otra.","details":{"limit":3,"current":3}}`

## 5. Lo que este endpoint **no** hace

- **No aplica plantilla** (ADR-5-E3-A1-04). El paso 2 lo da el cliente:
  `POST /editor/invitations/{invitationId}/document:choose-template`
  (`EditorDocumentController.kt:36-41`), único creador del documento (ADR-1R-X-03). Comprobado: la
  invitación recién creada pasa la comprobación de propiedad de `templates2` con el mismo token.
- No cobra ni toca `is_paid` (E4), no crea invitados (E2), no publica, no manda correo, no sube
  imágenes y no edita; no hay `GET` ni `PUT` todavía (**sí hay `DELETE`**: §1 bis). No devuelve
  `publicToken`: no existe hasta el primer `:choose-template`.

## 6. Estado inicial en la base

`is_paid=false` · `is_enabled=true` · `is_finished=false` · `uses_templates2=true` (en el propio
`INSERT`) · `total_amount=0` · `has_music`/`has_gallery`/`has_extra_modules`/`all_events_same_location=false`
· `cover_photo_url=''` · `created_by`/`updated_by` = la dueña · `template_id` = **fila puente** de
`V42` según el `eventKind` (ADR-5-E3-A1-02; `planTier = 1`, plantillas de plan 2 bloqueadas hasta que
E4 lo suba). Ninguna columna `NOT NULL` sin valor, ninguna que `InvitationEntity` mapee a primitivo en `NULL`.

**Las filas puente se resuelven por el marcador de `url`, nunca por id** (`templates2:<eventKind>`).
Los ids 901-908 que citaba la versión anterior de este documento son un detalle de `V42`, no parte
del contrato: `V44` corrigió el tipo de evento al que cuelgan y sembró las gemelas de plan 2 con ids
que pone la secuencia. **Ningún consumidor debe escribir 901-908 en su código.**

## 7. Cómo sube una invitación a plan 2 (para **E4**)

El `planTier` que ve `templates2` sale de `invitation → invitation_template → invitation_plan.is_premium`
(`BusinessSnapshotReader.kt:63`), o sea **de la fila puente**, no de `is_paid`. Poner `is_paid = true`
**no** desbloquea las plantillas de plan 2 por sí solo.

Desde `V44` cada fila puente tiene una gemela premium con el marcador `templates2:<eventKind>:plan2`.
Al cobrar, en la misma transacción del webhook:

```sql
UPDATE invitation i
   SET template_id = (SELECT g.id FROM invitation_template g
                       WHERE g.url = (SELECT b.url FROM invitation_template b WHERE b.id = i.template_id) || ':plan2'),
       is_paid = true, updated_at = NOW()
 WHERE i.id = :invitationId
   AND i.uses_templates2 IS TRUE
   AND EXISTS (SELECT 1 FROM invitation_template b
                WHERE b.id = i.template_id AND b.url LIKE 'templates2:%' AND b.url NOT LIKE '%:plan2');
```

Y al revés en un reembolso o contracargo (ADR-5-0B-01): quitar el sufijo `:plan2` además de poner
`is_paid = false`. Desarrollo completo, casos de borde y qué **no** hacer: `handoffs/5-E3-C2-para-E4.md`.
