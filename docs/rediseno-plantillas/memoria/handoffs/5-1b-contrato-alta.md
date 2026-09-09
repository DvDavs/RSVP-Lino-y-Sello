# 5-1b · Contrato del alta de invitación por el rol USER

Autor: **5-E3-A1** · 2026-09-09 · ADR-5-E3-A1-01…05 (propuestas). Lo consumen **E2**, **E4** y el
asistente: basta este documento, no hace falta leer el código. **Verificado contra el backend real**
(`:6003`); las respuestas de abajo están copiadas de esa corrida.

## 1. Ruta — `POST /product/invitations`, crea **una** invitación vacía del dueño del token

- Roles `USER`, `ADMIN`, `MASTER` (`@PreAuthorize` de clase, ADR-1R-B-10). Sin token → `401`; no hay
  rol autenticado fuera de esos tres, así que hoy **no existe un `403` por rol** en esta ruta.
  Cabeceras: `Authorization: Bearer <jwt>` y `Content-Type: application/json`.

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
**Doble clic.** `200 OK` con el mismo cuerpo en un solo caso: reenvío del mismo dueño con el mismo
`eventKind`, `eventDate` y `eventTime`, sobre un borrador aún sin documento y **en menos de 60 s**;
distínguelos por el estado, no por el cuerpo. **No hay idempotencia por clave de cliente**: detrás de
esa ventana solo está el tope de 3, así que el **frontend debe** deshabilitar el botón al primer envío
y no reintentar solo un `5xx` (dos envíos con datos distintos son dos invitaciones legítimas).

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
| `500` | `PRD_TEMPLATE_BRIDGE_MISSING` | falta la fila puente de `V42` para ese `eventKind` (entorno mal migrado) |
| `500` | `PRD_INTERNAL` | cualquier otra; cuerpo mudo |

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
  imágenes, no edita y no borra; no hay `GET`, `PUT` ni `DELETE` todavía. No devuelve `publicToken`:
  no existe hasta el primer `:choose-template`.

## 6. Estado inicial en la base

`is_paid=false` · `is_enabled=true` · `is_finished=false` · `uses_templates2=true` (en el propio
`INSERT`) · `total_amount=0` · `has_music`/`has_gallery`/`has_extra_modules`/`all_events_same_location=false`
· `cover_photo_url=''` · `created_by`/`updated_by` = la dueña · `template_id` = **fila puente** de
`V42` según el `eventKind` (901-908, ADR-5-E3-A1-02; `planTier = 1`, plantillas de plan 2 bloqueadas
hasta que E4 lo suba). Ninguna columna `NOT NULL` sin valor, ninguna que `InvitationEntity` mapee a primitivo en `NULL`.
