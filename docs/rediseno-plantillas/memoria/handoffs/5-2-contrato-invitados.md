# 5-2 · Contrato HTTP de invitados, RSVP y compartir — fijado por el orquestador de E2

Lo fija el orquestador **antes** de repartir para que el backend y el frontend se escriban en
paralelo sin esperarse. Es la referencia única: si el código y este documento discrepan, se corrige
el código o se corrige esto con un aviso al orquestador, nunca en silencio.

Base de todas las rutas autenticadas: `/product/invitations/{invitationId}/guests`.
Base de la superficie pública: `/public/r/{token}`.

## 0. Reglas que aplican a TODA la superficie nueva

1. **Autorización por propiedad de la invitación.** El rol `USER` solo alcanza invitaciones cuyo
   `invitation.customer.id` es el suyo. `ADMIN`/`MASTER` pasan por la jerarquía que ya existe
   (`HierarchyValidationService`). Nunca se abre `/admin/**` a `USER`.
2. **`@PreAuthorize` de clase** en cada controlador, porque `/product/` + `**` no casa con ninguna
   regla de prefijo de `SecurityConfig.kt:36-47` y cae en `anyRequest().authenticated()`
   (ADR-5-0C-01, parte C §2). El prefijo `/public/` **sí** casa (`SecurityConfig.kt:38`,
   `permitAll`) y por eso la superficie pública va bajo `/public/r/`.
3. **Ningún token de invitado sale del backend** salvo por `GET …/guests/{guestId}/enlace`, que es
   la única ruta cuyo propósito es compartir. Los DTO del panel **no** llevan `confirmationToken`
   ni `cancellationToken` (cierra S-13, y con S-04 arreglado deja de haber toma de control ajena).
4. **`cancellationToken` no se usa en la superficie nueva y no se expone nunca.** Cambiar de opinión
   (confirmar → declinar → confirmar) se hace con el mismo `confirmationToken` sobre
   `PUT /public/r/{token}` — `GuestAttendanceService.confirmAttendance` ya cubre los dos sentidos con
   `isAttending`. El enlace de cancelación heredado sigue existiendo para los correos viejos; no se
   construye ninguno nuevo.
5. **Una sola respuesta de fallo en lo público.** Token inexistente, deshabilitado, de una invitación
   sin publicar, de un anfitrión deshabilitado o mal formado → **`404` con el mismo cuerpo**
   `{"code":"RSVP_LINK_NOT_FOUND","message":"Este enlace ya no funciona"}`. Distinguirlos es un
   oráculo de enumeración (`/i/[publicToken]` ya hace lo mismo con `TPL_RELEASE_NOT_FOUND`).
6. **Errores tipados con `code`** en el módulo nuevo, mediante un `@RestControllerAdvice` acotado a
   `modules.product.guests` (el de `templates2` está acotado a su paquete y no alcanza, parte C §3).
   Códigos: `GUEST_NOT_FOUND`, `GUEST_INVALID`, `GUEST_DUPLICATE`, `GUEST_QUOTA_EXCEEDED`,
   `INVITATION_NOT_FOUND`, `RSVP_LINK_NOT_FOUND`, `RSVP_CLOSED`, `RSVP_TOO_MANY_ATTEMPTS`.
   **Ratificado por el orquestador**, sobre lo implementado: cada subpaquete declara **su propio**
   advice acotado (`…guests.panel` y `…guests.rsvp`), lo que evitó que dos agentes en paralelo se
   pisaran un fichero (ADR-5-E2-04); se añadieron `GUEST_INTERNAL` y `RSVP_INTERNAL` para que ningún
   `500` salga sin `code` por `GeneralExceptionHandler`, que con `include-message: always` (S-02)
   filtraría el mensaje interno; `GUEST_EMAIL_UNAVAILABLE` queda **declarado y sin productor** desde
   que `:send-email` funciona, y se conserva por si el transporte de correo no está configurado; y
   `RSVP_CLOSED` lo produce **también el panel**, no solo la superficie pública, porque
   `:send-email` necesita el mismo «esta invitación ya no admite respuestas» y duplicar el concepto
   con otro nombre habría sido peor.
7. **Idioma.** Nombres de clase y campos JSON en inglés (como todo el repositorio); mensajes y
   comentarios en es-MX.

