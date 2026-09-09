# 12a — Inventario del backend heredado (fase 5, agente 5-0b-A)

Documento de entrada para `12-producto-completo.md`. Es un **inventario verificado leyendo el
código**: cada afirmación lleva `fichero:línea` relativo a la raíz del repositorio. Los prefijos de
paquete `src/main/kotlin/mx/evolutiondev/invitaciones/` se abrevian como `…/`.

Marcas de fiabilidad usadas en todo el documento:

- **[V]** verificado — lo leí en el código, con la línea citada.
- **[I]** inferido — deducción a partir de lo verificado, no ejecutado ni probado.
- **[?]** no pude determinar en el tiempo/contexto de este encargo.

No se ha modificado ni una línea de producción. No hay propuestas aplicadas: solo hallazgos y
arreglos mínimos propuestos para que otro agente los escriba.

---

## 0. Cómo se decide hoy quién puede entrar a cada ruta

Esto condiciona todas las secciones siguientes, así que va primero.

**[V]** La autorización **no** vive en los controladores heredados. `grep` sobre todo
`src/main/kotlin` devuelve `@PreAuthorize` en **solo cinco ficheros, todos de `templates2`**
(`EditorDocumentController.kt:37`, `EditorReleaseController.kt:32`, `EditorEventController.kt:41`,
`EditorAssetController.kt:43`, `CatalogController.kt:24`, `MasterTemplateRegistryController.kt:36`).
Todo lo demás se resuelve por prefijo de ruta en
`…/core/auth/security/SecurityConfig.kt:36-47`:

| Regla | Línea | Efecto |
|---|---|---|
| `/auth/**` | `SecurityConfig.kt:37` | `permitAll` |
| `/public/**` | `SecurityConfig.kt:38` | `permitAll` |
| `/error` | `SecurityConfig.kt:39` | `permitAll` |
| `/admin/dashboard` | `SecurityConfig.kt:40` | ADMIN, MASTER **y USER** |
| `/admin/administrators/users/**` | `SecurityConfig.kt:41` | MASTER |
| `/admin/**` | `SecurityConfig.kt:42` | ADMIN, MASTER |
| `/user/**` | `SecurityConfig.kt:43` | USER, ADMIN, MASTER |
| `/master/**` | `SecurityConfig.kt:44` | MASTER |
| `/api/whatsapp/**` | `SecurityConfig.kt:45` | USER, ADMIN, MASTER |
| `/webhook` | `SecurityConfig.kt:46` | `permitAll` |
| resto (`/editor/**`) | `SecurityConfig.kt:47` | `authenticated()` — de ahí los `@PreAuthorize` de clase de templates2 |

**[V]** `@EnableMethodSecurity` está activo (`SecurityConfig.kt:17`), así que los `@PreAuthorize` de
templates2 funcionan. **[V]** CSRF deshabilitado (`SecurityConfig.kt:27-28`), sesión `STATELESS`
(`:31-32`), y CORS con `allowedOrigins = listOf("*")`
(`…/core/auth/cors/AppCorsConfiguration.kt:17`).

Consecuencia de diseño para la fase 5 **[I]**: cualquier ruta nueva que se cuelgue de
`modules/product/**` **no cae bajo ninguna regla de prefijo** y quedará en `authenticated()`. O se
añade su prefijo a `SecurityConfig` (tocar el núcleo de seguridad: requiere ADR) o se pone
`@PreAuthorize` de clase, que es exactamente lo que hizo templates2 (ADR-1R-B-10). **Lo segundo es
lo que recomiendo**: no toca el fichero compartido.

---

## A1. Mapa del backend heredado por área

### A1.1 `core/auth` — sin rutas propias

**[V]** 15 ficheros (`find …/core/auth -name "*.kt"`).

| Clase | Fichero | Qué hace |
|---|---|---|
| `SecurityConfig` | `…/core/auth/security/SecurityConfig.kt:18` | La cadena de filtros y la tabla de prefijos de arriba; expone `BCryptPasswordEncoder` (`:52-55`). |
| `JwtTokenFilter` | `…/core/auth/security/JwtTokenFilter.kt` | Filtro que lee el `Bearer` y puebla el `SecurityContext`. |
| `JwtUtil` | `…/core/auth/jwt/JwtUtil.kt:13` | Acuña y valida el JWT (HS256, `:31`), y **acuña los dos tipos de token opaco del producto**: `generateSecureToken()` = 128 bytes de `SecureRandom` (`:59-64`) y `generateInvitationSecureToken()` = 16 bytes de `SecureRandom` (`:66-71`). |
| `CustomerEntity` | `…/core/auth/model/CustomerEntity.kt:16` | Tabla `customer`. Campos relevantes: `email` único (`:23-24`), `password` (`:26-27`), `role` (`:29-31`), `isEnabled` (`:33-34`), `isBanned` (`:36-37`), `resetToken`/`resetTokenExpiry` (`:39-40`), `isSurveyAnswered` (`:64-65`), `avatarId` (`:67-68`), `refreshTokens` (`:70-71`). **No hay ningún campo de verificación de correo.** |
| `RefreshTokenEntity` | `…/core/auth/model/RefreshTokenEntity.kt` | Token de refresco 1:1 con el cliente. |
| `Role` / `AppRole` | `…/core/auth/model/Role.kt`, `…/core/auth/model/AppRole.kt` | `USER`, `ADMIN`, `MASTER`. |
| `HierarchyValidationService` | `…/core/auth/service/HierarchyValidationService.kt:10` | El único guardián de propiedad real del backend heredado: `validateUserAccess` (`:23-40`) y `validateInvitationAccess` (`:42-71`). MASTER ve todo; ADMIN ve lo que creó él o lo de los usuarios que creó; USER solo lo suyo (`:69`). |
| `AuthEntryPointJwt`, `InvitationsAccessDeniedHandler` | `…/core/auth/security/` | 401 / 403. |
| `AppCorsConfiguration` | `…/core/auth/cors/AppCorsConfiguration.kt:11` | CORS `*`. |

### A1.2 `modules/auth` — 5 rutas, todas `permitAll`

`…/modules/auth/presentation/AuthController.kt:27`

| Verbo + ruta | Línea | Rol hoy | Qué hace |
|---|---|---|---|
| `POST /auth/token` | `AuthController.kt:36` | público | Acceso. `validateUser` + refresh token + `TokenResponse{accessToken, refreshToken, role, isSurveyAnswered}` (`:72-79`). |
| `POST /auth/token/refresh` | `AuthController.kt:44` | público | Canjea el token de refresco por un JWT nuevo. |
| `POST /auth/signup` | `AuthController.kt:51` | público | Alta con rol `USER` fijo (`CustomerService.kt:127`) y **devuelve sesión iniciada** (`:60-62`). |
| `POST /auth/request-password-reset` | `AuthController.kt:60` | público | Recuperación. Respuesta única, sin token (N-01 cerrado). |
| `POST /auth/reset-password` | `AuthController.kt:66` | público | Cambia la contraseña con el token del correo. |

Servicios: `CustomerService` (`…/modules/auth/service/CustomerService.kt:30`),
`RefreshTokenService` (`…/RefreshTokenService.kt:13`, validez 7 días `:17`),
`ResetPasswordService` (`…/ResetPasswordService.kt:34`, validez 15 min `:42`),
`AuthThrottleService` (`…/AuthThrottleService.kt`, límites en `:109-121`: 5 fallos por cuenta, 20
por IP, ventana 15 min, tope 50 000 entradas, `confiar-en-x-forwarded-for:false`; tres ámbitos
independientes `ACCESO`/`RECUPERACION`/`REGISTRO` en `:53-60`).

**[V]** No existe ninguna ruta de cierre de sesión ni de revocación de token de refresco: `grep -rni
"logout"` sobre `src/main/kotlin` no devuelve nada.

### A1.3 `modules/profile` y perfil de usuario

- **[V]** `…/modules/profile/avatar/` **no tiene controlador**: es solo `AvatarService`
  (`…/modules/profile/avatar/service/AvatarService.kt`) + repositorio, consumido desde los
  controladores de perfil.
- **[V]** `…/modules/user/profile/presentation/ProfileController.kt:20` — prefijo `/user/profile`,
  rol USER/ADMIN/MASTER por `SecurityConfig.kt:43`:

| Verbo + ruta | Línea | Qué hace |
|---|---|---|
| `GET /user/profile` | `ProfileController.kt:28` | Perfil propio (`authentication.userId()`, `:33`). |
| `PUT /user/profile` | `ProfileController.kt:37` | Actualiza nombre, apellidos, **correo**, teléfono, dirección (`ProfileService.kt:44-52`). |
| `PUT /user/profile/photo/{avatarId}` | `ProfileController.kt:48` | Elige avatar del catálogo. |
| `POST /user/profile/survey` | `ProfileController.kt:58` | Guarda la encuesta de alta. |

- **[V]** `…/modules/master/profile/presentation/MasterAvatarController.kt:12` — `/master/profile/avatars`,
  rol MASTER: `POST` (`:15`), `PUT /{id}` (`:21`), `DELETE /{id}` (`:26`). Sube avatares a S3.

### A1.4 `modules/shared/guests` — sin rutas propias, es el motor de invitados y RSVP

**[V]** 26 ficheros; ningún `@RestController`. Todo se expone desde `modules/user`, `modules/admin`,
`modules/master` y `modules/all`.

| Clase | Fichero | Qué hace |
|---|---|---|
| `InvitationGuestEntity` | `…/modules/shared/guests/repository/model/InvitationGuestEntity.kt:25` | Tabla `invitation_guest`. Detalle en §A4. |
| `AttendanceStatus` | `…/repository/model/AttendanceStatus.kt:3` | `PENDING`, `CONFIRMED`, `DECLINED`. |
| `InvitationGuestsRepository` | `…/repository/InvitationGuestsRepository.kt` | `findByConfirmationToken` (`:17`), `findByCancellationToken`, `findAllByInvitationId`, `hardDeleteById`, `JpaSpecificationExecutor`. |
| `InvitationGuestsService` | `…/service/InvitationGuestsService.kt:32` | Alta (`:52`), edición (`:114`), borrado (`:153`), listado paginado (`:163`), **resumen de cupos** (`:207`), ficha (`:253`), cancelar desde el panel (`:280`), notificar (`:304`), listado global MASTER (`:343`), borrado físico (`:390`). Guardián único: `validateInvitation` (`:396-414`). |
| `GuestAttendanceService` | `…/service/GuestAttendanceService.kt:18` | El RSVP real: `confirmAttendance` (`:24`), `cancelAttendance` (`:63`), validación de cupos (`:150-184`). |
| `GuestFileImportService` | `…/service/GuestFileImportService.kt` | Importación CSV: cabecera opcional «nombre del graduado» (`:192-195`), 6-8 columnas (`:206-219`), orden `nombre, graduado, teléfono, correo, adultos, jóvenes, niños, mesa` (`:221-230`). |
| `GuestExportService` | `…/service/GuestExportService.kt` | PDF de mensajes y XLSX de confirmados. |
| `EmailGuestNotifier` | `…/notifier/EmailGuestNotifier.kt` | Correos a invitados y al anfitrión. Detalle y hallazgo en §A6. |
| `GuestsSpecifications` | `…/service/filter/GuestsSpecifications.kt` | Filtros JPA por rol (`prepare`) y para MASTER (`forMaster`). |

### A1.5 `modules/shared/whatsapp` — 3 rutas

| Verbo + ruta | Fichero:línea | Rol hoy | Qué hace |
|---|---|---|---|
| `GET /webhook` | `…/modules/shared/whatsapp/WhatsAppWebhookController.kt:24` | `permitAll` | Verificación del webhook de Meta contra un `VERIFY_TOKEN` **escrito en el código** (`:13`). |
| `POST /webhook` | `WhatsAppWebhookController.kt:39` | `permitAll` | Recibe mensajes y responde con un texto fijo (`:76-85`). **Sin verificación de la firma `X-Hub-Signature-256`.** |
| `POST /api/whatsapp/send-masivo` | `…/modules/shared/whatsapp/WhatsAppController.kt:11` | USER/ADMIN/MASTER | Envía la plantilla `ver_invitacion` (`WhatsAppService.kt:53`) a **la lista de teléfonos que venga en el cuerpo**, sin comprobar que sean invitados de una invitación del solicitante. |

### A1.6 `core/email` — sin rutas

| Clase | Fichero | Qué hace |
|---|---|---|
| `EmailService` | `…/core/email/EmailService.kt:8` | `sendEmail(to, templateName, variables)` (`:13`) y `sendCustomEmail(...)` (`:30`). Ambas `suspend`. |
| `EmailSenderStrategy` | `…/core/email/strategy/EmailSenderStrategy.kt:5` | Interfaz de proveedor. |
| `GoogleSmtpStrategy` | `…/core/email/strategy/GoogleSmtpStrategy.kt:58` | Activa con `email.provider=google` (`:57`), que es el valor actual (`application.yml:77`). |
| `MailerSendEmailStrategy` | `…/core/email/strategy/MailerSendEmailStrategy.kt:41` | Alternativa por API, activa con `email.provider=mailersend` (`:39`). |
| `MailConfig` | `…/core/email/MailConfig.kt:21` | Bean `JavaMailSender` con host, usuario y **contraseña escritos en el código** (`:27-30`). |
| `EmailContentGenerator` | `…/core/email/EmailContentGenerator.kt:14` | Las plantillas, en HTML dentro de Kotlin. Catálogo en §A6. |

### A1.7 `modules/master/plans` — 6 rutas, todas MASTER

`…/modules/master/plans/presentation/MasterPlansController.kt:17`

| Verbo + ruta | Línea |
|---|---|
| `POST /master/plans` | `:23` |
| `GET /master/plans` (filtros `isPremium`, `isEnable`, `page`) | `:33` |
| `GET /master/plans/{id}` | `:43` |
| `PUT /master/plans/{id}` | `:51` |
| `DELETE /master/plans/{id}` (baja lógica) | `:62` |
| `PATCH /master/plans/{id}/activate` | `:72` |

Entidad: `…/modules/master/plans/repository/model/InvitationPlanEntity.kt:14`. Detalle en §A5.

### A1.8 `modules/admin/**` — 41 rutas

**Ojo con el paquete**: `…/modules/admin/users/presentation/MasterController.kt:31` vive en
`modules/admin` pero **cuelga de `/master`**, así que es MASTER por `SecurityConfig.kt:44`.

| Controlador | Prefijo | Rol hoy | Rutas |
|---|---|---|---|
| `AdminUsersController.kt:20` | `/admin/users` | ADMIN, MASTER | `POST /create` (`:26`), `GET /my-users` (`:38`), `PUT /{id}/ban` (`:49`), `PUT /{id}/unban` (`:64`), `DELETE /{id}/delete` (`:79`), `POST /{id}/re-activate` (`:94`), `GET /{id}` (`:109`), `PUT /{id}/update` (`:119`), `PUT /{id}/password/update` (`:131`) |
| `AdminMasterUsersController.kt:21` | `/admin/administrators/users` | MASTER (`SecurityConfig.kt:41`) | `GET /all` (`:29`), `GET /{id}` (`:35`), `POST /create` (`:41`), `PUT /{id}/update` (`:51`), `PUT /{id}/password/update` (`:63`), `DELETE /{id}/force` (`:76`) |
| `InvitationController.kt:24` | `/admin/invitations` | ADMIN, MASTER | `GET /unpaid` (`:30`), `PUT /{id}/mark-as-paid` (`:42`), `POST /create` (`:52`), `GET /all` (`:68`), `GET /{id}` (`:99`), `PUT /{id}` (`:110`), `PUT /{id}/toggle-status` (`:127`), `GET /{id}/guests/notify` (`:143`) |
| `AdminGuestsController.kt:34` | `/admin/invitations` | ADMIN, MASTER | `GET /{id}/guests` (`:40`), `GET /{id}/guests/{guestId}` (`:66`), `POST /{id}/guests/append` (`:84`), `PUT /{id}/guests/{guestId}/update` (`:104`), `DELETE /{id}/guests/{guestId}` (`:126`), `POST /{id}/guests/upload` (`:145`), `PUT /{id}/guests/{guestId}/cancel-attendance` (`:163`), `GET /{id}/guests/download/messages-pdf` (`:183`), `GET /{id}/guests/download/confirmed-xlsx` (`:207`) |
| `DashboardController.kt:13` | `/admin/dashboard` | **ADMIN, MASTER y USER** (`SecurityConfig.kt:40`) | `GET` (`:18`). Bifurca por rol en el propio método (`:23-27`): panel de admin o panel del cliente. |
| `NotificationsController.kt:11` | `/admin/dashboard/notifications/receivers` | ADMIN, MASTER (cae en `/admin/**`) | `POST` (`:16`), `GET` (`:21`), `PUT /{id}` (`:25`), `DELETE /{id}` (`:33`) |
| `MasterController.kt:31` | `/master` | MASTER | `GET /users` (`:52`), `GET /invitations/all` (`:98`), `DELETE /invitations/{id}/force` (`:146`) |

Servicios de apoyo: `AdminUsersService` (`…/modules/admin/users/service/AdminUsersService.kt`),
`InvitationAdminService` (`…/modules/admin/invitations/service/InvitationAdminService.kt`),
`DashboardService` (`…/modules/admin/dashboard/service/DashboardService.kt`),
`InvitationSpecifications` (`…/modules/admin/invitations/repository/InvitationSpecifications.kt`),
y la entidad `InvitationEntity` (`…/modules/admin/invitations/repository/model/InvitationEntity.kt`).

**Nota importante [V]**: `InvitationEntity` vive en `modules/admin/invitations`, **no** en
`modules/user/invitations`. No está en la lista de módulos prohibidos, y tanto `templates2`
(`V32__create_tpl_document.sql:7`) como `InvitationGuestEntity`
(`InvitationGuestEntity.kt:29-31`) dependen de ella.

### A1.9 `modules/all/**` — 12 rutas, todas bajo `/public/**` y por tanto `permitAll`

| Controlador | Verbo + ruta | Línea | Qué hace |
|---|---|---|---|
| `PublicInvitationTemplateController.kt:10` | `GET /public/invitations/templates` | `:16` | Catálogo de plantillas **antiguas** filtrado por `eventId`/`planId`. |
| ídem | `GET /public/invitations/templates/preview/{invitationId}/signed-url` | `:33` | URL firmada de S3 del HTML de una invitación **por id numérico y sin autenticar**. |
| `PublicInvitationInfoController.kt:22` | `GET /public/invitations/dress-code/predefined` | `:33` | Catálogo. |
| ídem | `GET /public/invitations/event-type` | `:42` | Catálogo de tipos de evento. |
| ídem | `GET /public/invitations/plan` | `:53` | **Lista pública de planes**: solo `id` y `name` (`:56-58`). |
| ídem | `GET /public/invitations/gift-registry/predefined-data` | `:64` | Catálogo. |
| ídem | `GET /public/invitations/music/recommendations` | `:73` | Catálogo. |
| ídem | `GET /public/invitations/phrases/configuration` | `:88` | Catálogo. |
| ídem | `GET /public/invitations/extra-modules` | `:103` | Catálogo con precios de módulos extra. |
| `PublicGuestInfoController.kt:52` | `GET /public/invitation/guest-info/{token}` | `:58` | **Ficha del invitado por token de confirmación.** Devuelve nombre, correo, cupos, cupos confirmados, mesa, `cancellationToken` y **el detalle completo de la invitación antigua** (`:77`, `:102`). |
| `InviteAttendingController.kt:14` | `PUT /public/invitation/{confirmationToken}/attend` | `:20` | **El RSVP.** Confirma o declina y devuelve el invitado + el detalle de la invitación antigua (`:33-41`). |
| ídem | `PUT /public/invitation/cancel/{cancellationToken}` | `:44` | Cancela una asistencia ya confirmada. |

### A1.10 `modules/public/**` — 1 ruta

| Verbo + ruta | Fichero:línea | Qué hace |
|---|---|---|
| `GET /public/profile/avatars` | `…/modules/public/profile/presentation/PublicAvatarController.kt:13` | Catálogo de avatares. |

### A1.11 `modules/templates2` — 19 rutas (solo la superficie que consume el producto)

| Controlador | Rutas | Rol |
|---|---|---|
| `CatalogController.kt:23` | `GET /editor/templates2/catalog` (`:36`) | USER/ADMIN/MASTER (`:24`) |
| `EditorDocumentController.kt:36` | `POST /document:choose-template` (`:41`), `GET /document` (`:53`), `POST /document/operations` (`:58`), `GET /document/history` (`:66`), `POST /document/restore` (`:76`) — todas bajo `/editor/invitations/{invitationId}` | USER/ADMIN/MASTER (`:37`) |
| `EditorEventController.kt:40` | `PUT /editor/invitations/{invitationId}/event` (`:45`) | USER/ADMIN/MASTER (`:41`) |
| `EditorAssetController.kt:42` | `POST` (`:54`), `GET` (`:72`), `DELETE /{assetId}` (`:84`) bajo `/editor/invitations/{invitationId}/assets` | USER/ADMIN/MASTER (`:43`) |
| `EditorReleaseController.kt:31` | `GET /release/preflight` (`:36`), `POST /release` (`:41`), `DELETE /release` (`:53`), `GET /releases` (`:60`), `POST /public-token:rotate` (`:69`) | USER/ADMIN/MASTER (`:32`) |
| `PublicRenderController.kt:28` | `GET /public/i/{publicToken}/render` (`:46`), `GET /public/i/{publicToken}/exists` (`:72`) | público, **a propósito y sin `@PreAuthorize`** (`:21`) |
| `MasterTemplateRegistryController.kt:35` | `POST /master/templates2/versions` (`:54`), `GET` (`:70`), `POST /{templateVersionId}:deprecate` (`:91`) | MASTER (`:36`) |
| `LocalAssetController.kt` | `GET {BASE}/**` (`:34`) | Solo desarrollo (`TEMPLATES2_ASSETS_MODE=local`) |

**[V] Lo que templates2 NO tiene y la fase 5 necesita**:
1. **Ninguna ruta crea una invitación.** El editor siempre recibe un `invitationId` que ya existe.
   La única alta hoy es `POST /user/invitations/create`
   (`…/modules/user/invitations/presentation/InvitationsController.kt:34`), que está **prohibida**.
2. **Ninguna ruta consulta el pago.** `grep "isPaid\|is_paid"` sobre `modules/templates2` no
   devuelve nada: `ReleaseService.publish` no mira `invitation.is_paid`. Publicar es gratis hoy.
3. **Ninguna ruta llega a los invitados** desde el `publicToken`.

---

## A2. Tabla maestra endpoint × decisión