## 1. Panel de la clienta (autenticado, `USER`+)

### `GET /product/invitations/{invitationId}/guests`
Parámetros: `search` (nombre, insensible a mayúsculas y acentos), `status`
(`PENDING|CONFIRMED|DECLINED`), `page` (0), `size` (25, máx 200).

```json
{ "content": [GuestItem], "page": 0, "size": 25, "totalElements": 49, "totalPages": 2 }
```

`GuestItem` — **sin tokens**:
```json
{ "id": 12, "fullName": "María Fernanda Cruz", "email": "…", "phone": "+52…",
  "tableNumber": 4, "adults": 2, "children": 1, "young": 0,
  "adultsConfirmed": 2, "childrenConfirmed": 1, "youngConfirmed": 0,
  "status": "CONFIRMED", "message": "…", "updatedAt": "2026-03-01T18:22:10Z" }
```

### `GET /product/invitations/{invitationId}/guests/summary`
Los contadores en vivo. Se calculan al vuelo reutilizando `InvitationGuestsService.getAllGuests`
(`:207-250`, ya suma las 16 cifras).
```json
{ "guests": { "total": 49, "pending": 12, "confirmed": 34, "declined": 3 },
  "seats":  { "adults": {"invited": 60, "confirmed": 48},
              "children": {"invited": 15, "confirmed": 10},
              "young": {"invited": 5, "confirmed": 3},
              "totalInvited": 80, "totalConfirmed": 61 },
  "rules":  { "childrenAllowed": true, "youngAllowed": false } }
```

### `POST /product/invitations/{invitationId}/guests` → `201` `GuestItem`
```json
{ "fullName": "…", "email": "…", "phone": "+52…", "tableNumber": 4,
  "adults": 2, "children": 1, "young": 0 }
```
Reutiliza `InvitationGuestsService.appendGuest` (`:52`). Respeta `children_allowed` /
`young_allowed` (`:437-443`): cupos no permitidos → `422 GUEST_QUOTA_EXCEEDED`.

### `POST /product/invitations/{invitationId}/guests:preview` → `200`, **no escribe nada**
Cuerpo `{"text": "…"}` (lo pegado, un invitado por renglón:
`nombre, adultos, niños, jóvenes, teléfono, correo`; solo el nombre es obligatorio).
```json
{ "ready": [GuestDraft], "problems": [{ "line": 3, "raw": "…", "code": "GUEST_INVALID",
   "message": "Falta el nombre.", "hint": "Escríbelo antes de la primera coma." }] }
```
`GuestDraft` es el `GuestItem` sin `id`, `status` ni `updatedAt`.

### `POST /product/invitations/{invitationId}/guests:import` → `200`
Mismo cuerpo. Da de alta **solo los renglones válidos** y devuelve la misma forma que
`:preview` con los creados ya como `GuestItem`. Nunca falla entera por un renglón malo.

### `PUT /product/invitations/{invitationId}/guests/{guestId}` → `200` `GuestItem`
### `DELETE /product/invitations/{invitationId}/guests/{guestId}` → `204`
Los dos **exigen** que `guest.invitation.id == invitationId` (cierra S-04 y S-05).

### `GET /product/invitations/{invitationId}/guests/{guestId}/link` → `200`
**La única ruta que revela un token**, y lo hace ya montado en la URL final:
```json
{ "url": "https://…/r/<confirmationToken>",
  "whatsappUrl": "https://wa.me/5215512345678?text=…",
  "shareText": "María Fernanda, te esperamos en la boda de Ana y Luis…" }
```
`url` se construye con `app.frontend.url` (`FRONTEND_URL`, ya inyectada), **nunca** con una constante
escrita en el código (es el defecto S-08). `whatsappUrl` solo viene si el invitado tiene teléfono.

### `GET /product/invitations/{invitationId}/guests/export.csv` → `200 text/csv; charset=utf-8`
Encabezados es-MX, separador `,`, BOM UTF-8 para que Excel en Windows no rompa los acentos.
Columnas: `Nombre,Correo,Teléfono,Mesa,Adultos,Niños,Jóvenes,Adultos confirmados,Niños confirmados,
Jóvenes confirmados,Estado,Mensaje`. **Sin tokens.**