Leyenda de sesiones: **E2** cuenta y acceso · **E3** invitados y RSVP · **E4** compartir y
confirmaciones en vivo · **E5** planes, pago y administración. Son las etiquetas del encargo; si el
orquestador reasigna, cambia solo esta columna.

### A2.1 Registro, acceso y cuenta

| Verbo y ruta | Rol hoy | Quién lo consume | Decisión | Hallazgo (`fichero:línea`) / destino |
|---|---|---|---|---|
| `POST /auth/token` | público | E2 | **REUTILIZAR TAL CUAL** | `CustomerService.kt:60-81` ya tiene límite de intentos, hash señuelo y `401` idéntico en los tres caminos. |
| `POST /auth/token/refresh` | público | E2 | **ENDURECER** | `RefreshTokenService.kt:38-58` valida y **devuelve el mismo token** (`AuthController.kt:44-49`): no hay rotación, así que un token robado vive los 7 días completos (`RefreshTokenService.kt:17`) y el uso legítimo no lo delata. Arreglo mínimo: rotar en cada canje (borrar el usado, emitir uno nuevo) — es una línea en `RefreshTokenService`, sin cambio de contrato. |
| `POST /auth/signup` | público | E2 | **ENDURECER** | Dos cosas: (a) `CustomerService.kt:139-148` manda el correo `welcome` pero **no hay verificación de correo en ninguna parte** (§A6); (b) `AuthController.kt:51-58` devuelve sesión iniciada de inmediato, así que si se añade verificación hay que decidir si se sigue permitiendo. La enumeración por `DuplicatedEmailException` (`CustomerService.kt:102`) está **aceptada y documentada** (`CustomerService.kt:84-92`): se mitiga con caudal, no se puede cerrar sin romper el alta. Arreglo mínimo: emitir el token de verificación en el alta y marcar la cuenta como no verificada; no bloquear el acceso hasta que producto lo decida. |
| `POST /auth/request-password-reset` | público | E2 | **REUTILIZAR TAL CUAL** | N-01 cerrado: respuesta única (`ResetPasswordService.kt:52-53`), token nunca en el cuerpo (`RecoveryPasswordSentResponse.kt:15-17`), límite en ámbito propio (`:58`, `:91`). |
| `POST /auth/reset-password` | público | E2 | **ENDURECER** | `ResetPasswordService.kt:96-112` **no tiene límite de intentos** (a diferencia de sus dos hermanos) y **no invalida los tokens de refresco vivos** tras cambiar la contraseña: quien tenga un refresh token robado sigue dentro después del «recupera tu cuenta». Arreglo mínimo: `authThrottleService.comprobar(AmbitoIntentos.RECUPERACION, …)` al entrar, y `refreshTokenRepository.deleteByCustomer(customer)` antes del `save` de `:107`. |
| `POST /auth/verify-email` + `POST /auth/verify-email:resend` | — | E2 | **CREAR** | No existe nada: `CustomerEntity.kt:16-79` no tiene campo de verificación y `grep -i "verif.*email"` no devuelve ninguna ruta. Va en `modules/product/cuenta`, con una migración `V41` que añada `email_verified boolean not null default true` (`true` para no invalidar las cuentas existentes) + `email_verification_token` + `email_verification_expiry`. Ver §A6 para la viabilidad del correo. |
| `POST /auth/logout` | — | E2 | **CREAR** | `grep -rni "logout"` sobre `src/main/kotlin` no devuelve nada: los tokens de refresco solo se borran al volver a entrar (`RefreshTokenService.kt:20-24`) o al deshabilitar la cuenta (`:48-55`). Va en `modules/product/cuenta`: borrar la fila de `refresh_token` del solicitante. |
| `PUT /user/account/password` (contraseña propia con la actual) | — | E2 | **CREAR** | Hoy un `USER` **no puede cambiar su propia contraseña estando dentro**: la única ruta es `PUT /admin/users/{id}/password/update` (`AdminUsersController.kt:131`) y `/admin/**` exige ADMIN o MASTER (`SecurityConfig.kt:42`). Va en `modules/product/cuenta`; debe exigir la contraseña actual, cosa que `AdminUsersService.kt:218-232` no hace. |
| `GET /user/profile` | USER+ | E2 | **REUTILIZAR TAL CUAL** | `ProfileController.kt:28-35` lee siempre `authentication.userId()`; no acepta id ajeno. |
| `PUT /user/profile` | USER+ | E2 | **ENDURECER** | `ProfileService.kt:44-52` **cambia el correo de acceso sin verificar el nuevo ni avisar al antiguo**, y la comprobación de unicidad (`:37-42`) solo mira cuentas habilitadas, así que un correo de una cuenta deshabilitada revienta contra el índice único (`CustomerEntity.kt:23`) con un 500 en vez de un mensaje. Arreglo mínimo: sacar `email` de este DTO y moverlo a un flujo propio con verificación; mientras tanto, comparar contra `findByEmailEvenIfDisabled`. |
| `PUT /user/profile/photo/{avatarId}` | USER+ | E2 | **REUTILIZAR TAL CUAL** | `ProfileController.kt:48-56`, id del avatar de catálogo, sin datos ajenos. |
| `POST /user/profile/survey` | USER+ | E2 | **REUTILIZAR TAL CUAL** | `ProfileController.kt:58-67`. |

### A2.2 Invitados: alta, edición, borrado, listado, importación

Todas viven en `AdminGuestsController` (`/admin/**`, ADMIN+) o en `InvitationsController`
(`/user/invitations/**`, **módulo prohibido**), y ambas delegan en el mismo
`InvitationGuestsService`. **Ese servicio sí se puede reutilizar** (`modules/shared/guests` no está
prohibido); lo que hay que crear es la superficie HTTP para el rol USER fuera del módulo prohibido.

| Verbo y ruta | Rol hoy | Quién lo consume | Decisión | Hallazgo / destino |
|---|---|---|---|---|
| `POST /user/invitations/{id}/guests/append` | USER+ | E3 | **CREAR** (equivalente) | La ruta existe pero en `…/modules/user/invitations/presentation/InvitationsController.kt:123`, que **está prohibido**. Nueva ruta `POST /product/invitations/{id}/guests` en `modules/product/invitados`, llamando a `InvitationGuestsService.appendGuest` (`InvitationGuestsService.kt:52`) sin tocarlo. |
| `PUT /user/invitations/{id}/guests/{guestId}/update` | USER+ | E3 | **CREAR + ENDURECER el servicio** | Misma razón de módulo, **y** el servicio tiene un IDOR: `InvitationGuestsService.kt:121-122` valida la invitación y busca el invitado, pero **nunca comprueba que `guest.invitation.id == invitationId`**. Arreglo mínimo (una línea, en el servicio compartido): tras `findGuestById`, `if (guest.invitation.id != invitationId) throw GuestNotFoundException(...)`. Ver S-04. |
| `DELETE /user/invitations/{id}/guests/{guestId}` | USER+ | E3 | **CREAR + ENDURECER el servicio** | `InvitationGuestsService.kt:153-161`: para `USER` comprueba `guest.invitation.customer.id != userId` (`:156`), pero **para `ADMIN` no comprueba nada**, ni jerarquía ni pertenencia. Ver S-05. |
| `GET /user/invitations/{id}/guests` (paginado + filtros) | USER+ | E3, E4 | **CREAR + ENDURECER** | `InvitationGuestsService.kt:163-203` sí valida la invitación (`:173`), pero la respuesta incluye `confirmationToken` y `cancellationToken` de cada invitado (`GuestResponseItem.kt:36-37`). Para el panel del cliente es discutible pero **no** debe salir del backend sin necesidad. Arreglo mínimo: un DTO del producto sin los dos tokens, y una ruta aparte que devuelva el enlace de un invitado concreto cuando se vaya a compartir. |
| `GET /user/invitations/{id}/guests/{guestId}` | USER+ | E3 | **CREAR + ENDURECER el servicio** | Mismo IDOR que la edición: `InvitationGuestsService.kt:253-267` no cruza `guest.invitation.id` con `invitationId`. |
| `POST /user/invitations/{id}/guests/upload` (CSV) | USER+ | E3 | **CREAR** (equivalente) | `GuestFileImportService.kt` es reutilizable tal cual; solo cambia el controlador. **Anotar**: la importación crea invitados **sin `cancellationToken`** (`GuestFileImportService.kt:242-255`, no lo asigna), a diferencia del alta unitaria (`InvitationGuestsService.kt:93`); el de cancelación se acuña al confirmar (`GuestAttendanceService.kt:117`). Es coherente pero conviene que el diseño de la fase 5 lo diga. |
| `GET /user/invitations/{id}/guests/all` (resumen de cupos) | USER+ | E4 | **CREAR** (equivalente) | `InvitationGuestsService.getAllGuests` (`:207-250`) ya calcula los 16 contadores que necesita el panel en vivo (totales, adultos, niños, jóvenes × invitados/pendientes/confirmados/cancelados). Reutilizable sin cambios. |
| `GET /user/invitations/{id}/guests/download/confirmed-xlsx` y `/messages-pdf` | USER+ | E4 | **CREAR** (equivalente) | `GuestExportService` reutilizable; solo el controlador. |
| `GET /user/invitations/{id}/guests/notify` | USER+ | E4 | **CREAR + ENDURECER** | `InvitationGuestsService.notifyGuests` (`:304-341`) exige `invitation.isFinished` (`:311`), que es la bandera **del editor antiguo**. Para una invitación de templates2 la condición correcta es «tiene release activo». Arreglo mínimo: parámetro o estrategia que sustituya `isFinished` por la comprobación de `tpl_release.is_active`. **Además** el enlace del correo apunta al render antiguo: ver S-08 y §A6. |
| `PUT /user/invitations/{id}/guests/{guestId}/cancel-attendance` | USER+ | E4 | **CREAR + ENDURECER el servicio** | `InvitationGuestsService.kt:280-302`: mismo cruce ausente entre `guestId` e `invitationId`. |
| `POST /api/whatsapp/send-masivo` | USER+ | E4 | **ENDURECER** | `WhatsAppController.kt:11-19` envía a **cualquier lista de teléfonos** del cuerpo, sin invitación ni pertenencia. Cualquier cuenta con rol `USER` puede usar el número de WhatsApp Business de la empresa como pasarela de envío masivo. Ver S-06. |

### A2.3 RSVP público

| Verbo y ruta | Rol hoy | Quién lo consume | Decisión | Hallazgo / destino |
|---|---|---|---|---|
| `GET /public/invitation/guest-info/{token}` | público | E4 | **CREAR sustituto** | `PublicGuestInfoController.kt:58-106` es reutilizable en su lógica de tokens, pero **está atado al módulo prohibido**: llama a `InvitationService.findInvitation` (`:77`), que vive en `…/modules/user/invitations/service/InvitationService.kt`, y vuelca su respuesta entera en `invitationDetail` (`:102`). Ruta nueva en `modules/product/rsvp` que devuelva **solo** los datos del invitado y las reglas del evento, sin detalle de invitación (el render ya lo sirve por `/public/i/{publicToken}/render`). |
| `PUT /public/invitation/{confirmationToken}/attend` | público | E4 | **CREAR sustituto + ENDURECER el servicio** | `InviteAttendingController.kt:20-42` tiene la misma atadura (`:33-36`). El servicio `GuestAttendanceService.confirmAttendance` (`:24-61`) sí es reutilizable, pero **permite cambiar el correo del invitado** (`:35-49`) con solo tener el token: quien intercepte un enlace redirige a su buzón todos los avisos posteriores. Ver S-07. |
| `PUT /public/invitation/cancel/{cancellationToken}` | público | E4 | **CREAR sustituto** | `InviteAttendingController.kt:44-50` no depende del módulo prohibido; `GuestAttendanceService.cancelAttendance` (`:63-88`) es reutilizable. Solo cambia de sitio para no dejar mitad del RSVP en `modules/all`. |
| `GET /product/i/{publicToken}/guests/{confirmationToken}` (puente token público → invitado) | — | E4 | **CREAR** | **Esta es la pieza que hoy no existe.** Ver §A4.4. |

### A2.4 Planes, pago y publicación

| Verbo y ruta | Rol hoy | Quién lo consume | Decisión | Hallazgo / destino |
|---|---|---|---|---|
| `GET /public/invitations/plan` | público | E5 | **REUTILIZAR TAL CUAL como catálogo antiguo, NO como catálogo de venta** | `PublicInvitationInfoController.kt:53-62` devuelve solo `id` y `name`, **porque la entidad no tiene precio** (`InvitationPlanEntity.kt:14-41`). Ver §A5. |
| `GET/POST/PUT/DELETE/PATCH /master/plans[...]` | MASTER | E5 | **REUTILIZAR TAL CUAL** para la administración del catálogo antiguo | `MasterPlansController.kt:23-80`. Sigue haciendo falta mientras existan las plantillas antiguas, pero **no sirve como catálogo de Stripe** (§A5). |
| Catálogo de venta (`GET /product/plans`, `POST /product/checkout`, `POST /product/stripe/webhook`) | — | E5 | **CREAR** | No hay ni tabla ni ruta de precios de plan (§A5). Va en `modules/product/pagos`, con tabla nueva `product_plan` y `product_payment`. El webhook necesita quedar fuera de `/public/**` o con verificación de firma propia. |
| `PUT /admin/invitations/{id}/mark-as-paid` | ADMIN, MASTER | E5 | **ENDURECER** | `InvitationAdminService.kt:107-118`: **no llama a `hierarchyValidationService` ni a nada**. Cualquier `ADMIN` marca como pagada **cualquier** invitación del sistema, incluidas las de usuarios que no creó. Ver S-03. |
| `GET /admin/invitations/unpaid` | ADMIN, MASTER | E5 | **REUTILIZAR TAL CUAL** | `InvitationController.kt:30-40` pasa `requesterId` al servicio, que filtra por jerarquía. |
| Escritura de `invitation.is_paid` / `total_amount` | — | E5 | **ENDURECER + CREAR** | Hoy los escriben tres sitios: `InvitationService.kt:76-77` (alta de cliente: `isPaid=false`, importe calculado), `InvitationAdminService.kt:171-173` (alta de admin: **`isPaid=true` de oficio**) y `InvitationAdminService.kt:115`/`:425` (marcar pagada / recalcular). El primero está en módulo prohibido. Para Stripe hay que crear el escritor en `modules/product/pagos` y que `total_amount` deje de depender de `template.price` (§A5). |
| `POST /editor/invitations/{invitationId}/release` | USER+ | E5 | **ENDURECER** | `EditorReleaseController.kt:41` y todo `templates2` **no consultan el pago**: `grep "isPaid\|is_paid"` sobre `modules/templates2` no devuelve nada. Publicar es gratis. Arreglo mínimo **sin tocar templates2**: una comprobación en la capa del producto antes de proxiar la publicación, o —mejor y con ADR— un `preflight` que consulte una interfaz nueva que el producto implemente. **[?]** Cuál de las dos prefiere el dueño del módulo templates2 no lo puedo decidir yo. |
| `POST /product/invitations` (alta de invitación) | — | E2, E5 | **CREAR** | La única alta hoy es `POST /user/invitations/create` (`InvitationsController.kt:34`), **prohibida**. Sin esta ruta **no hay flujo de venta**: templates2 nunca crea una invitación (§A1.11). Va en `modules/product/invitaciones`; debe insertar en `invitation` (customer, template, fecha, hora, `children_allowed`, `young_allowed`) y poner `uses_templates2 = true` vía `Templates2FlagRepository` (`…/modules/templates2/persistence/Templates2FlagRepository.kt:51`). **[?]** `invitation.template_id` es `NOT NULL` (`V1__initial_schema.sql:282`) y apunta a `invitation_template`, tabla del módulo antiguo: hay que decidir con ADR si se apunta a una fila «puente» o si se hace la columna anulable. Es la decisión con más peso de toda la fase 5. |

### A2.5 Administración

| Verbo y ruta | Rol hoy | Quién lo consume | Decisión | Hallazgo / destino |
|---|---|---|---|---|
| `GET /admin/dashboard` | ADMIN, MASTER, USER | E5 (y E4) | **REUTILIZAR TAL CUAL** | `DashboardController.kt:18-28` bifurca por rol. Los contadores de pago vienen de `DashboardRepository.kt:17-20` y `:53-56`. |
| `GET /master/users` | MASTER | E5 | **REUTILIZAR TAL CUAL** | `MasterController.kt:52`. |
| `GET /admin/users/my-users`, `POST /admin/users/create`, ban/unban/delete/re-activate/update | ADMIN, MASTER | E5 | **REUTILIZAR TAL CUAL** | `AdminUsersController.kt:26-129`; todos pasan por `HierarchyValidationService.validateUserAccess`. |
| `PUT /admin/users/{id}/password/update` | ADMIN, MASTER | E5 | **ENDURECER** | `AdminUsersService.kt:218-232` **no pide la contraseña actual** y `validateUserAccess` devuelve `true` cuando `requesterId == targetUserId` (`HierarchyValidationService.kt:24-26`): un ADMIN cambia su propia contraseña sin probar que la sabe, así que una sesión robada se convierte en toma de cuenta permanente. Arreglo mínimo: exigir la contraseña actual cuando `id == solicitante`. |
| `GET /master/invitations/all`, `DELETE /master/invitations/{id}/force` | MASTER | E5 | **REUTILIZAR TAL CUAL** | `MasterController.kt:98`, `:146`. |
| `GET /admin/invitations/all`, `/{id}`, `PUT /{id}`, `PUT /{id}/toggle-status` | ADMIN, MASTER | E5 | **REUTILIZAR TAL CUAL** | `InvitationController.kt:68-134`; todos pasan `requesterId`/`appRole` al servicio. |
| `GET /master/guests`, `DELETE /master/guests/{guestId}/force` | MASTER | E5 | **REUTILIZAR TAL CUAL** | `…/modules/master/guests/presentation/MasterGuestsController.kt:24`, `:48`. Rol MASTER es suficiente barrera. |
| `GET /admin/invitations/{id}/guests[...]` (9 rutas) | ADMIN, MASTER | E5 | **ENDURECER** (las mismas del servicio, §A2.2) | `AdminGuestsController.kt:40-207`. Heredan los IDOR S-04 y S-05 del servicio compartido; arreglando el servicio se arreglan las dos superficies a la vez. |
| `GET/POST/PUT/DELETE /admin/dashboard/notifications/receivers` | ADMIN, MASTER | E5 | **REUTILIZAR TAL CUAL** | `NotificationsController.kt:16-36`. |
| `POST /master/templates2/versions`, `GET`, `:deprecate` | MASTER | E5 | **REUTILIZAR TAL CUAL** | `MasterTemplateRegistryController.kt:54`, `:70`, `:91`. Es la administración de plantillas **nueva**; la antigua (`/master/templates`) está prohibida. |

### A2.6 Recuento

**[V]** Rutas inventariadas en total: **119** (`grep` de anotaciones de mapeo sobre
`src/main/kotlin`, descontando los `@RequestMapping` de clase y los comentarios).
De las que la fase 5 necesita, en esta tabla hay **43 filas**:

| Decisión | Filas |
|---|---|
| REUTILIZAR TAL CUAL | 17 |
| ENDURECER | 14 |
| CREAR (incluye «CREAR sustituto» y «CREAR + ENDURECER el servicio») | 12 |

Nueve de las 43 son a la vez CREAR de superficie y ENDURECER del servicio compartido; están contadas
en CREAR y su hallazgo queda en la columna de la derecha.

---

## A3. Hallazgos de seguridad del código expuesto

Fases 3-B/3-C cerraron **N-01** (token de recuperación devuelto sin autenticar; verificado cerrado en
`RecoveryPasswordSentResponse.kt:15-17` y `ResetPasswordService.kt:56-94`) y **N-02**. Lo que sigue
es lo que **queda** y afecta a lo que la fase 5 va a exponer.

### S-01 — Secretos en claro en el repositorio · severidad ALTA · confirmado

**[V]** `src/main/resources/application.yml`:

| Línea | Secreto | Qué se puede hacer con él |
|---|---|---|
| `:9` | Clave de firma del JWT (`invitaciones.jwt.secret`) | Firmar un token válido para **cualquier** `userId` y **cualquier** rol, incluido `MASTER`. `JwtUtil.kt:18` la usa tal cual como clave HMAC y `JwtUtil.kt:20-33` mete `role` como *claim*. Es acceso total al sistema sin credenciales, sin pasar por el límite de intentos y sin dejar rastro de acceso. |
| `:15-16` | `aws.credentials.access-key` y `secret-key` | Acceso programático a la cuenta de AWS con los permisos que tenga esa clave: como mínimo lectura y escritura del bucket de assets e imágenes (`…/core/s3/`). |
| `:65-66` | Usuario y contraseña de la cuenta de correo `invitacionesdigitalesagape@gmail.com` | Enviar correo **como la empresa** (suplantación perfecta ante los clientes y sus invitados) y leer el buzón, que es donde caen los correos de recuperación de contraseña de las cuentas internas. |
| `:88` | `whatsapp.access-token` de Meta Graph | Enviar mensajes de WhatsApp desde el número de la empresa. |
| `:22` | `SPRING_DATASOURCE_PASSWORD:evolution123` como valor por defecto | Contraseña de base de datos si la variable de entorno no está puesta. |

**[V]** Y **fuera** del `yml`, que es lo que no estaba anotado:

| Fichero:línea | Secreto |
|---|---|
| `…/core/email/MailConfig.kt:29-30` | El mismo usuario y contraseña de Gmail, **escritos en el código Kotlin**, en un `@Bean @Primary` (`:23-24`). Mover el `yml` a variables de entorno **no arregla esto**. |
| `…/modules/shared/whatsapp/WhatsAppWebhookController.kt:13` | `VERIFY_TOKEN = "whatsapp_webhook_agape_26"` del webhook de Meta, en el código. |

**Arreglo mínimo — y hay que decirlo con todas las letras**: mover los valores a variables de entorno
**no es el arreglo**. Están en el historial de git; siguen siendo válidos aunque el fichero cambie
mañana. El arreglo de verdad es **rotarlos**: clave JWT nueva (invalida todas las sesiones vivas, hay
que avisar), claves de AWS nuevas y las viejas desactivadas en IAM, contraseña de aplicación de Gmail
revocada y regenerada, token de WhatsApp regenerado en Meta, contraseña de base de datos cambiada.
**Es una decisión del dueño**, no del agente que escriba el código: rotar la clave JWT cierra la
sesión de todos los clientes en producción. Lo que sí puede hacer la fase 5 sin decisión previa es
dejar el código **listo para leerlos de variables de entorno** (incluido `MailConfig.kt`) para que la
rotación sea un despliegue y no un cambio de código.

### S-02 — `include-message: always` convierte cada excepción en un oráculo · severidad MEDIA