### `POST /product/invitations/{invitationId}/guests/{guestId}:send-email` → `202`
Manda a ese invitado su enlace por correo sobre `core/email`. Requiere que el invitado tenga correo
y que la invitación tenga release activo; si no, `409 RSVP_CLOSED` con el motivo. Límite por
invitación y día, como el que ya tiene `EmailGuestNotifier.kt:79-84`.

## 2. Superficie pública del invitado (sin sesión)

### `GET /public/r/{token}` → `200`
```json
{ "guest": { "fullName": "María Fernanda Cruz",
             "adults": 2, "children": 1, "young": 0,
             "adultsConfirmed": 0, "childrenConfirmed": 0, "youngConfirmed": 0,
             "status": "PENDING", "hasEmail": true },
  "event": { "publicToken": "01J…", "childrenAllowed": true, "youngAllowed": false,
             "closed": false } }
```
- **Nada más.** Ni la lista de invitados, ni los contadores del anfitrión, ni correo o teléfono de
  nadie (ni el del propio invitado: `hasEmail` es un booleano, para poder decir «te mandamos el
  detalle a tu correo» sin volcar la dirección en el HTML de una página que se reenvía).
- `publicToken` sale de la unión `invitation_guest.invitation_id → tpl_document.invitation_id`
  (§A4.4). Es lo que permite a la página pintar la invitación con el render que ya existe.
- `closed` es `true` cuando la fecha del evento ya pasó (`GuestAttendanceService.kt:50-53` lo
  rechaza): la página lo dice antes de enseñar el formulario en vez de fallar al enviar.

### `PUT /public/r/{token}` → `200`, misma forma que el `GET`
```json
{ "attending": true, "adults": 2, "children": 1, "young": 0, "message": "…" }
```
- `attending: false` declina; volver a llamar con `true` vuelve a confirmar (cambiar de opinión).
- **`email` NO se acepta en el cuerpo** y si viene se ignora sin error: cierra S-07.
- `attending: true` con los tres cupos en cero → `422 GUEST_INVALID`.
- Cupos por encima de lo asignado → `422 GUEST_QUOTA_EXCEEDED`.

### Límite de intentos
Por **IP** y por **(token, IP)**, con la misma disciplina de `AuthThrottleService` (ámbito propio, no
compartido con `/auth`). Superado → `429 RSVP_TOO_MANY_ATTEMPTS`, cuerpo idéntico para cualquier
token. Con 128 bits de entropía (S-12) la fuerza bruta no es viable; el límite existe por coste, no
por confidencialidad, y **no** debe convertirse en un oráculo (el 429 no dice si el token existía).

> **Rectificación ratificada por el orquestador (revisión adversarial, ataque #4).** Este párrafo
> decía «por IP **y por token**», y así se implementó primero. La revisión lo midió y resultó
> explotable **contra la propia invitada**: con 40 peticiones, cualquiera que vea una captura del
> enlace la deja sin poder confirmar durante quince minutos. El cubo por token pasa a ser por
> **(token, IP)**. El motivo es que a 128 bits el cubo por token no protegía de nada —no hay quien
> adivine un token, así que no hay a quién frenar— y sí era un arma contra la única persona que
> tiene ese enlace legítimamente. Verificado en vivo: el atacante desde otra IP se bloquea solo y la
> dueña del enlace sigue respondiendo `200`.

## 3. Frontend

- `lib/invitados/api.ts` — cliente tipado de las rutas del §1, sobre `lib/api-client.ts`.
- `lib/invitados/rsvp.ts` — cliente de las rutas del §2. Se llama **desde el navegador**, nunca
  desde el servidor: el estado personal del invitado no puede quedar horneado en el HTML ni entrar
  en la caché ISR compartida de `/i/[publicToken]`.
- `app/(public)/r/[token]/page.tsx` — sirve el render público (con el `publicToken` que devuelve el
  `GET`) y monta la **isla** de RSVP en el gancho DOM que `RsvpSection` ya deja
  (`#rsvp-mount-{section.key}` / `data-rsvp-mount`, `RsvpSection.tsx`). La estética de esa sección
  no se toca.
- La página se declara **dinámica y `no-store`**: `export const dynamic = "force-dynamic"` y
  `revalidate = 0`. Nunca comparte entrada de caché con `/i/[publicToken]`.