**[V]** `application.yml:6` activa `server.error.include-message: always`. **[V]** Los servicios
lanzan `IllegalArgumentException` con el dato dentro:
`InvitationGuestsService.kt:402` («La invitación con el id: X no existe»), `:406` («No tienes
permisos para acceder a esta invitación»), `CustomerService.kt:196`, `AdminUsersService.kt:249`.
La diferencia entre «no existe» y «no tienes permisos» permite **enumerar qué ids de invitación
existen** desde cualquier cuenta.
**Arreglo mínimo**: unificar los dos mensajes en el punto de decisión (`InvitationGuestsService.kt:401-407`
ya está a dos líneas de hacerlo) y poner `include-message: never` en el perfil de producción.

### S-03 — `mark-as-paid` sin comprobación de jerarquía · severidad ALTA (impacto de negocio)

**[V]** `…/modules/admin/invitations/service/InvitationAdminService.kt:107-118`. El método recibe
`id` y `updatedBy` y **no llama a `hierarchyValidationService` ni comprueba nada** más allá de que la
invitación exista y no esté ya pagada. La ruta es `PUT /admin/invitations/{id}/mark-as-paid`
(`InvitationController.kt:42`), abierta a **cualquier ADMIN** por `SecurityConfig.kt:42`.
**Qué se puede hacer**: cualquier cuenta con rol ADMIN marca como pagada cualquier invitación del
sistema —también las de clientes de otros administradores— iterando ids. Cuando la fase 5 conecte
Stripe, esta ruta es un puente para saltarse el cobro.
**Arreglo mínimo**: `if (!hierarchyValidationService.validateInvitationAccess(updatedBy, id)) throw
UnauthorizedAccessException(...)` como primera línea de `markAsPaid`. Es el mismo patrón que usan
`updateInvitation` y `toggleInvitationStatus` en el mismo servicio.

### S-04 — IDOR en invitados: `guestId` nunca se cruza con `invitationId` · severidad ALTA

**[V]** Cuatro métodos de `…/modules/shared/guests/service/InvitationGuestsService.kt` validan la
**invitación** y luego buscan el **invitado por id suelto**, sin comprobar que el invitado pertenezca
a esa invitación:

| Método | Líneas | Superficie HTTP |
|---|---|---|
| `updateGuest` | `:121-122` | `PUT /admin/invitations/{id}/guests/{guestId}/update` (`AdminGuestsController.kt:104`) |
| `getGuest` | `:259-260` | `GET /admin/invitations/{id}/guests/{guestId}` (`AdminGuestsController.kt:66`) |
| `cancelAttendanceFromDashboard` | `:286-287` | `PUT /admin/invitations/{id}/guests/{guestId}/cancel-attendance` (`AdminGuestsController.kt:163`) |
| (las mismas, vía el módulo prohibido) | | `InvitationsController.kt:106`, `:142`, `:216` |

**Qué se puede hacer**: un cliente que tenga **una** invitación propia (id `A`) pide
`GET /admin/invitations/A/guests/{guestId}` recorriendo `guestId` y lee **el invitado de cualquier
otra invitación del sistema**: nombre, correo, teléfono, mesa, mensaje de felicitación y —peor— su
`confirmationToken` y su `cancellationToken` (`GuestResponseItem.kt:36-37`). Con el token de
confirmación puede responder el RSVP en su nombre; con el de cancelación, cancelarlo.
*Matiz honesto* **[I]**: por `SecurityConfig.kt:42` la ruta de `/admin/**` exige ADMIN o MASTER, así
que hoy la explota un ADMIN, no un USER cualquiera. Pero las rutas gemelas de `/user/invitations/**`
(`InvitationsController.kt:106`, `:142`, `:216`) **sí** están abiertas a rol USER, y la fase 5 va a
crear las suyas equivalentes.
**Arreglo mínimo** (una línea, en el servicio compartido, arregla las dos superficies a la vez):
en `findGuestById` o inmediatamente después de cada llamada,
`if (guest.invitation.id != invitationId) throw GuestNotFoundException("El invitado con el id: $guestId no existe")`
— con el **mismo** mensaje que el «no existe» de `:418`, para no crear un oráculo nuevo.

### S-05 — `deleteGuest` no comprueba nada cuando el rol no es USER · severidad MEDIA

**[V]** `InvitationGuestsService.kt:153-161`: la única comprobación (`:156`) es
`if (appRole == AppRole.USER && guest.invitation.customer.id != userId)`. Para ADMIN no hay ni
jerarquía ni pertenencia, y acto seguido hace **borrado físico** (`hardDeleteById`, `:160`), no
lógico.
**Qué se puede hacer**: cualquier ADMIN borra de forma irreversible invitados de clientes que no son
suyos, recorriendo ids.
**Arreglo mínimo**: sustituir la condición por `validateInvitation(userId, appRole, guest.invitation.id)`,
que ya existe en el mismo fichero (`:396`) y aplica la jerarquía correcta para los tres roles.

### S-06 — `POST /api/whatsapp/send-masivo` es una pasarela abierta · severidad ALTA

**[V]** `…/modules/shared/whatsapp/WhatsAppController.kt:11-19` recibe `request.guests` y llama a
`whatsAppService.sendMasivo`. **No hay `invitationId`, ni comprobación de pertenencia, ni límite de
volumen.** El rol exigido es USER, ADMIN o MASTER (`SecurityConfig.kt:45`), y el envío sale con el
token de la empresa (`WhatsAppService.kt:18-19`, `:45-46`).
**Qué se puede hacer**: cualquier cuenta registrada (el alta es pública) usa el número de WhatsApp
Business de Lino & Sello para mandar la plantilla aprobada a **cualquier** lista de teléfonos. Coste
directo por mensaje, y riesgo de que Meta suspenda el número por denuncias de *spam*, lo que deja sin
canal a todos los clientes.
**Arreglo mínimo**: exigir `invitationId` en el cuerpo, pasar por `validateInvitation`, y enviar solo
a los teléfonos que estén en `invitation_guest` de esa invitación (ignorando los del cuerpo). Añadir
un límite por invitación y día, como el que ya tiene el correo (`EmailGuestNotifier.kt:79-84`).

### S-07 — El RSVP público permite cambiar el correo del invitado · severidad MEDIA

**[V]** `…/modules/shared/guests/service/GuestAttendanceService.kt:35-49`: si el cuerpo de
`PUT /public/invitation/{confirmationToken}/attend` trae un `email` distinto, se **guarda** en el
invitado (`:48`). No se pide confirmación ni se avisa al correo anterior.
**Qué se puede hacer**: quien intercepte o adivine el enlace de un invitado (un reenvío de WhatsApp,
una captura de pantalla) redirige a su buzón el correo de confirmación con el `cancellationToken`
(`EmailGuestNotifier.kt:241`, `:251-252`), y a partir de ahí controla ese RSVP.
**Arreglo mínimo**: no permitir el cambio de correo en el RSVP; si el producto lo quiere, guardarlo
en un campo aparte («correo de contacto declarado por el invitado») que no reemplace el destino de
las notificaciones.

### S-08 — El enlace del RSVP está escrito en el código y apunta al render antiguo · severidad ALTA (funcional, no de confidencialidad)

**[V]** `…/modules/shared/guests/notifier/EmailGuestNotifier.kt:68`:
`return "https://invitaciones-digitales-agape.cloud/invitaciones/${invitation.id}/$eventTypeSlug/$peopleNamesSlug?token=$token"`
— con la línea de debajo (`:69`) comentada, que era la que usaba `frontendUrl`.
**Consecuencia**: todo correo que hoy manda el backend a un invitado lleva al **producto antiguo**,
no a `/i/{publicToken}`. Además la URL se construye con `invitation.template.eventType.name` (`:63`)
y `invitation.people` (`:66`), datos del módulo antiguo que una invitación de templates2 puede no
tener.
**Arreglo mínimo**: recuperar `frontendUrl` (ya está inyectado) y construir la URL contra el
`public_token` de `tpl_document` cuando `uses_templates2 = true`. Es un cambio en
`modules/shared/guests`, que **no** está prohibido.

### S-09 — Webhook de WhatsApp sin verificación de firma · severidad BAJA

**[V]** `WhatsAppWebhookController.kt:39-62` acepta cualquier `POST /webhook` (`permitAll`,
`SecurityConfig.kt:46`) y no comprueba `X-Hub-Signature-256`. Un tercero puede provocar envíos de
mensajes a números que él elija (`:52-54`).
**Arreglo mínimo**: verificar la firma HMAC con el *app secret* de Meta antes de procesar.

### S-10 — URL firmada de S3 de cualquier invitación, sin autenticar · severidad MEDIA

**[V]** `…/modules/all/templates/presentation/PublicInvitationTemplateController.kt:33-40`:
`GET /public/invitations/templates/preview/{invitationId}/signed-url` es `permitAll` y recibe un
**id numérico**, así que se enumera. Devuelve una URL firmada al HTML de esa invitación.
*Matiz*: es superficie del módulo antiguo y se retira en la fase 7. Se anota para que la fase 5 **no
lo replique** en el producto nuevo. El equivalente nuevo (`/public/i/{publicToken}/render`) ya está
bien hecho: token opaco de 30 caracteres, y `exists` devuelve `{"published": false}` en vez de `404`
precisamente para no ser oráculo (`PublicRenderController.kt:42-43`).

### S-11 — CORS `*` en todas las rutas · severidad BAJA

**[V]** `AppCorsConfiguration.kt:17-19`. Sin `allowCredentials`, así que no hay robo de sesión por
cookie (el JWT va por cabecera). Se anota porque cuando la fase 5 monte el pago conviene una lista de
orígenes explícita.

### S-12 — Entropía de los tokens de invitado: **correcta** · sin hallazgo

Verificado a propósito porque el encargo lo pedía:

| Token | Dónde se acuña | Cómo | Entropía |
|---|---|---|---|
| `confirmation_token` (alta unitaria) | `InvitationGuestsService.kt:65` → `JwtUtil.generateInvitationSecureToken()` (`JwtUtil.kt:66-71`) | `SecureRandom`, **16 bytes**, Base64 URL sin relleno (22 caracteres) | **128 bits** |
| `confirmation_token` (importación CSV) | `GuestFileImportService.kt:240` → el mismo método | ídem, **uno por fila**, dentro de `parseGuestFromLine` (`:197`) | 128 bits |
| `cancellation_token` | `InvitationGuestsService.kt:70`, `:93` y `GuestAttendanceService.kt:117` → `JwtUtil.generateSecureToken()` (`JwtUtil.kt:59-64`) | `SecureRandom`, **128 bytes** (171 caracteres) | 1024 bits |
| `reset_token` | `ResetPasswordService.kt:68` → `generateSecureToken()` | ídem | 1024 bits |
| `refresh_token` | `RefreshTokenService.kt:27` → `generateSecureToken()` | ídem | 1024 bits |
| `public_token` (templates2) | ULID, formato validado por `ck_tpl_document_public_token` (`V32__create_tpl_document.sql:18`) | 26 caracteres Crockford | ~128 bits |

**No** son `UUID.randomUUID()`, **no** son `Random`, **no** son un contador y **no** son el id.
`UUID.randomUUID()` aparece 30 veces en el código pero **solo** en `DefaultConfigGeneratorService.kt`
(ids de bloques de plantilla, módulo prohibido), en `AvatarService.kt:50`/`:67` y `S3KeyService.kt:65`
(nombres de fichero) y en `AuthThrottleService.kt:143` (relleno del hash señuelo). Ninguno es un
token de seguridad.

**Dos matices, ninguno bloqueante [V]**:
1. **No hay índice único** sobre `invitation_guest.confirmation_token`
   (`V8__create_invitation_guest_table.sql:48` crea un índice **no único**) ni sobre
   `cancellation_token` (`V16__add_guest_enhancements.sql:48-49`, tampoco único). Con 128 bits la
   colisión es despreciable, pero un `UNIQUE` la haría imposible y cuesta una línea de DDL.
2. **No hay límite de intentos** en `GET /public/invitation/guest-info/{token}` ni en los dos `PUT`
   del RSVP. Con 128 bits la fuerza bruta no es viable **[I]**, pero un límite por IP evitaría el
   coste de una avalancha de consultas a base de datos.

### S-13 — Los tokens de invitado salen en respuestas del panel · severidad BAJA

**[V]** `GuestResponseItem.kt:36-37` y `:58-59` incluyen `confirmationToken` y `cancellationToken` en
**todos** los listados de invitados (`InvitationGuestsService.kt:196`, `:381`) y en la respuesta del
propio RSVP (`InviteAttendingController.kt:39`). Para el dueño de la invitación es datos suyos, así
que no es una fuga por sí misma; pero combinado con **S-04** es lo que convierte el IDOR en toma de
control del RSVP ajeno. La fase 5 debe usar un DTO propio sin los dos campos salvo en la ruta que
explícitamente sirva para compartir el enlace.

### Lo que verifiqué y **no** es un hallazgo

- **[V]** `POST /auth/request-password-reset` no devuelve el token y responde igual exista o no la
  cuenta (`ResetPasswordService.kt:52-53`, `:93`; `RecoveryPasswordSentResponse.kt:15-17`). N-01
  cerrado, confirmado.
- **[V]** `POST /auth/token` no distingue «no existe» de «contraseña mala» de «deshabilitado»: un
  único literal (`CustomerService.kt:46`) en los tres caminos (`:67`, `:71`, `:75`) y bcrypt señuelo
  para el caso «no existe» (`:65`). I-02 cerrado, confirmado.
- **[V]** Los tres extremos de `/auth` limitados llevan ámbitos separados
  (`AuthThrottleService.kt:53-60`), así que agotar la recuperación no cierra el acceso.
- **[V]** `@PreAuthorize` faltantes: **no encontré ninguno que falte** en el sentido estricto, porque
  el modelo del backend heredado es por prefijo (`SecurityConfig.kt:36-47`) y todas las rutas caen
  bajo una regla. El riesgo real no es de rol sino de **propiedad dentro del rol** (S-03, S-04,
  S-05). La excepción a vigilar es que **cualquier ruta nueva fuera de los prefijos conocidos**
  queda en `authenticated()`, es decir, abierta a rol USER.
- **[V]** `templates2` sí valida propiedad, y con más cuidado que el módulo heredado:
  `InvitationAvailabilityReader` (`Templates2EditorQueryRepositories.kt:149-172`) comprueba
  `invitation.is_enabled` + `customer.is_enabled` + `customer.is_banned` con una consulta nativa,
  precisamente porque `validateInvitationAccess` usa `findByIdEvenIfDisabled`
  (`HierarchyValidationService.kt:44`).

---

## A4. Modelo de datos de invitados y RSVP

### A4.1 DDL real de `invitation_guest`

Reconstruido a partir de las tres migraciones que la tocan. **[V]**

```sql
-- V8__create_invitation_guest_table.sql:5-42 (creación)
CREATE TABLE invitation_guest (
    id                       BIGSERIAL PRIMARY KEY,
    invitation_id            BIGINT       NOT NULL,   -- FK -> invitation(id)   V8:27-29
    full_name                VARCHAR(255),            -- NOT NULL en V8:8, relajado en V16:11
    phone                    VARCHAR(255),            -- V8:9
    email                    VARCHAR(255),            -- NOT NULL en V8:10, relajado en V16:12
    adults_count             INT,                     -- NOT NULL DEFAULT 0 en V8:11, relajado en V16:13
    children_count           INT  NOT NULL DEFAULT 0, -- V8:12
    young_count              INT  NOT NULL DEFAULT 0, -- V8:13
    adults_count_confirmed   INT  NOT NULL DEFAULT 0, -- V8:14
    children_count_confirmed INT  NOT NULL DEFAULT 0, -- V8:15
    young_count_confirmed    INT  NOT NULL DEFAULT 0, -- V8:16
    confirmation_token       VARCHAR(255),            -- V8:18
    is_enabled               BOOLEAN NOT NULL DEFAULT true, -- V8:19 (baja lógica)
    notification_date_sent   VARCHAR(255),            -- V8:20
    created_by               BIGINT,                  -- FK -> customer(id)  V8:31-33
    updated_by               BIGINT,                  -- FK -> customer(id)  V8:35-37
    deleted_by               BIGINT,                  -- FK -> customer(id)  V8:39-41
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- V8:24
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- V8:25
);

-- V16__add_guest_enhancements.sql
ALTER TABLE invitation_guest ADD COLUMN table_number            INT;    -- V16:6
ALTER TABLE invitation_guest ADD COLUMN congratulations_message TEXT;   -- V16:7
ALTER TABLE invitation_guest ADD COLUMN cancellation_token      VARCHAR(255); -- V16:8
ALTER TABLE invitation_guest ADD COLUMN attendance_status       VARCHAR(20) NOT NULL; -- V16:16, :37
ALTER TABLE invitation_guest ADD CONSTRAINT chk_attendance_status
    CHECK (attendance_status IN ('PENDING','CONFIRMED','DECLINED'));    -- V16:40-42
ALTER TABLE invitation_guest DROP COLUMN is_attending;                  -- V16:45

-- V40__add_invitation_guest_graduates_name.sql:8
ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255);
```

**[V]** Falta en el DDL y **sí** está en la entidad: `whatsapp_sent`
(`InvitationGuestEntity.kt:75-76`), creada por `V28__add_whatsapp_sent_column.sql`.

**[V]** Índices: `invitation_id`, `email`, `phone`, `confirmation_token`, `deleted_by`
(`V8:45-49`, todos **no únicos**); `cancellation_token` y `attendance_status` (`V16:48-52`, tampoco
únicos).

**[V]** Borrado: `@SQLDelete` marca `is_enabled = false` (`InvitationGuestEntity.kt:23`) y hay un
filtro de Hibernate `enabledFilter` (`:24`), pero `deleteGuest` usa `hardDeleteById`
(`InvitationGuestsService.kt:160`), es decir, **borrado físico**. La baja lógica se usa en otros
caminos (el alta reactiva un invitado deshabilitado, `InvitationGuestsService.kt:67-89`).

### A4.2 Cupos por tipo — nombres reales confirmados

**[V]** Son **tres** tipos, y los nombres reales son:

| Concepto | Columna de cupo | Columna de confirmados | Campo Kotlin |
|---|---|---|---|
| Adultos | `adults_count` (**nullable**) | `adults_count_confirmed` | `adultsCount: Int?` / `adultsCountConfirmed: Int` (`InvitationGuestEntity.kt:44-45`, `:53-54`) |
| Niños | `children_count` (NOT NULL) | `children_count_confirmed` | `childrenCount` / `childrenCountConfirmed` (`:47-48`, `:56-57`) |
| Jóvenes | `young_count` (NOT NULL) | `young_count_confirmed` | `youngCount` / `youngCountConfirmed` (`:50-51`, `:59-60`) |

**No** se llaman «adultos/niños/adolescentes»: el tercero es **`young` / jóvenes**.

**[V]** Reglas del evento que los limitan: `invitation.children_allowed` y `invitation.young_allowed`
(`InvitationEntity.kt:33-37`). Se comprueban al dar de alta un invitado
(`InvitationGuestsService.kt:437-443`) y al confirmar (`GuestAttendanceService.kt:177-183`).

**[V]** Al confirmar, un invitado nunca puede confirmar más de lo que se le asignó
(`GuestAttendanceService.kt:158-175`) y tiene que confirmar al menos una persona (`:105-108`).
**[V]** No existe un cupo global por invitación: no hay ninguna columna de aforo en `invitation`
(`V1__initial_schema.sql:265-283`), así que el límite es siempre por invitado.

### A4.3 Estados, tokens y contadores

**[V]** Estados: `PENDING` → `CONFIRMED` (`GuestAttendanceService.kt:121`) o `DECLINED` (`:141`).
Desde `CONFIRMED` se vuelve a `DECLINED` por el `cancellationToken` (`:79`) o desde el panel
(`InvitationGuestsService.kt:295`). **No hay vuelta a `PENDING`.**
**[V]** `cancelAttendance` pone `cancellation_token = null` (`GuestAttendanceService.kt:83`), así que
el enlace de cancelación es de un solo uso. **[V]** `confirmation_token` **no** se borra al
confirmar: el mismo enlace sigue sirviendo para volver a la ficha (`PublicGuestInfoController.kt:60`)
y para volver a confirmar (`GuestAttendanceService.kt:28`, no comprueba el estado antes de
`confirmPositiveAttendance`).
**[V]** Los contadores agregados no se guardan: se calculan al vuelo en
`InvitationGuestsService.getAllGuests` (`:207-250`), sumando sobre `findAllByInvitationId` (`:215`).
Devuelve 16 cifras: totales y, por cada uno de los tres tipos, invitados / pendientes / confirmados /
cancelados. **Es exactamente lo que el panel «confirmaciones en vivo» de la fase 5 necesita, y es
reutilizable tal cual.**
*Matiz* **[V]**: `totalConfirmados` (`:228`) suma sobre **todos** los invitados, no solo los
`CONFIRMED`. Es correcto porque los `_confirmed` se ponen a 0 al declinar (`:80-82`, `:143-145`),
pero conviene saberlo antes de tocar nada.

### A4.4 La pregunta crítica: ¿llegan los invitados desde la invitación nueva?

**Respuesta corta: sí, la clave existe y la fila se puede alcanzar; lo que NO existe es el camino de
código que lo haga. Hay que construir el puente, y es pequeño.**

**[V]** Las dos tablas cuelgan de **la misma** tabla `invitation`:

- `invitation_guest.invitation_id BIGINT NOT NULL REFERENCES invitation(id)`
  (`V8__create_invitation_guest_table.sql:7`, `:27-29`), mapeado en
  `InvitationGuestEntity.kt:29-31`.
- `tpl_document.invitation_id BIGINT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE`, con
  `UNIQUE (invitation_id)` y `UNIQUE (public_token)`
  (`V32__create_tpl_document.sql:7`, `:16-17`).
- `tpl_release.invitation_id BIGINT NOT NULL REFERENCES invitation(id)`, con a lo sumo un release
  activo por invitación (`V34__create_tpl_release.sql:7`, `:23-24`).
- `invitation.uses_templates2 BOOLEAN NOT NULL DEFAULT false`
  (`V36__add_uses_templates2_to_invitation.sql:7`).

Es decir: **no hay tabla de invitados nueva, no hay tabla de invitación nueva y no hay duplicidad**.
`templates2` añadió sus tablas colgando de la invitación de siempre, y `V36` dejó dicho por escrito
que es «la única columna que templates2 añade a una tabla existente» (`V36:2-3`).

**Por tanto, la traducción es una unión de una línea** — verificado que la ruta existe en el esquema
**[V]**, no ejecutado contra una base real **[I]**:

```sql
SELECT g.*
FROM tpl_document d
JOIN invitation_guest g ON g.invitation_id = d.invitation_id
WHERE d.public_token = :publicToken
  AND g.is_enabled;
```

**Lo que sí falta, dicho con todas las letras [V]**:

1. **No hay ningún código que haga esa unión.** `grep` sobre `modules/templates2` no devuelve
   ninguna referencia a `invitation_guest` ni a `InvitationGuestEntity`, y `grep` sobre
   `modules/shared/guests` no devuelve ninguna referencia a `tpl_document` ni a `public_token`. Los
   dos mundos se tocan solo a través de la tabla `invitation` y **nadie ha escrito el paso**.
2. **La página pública nueva no puede resolver un invitado.** El render (`/public/i/{publicToken}/render`,
   `PublicRenderController.kt:46`) devuelve el documento compuesto y nada más; el RSVP vive en
   `/public/invitation/guest-info/{token}` (`PublicGuestInfoController.kt:58`), que solo acepta el
   **token del invitado**, no el `publicToken`. Funcionan si el invitado llega con **los dos**: el
   `publicToken` en la URL de la página y su `confirmationToken` como parámetro. **[I]** Ese es
   probablemente el diseño que quiere la fase 5, y es viable sin puente… **salvo** por el punto 3.
3. **El enlace que hoy se envía por correo no lleva a la página nueva**: está escrito en el código y
   apunta al producto antiguo (`EmailGuestNotifier.kt:68`, hallazgo S-08).
4. **`GET /public/invitation/guest-info/{token}` está atado al módulo prohibido**: llama a
   `InvitationService.findInvitation` de `modules/user/invitations` (`PublicGuestInfoController.kt:10`,
   `:77`), así que **no se puede usar tal cual** como base de la fase 5.

**Puente mínimo propuesto** (todo dentro de `modules/product/rsvp`, sin tocar `templates2` ni
`modules/user/invitations`):

- **Un repositorio de traducción**, `PublicTokenInvitationReader`, con la consulta nativa
  `SELECT invitation_id FROM tpl_document WHERE public_token = :publicToken`. Es el mismo patrón
  —consulta nativa de solo lectura, sin montar el grafo de entidades— que ya usan
  `Templates2FlagRepository` (`Templates2FlagRepository.kt:44-45`) y `InvitationAvailabilityReader`
  (`Templates2EditorQueryRepositories.kt:154-158`), así que no inventa nada.
- **Una ruta nueva** `GET /public/i/{publicToken}/rsvp/{confirmationToken}` que: (a) traduzca el
  `publicToken` a `invitationId`; (b) cargue el invitado por `confirmationToken`; (c) **compruebe
  que `guest.invitation.id` coincide** con el traducido —esto cierra de paso la puerta a usar un
  token de invitado de otra invitación—; (d) devuelva solo los datos del invitado y las reglas del
  evento, **sin** volcar la invitación entera y **sin** `cancellationToken` hasta que confirme.
- **Un `PUT` gemelo** para confirmar, que reutilice `GuestAttendanceService.confirmAttendance`
  (`GuestAttendanceService.kt:24`) con S-07 ya corregido.
- **Arreglar `EmailGuestNotifier.kt:68`** para que, cuando `uses_templates2 = true`, el enlace se
  construya con `frontendUrl` + `/i/{publicToken}?g={confirmationToken}`.

**[?] Lo que no pude determinar**: si el frontend nuevo (`frontend/apps/web`, ruta
`/i/[publicToken]`) ya espera un parámetro de invitado y con qué nombre. No leí el frontend en este
encargo; el agente de la sesión E4 tiene que fijarlo antes de escribir la ruta.

---

## A5. Planes y pago

### A5.1 Qué hay hoy

**[V]** Entidad `InvitationPlanEntity` (`…/modules/master/plans/repository/model/InvitationPlanEntity.kt:14-41`),
tabla `invitation_plan` (`V1__initial_schema.sql:631-638`):

```sql
CREATE TABLE public.invitation_plan (
    id         bigint NOT NULL,
    created_at timestamp(6) with time zone,
    is_enabled boolean,
    is_premium boolean,
    name       character varying(255),
    updated_at timestamp(6) with time zone
);
```

**[V]** Datos reales sembrados: exactamente **dos filas** — `1 = Básico` (`is_premium = false`) y
`2 = Premium` (`is_premium = true`) (`V1__initial_schema.sql:1091-1094`).

**[V] El plan NO tiene precio.** Ni columna ni campo Kotlin. El precio vive en
`invitation_template.price` (`V1__initial_schema.sql:1133`, columna `price` de
`invitation_template`), y el plan se alcanza **a través de la plantilla**:
`invitation.template_id → invitation_template.invitation_plan_id → invitation_plan.id`
(`V1__initial_schema.sql:282`, `:703`). La consulta del panel lo confirma:
`DashboardRepository.kt:32` navega `i.template.invitationPlan.id` y `.name`.

**[V]** Rutas: las 6 de `MasterPlansController` (§A1.7), todas MASTER, más el catálogo público
`GET /public/invitations/plan` (`PublicInvitationInfoController.kt:53-62`), que devuelve **solo
`id` y `name`** porque no hay nada más que devolver.

### A5.2 Quién escribe `invitation.is_paid` y `invitation.total_amount` hoy

**[V]** Columnas: `is_paid boolean` y `total_amount double precision`
(`V1__initial_schema.sql:276`, `:278`), mapeadas en `InvitationEntity.kt:47-51`. Índice
`idx_invitation_is_paid` (`V23__add_dashboard_indexes.sql:5`).

**Tres escritores, y solo tres [V]**:

| Quién | Fichero:línea | Qué escribe |
|---|---|---|
| Alta hecha por el cliente | `…/modules/user/invitations/service/InvitationService.kt:76-77` | `isPaid = false`, `totalAmount = calculateTotalPrice(...)`. **Módulo prohibido.** |
| Alta hecha por un ADMIN/MASTER | `…/modules/admin/invitations/service/InvitationAdminService.kt:171-173` | `isPaid = **true** de oficio`, `totalAmount` calculado. Es decir: lo que crea un administrador nace pagado. |
| Marcar pagada / recalcular | `InvitationAdminService.kt:115` y `:425` | `isPaid = true`; `totalAmount = calculateTotalPrice(...)` al actualizar. |

**[V]** El cálculo: `InvitationPriceCalculatorService.calculateTotalPrice`
(`…/modules/shared/invitations/service/InvitationPriceCalculatorService.kt:20-27`) =
`template.price` (`:24`) + suma de `extra_module_config.price` de los módulos elegidos (`:56-63`).
**El plan no interviene en el precio en ningún punto.**

**[V]** No hay tabla de pagos, ni de transacciones, ni de facturas: `grep "CREATE TABLE"` sobre
`db/migration` no devuelve nada parecido. `is_paid` es un booleano y ahí acaba el modelo de pago.
No hay importe cobrado, ni moneda, ni fecha de cobro, ni referencia externa.

### A5.3 ¿Sirven los planes existentes para Stripe?

**No. Hay que crear un catálogo nuevo.** Motivos, todos verificados:

1. **No tienen precio** (`InvitationPlanEntity.kt:14-41`; tabla en `V1:631-638`). Un catálogo de
   venta sin importe no es un catálogo de venta.
2. **No tienen moneda, ni periodicidad, ni identificador externo.** Stripe necesita al menos un
   `price_id` por plan para no tener el importe duplicado en dos sistemas que se desincronizan.
3. **El precio real está en la plantilla antigua** (`invitation_template.price`,
   `InvitationPriceCalculatorService.kt:24`), y `modules/master/templates` **está prohibido** y se
   retira en la fase 7. Colgar el cobro de esa columna es construir sobre lo que se va a demoler.
4. **`invitation_plan` describe otra cosa.** Con `is_premium` y dos filas, hoy sirve para **filtrar
   catálogos** (frases, canciones, códigos de vestimenta, imágenes de regalo: seis claves foráneas
   distintas hacia `invitation_plan` en `V1:1679-1847`), no para vender. Cambiarle el significado
   rompería esos seis catálogos.
5. **No hay dónde registrar un cobro.** `is_paid` no guarda importe cobrado, ni moneda, ni fecha, ni
   `payment_intent`, así que no se puede conciliar, ni reembolsar, ni auditar.

**Propuesto**: dos tablas nuevas en `modules/product/pagos`, migraciones `V42`/`V43` (V38 y V39 están
reservadas según `V40__add_invitation_guest_graduates_name.sql:6`, y V41 la reclama la verificación
de correo de §A2.1):

- `product_plan(id, codigo, nombre, descripcion, precio_centavos, moneda, stripe_price_id,
  activo, orden, created_at, updated_at)` — el catálogo que se vende.
- `product_payment(id, invitation_id FK, product_plan_id FK, stripe_payment_intent_id UNIQUE,
  estado, importe_centavos, moneda, pagado_en, created_at)` — el registro del cobro.

Y que el webhook de Stripe, al confirmar, escriba `product_payment` **y** ponga
`invitation.is_paid = true` con una consulta nativa acotada, igual que hace
`Templates2FlagRepository.kt:51` con `uses_templates2` — así el panel de administración heredado
(`DashboardRepository.kt:17-20`, `InvitationController.kt:30`) sigue funcionando sin tocarlo.
**[I]** `invitation.total_amount` queda como dato heredado; el importe de verdad pasa a
`product_payment.importe_centavos` (`double precision` no es tipo para dinero).

---

## A6. Correo transaccional

### A6.1 Qué expone `core/email`

**[V]** Interfaz de uso: `EmailService.sendEmail(to, templateName, variables)`
(`…/core/email/EmailService.kt:13`) y `sendCustomEmail(to, subject, htmlBody, textBody)` (`:30`).
Ambas son `suspend`; **[V]** todos los llamadores las lanzan en una corrutina propia y **no esperan**
(`CustomerService.kt:139`, `ResetPasswordService.kt:76`, `EmailGuestNotifier.kt:91`): un fallo de
envío no rompe la petición, pero **tampoco se registra en ningún sitio consultable** — en
`EmailGuestNotifier.kt:275` el error acaba en un `println`.

**[V]** Proveedor: patrón estrategia (`EmailSenderStrategy.kt:5`) con dos implementaciones
seleccionadas por `email.provider`: `GoogleSmtpStrategy` (`:57-58`, SMTP de Gmail) y
`MailerSendEmailStrategy` (`:39-41`, API HTTP). **[V]** El valor actual es `google`
(`application.yml:77`), con la cuenta y contraseña de S-01.

**[V]** Plantillas: **no hay ficheros de plantilla**. Todo el HTML está escrito dentro de
`…/core/email/EmailContentGenerator.kt`, en un `when` sobre el nombre (`:14-27`).

### A6.2 Catálogo de plantillas existentes

| Nombre | Método | Quién la usa hoy |
|---|---|---|
| `welcome` | `EmailContentGenerator.kt:29` | `CustomerService.kt:142` (alta pública), `:249` y `:298` (alta por admin, con contraseña temporal en el cuerpo) |
| `invitation` | `:137` | `InvitationNotificationService` (módulo prohibido) |
| `admin-invitation-notification` | `:267` | ídem |
| `password-reset` | `:358` | `ResetPasswordService.kt:79` |
| `guest-notification` | `:396` | `EmailGuestNotifier.kt:102` (envío masivo), `:143` (envío individual) |
| `guest-confirmation-success` | `:464` | `EmailGuestNotifier.kt:241` |
| `guest-decline-confirmation` | `:561` | `EmailGuestNotifier.kt:179` |
| `host-guest-declined-notification` | `:611` | `EmailGuestNotifier.kt:195` |
| `host-guest-confirmed-notification` | `:656` | `EmailGuestNotifier.kt:261` |

### A6.3 Los cinco correos que pide la fase 5

| Correo | ¿Existe? | Qué hace falta |
|---|---|---|
| **Bienvenida** | **Sí** — `welcome` (`EmailContentGenerator.kt:29`), enviado en el alta (`CustomerService.kt:139-148`) | Nada funcional. Solo rehacer el arte con la identidad de Lino & Sello: hoy dice `"companyName" to "AGAPE"` (`CustomerService.kt:145`). |
| **Verificación de correo** | **No** | Plantilla nueva `email-verification` + el flujo entero (§A2.1). |
| **Recuperación** | **Sí** — `password-reset` (`:358`), con `resetUrl` construido desde `app.frontend.url` (`ResetPasswordService.kt:82`) | Nada funcional; solo arte. Es la **única** plantilla que ya usa `frontendUrl` configurable y no una URL escrita en el código. |
| **Confirmación de pago** | **No** | Plantilla nueva `payment-receipt`, disparada desde el webhook de Stripe. Lo más parecido hoy es `invitation` (`:137`), que lleva un desglose de precio y una bandera `isPaid` (`:149-151`, `:183-189`), pero la dispara `InvitationNotificationService`, **módulo prohibido**: sirve como referencia de contenido, no como base. |
| **Aviso de RSVP al cliente** | **Sí, las dos** — `host-guest-confirmed-notification` (`:656`) y `host-guest-declined-notification` (`:611`), enviadas al anfitrión en `EmailGuestNotifier.kt:261` y `:195` | Funcionan. **Pero** el correo al invitado que las precede lleva el enlace del producto antiguo (S-08), así que hay que arreglar `EmailGuestNotifier.kt:68` en el mismo trabajo. |

### A6.4 ¿Es viable la verificación de correo con lo que hay? — **Sí, y sin infraestructura nueva**

Ésta es la pregunta que el prompt de la fase deja abierta. Respuesta con las piezas verificadas:

1. **El envío funciona y ya se usa en el alta.** `CustomerService.kt:139-148` manda `welcome` en cada
   registro; añadir un segundo envío en el mismo bloque no exige nada nuevo.
2. **El token está resuelto.** `JwtUtil.generateSecureToken()` (`JwtUtil.kt:59-64`, 128 bytes de
   `SecureRandom`) es el mismo que ya respalda la recuperación de contraseña.
3. **El patrón de «token + caducidad en la fila del cliente» ya existe**: `resetToken` /
   `resetTokenExpiry` (`CustomerEntity.kt:39-40`), con `findByResetToken`
   (`ResetPasswordService.kt:97`). Copiar ese patrón con `email_verification_token` /
   `email_verification_expiry` es una migración de tres columnas.
4. **La URL del correo se puede construir bien**: `app.frontend.url` está inyectada y funcionando
   (`ResetPasswordService.kt:40`, `:82`); **no** hay que replicar el error de
   `EmailGuestNotifier.kt:68`.
5. **El límite de intentos está listo**: `AuthThrottleService` acepta ámbitos
   (`AuthThrottleService.kt:53-60`); basta añadir `VERIFICACION` para que el reenvío no sea un
   amplificador de correo.

**Tres condiciones que hay que aceptar por escrito antes de encenderla [V]/[I]**:

- **[V] Migración obligatoria**: `ddl-auto: validate` (`application.yml:32`), así que las columnas
  nuevas **tienen que** venir en una migración Flyway o la aplicación no arranca. Es exactamente el
  problema que `V40` documenta (`V40:1-7`).
- **[V] Las cuentas existentes deben nacer verificadas** (`email_verified DEFAULT true`), o el
  despliegue deja fuera a todos los clientes actuales.
- **[V] El canal de envío es un Gmail personal por SMTP** (`MailConfig.kt:27-30`,
  `application.yml:63-66`), con cuota diaria y reputación de dominio propias de una cuenta
  gratuita. **[I]** Si la fase 5 va a mandar bienvenida + verificación + recibo de pago + aviso de
  RSVP por cada cliente y cada invitado, ese canal se queda corto. `MailerSendEmailStrategy`
  (`:39-41`) ya está escrita y se activa con una sola propiedad (`application.yml:77`): la decisión
  de proveedor es de configuración, no de código. **Recomiendo elevarlo como pregunta al dueño**,
  no resolverlo dentro de la fase.
- **[?]** Si el dominio de correo de Lino & Sello tiene SPF/DKIM/DMARC configurados no lo puedo
  determinar desde el repositorio.

---

## A7. Lo que NO se toca

**Recordatorio en firme.** Estos tres siguen **prohibidos** en la fase 5 y se retiran en la fase 7.
Nada de lo que se escriba en la fase 5 puede tenerlos como base, ni importarlos, ni llamarlos.

### A7.1 `modules/user/invitations` — PROHIBIDO

**[V]** Lo que inventarié ahí y por tanto **no** se puede usar:

| Elemento | Fichero:línea | Por qué duele |
|---|---|---|
| `POST /user/invitations/create` | `…/modules/user/invitations/presentation/InvitationsController.kt:34` | **Es la única alta de invitación para un cliente que existe.** Sin ella no hay flujo de venta → de ahí el CREAR de §A2.4. |
| `GET /user/invitations/all`, `/{id}/detail` | `InvitationsController.kt:44`, `:53` | Listado y ficha del cliente: hay que rehacerlos. |
| Las 11 rutas de invitados de `/user/invitations/**` | `InvitationsController.kt:66-260` | Son la superficie que hoy usa el cliente para gestionar invitados. Sus **servicios** (`modules/shared/guests`) sí se reutilizan; los **controladores** no. |
| `InvitationConfigController` | `…/presentation/InvitationConfigController.kt:11` (`PUT`/`GET /user/invitations/{id}/config`) | Editor antiguo. |
| `InvitationAssetsController` | `…/presentation/InvitationAssetsController.kt:41`, `:90` | Subida de assets antigua; el equivalente nuevo es `EditorAssetController` (`templates2`). |
| `InvitationService` | `…/service/InvitationService.kt` | **Lo llaman dos controladores públicos** de `modules/all`: `PublicGuestInfoController.kt:10`, `:77` e `InviteAttendingController.kt:4`, `:33`. Por eso esos dos **no** se pueden reutilizar tal cual (§A2.3). |
| `InvitationNotificationService` | `…/service/InvitationNotificationService.kt:30` | Correos de compra/plan. Referencia de contenido para el recibo de pago, **no** base de código. |
| `DefaultConfigGeneratorService` | `…/service/DefaultConfigGeneratorService.kt` (2600+ líneas) | El generador antiguo. Es donde viven los 30 `UUID.randomUUID()` del §S-12; no son tokens de seguridad. |
| `escribir en `invitation.is_paid` desde el alta de cliente` | `InvitationService.kt:76-77` | El escritor de pago del lado cliente está aquí: la fase 5 tiene que crear el suyo. |

### A7.2 `modules/master/templates` — PROHIBIDO

**[V]** `…/modules/master/templates/presentation/MasterTemplatesController.kt:20` y sus 7 rutas
(`:26`, `:50`, `:60`, `:71`, `:79`, `:90`, `:100`), más `MasterTemplatesService` y
`InvitationTemplateEntity`.

**Consecuencias concretas para la fase 5 [V]**:
- El catálogo público `GET /public/invitations/templates`
  (`PublicInvitationTemplateController.kt:16`) delega en `MasterTemplatesService.listAllFiltered`
  (`:22`), así que **es superficie del módulo prohibido**. El equivalente nuevo ya existe:
  `GET /editor/templates2/catalog` (`CatalogController.kt:36`).
- **`invitation_template.price` es la fuente del precio de hoy**
  (`InvitationPriceCalculatorService.kt:24`). Por eso §A5 concluye catálogo de venta nuevo: el
  precio actual vive en una tabla que se demuele.
- **`invitation.template_id` es `NOT NULL`** (`V1__initial_schema.sql:282`) y apunta a esa tabla.
  Es la atadura estructural entre la invitación y el módulo prohibido, y es la decisión con ADR que
  señalé en §A2.4.
- `GET /public/invitations/templates/preview/{invitationId}/signed-url`
  (`PublicInvitationTemplateController.kt:33`) — hallazgo S-10; **no replicar el patrón**.

### A7.3 `MongoDataInitializer` — PROHIBIDO

**[V]** `…/core/data/MongoDataInitializer.kt`. Siembra la configuración por defecto del editor
antiguo en MongoDB (`spring.data.mongodb.uri`, `application.yml:46-48`). El producto nuevo no usa
Mongo: `templates2` guarda todo en Postgres (`tpl_document`, `tpl_release`, `V32`, `V34`).

### A7.4 Lo que **sí** se puede usar aunque esté cerca de lo prohibido

Vale la pena dejarlo escrito para que nadie se pase de prudente:

- **[V]** `modules/shared/guests` **no está prohibido**. Es donde vive todo el motor de invitados y
  RSVP, y es reutilizable (con los arreglos S-04, S-05, S-07, S-08).
- **[V]** `modules/admin/invitations` **no está prohibido**, y es donde vive `InvitationEntity`
  (`…/modules/admin/invitations/repository/model/InvitationEntity.kt`), de la que dependen
  `invitation_guest` y `tpl_document`. Se puede leer y escribir.
- **[V]** `modules/shared/invitations` (`InvitationValidationService`,
  `InvitationPriceCalculatorService`, `InvitationPersistenceHelper`) tampoco está prohibido, **pero**
  el calculador de precio depende de `InvitationTemplateEntity`
  (`InvitationPriceCalculatorService.kt:5`, `:21`), que sí lo está: útil como referencia, no como
  base del cobro nuevo.
- **[V]** `core/auth`, `core/email`, `core/s3`, `modules/master/plans`, `modules/admin/**`,
  `modules/public/**` y `modules/templates2` están todos disponibles.

---

## Resumen de fiabilidad

**Verificado leyendo el código [V]**: el mapa completo de rutas y roles (§A1), las 43 filas de la
tabla de decisión (§A2), los 13 hallazgos de seguridad con línea (§A3), el DDL de `invitation_guest`
y la relación entre `invitation_guest`, `tpl_document` y `invitation` (§A4), la ausencia de precio en
`invitation_plan` y los tres escritores de `is_paid` (§A5), y el catálogo de nueve plantillas de
correo (§A6).

**Inferido [I]**: la explotabilidad práctica de S-04 desde rol USER en la fase 5 (hoy la ruta exige
ADMIN, pero la gemela prohibida no); que la fuerza bruta sobre tokens de 128 bits no es viable; que
el canal de Gmail se queda corto para el volumen de la fase 5; que el diseño de RSVP con
`publicToken` + `confirmationToken` es el que quiere la fase.

**No pude determinar [?]**: (1) qué espera exactamente el frontend en `/i/[publicToken]` para el
parámetro del invitado; (2) si el dueño prefiere que la comprobación de pago antes de publicar viva
en el producto o dentro de `templates2` con un ADR; (3) qué hacer con `invitation.template_id NOT
NULL` apuntando a la tabla prohibida — fila puente o columna anulable; (4) si el dominio de correo
tiene SPF/DKIM/DMARC. Los cuatro son decisiones, no lecturas de código: van a
`preguntas-abiertas.md`.
