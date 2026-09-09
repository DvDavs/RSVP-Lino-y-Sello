# 12 · Producto completo — inventario, arquitectura y mapa de la fase 5

**Qué es este documento.** El entregable 5-0b de la sesión E1 (cimientos) de la fase 5. Es lo que
E2, E3, E4 y E5 leen antes de escribir una línea: qué hay ya construido en el backend heredado, qué
hay que endurecer, qué hay que crear, qué pantalla va en cada ruta y de quién es cada fichero.

**Cómo se compuso.** Cuatro agentes en paralelo sobre territorios disjuntos, integrados por el
orquestador de E1:

| Parte | Agente | Modelo | Qué aporta |
|---|---|---|---|
| A | 5-0b-A | Opus | inventario del backend heredado, tabla endpoint × decisión, hallazgos de seguridad, modelo de invitados y RSVP, planes, correo |
| B | 5-0b-B | Opus | recorridos por rol, tabla pantalla × rol, wireframes, ADR de la puerta de publicación, correo transaccional, entorno, presupuestos |
| C | 5-0c | Opus | esqueleto del módulo `modules/product` y ADR del módulo nuevo |
| D | 5-0d | Opus | puntos de enganche del frontend: registro de navegación, rutas con marcador, catálogo de entorno |

**Cómo leerlo si tienes prisa.** La sección 0 trae las decisiones que ya están tomadas y que ninguna
sesión debe reabrir. Después, ve a la parte que te toca: E2 → A2.2, A2.3, A4, B3.1, B3.2, D2; E3 →
A2.1, A6, B3.7, B3.8, B3.9; E4 → A2.4, A5, B3.3, B3.4, B3.5, B4; E5 → A2.5, A3, B3.6.

**Convención de fiabilidad**, heredada del brief común: **[V]** verificado leyendo el código, con
`fichero:línea` · **[I]** inferido · **[?]** no se pudo determinar.

---

## 0. Decisiones del orquestador de E1 — no se reabren

Cuatro sesiones en paralelo no pueden estar decidiendo lo mismo por su cuenta. Esto queda fijado.

### 0.1 Puerta de publicación
**Editar y previsualizar son gratis; publicar y compartir exigen plan pagado en esa invitación, y se
comprueba en el backend, no solo en la interfaz.** Desarrollo completo y matriz de lo que se puede
hacer con y sin pago: **ADR-5-0B-01**, en la parte B §B4. Estado: propuesta.

### 0.2 Módulo backend nuevo
**`modules/product` con cuatro subpaquetes, no una extensión de `modules/templates2`.** Motivos y
alternativas descartadas: **ADR-5-0C-01**, en la parte C §5. Estado: propuesta.
En esa misma ADR queda fijado que `modules/user/invitations`, `modules/master/templates` y
`MongoDataInitializer` **siguen prohibidos toda la fase 5**; se retiran en la fase 7.

### 0.3 Ruta del enlace personal del invitado: `/r/[token]`
En el **frontend** el enlace personal es `/r/[token]`, no `/i/[publicToken]?g=<token>`.

Esto **reconcilia una diferencia entre las partes A y B**: la parte A (§A4.4) propone que el invitado
llegue con los dos tokens y describe el puente como `GET /public/i/{publicToken}/rsvp/{confirmationToken}`.
La decisión es la contraria y por tres razones:

1. **El invitado no tiene por qué conocer el `publicToken`.** El backend hace la traducción, que es
   la misma unión de una línea que la parte A ya demostró que existe en el esquema (§A4.4), solo que
   en el otro sentido: `invitation_guest.confirmation_token` → `invitation_id` → `tpl_document.public_token`.
2. **La comprobación de propiedad deja de ser un paso que se pueda olvidar.** Con dos tokens hay que
   acordarse de cruzarlos (y si no se cruzan, un token de invitado de otra invitación entra: es el
   hallazgo S-04). Con uno solo, la unión ES la comprobación.
3. **El token no viaja en la cadena de consulta.** En un segmento de ruta es más fácil razonar sobre
   qué se filtra por `Referer` hacia recursos externos, y el enlace es más corto de compartir por
   WhatsApp.

Consecuencia para el backend, que es de **E2**: la ruta pública nueva toma **solo** el token del
invitado y devuelve el invitado, las reglas del evento y el `publicToken` con el que la página pinta
la invitación. **Nunca** vuelca la invitación entera, ni los datos de otros invitados, ni el
`cancellationToken` antes de que el invitado confirme. Lo demás del puente que describe §A4.4 sigue
en pie tal cual, incluido el arreglo de `EmailGuestNotifier.kt:68` (hallazgo S-08).

### 0.4 Cuatro subpaquetes, no cinco
La parte A propone `modules/product/rsvp`. **No se crea.** El RSVP es la otra cara de los invitados y
es la misma sesión (E2) quien lo escribe: vive en **`modules/product/guests`**. Cinco subpaquetes con
cuatro sesiones solo añade una frontera que nadie necesita cruzar.

### 0.5 Catálogo de variables de entorno
Cerrado en la parte B §B6 y la parte D §D4. Dos reglas que no se negocian: **`NEXT_PUBLIC_SITE_URL`
se reutiliza** (no se inventa una segunda variable de origen: dos darían enlaces compartidos
distintos, que es lo que cerró N-02), y **`FRONTEND_URL` se reutiliza** en el backend para las URLs
de retorno de Stripe y los enlaces de correo. Ningún secreto en el repositorio.

### 0.6 Aislamiento de los e2e — regla dura de toda la fase 5
**Cada spec e2e nuevo crea su propia invitación, y su propio usuario si hace falta. Ninguno usa la
invitación sembrada compartida. `fullyParallel` con 4 workers tiene que pasar.**
Es la lección de la issue **I-CI-01**: dos specs se pisaban la invitación sembrada y el job `e2e` solo
pasaba con `--workers=1`. Está también en el skill `pruebas-producto` y en
`memoria/handoffs/5-0-cimientos.md`, con el patrón concreto y los ayudantes de siembra por área.

### 0.7 Lo que ninguna sesión de la fase 5 toca
`.github/workflows/**` · `frontend/apps/web/e2e/preparar.ts`, `e2e/a11y-publico.spec.ts` y
`e2e/editor-3c-evidencia.spec.ts` (los está aislando la sesión del CI) ·
`frontend/apps/web/public/imagenes/**`, `components/asistente/tipos-de-evento.ts` e
`imagenes-pendientes.md` (rama de las imágenes) · `frontend/templates/**`,
`frontend/packages/template-kit/**`, `frontend/packages/migration-legacy/**` y los metadatos de
`packages/sections` (fase 4) · `memoria/contratos.md` y `memoria/00-INDICE.md`, que los cierra la
sesión de integración E6.

---

# Parte A — Inventario del backend heredado

*Agente 5-0b-A (Opus). Documento original: `_12a-inventario-backend.md`, integrado aquí sin cambios de contenido.*


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

---

# Parte B — Mapa de producto: recorridos, pantallas, wireframes y decisiones

*Agente 5-0b-B (Opus). Documento original: `_12b-mapa-de-producto.md`.*


Agente **5-0b-B** · 2026-09-09 · rama `claude/fase-5-cimientos-adenda-u150eq` · estado **propuesta**

Este documento es el **mapa de producto** de la fase 5: qué recorre cada rol, qué pantalla existe y
cuál hay que construir, cómo se ve cada una de las nueve pantallas nuevas, y las decisiones de
producto que el orquestador ya cerró y que aquí quedan escritas con su porqué.

**Qué NO está aquí.** El inventario del backend (qué endpoint se reutiliza tal cual, cuál se
endurece con hallazgo concreto y cuál se crea, modelo de datos, autorización, esquema Stripe) lo
escribe en paralelo el agente 5-0b-A en `_12a-inventario-backend.md`. Cuando aquí se nombra un
endpoint es para decir **de dónde salen los datos de una pantalla**, no para especificarlo; todo lo
que este documento marca como *supuesto para 5-0b-A* es una pregunta que ese inventario debe cerrar.

Fuentes que mandan sobre este documento: `memoria/decisiones-dueno.md` (D-01…D-08),
`docs/rediseno-plantillas/hoja-de-ruta.md`, `prompts/fase-5-producto-completo.md`,
`memoria/contratos.md §8` y `§13`, `guias/identidad-visual.md` y la skill `identidad-visual`.

---

## B1. Recorridos por rol

### Clienta nueva (la que todavía no ha comprado nada)

Llega a `/` por un enlace o por una búsqueda y lee la portada: qué es, cómo funciona en tres pasos,
para qué celebraciones sirve, y **cuánto cuesta** — esto último es nuevo: hoy la sección de planes de
la portada dice literalmente que los precios no se publican y remite a un contacto humano
(`frontend/apps/web/components/sitio/Planes.tsx:1-13`, `lib/i18n.ts:174-180`), porque cuando se
escribió no existía ningún extremo que sirviera precios. Con Stripe ya hay uno, así que la portada
lleva a `/precios`, donde se comparan los planes de verdad. Elige uno y, si no tiene sesión, cae en
`/acceso` (pestaña «Crear cuenta», registro en tres pasos ya construido) y vuelve a `/precios` con la
compra en curso; el pago se hace en Stripe Checkout, fuera de nuestro dominio, y regresa a `/pago`,
que es la pantalla honesta de espera: la compra no está confirmada hasta que llega el webhook, y
esta pantalla lo dice y espera en vez de mentir. Confirmado el pago, entra al asistente `/editor`
(cuatro pasos: tipo de evento, plantilla, datos básicos, listo) y de ahí al editor
`/editor/[invitationId]`. Con la invitación ya escrita se pasa a `/editor/[invitationId]/invitados`:
carga a su gente a mano o pegando una lista, reparte pases (adultos, jóvenes, niños) y obtiene el
enlace personal de cada invitado. Comparte desde ahí mismo por WhatsApp o correo, y ve las
confirmaciones llegar en esa misma pantalla. Su cuenta y su contraseña viven en `/perfil`; el plan y
el historial de pagos de **esa** invitación, en `/editor/[invitationId]/plan`.

Una clienta que llega **sin haber comprado** puede hacer casi todo: crear la invitación, elegir
plantilla, escribirla entera y previsualizarla. Lo único que no puede es **publicar y compartir**
(ADR-5-0B-01, más abajo). Cuando lo intenta no se encuentra un botón muerto: se encuentra la
pantalla del plan, con el precio y el botón de pago.

### Invitada (la que recibe el enlace)

Le llega un mensaje de WhatsApp de la novia con una frase escrita a mano y un enlace
`https://linoysello.com/r/<token>`. Lo abre con el pulgar, en un teléfono, probablemente con datos
móviles y sin cuenta de nada. Lo primero que ve es su propio nombre y cuántos lugares le apartaron,
sobre la portada de la invitación; abajo, la invitación completa (la misma composición que sirve
`/i/[publicToken]`, mismo `packages/sections`, mismos tokens `--inv-*`) y, al final y también fijo
al pie, la única decisión que se le pide: **confirmo** o **no podré ir**. Si confirma, ajusta cuántos
de sus lugares usará y manda. La pantalla le contesta con lo que quedó registrado y le dice, con
todas sus letras, que puede volver a este mismo enlace y cambiar de opinión cuando quiera. Si vuelve
tres días después, el enlace la reconoce y le enseña su respuesta actual con un botón para cambiarla.
Nunca ve a otros invitados, ni cuántos van, ni el teléfono de nadie.

### Administrador (MASTER/ADMIN)

Entra por `/acceso` con su cuenta y aterriza en `/admin`, que es un panel de lectura con acciones
puntuales: cuántas invitaciones se crearon, cuántas se publicaron, cuántas se pagaron y cuántas
confirmaciones han entrado esta semana; la lista de clientas con su estado; la lista de invitaciones
con su plan, su pago, su enlace y el interruptor de deshabilitar; la lista de pagos con su estado de
Stripe; y el catálogo de plantillas registradas, en solo lectura (las plantillas se dan de alta con
el kit de autor de la fase 4, nunca desde el panel). No edita invitaciones ajenas desde aquí: para
eso ya existe el editor y la jerarquía de roles que lo permite.

---

## B2. Tabla maestra pantalla × rol

**Sesiones de la fase 5** (el reparto de trabajo del orquestador):
**E2** invitados + RSVP + compartir · **E3** cuenta + marca + legal · **E4** pagos · **E5** admin.
Cada ruta **nueva** tiene exactamente una sesión dueña. Las rutas existentes llevan «existente» y,
entre paréntesis, la sesión que las retoca y **qué fichero** toca, para que dos sesiones no escriban
el mismo (ver el anexo de propiedad de ficheros al final de esta sección).

| ruta | rol | sesión dueña | qué se ve | vacío / error / carga | de dónde salen los datos |
|---|---|---|---|---|---|
| `/` | público | existente (E4 añade el enlace a `/precios` en `components/sitio/Planes.tsx`) | portada: héroe, tres pasos, tipos de evento, testimonios de muestra, planes, contacto, CTA | sin vacío; `error.tsx` del grupo `(sitio)`; sin carga (estático) | estático desde `lib/i18n.ts §sitio`; contacto desde `lib/contacto.ts` |
| `/acceso` | público | existente (E3 añade el aviso de verificación en `components/sitio/AsistenteAcceso.tsx`) | dos pestañas: entrar y crear cuenta en tres pasos; recuperar contraseña con respuesta genérica (N-01) | error de credenciales sin distinguir causa; estado «Entrando…» | `POST /auth/token`, `/auth/signup`, `/auth/request-password-reset` (`AuthController.kt:36,51,60`) |
| `/ayuda` | público | existente (E3 pone `soporte@` en `components/sitio/ContactoParaContratar.tsx`) | buscador de dudas y caja de contacto | «Ninguna duda coincide» con acción de volver a verlas todas | `components/sitio/dudas-ayuda.ts` |
| `/editor` | clienta | existente (E4 cambia el destino del estado vacío de `AYUDA_PLANES` a `/precios`) | asistente de cuatro pasos + «Mis invitaciones» | `EmptyState` «Todavía no tienes invitaciones» (`MisInvitaciones.tsx:40-48`) | `GET /editor/templates2/catalog`, lista de invitaciones de la clienta |
| `/editor/[invitationId]` | clienta | existente (E2 añade la barra de sub-navegación; ver anexo) | chrome del editor: secciones, campos, fotos, publicar y compartir | `loading.tsx`, `error.tsx`, `not-found.tsx` propios ya existentes | `GET /editor/invitations/{id}/document` (`EditorDocumentController.kt:53`) |
| `/editor/[invitationId]/invitados` | clienta | **E2** | lista de invitados con pases y estado en vivo, alta individual, pegado/CSV, búsqueda, exportación, enlace personal y compartir por invitado | vacío: «Todavía no tienes invitados» con las dos altas; error de importación por fila; esqueleto de tabla al cargar | invitados de la invitación (hoy solo hay ruta ADMIN: `AdminGuestsController.kt:40`; el equivalente de cliente lo define 5-0b-A) |
| `/editor/[invitationId]/plan` | clienta | **E4** | plan de **esta** invitación, qué incluye, estado del pago, historial de pagos, botón de pagar o de cambiar de plan | sin pago: tarjeta «Esta invitación todavía no tiene plan» con el precio y el botón; error de Stripe con reintento; «Preparando el pago…» | catálogo de planes y pagos de la invitación (`invitation.is_paid` / `total_amount`, `InvitationEntity.kt:47-51`; el catálogo con precio lo define 5-0b-A) |
| `/precios` | público | **E4** | comparación de planes con precio, qué incluye cada uno, preguntas frecuentes de compra, contacto | sin catálogo: se cae al bloque de contacto que ya existe, nunca a una tabla vacía; error de red con reintento; esqueletos de tarjeta | catálogo público de planes (nuevo; 5-0b-A) |
| `/pago` | clienta | **E4** | resultado de la compra: esperando confirmación, confirmada, o cancelada por la clienta | espera con explicación honesta y sondeo acotado; error con el contacto de soporte; nunca «pagado» sin webhook | sesión de Stripe Checkout por `session_id` + estado de pago del backend (5-0b-A) |
| `/r/[token]` | invitada | **E2** | su nombre, sus pases, la invitación completa, confirmar o declinar, cambiar de opinión | token inválido/caducado: una sola pantalla indistinguible (sin oráculo); error con reintento; esqueleto de portada | `GET /public/invitation/guest-info/{token}` (`PublicGuestInfoController.kt:58`) + render público de la invitación |
| `/i/[publicToken]` | público | existente (nadie la reescribe en la fase 5) | la invitación publicada, sin datos de invitado | `not-found.tsx`, `forbidden.tsx`, `error.tsx`, `loading.tsx` ya existentes | `GET /public/i/{publicToken}/render` (`PublicRenderController.kt:46`) |
| `/admin` | MASTER/ADMIN | **E5** | métricas, clientas, invitaciones, pagos, plantillas registradas (lectura) | cada tabla con su vacío propio; error por bloque, no por página; esqueletos de fila | `modules/admin/**` (`DashboardController`, `InvitationController.kt:68`, `AdminUsersController`) |
| `/perfil` | clienta (y admin) | **E3** | nombre, correo, cambio de contraseña, cerrar sesión en todos los dispositivos, borrar cuenta (solicitud) | sin datos no aplica; error por campo; «Guardando…» | perfil del usuario (`modules/profile`, `modules/admin/users/service/ProfileService.kt`) |
| `/contacto` | público | **E3** | WhatsApp click-to-chat, correo de ventas, correo de soporte, horario | sin variables configuradas: la frase honesta de `lib/contacto.ts`, nunca un botón muerto | `lib/contacto.ts` sobre las variables `NEXT_PUBLIC_CONTACTO_*` y `NEXT_PUBLIC_SOPORTE_CORREO` |
| `/legal` | público | **E3** | aviso de privacidad y términos, en dos secciones enlazables, marcados como borrador pendiente de revisión legal | sin vacío; sin error (estático) | texto estático en es-MX |
| `/design` y `/design/**` | interno | existente (nadie la toca en la fase 5) | galería viva del sistema de diseño | — | `packages/ui` `metadatos` |
| 404 raíz y 404 del chrome | público | existente | página no encontrada | es el estado vacío | — |

### Anexo · propiedad de ficheros compartidos (para que no choquen las sesiones)

Tres ficheros los tocarían las cuatro sesiones a la vez. Se reparten así, y el reparto es parte de
la decisión, no una sugerencia:

- **Sub-navegación del editor.** `/editor/[invitationId]`, `.../invitados` y `.../plan` comparten una
  barra («Invitación · Invitados · Plan»). La escribe **E2** en un fichero nuevo
  `components/editor/NavegacionDeInvitacion.tsx` **con las tres entradas ya puestas**, incluida la
  de «Plan», que apunta a una ruta que E4 creará después. E4 solo escribe la página `plan/page.tsx`;
  no toca la navegación. Si E4 llega antes que E2, la entrada existe igual y lleva a un 404 del
  chrome, que es un estado ya construido y honesto.
- **Textos (`lib/i18n.ts`, 672 líneas, un solo objeto).** Se parte en `lib/i18n/` con un fichero por
  área (`comun.ts`, `sitio.ts`, `acceso.ts`, `editor.ts`, `invitados.ts`, `rsvp.ts`, `pagos.ts`,
  `admin.ts`, `cuenta.ts`, `legal.ts`) y `lib/i18n.ts` queda como barril que los compone y conserva
  el export `es_MX` — ni un consumidor cambia. **La partición la hace la primera sesión que aterrice
  (E2)**, en un commit propio que no añade texto nuevo, para que el movimiento se revise solo. A
  partir de ahí cada sesión escribe únicamente su fichero.
- **Presupuestos (`apps/web/scripts/check-budget.mjs`, constante `LIMITES_BASE`).** Las nueve
  entradas nuevas las añade **E2 de una sola vez**, con los valores de §B7, en el mismo commit de la
  partición de textos. Ninguna otra sesión toca ese fichero; si una ruta no cabe, se arregla la ruta.

---

## B3. Wireframes de las nueve pantallas nuevas

Convenciones de los nueve dibujos (100 columnas):

- `[display-*]`, `[heading-*]`, `[text-*]`, `[label-*]` marcan la **voz tipográfica** exacta:
  `display`/`heading` son Fraunces, `text` es Onest, `label` es Red Hat Mono en mayúsculas
  (`guias/identidad-visual.md §2`). Nunca la fuente de cuerpo en un título.
- `«FORMA: …»` marca **la única forma protagonista del bloque** (`Rays`, `Blob`, `Seal`,
  `WaveDivider`, `Triangle`, `ColorShadow`…). Una por bloque, nunca detrás de texto, campo o botón.
- `VACÍO ▸` marca dónde vive el estado vacío de ese bloque.
- Sin emojis, aquí y en la interfaz. Los iconos son de `packages/icons` y se nombran por su fichero.

### 1 · `/r/[token]` — la pantalla de la invitada (la más importante)

Es la que ve más gente, casi siempre en un teléfono, entrando desde WhatsApp, sin cuenta y sin
paciencia. Todo lo demás de la fase se puede rehacer; esta no.

Móvil (390 px), primer pliegue y estado de decisión:

```
+--------------------------------------------------------------------------------------------------+
|                                    « FORMA: Seal (sello) »                                        |
|                            .-------------------------------.                                      |
|                            |   portada de la invitación    |   <- Image mask="seal", sin texto    |
|                            |   (foto con máscara, nunca    |      encima: la separación es la      |
|                            |    rectángulo duro)           |      tarjeta de abajo, no un velo     |
|                            '-------------------------------'                                      |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  PARA TI                                                             [label-md, mayúsculas]  | |
|  |  María Fernanda Cruz                                                      [display-lg]       | |
|  |  Te apartamos 2 lugares de adulto y 1 de niño.                            [text-md]          | |
|  |  ------------------------------------------------------------------------------------------  | |
|  |  Boda de Ana y Luis  ·  sábado 14 de marzo, 17:00                         [text-sm, ink-muted]| |
|  +----------------------------------------------------------------------------------------------+ |
|      ^ tarjeta OPACA sobre la portada: así se lee el nombre, no con degradado ni text-shadow        |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  ¿Nos acompañas?                                                          [heading-md]       | |
|  |                                                                                              | |
|  |   ( o ) Sí, ahí estaré                     ( ) No podré ir                 [text-md]         | |
|  |         RadioGroup del sistema, objetivo de toque >= 44 px, no un control nativo             | |
|  |                                                                                              | |
|  |   Cuántos vamos                                                            [label-md]        | |
|  |   Adultos   [ - ]  2  [ + ]   de 2                                         [text-md]         | |
|  |   Niños     [ - ]  1  [ + ]   de 1                                                           | |
|  |   Jóvenes   ...................... (solo si la invitación los permite)                       | |
|  |                                                                                              | |
|  |   [  Confirmar mi asistencia  ]                          Button variant="primario" size="lg" | |
|  |   Puedes volver a este enlace y cambiar tu respuesta cuando quieras.       [text-sm]         | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  ============================ la invitación completa, tal cual =============================        |
|  |  el mismo render de /i/[publicToken]: packages/sections, tokens --inv-*, sin chrome      |        |
|  |  (portada, historia, itinerario, lugar, vestimenta, mesa de regalos, galería…)           |        |
|  ============================================================================================        |
|                                                                                                    |
|  ---- barra fija al pie mientras no haya respuesta ------------------------------------------      |
|  |  Tu respuesta:  [ Confirmar ]   [ No podré ir ]                          [label-md]      |      |
|  ---------------------------------------------------------------------------------------------      |
+--------------------------------------------------------------------------------------------------+
```

Después de responder, la misma ruta, mismo token:

```
+--------------------------------------------------------------------------------------------------+
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: ColorShadow bajo la tarjeta »                                                       | |
|  |  [icono confirmar]  Quedaste confirmada                                   [display-md]       | |
|  |  Apartamos 2 adultos y 1 niño a tu nombre.                                [text-md]          | |
|  |  Te mandamos el detalle a mafer@ejemplo.mx.                               [text-sm]          | |
|  |                                                                                              | |
|  |  [ Cambiar mi respuesta ]                              Button variant="secundario"           | |
|  +----------------------------------------------------------------------------------------------+ |
|  (debajo sigue la invitación completa, sin cambios)                                                |
+--------------------------------------------------------------------------------------------------+
```

Token que no resuelve — **una sola pantalla** para inexistente, caducado, rotado, invitación
despublicada o anfitrión deshabilitado, igual que ya hace `/i/[publicToken]`
(`app/(public)/i/[publicToken]/page.tsx:20-27`): distinguirlos sería un oráculo de enumeración.

```
+--------------------------------------------------------------------------------------------------+
|                              « FORMA: Blob de fondo, apagado »                                     |
|                     Este enlace ya no funciona                            [display-md]             |
|                     Pídele a quien te invitó que te mande el suyo otra vez. [text-md]              |
|                     VACÍO ▸ este ES el estado vacío de la ruta: no hay nada más que ofrecer,       |
|                     y no se ofrece «buscar tu invitación», que sería justo el oráculo.             |
+--------------------------------------------------------------------------------------------------+
```

Escritorio (>= 1024 px) — cambia de verdad: la tarjeta de identidad y la decisión se fijan a la
izquierda y la invitación se desplaza a la derecha, para no obligar a bajar dos pantallas:

```
+--------------------------------------------------------------------------------------------------+
|  +--------------------------------+  +--------------------------------------------------------+  |
|  |  PARA TI            [label-md] |  |                                                        |  |
|  |  María Fernanda   [display-lg] |  |     la invitación completa (render público)            |  |
|  |  2 adultos, 1 niño   [text-md] |  |     con su propio desplazamiento                       |  |
|  |  ----------------------------  |  |                                                        |  |
|  |  ¿Nos acompañas? [heading-md]  |  |                                                        |  |
|  |  ( o ) Sí   ( ) No podré ir    |  |                                                        |  |
|  |  Adultos [-] 2 [+]  de 2       |  |                                                        |  |
|  |  Niños   [-] 1 [+]  de 1       |  |                                                        |  |
|  |  [ Confirmar mi asistencia ]   |  |                                                        |  |
|  |  « FORMA: Seal, una sola »     |  |                                                        |  |
|  +--------------------------------+  +--------------------------------------------------------+  |
|         columna fija (sticky)                        columna que se desplaza                       |
+--------------------------------------------------------------------------------------------------+
```

**Cómo funciona `/r/[token]` y por qué no se puede enumerar.** El servidor resuelve el token contra
el invitado (`InvitationGuestEntity.confirmationToken`, `InvitationGuestEntity.kt:60`), que hoy se
genera con `SecureRandom` de **128 bytes** en base64url (`core/auth/jwt/JwtUtil.kt:59-64`): 1024
bits de entropía, muy por encima de cualquier umbral razonable, y el problema real no es adivinarlo
sino su longitud en una URL de WhatsApp (ver §B8). El token va en la **ruta**, no en la cadena de
consulta, por dos motivos medibles: una `?g=` viaja en el `Referer` hacia cualquier recurso externo
que la página cargue, y se queda en los registros de los intermediarios con más facilidad que un
segmento de ruta; y el enlace de la invitada tiene un **modelo de caché distinto** del de
`/i/[publicToken]` (que es ISR de 300 s, `page.tsx:26`), porque su contenido es personal y no puede
compartir entrada de caché con nadie. Con una ruta propia, `/r/[token]` se declara dinámica y
`no-store` sin tocar el render público, que sigue cacheándose para todos. La página **no expone**
nunca la lista de invitados, ni el total de confirmados, ni el `cancellationToken` de nadie; la
respuesta para un token que no resuelve es idéntica a la de un token caducado, y el intento se
limita por tasa en el backend (5-0b-A). El `publicToken` de la invitación no se deriva del token del
invitado ni al revés: quien tenga uno no puede construir el otro.

### 2 · `/editor/[invitationId]/invitados` — la lista de la clienta

Escritorio:

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello                                                    [Ayuda]  [Cerrar sesión]           |
+--------------------------------------------------------------------------------------------------+
| Boda de Ana y Luis            ( Invitación )  ( Invitados )  ( Plan )        NavegacionDeInvitacion|
+--------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  Invitados                                                                    [display-md]         |
|  Reparte los pases y manda a cada quien su enlace.                            [text-md]            |
|                                                                                                    |
|  +----------------+  +----------------+  +----------------+  +----------------+                    |
|  | CONFIRMADOS    |  | PENDIENTES     |  | NO ASISTEN     |  | LUGARES        |   [label-md]       |
|  | 34             |  | 12             |  | 3              |  | 61 de 80       |   [display-md]     |
|  +----------------+  +----------------+  +----------------+  +----------------+                    |
|      « FORMA: ColorShadow bajo la fila de contadores, una sola vez »                               |
|                                                                                                    |
|  [ Buscar por nombre ]              [ Todos v ]        [ Agregar invitado ]  [ Pegar una lista ]   |
|                                                          primario              secundario          |
|                                                                                    [ Exportar ]    |
|  +----------------------------------------------------------------------------------------------+ |
|  | Nombre              Pases        Estado        Enlace                Compartir               | |
|  |----------------------------------------------------------------------------------------------| |
|  | María Fernanda C.   2A 1N 0J     Confirmada    [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  |                     usa 2A 1N    hace 2 días                                                 | |
|  | Rocío Delgado       2A           Pendiente     [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  | Jorge Luis Pérez    1A           No asiste     [Copiar] [Ver]        [WhatsApp] [Correo]     | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  VACÍO ▸ sin invitados, en lugar de la tabla:                                                      |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « ilustración del sistema »   Todavía no tienes invitados       [heading-md]                 | |
|  |  Agrégalos de uno en uno o pega tu lista de WhatsApp.            [text-md]                    | |
|  |  [ Agregar invitado ]   [ Pegar una lista ]                                                   | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  CARGA ▸ Skeleton de seis filas con la misma altura que las reales (sin salto de maquetación).     |
|  ERROR ▸ tarjeta danger-soft sobre la tabla con «Reintentar»; la tabla anterior no se borra.       |
+--------------------------------------------------------------------------------------------------+
```

Móvil: la tabla no existe. Cada invitado es una tarjeta apilada, y las acciones de compartir viven
dentro de un `Sheet` por invitado (una acción a la vez, pulgar abajo):

```
+------------------------------------------------------------+
|  Invitados                              [display-md]        |
|  34 confirmados · 12 pendientes         [text-sm]           |
|  [ Buscar ]                        [ Todos v ]              |
|  +------------------------------------------------------+  |
|  | María Fernanda Cruz              [heading-sm]         |  |
|  | 2 adultos · 1 niño               [text-sm]            |  |
|  | Confirmada                       [Badge success]      |  |
|  | [ Compartir ]  [ Editar ]                             |  |
|  +------------------------------------------------------+  |
|  | Rocío Delgado                                         |  |
|  | 2 adultos · Pendiente            [Badge neutro]       |  |
|  | [ Compartir ]  [ Editar ]                             |  |
|  +------------------------------------------------------+  |
|  [ Agregar invitado ]        botón fijo al pie             |
+------------------------------------------------------------+
```

Pegado de lista (el `Sheet` de importación), con los errores **por fila** y sugiriendo la corrección,
nunca un «formato inválido» a secas:

```
+--------------------------------------------------------------------------------------------------+
|  Pega tu lista                                                             [heading-md]           |
|  Un invitado por renglón: nombre, adultos, niños, jóvenes, teléfono.       [text-md]              |
|  +----------------------------------------------------------------------------------------------+ |
|  | María Fernanda Cruz, 2, 1, 0, 9511234567                                                     | |
|  | Rocío Delgado, 2                                                                             | |
|  | , 3                                                          <- renglón 3                    | |
|  +----------------------------------------------------------------------------------------------+ |
|  Vista previa: 2 invitados listos, 1 con problema                          [label-md]             |
|  Renglón 3: falta el nombre. Escríbelo antes de la primera coma.           [text-sm, danger-text] |
|  [ Agregar los 2 que están bien ]   [ Volver a la lista ]                                         |
+--------------------------------------------------------------------------------------------------+
```

### 3 · `/editor/[invitationId]/plan` — el plan de esta invitación

```
+--------------------------------------------------------------------------------------------------+
| Boda de Ana y Luis            ( Invitación )  ( Invitados )  ( Plan )                              |
+--------------------------------------------------------------------------------------------------+
|  Plan de esta invitación                                                   [display-md]           |
|                                                                                                    |
|  --- SIN PAGO (VACÍO ▸ este es el estado vacío de la pantalla) --------------------------------    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: Triangle en la esquina, una sola »                                                  | |
|  |  Esta invitación todavía no tiene plan                                    [heading-lg]        | |
|  |  Puedes escribirla y verla completa sin pagar. Para publicarla y                              | |
|  |  mandarla a tus invitados necesitas un plan.                              [text-md]           | |
|  |                                                                                              | |
|  |  Plan Fiesta            $ ___ MXN, pago único            [display-sm] + [label-md]           | |
|  |  Hasta 150 invitados · confirmaciones ilimitadas · enlace propio          [text-sm]           | |
|  |                                                                                              | |
|  |  [ Pagar y publicar ]  primario        [ Ver todos los planes ]  terciario -> /precios        | |
|  +----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  --- CON PAGO ---------------------------------------------------------------------------------    |
|  +----------------------------------------------------------------------------------------------+ |
|  |  Plan Fiesta   [Badge success: Pagado]                                    [heading-lg]        | |
|  |  Pagado el 3 de marzo de 2026 · $ ___ MXN                                 [text-md]           | |
|  |  Hasta 150 invitados · llevas 46                                          [text-sm]           | |
|  |  [ Ver mi comprobante ]                                                                       | |
|  +----------------------------------------------------------------------------------------------+ |
|  Pagos de esta invitación                                                  [heading-md]           |
|  | 3 mar 2026   Plan Fiesta    $ ___ MXN   Pagado      [Comprobante]  |                           |
|  VACÍO ▸ «Todavía no hay pagos registrados.»                                                       |
|  CARGA ▸ Skeleton de la tarjeta grande + dos filas.  ERROR ▸ tarjeta con reintento y soporte.      |
+--------------------------------------------------------------------------------------------------+
```

### 4 · `/precios`

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello        Cómo funciona    Precios    Ayuda                      [ Entrar ]              |
+--------------------------------------------------------------------------------------------------+
|                              « FORMA: Rays detrás del bloque de título »                           |
|   PLANES                                                                   [label-md]             |
|   Un pago por invitación. Sin mensualidades.                               [display-xl]           |
|   Escribes y ves tu invitación gratis; pagas cuando la quieras mandar.     [text-lg]              |
|                                                                                                    |
|  +---------------------------+  +---------------------------+  +---------------------------+      |
|  | SENCILLO      [label-md]  |  | FIESTA        [label-md]  |  | GRANDE        [label-md]  |      |
|  | $ ___ MXN   [display-lg]  |  | $ ___ MXN   [display-lg]  |  | $ ___ MXN   [display-lg]  |      |
|  | pago único    [text-sm]   |  | pago único    [text-sm]   |  | pago único    [text-sm]   |      |
|  | ------------------------- |  | ------------------------- |  | ------------------------- |      |
|  | hasta 60 invitados        |  | hasta 150 invitados       |  | sin límite de invitados   |      |
|  | confirmaciones            |  | confirmaciones            |  | confirmaciones            |      |
|  | enlace propio             |  | enlace propio             |  | enlace propio             |      |
|  |                           |  | galería de fotos          |  | galería y música          |      |
|  | [ Elegir Sencillo ]       |  | [ Elegir Fiesta ]         |  | [ Elegir Grande ]         |      |
|  |   secundario              |  |   primario (recomendado)  |  |   secundario              |      |
|  +---------------------------+  +---------------------------+  +---------------------------+      |
|         « la tarjeta recomendada lleva ColorShadow; las otras dos, no »                            |
|                                                                                                    |
|  Preguntas de compra                                                       [heading-lg]           |
|  ¿Puedo probar antes de pagar? · ¿Puedo cambiar de plan? · ¿Qué pasa si cancelo?   [text-md]      |
|                                                                                                    |
|  ¿Prefieres que te lo expliquemos?                                         [heading-md]           |
|  [ Escribir por WhatsApp ]   [ Escribir por correo ]      (bloque ContactoParaContratar existente) |
|                                                                                                    |
|  VACÍO ▸ sin catálogo del backend NO se pinta una tabla vacía: se enseña solo el bloque de         |
|          contacto con «Escríbenos y te pasamos los precios», que es lo que hoy hace la portada.    |
|  CARGA ▸ tres Skeleton con la altura exacta de las tarjetas.                                       |
|  ERROR ▸ misma salida que el vacío, más un «Reintentar» discreto: el contacto nunca falla.        |
+--------------------------------------------------------------------------------------------------+
```

Móvil: las tres tarjetas se apilan, la recomendada primero, y el precio queda siempre por encima del
pliegue.

### 5 · `/pago`

Tres estados, una sola ruta. El estado que manda es el del **backend**, no el `success_url` de
Stripe: volver de Checkout no es haber pagado.

```
+--- esperando ------------------------------------------------------------------------------------+
|                            « FORMA: ProgressRing del sistema, sin girar si                        |
|                              prefers-reduced-motion »                                             |
|   Estamos confirmando tu pago                                              [display-md]           |
|   Tu banco ya nos contestó; falta que el cobro quede registrado. Esto      [text-md]              |
|   suele tardar unos segundos. No cierres esta página.                                             |
|   Si tarda más de un minuto, escríbenos: soporte@…                         [text-sm]              |
+--------------------------------------------------------------------------------------------------+

+--- confirmado -----------------------------------------------------------------------------------+
|   « FORMA: Seal »   [icono exito]                                                                 |
|   Listo, tu plan está activo                                               [display-lg]           |
|   Plan Fiesta para «Boda de Ana y Luis». Te mandamos el comprobante        [text-md]              |
|   a ana@ejemplo.mx.                                                                                |
|   [ Ir a mi invitación ]  primario     [ Ver mi plan ]  secundario                                |
+--------------------------------------------------------------------------------------------------+

+--- cancelado por la clienta ---------------------------------------------------------------------+
|   No completaste el pago                                                   [display-md]           |
|   No te cobramos nada. Tu invitación sigue guardada tal como la dejaste.   [text-md]              |
|   [ Volver a intentar ]  primario      [ Ver los planes ]  terciario                              |
|   VACÍO ▸ este estado ES el vacío de la ruta: sin sesión de pago que mirar, se llega aquí.         |
+--------------------------------------------------------------------------------------------------+
```

### 6 · `/admin`

```
+--------------------------------------------------------------------------------------------------+
| Lino & Sello · Administración                                     admin@…    [ Cerrar sesión ]     |
+--------------------------------------------------------------------------------------------------+
| ( Resumen )  ( Clientas )  ( Invitaciones )  ( Pagos )  ( Plantillas )        Tabs del sistema     |
+--------------------------------------------------------------------------------------------------+
|  Resumen                                                                   [display-md]           |
|  +--------------+ +--------------+ +--------------+ +--------------+ +--------------+             |
|  | CLIENTAS     | | INVITACIONES | | PUBLICADAS   | | PAGADAS      | | RSVP 7 DÍAS  | [label-md]  |
|  | 128          | | 141          | | 96           | | 103          | | 412          | [display-md]|
|  +--------------+ +--------------+ +--------------+ +--------------+ +--------------+             |
|      « FORMA: Stripes como banda bajo la fila de métricas, una sola vez »                          |
|                                                                                                    |
|  Invitaciones                                          [ Buscar ]   [ Estado v ]   [ Plan v ]      |
|  +----------------------------------------------------------------------------------------------+ |
|  | Invitación         Clienta        Plan      Pago      Estado      Enlace     Acciones        | |
|  |----------------------------------------------------------------------------------------------| |
|  | Boda Ana y Luis    Ana Torres     Fiesta    Pagado    Publicada   [Abrir]    [Deshabilitar]  | |
|  | XV de Sofía        M. Cruz        —         —         En edición  —          [Deshabilitar]  | |
|  +----------------------------------------------------------------------------------------------+ |
|  VACÍO ▸ por tabla, no por página: «Todavía no hay invitaciones», «Ningún pago con ese filtro».    |
|  CARGA ▸ Skeleton por bloque; el resumen no espera a las tablas ni al revés.                       |
|  ERROR ▸ por bloque: si «Pagos» falla, «Clientas» sigue en pantalla con su dato bueno.             |
|                                                                                                    |
|  Plantillas registradas (solo lectura; el alta es con el kit de autor)     [heading-md]            |
|  | boda-clasica 1.2.0   registrada 2 mar 2026   12 invitaciones la usan |                         |
+--------------------------------------------------------------------------------------------------+
```

Móvil: tabs arriba, tarjetas apiladas y **sin acciones destructivas** (deshabilitar una invitación
pide pantalla ancha; en móvil el control se enseña deshabilitado con la razón, nunca escondido).

### 7 · `/perfil`

```
+--------------------------------------------------------------------------------------------------+
|  Tu cuenta                                                                 [display-md]           |
|  +----------------------------------------------------------------------------------------------+ |
|  |  « FORMA: Pill detrás del avatar, una sola »                                                  | |
|  |   ( AT )   Ana Torres                                                     [heading-lg]        | |
|  |            ana@ejemplo.mx   [Badge: correo sin verificar]  [ Reenviar ]   [text-sm]           | |
|  +----------------------------------------------------------------------------------------------+ |
|  Tus datos                                                                 [heading-md]           |
|  Nombre     [ Ana                    ]      Apellidos  [ Torres          ]                        |
|  Correo     [ ana@ejemplo.mx         ]      (cambiarlo pide verificar de nuevo)   [text-sm]       |
|  [ Guardar cambios ]                                                                              |
|                                                                                                    |
|  Contraseña                                                                [heading-md]           |
|  Actual [ •••••••• ]   Nueva [ •••••••• ]   Repite [ •••••••• ]                                   |
|  Al menos 8 caracteres, con mayúscula, minúscula y símbolo.                [text-sm]              |
|  [ Cambiar contraseña ]                                                                            |
|                                                                                                    |
|  Sesiones                                                                  [heading-md]           |
|  Si usaste tu cuenta en un equipo prestado, ciérralas todas.               [text-md]              |
|  [ Cerrar sesión en todos los dispositivos ]   secundario                                         |
|                                                                                                    |
|  Tu información                                                            [heading-md]           |
|  [ Pedir que borren mi cuenta ]  terciario, con diálogo de confirmación                           |
|  VACÍO ▸ no aplica (siempre hay datos). CARGA ▸ Skeleton por campo.                                |
|  ERROR ▸ por campo, junto al campo, diciendo qué corregir; nunca un banner genérico arriba.       |
+--------------------------------------------------------------------------------------------------+
```

### 8 · `/contacto`

```
+--------------------------------------------------------------------------------------------------+
|                          « FORMA: WaveDivider entre el título y las tarjetas »                     |
|   HABLEMOS                                                                 [label-md]             |
|   ¿Te ayudamos a decidir?                                                  [display-xl]           |
|   Contestamos personas, no un robot.                                       [text-lg]              |
|                                                                                                    |
|  +-------------------------------------+  +-------------------------------------+                  |
|  | [icono chat]  WhatsApp  [heading-md]|  | [icono correo] Correo  [heading-md] |                  |
|  | +52 951 470 9685        [text-md]   |  | hola@linoysello.com     [text-md]   |                  |
|  | Para precios y para contratar.      |  | Para lo que prefieras por escrito.  |                  |
|  | [ Escribir por WhatsApp ]           |  | [ Escribir por correo ]             |                  |
|  +-------------------------------------+  +-------------------------------------+                  |
|                                                                                                    |
|  ¿Ya eres clienta y algo no funciona?                                      [heading-md]           |
|  Escríbenos a soporte@linoysello.com y dinos el nombre de tu invitación.   [text-md]              |
|                                                                                                    |
|  VACÍO ▸ sin variables configuradas NO se pinta ninguna tarjeta con enlace: sale la frase          |
|          honesta que ya existe (`lib/i18n.ts:200`, `sitio.contactar.sinContacto`). Es el mismo     |
|          criterio de `lib/contacto.ts`: un botón que no lleva a nadie es peor que su ausencia.     |
+--------------------------------------------------------------------------------------------------+
```

### 9 · `/legal`

```
+--------------------------------------------------------------------------------------------------+
|   Avisos legales                                                           [display-lg]           |
|   Borrador pendiente de revisión legal. Última actualización: 9 sep 2026.  [text-sm, warning-text]|
|                                                                                                    |
|  +--------------------------+  +--------------------------------------------------------------+   |
|  |  En esta página          |  |  Aviso de privacidad                         [heading-lg]    |   |
|  |  · Aviso de privacidad   |  |  Qué datos guardamos, para qué y por cuánto  [text-md]       |   |
|  |    Qué guardamos         |  |  tiempo. Los nombres y teléfonos de tus                       |   |
|  |    Tus invitados         |  |  invitados son tuyos: nosotros solo los                       |   |
|  |    Tus derechos          |  |  guardamos para que puedas mandarles su enlace.               |   |
|  |  · Términos              |  |                                                              |   |
|  |    Qué incluye tu plan   |  |  Términos del servicio                       [heading-lg]    |   |
|  |    Devoluciones          |  |  Qué incluye tu plan, qué pasa si cancelas… [text-md]        |   |
|  |  (índice fijo, sticky)   |  |                                                              |   |
|  +--------------------------+  +--------------------------------------------------------------+   |
|      « FORMA: ninguna. Es una página de lectura larga: la única disciplina es la medida de línea   |
|        (max 70ch) y el ritmo vertical. Meterle una forma sería ruido. »                            |
|  Móvil: el índice se convierte en una lista al principio, no en una barra fija.                    |
+--------------------------------------------------------------------------------------------------+
```

---

## B4. ADR-5-0B-01 — Puerta de publicación: editar gratis, publicar con plan pagado

## ADR-5-0B-01 — La puerta de pago está en publicar, no en editar, y se comprueba en el backend
- Fecha: 2026-09-09 · Estado: propuesta · Autor: 5-0b-B
- Contexto: la fase 5 introduce cobro (D-05: Stripe Checkout + webhook) sobre un producto cuyo valor
  solo se ve **después** de trabajar un rato en él: elegir plantilla, escribir los datos y verla
  compuesta. Poner el cobro antes de eso obliga a pagar a ciegas. Hay además tres hechos del código
  que condicionan dónde puede vivir la puerta. (1) La invitación **no la crea el módulo nuevo**:
  `templates2` aplica una plantilla a una invitación que ya existe (`MisInvitaciones.tsx:3-7`,
  ADR-2-4-02) y la única alta es hoy `POST /admin/invitations/create`, con rol ADMIN
  (`InvitationController.kt:52`). (2) El modelo ya tiene el estado de pago:
  `InvitationEntity.isPaid` y `totalAmount` (`InvitationEntity.kt:47-51`) y un
  `PUT /admin/invitations/{id}/mark-as-paid` (`InvitationController.kt:42`). (3) La publicación ya
  tiene un punto de estrangulamiento único y **ya tiene el concepto de bloqueo**:
  `POST /editor/invitations/{id}/release` y su gemelo de solo lectura
  `GET /editor/invitations/{id}/release/preflight`, que devuelve
  `PreflightResponse{canPublish, blockers[], warnings[]}` (`EditorReleaseController.kt:36-50`,
  `Templates2EditorDtos.kt:192-208`), con la comprobación de bloqueos compartida entre los dos
  (`ReleaseService.kt:64-92`). El riesgo conocido de cualquier puerta de pago dibujada solo en la
  interfaz es que se salte con una petición directa; y el riesgo de una puerta mal contada es el
  botón muerto que ya destapó G-01 en la fase 3-C (`lib/contacto.ts:1-12`): un camino que promete
  una salida que no existe.
- Decisión:
  1. **Editar y previsualizar son gratis.** Crear la invitación, elegir plantilla, escribir todos los
     campos, subir fotos, deshacer, ver el lienzo y `/preview/[invitationId]` no exigen pago.
  2. **Publicar y compartir exigen plan pagado en esa invitación.** La comprobación vive en el
     **backend**, dentro de `ReleaseService`, y se expresa como un `blocker` más del preflight con
     código propio (`TPL_PLAN_UNPAID`), de modo que `GET …/release/preflight` devuelve
     `canPublish=false` y `POST …/release` responde `402` con ese mismo código. La interfaz **no es**
     la puerta: es su reflejo.
  3. Con la puerta cerrada, el reparto de enlaces también lo está: sin release activo no hay
     `publicToken` publicado, y `/r/[token]` de un invitado de una invitación sin publicar responde
     con la misma pantalla indistinguible que un token inválido.
  4. La pantalla **nunca** enseña un botón muerto: «Publicar» sigue existiendo y sigue siendo
     pulsable; al pulsarlo, el diálogo de publicar enseña el bloqueo «Falta el plan» con el precio y
     un botón que lleva a `/editor/[invitationId]/plan`, que es la pantalla que sí puede resolverlo.
  5. **Consecuencia obligatoria** de (1): la invitación tiene que poder nacer **sin pagar**, así que
     la fase 5 necesita un alta de invitación para el rol USER (hoy solo hay la de ADMIN), que la
     cree con `is_paid = false`. Especificarla es de 5-0b-A; sin ella, «editar gratis» es imposible
     porque no habría nada que editar antes de pagar.
- Alternativas descartadas y por qué:
  - **Cobrar antes de crear la invitación** (la forma que el producto tiene hoy de facto: la
    invitación nace de una compra). Se descarta porque obliga a comprar sin haber visto nada y
    porque contradice el objetivo de negocio de la fase, que quiere a la clienta dentro del editor
    cuanto antes. Además deja el asistente y el editor sin ningún recorrido para quien todavía duda.
  - **Poner la puerta solo en la interfaz** (ocultar el botón de publicar). Se descarta porque no es
    una puerta: `POST …/release` seguiría aceptando la publicación de cualquiera con una sesión
    válida, y el producto cobraría solo a quien no sabe usar la consola del navegador.
  - **Poner la puerta en el render público** (publicar libre, pero `/i/[publicToken]` responde 402 si
    no está pagado). Se descarta por tres motivos: le da la mala noticia al **invitado**, que no
    tiene nada que ver; ensucia una ruta pública que hoy tiene exactamente tres estados bien
    definidos (`page.tsx:20-27`); y deja rastro en la caché de la CDN de algo que sí llegó a estar
    publicado.
  - **Marca de agua en la invitación gratuita en lugar de puerta.** Se descarta para esta fase: es
    una decisión de producto y de arte que nadie ha tomado (no hay logotipo todavía, D-02) y
    convierte el criterio binario «está pagada / no lo está» en una negociación estética. Queda
    anotada como pregunta abierta por si el dueño la prefiere más adelante.
  - **Límite por número de invitados en vez de por publicación.** Se descarta como puerta principal:
    el valor que la clienta compra es «mandarla», no «apuntar gente», y un límite de invitados
    castiga justo el trabajo que ella ya hizo. Sí se conserva como **diferencia entre planes**.
- Matriz de capacidades:

  | Acción | Sin plan pagado | Con plan pagado |
  |---|---|---|
  | Crear la invitación desde `/editor` | Sí | Sí |
  | Elegir y cambiar de plantilla | Sí | Sí |
  | Escribir contenido, subir fotos, deshacer | Sí | Sí |
  | Ver el lienzo y `/preview/[invitationId]` | Sí | Sí |
  | `GET …/release/preflight` | Sí; devuelve `canPublish=false` con `TPL_PLAN_UNPAID` | Sí |
  | `POST …/release` (publicar) | **No** · `402 TPL_PLAN_UNPAID` | Sí |
  | Rotar el enlace público | **No** (no hay enlace que rotar) | Sí |
  | Agregar invitados y repartir pases | Sí | Sí |
  | Ver el enlace personal de un invitado | Sí, pero marcado «se activa al publicar» | Sí |
  | Compartir por WhatsApp / correo desde la lista | **No** · el botón abre el plan | Sí |
  | `/r/[token]` para un invitado | Pantalla indistinguible de token inválido | Funciona |
  | Exportar la lista de invitados | Sí (sus datos son suyos) | Sí |
  | `/editor/[invitationId]/plan` | Sí; es la pantalla que resuelve el bloqueo | Sí |

- Qué pasa si el pago caduca o se reembolsa:
  - **Caducidad.** Con pago único por invitación (la recomendación del prompt maestro, bloque 5-4) no
    hay caducidad: se paga una vez y la invitación queda publicable para siempre. Si el dueño
    prefiere suscripción, hace falta una fecha de vigencia por invitación, y entonces el vencimiento
    se comporta igual que un reembolso pero avisando **antes** (dos correos: 7 días y 1 día). Es
    pregunta abierta P-5-0B-3.
  - **Reembolso o contracargo** (`charge.refunded`, `charge.dispute.created`): el webhook pone
    `is_paid = false`, **retira el release activo** (equivalente a `DELETE …/release`: el enlace deja
    de servir de inmediato en origen, con la ventana de 300 s de la CDN que ya está documentada en
    `contratos.md §8`), y avisa por correo a la clienta con la razón y el camino para volver a pagar.
    En `/editor/[invitationId]/plan` el estado pasa a «Pago devuelto» con el botón de pagar otra vez;
    la invitación **no se borra** y los invitados **no se borran**: al volver a pagar y publicar, los
    mismos enlaces personales vuelven a funcionar. El panel `/admin` lo ve en la lista de pagos.
  - **Pago disputado y luego resuelto a favor:** vuelve a `is_paid = true` pero **no republica sola**;
    la clienta pulsa publicar. Republicar en nombre de alguien sin que lo pida es una acción visible
    para terceros que el sistema no debe tomar por su cuenta.
- Consecuencias por pantalla:
  - `/editor/[invitationId]`: el diálogo de publicar gana un bloqueo nuevo, con el mismo aspecto que
    los que ya pinta (los de contenido de demostración sin sustituir); el texto dice qué falta y el
    botón lleva al plan. El resto del editor no cambia.
  - `/editor/[invitationId]/plan`: es la pantalla que **resuelve** el bloqueo y por eso su estado
    vacío es la oferta, no un mensaje de error.
  - `/editor/[invitationId]/invitados`: los botones de compartir están presentes y deshabilitados con
    una razón visible («Se activan cuando publiques»), nunca ocultos; «Copiar enlace» sigue copiando
    para que la clienta pueda probarlo ella misma, con el aviso de que todavía no abre para nadie más.
  - `/precios` y `/pago`: son el camino de salida del bloqueo y por eso la ruta `/precios` acepta un
    parámetro con la invitación de origen, para volver a ella tras pagar.
  - `/admin`: la columna «Pago» de la lista de invitaciones es la misma verdad que la puerta; un
    ADMIN que marque una invitación como pagada la habilita, y eso queda registrado.
  - `/r/[token]` y `/i/[publicToken]`: no cambian. Un invitado nunca ve nada de esto.

---

## B5. Correo transaccional

Todo sobre `core/email`: `EmailService.sendEmail(to, templateName, variables)`
(`EmailService.kt:13`) y `EmailContentGenerator.generate` (`EmailContentGenerator.kt:14`), que hoy
resuelve nueve plantillas por nombre: `welcome`, `invitation`, `admin-invitation-notification`,
`password-reset`, `guest-notification`, `guest-confirmation-success`, `guest-decline-confirmation`,
`host-guest-confirmed-notification`, `host-guest-declined-notification`
(`EmailContentGenerator.kt:15-24`). El envío tiene dos estrategias, Google SMTP y MailerSend,
elegidas por la propiedad `email.provider` (`application.yml:71-72`).

| # | correo | a quién | qué dice (una línea, es-MX) | qué lo dispara | enlace | variables de entorno |
|---|---|---|---|---|---|---|
| 1 | Bienvenida | clienta recién registrada | «Tu cuenta de Lino & Sello está lista: entra y empieza tu invitación.» | alta correcta en `POST /auth/signup` (`AuthController.kt:51`) | `FRONTEND_URL/editor` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `MAIL_RESPONDER_A` |
| 2 | Verificación de correo | clienta recién registrada | «Confirma que este correo es tuyo: aquí te mandaremos el enlace de tu invitación.» | mismo alta que (1), en el mismo commit | `FRONTEND_URL/acceso?verificar=<token>` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE` |
| 3 | Recuperación de contraseña | quien la pidió | «Cambia tu contraseña con este enlace; caduca pronto y solo sirve una vez.» | `POST /auth/request-password-reset` (`AuthController.kt:60`) | `FRONTEND_URL/acceso?recuperar=<token>` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE` |
| 4 | Confirmación de pago | clienta que pagó | «Recibimos tu pago del plan Fiesta: tu invitación ya se puede publicar.» | webhook de Stripe, evento de pago completado, **después** de marcar `is_paid` | `FRONTEND_URL/editor/{invitationId}/plan` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `MAIL_RESPONDER_A`, `STRIPE_MONEDA` |
| 5 | Aviso de RSVP a la clienta | dueña de la invitación | «María Fernanda confirmó: 2 adultos y 1 niño. Llevas 34 de 80 lugares.» | `PUT /public/invitation/{confirmationToken}/attend` (`InviteAttendingController.kt:20`) y su gemelo de cancelación | `FRONTEND_URL/editor/{invitationId}/invitados` | `FRONTEND_URL`, `MAIL_FROM`, `MAIL_FROM_NOMBRE`, `SOPORTE_CORREO` |

**Qué ya existe y qué no** (lo que sigue son supuestos y hallazgos para 5-0b-A, no especificación):

- (1) y (3) **ya tienen plantilla** (`welcome`, `password-reset`); solo hay que revisar el texto para
  la marca «Lino & Sello» (D-02) y para es-MX.
- (5) **ya tiene plantilla** (`host-guest-confirmed-notification`,
  `host-guest-declined-notification`) — lo que hay que revisar es a qué enlace manda.
- (2) **no existe**: no hay ninguna columna ni servicio de verificación de correo en el backend (una
  búsqueda de `emailVerified` / `is_verified` sobre `src/main/kotlin` no devuelve nada relacionado).
  **Supuesto para 5-0b-A**: si añadir la columna y su token resulta caro para esta fase, la
  alternativa conservadora es que el registro funcione sin verificar y el correo sin verificar se
  marque en `/perfil` con su reenvío, sin bloquear ninguna capacidad. Bloquear el uso del producto
  detrás de una verificación que todavía no se puede probar de punta a punta sería peor.
- (4) **no existe**: no hay plantilla de pago. Es plantilla nueva (`payment-confirmation`).
- **Hallazgo, y es grave para el correo del invitado**: `EmailGuestNotifier.buildInvitationUrl`
  ignora el `frontendUrl` que recibe y devuelve una URL con el **dominio de producción del sistema
  antiguo**, escrito a mano: `EmailGuestNotifier.kt:68` retorna
  `https://invitaciones-digitales-agape.cloud/invitaciones/{id}/{slug}/{nombres}?token=…`, con la
  versión configurable justo debajo, comentada (`:69`). Todo correo de invitación que salga hoy lleva
  a un producto que no es este. Es exactamente el mismo defecto que U-6 corrigió en la interfaz
  (`lib/enlace-publico.ts:1-12`) y aquí sigue vivo en el correo.
- **Hallazgo**: `ResetPasswordService.kt:82` construye
  `"$frontendUrl/login/reset-password/ChangePass?token=$resetToken"`, una ruta que **no existe** en
  `apps/web` (el árbol de `app/**` no tiene `/login`). El correo de recuperación, hoy, lleva a un
  404. La ruta viva es `/acceso` con su pestaña de recuperación (`lib/i18n.ts:76-88`).
- **Hallazgo**: el remitente está fijado en `application.yml:56-57` (`spring.mail.username`, una
  cuenta de Gmail del sistema anterior) y en `mailersend.fromEmail` (`application.yml:75`). Ninguna
  de las dos es una dirección de Lino & Sello. De ahí salen `MAIL_FROM`, `MAIL_FROM_NOMBRE` y
  `MAIL_RESPONDER_A` (§B6): el transaccional sale de `no-responder@linoysello.com` y **responde a**
  `soporte@linoysello.com`, para que una respuesta de una clienta no se pierda (D-03).
- Regla común a los cinco: **sin emojis** también en el correo (skill `identidad-visual`), es-MX, y
  ningún correo transaccional lleva datos de otros invitados. El aviso de RSVP (5) nombra a un solo
  invitado, el que acaba de responder, y su cuenta de lugares; nunca una lista.

---

## B6. Catálogo de variables de entorno de la fase 5

Sin valores en claro. Las direcciones y el número los fija `memoria/decisiones-dueno.md` D-03
(`hola@linoysello.com` contacto/ventas, `soporte@linoysello.com` ayuda,
`no-responder@linoysello.com` transaccional) y D-04 (WhatsApp **+52 951 470 9685**, solo
click-to-chat, sin API de Meta).

### Frontend (`frontend/apps/web/lib/env.ts` — **fichero nuevo**: hoy no existe)

Hoy cada variable se lee donde hace falta (`lib/contacto.ts:110`, `app/(public)/layout.tsx:32`,
`lib/enlace-publico.ts:62`). `lib/env.ts` centraliza la **lectura y la validación**, y cada módulo
sigue exponiendo su función de dominio; el patrón a imitar es el de `lib/contacto.ts`: funciones
puras sobre un mapa de entorno, probadas caso por caso sin tocar `process.env` global.

| nombre | dónde se lee | para qué | quién la necesita | obligatoria | si falta |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_CONTACTO_WHATSAPP` | `lib/env.ts` → `lib/contacto.ts` | número E.164 para `wa.me` de ventas | `/`, `/ayuda`, `/contacto`, `/precios` | opcional | no se pinta la tarjeta de WhatsApp; sale la frase honesta (`sitio.contactar.sinContacto`) |
| `NEXT_PUBLIC_CONTACTO_CORREO` | `lib/env.ts` → `lib/contacto.ts` | correo de ventas para `mailto:` | igual que la anterior | opcional | igual: sin tarjeta de correo, con frase honesta |
| `NEXT_PUBLIC_SOPORTE_CORREO` | `lib/env.ts` | correo de ayuda a clientas ya compradas | `/ayuda`, `/contacto`, `/pago` (estado de espera), `/perfil` | opcional | el bloque de soporte no se pinta y `/pago` remite al contacto de ventas |
| `NEXT_PUBLIC_SITE_URL` | ya se lee en `app/(public)/layout.tsx:32` y `lib/enlace-publico.ts:62`; la fase 5 la centraliza en `lib/env.ts` | origen público del sitio: metadatos y `og:image`, y **la base absoluta del enlace que la clienta reparte** cuando no hay `window` | `(public)/layout.tsx`, `lib/enlace-publico.ts`, y `/r/[token]` cuando E2 construya el enlace personal de cada invitada | **obligatoria en despliegue real** | ya hay dos compuertas de arranque que lo impiden: `motivoDeArranqueInvalido` (`lib/enlace-publico.ts:100-117`) cuando la API es remota y el origen no está declarado o es local, y `motivoDeOrigenDesalineado` (`:160`) cuando el artefacto se horneó para otro origen |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `lib/env.ts` | clave **pública** de Stripe para el cliente | `/precios`, `/pago` | obligatoria si hay pagos | `/precios` no ofrece pagar: enseña los planes y el bloque de contacto, y registra el motivo en consola. Nunca un botón «Pagar» que no puede pagar |
| `NEXT_PUBLIC_E2E_HOOKS` | ya se lee en `app/(chrome)/editor/[invitationId]/page.tsx:128` y `lib/manifest.ts:74`; la fija `playwright.config.ts:86` | expone ganchos de prueba (`window.__editorStore`, fixtures) | solo Playwright | opcional | nada: en producción no está definida y no se expone ningún gancho. **Nunca** se define en un despliegue real |

**Por qué el origen del sitio se reutiliza y no se renombra** (corrección del orquestador, 2026-09-09).
Un primer borrador de este catálogo traía una variable nueva, `NEXT_PUBLIC_SITIO_URL`, para lo que ya
hace `NEXT_PUBLIC_SITE_URL`. Se retira. La variable existente está en uso real y probado —35
referencias, entre ellas `app/(public)/layout.tsx:32`, `lib/enlace-publico.ts:62`,
`lib/enlace-publico.test.ts` y el `webServer` de `playwright.config.ts`— y **es la base del enlace que
la clienta manda a sus invitadas**, con el orden de resolución que fijó N-02 / `ADR-3C-N02-01`
(`window.location.origin` primero, la variable después, el `publicUrl` del servidor como último
recurso: `lib/enlace-publico.ts:19-30`). Tener **dos** variables para el mismo origen produciría
enlaces compartidos distintos según qué trozo de código los construyera, que es exactamente el
defecto que N-02 cerró tras medirlo (`bitacora/3b-adv.md §6.2`: enlaces al puerto del build mientras
la clienta navegaba en otro). Una sola fuente para el origen, y `/r/[token]` construye el enlace
personal de cada invitada sobre esa misma.

Frontend, entonces: **cuatro variables existentes que se reutilizan** (`NEXT_PUBLIC_CONTACTO_WHATSAPP`,
`NEXT_PUBLIC_CONTACTO_CORREO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_E2E_HOOKS`) y **dos nuevas**
(`NEXT_PUBLIC_SOPORTE_CORREO`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).

Variables vecinas que la fase 5 **no toca** y que conviene no confundir con las de arriba:
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_EDITOR_ORIGIN`, `NEXT_PUBLIC_CDN_ORIGIN`,
`NEXT_PUBLIC_BUILD_ID`, `EDITOR_ORIGIN`, `PERMITIR_ORIGEN_LOCAL`, `PERMITIR_ORIGEN_DESALINEADO`.

### Backend (`src/main/resources/application.yml`)

| nombre | dónde se lee | para qué | quién la necesita | obligatoria | si falta |
|---|---|---|---|---|---|
| `FRONTEND_URL` | `application.yml:80` → `app.frontend.url` | **se reutiliza, no se inventa otra**: base absoluta de los enlaces de todos los correos y de las URLs de retorno de Stripe Checkout (`success_url`, `cancel_url`) | `core/email` y sus consumidores, `EditorDocumentService.kt:804`, el servicio de Checkout | **obligatoria en despliegue real** | hoy cae a `http://localhost` y los enlaces salen inservibles (es U-6, ya medida). La fase 5 la hace obligatoria: sin ella el arranque falla, por la misma razón que `templates2.assets.bucket` no tiene valor por defecto |
| `STRIPE_SECRET_KEY` | `application.yml` (`stripe.secret-key`) | llamar a la API de Stripe (crear sesiones de Checkout, leer pagos) | módulo de pagos | **obligatoria si se aceptan pagos** | **el arranque falla ruidosamente**, ver la regla al final |
| `STRIPE_WEBHOOK_SECRET` | `application.yml` (`stripe.webhook-secret`) | verificar la firma del webhook antes de creer nada de lo que llega | módulo de pagos | **obligatoria si se aceptan pagos** | **el arranque falla ruidosamente** |
| `STRIPE_MONEDA` | `application.yml` (`stripe.moneda`) | moneda de los importes (`mxn`), en un solo sitio y no repartida por el código | módulo de pagos, correo (4) | opcional con valor por defecto `mxn` | se usa `mxn`, que es la moneda del producto (D-02: dominio y mercado en México) |
| `MAIL_FROM` | `application.yml` (`mail.from`) | remitente de todo el transaccional (`no-responder@…`, D-03) | `core/email`, las dos estrategias | obligatoria si se manda correo | el arranque falla si el correo está activo: hoy el remitente cae a la cuenta de Gmail del sistema anterior (`application.yml:56`), y mandar correo de Lino & Sello desde otra marca es peor que no mandarlo |
| `MAIL_FROM_NOMBRE` | `application.yml` (`mail.from-nombre`) | nombre visible del remitente («Lino & Sello») | `core/email` | opcional | se usa la parte local de `MAIL_FROM`; el correo sale sin nombre bonito pero llega |
| `MAIL_RESPONDER_A` | `application.yml` (`mail.responder-a`) | `Reply-To` hacia `soporte@…`, para que responder a un transaccional no caiga en el vacío | `core/email` | opcional | no se pone `Reply-To`; responder al correo llega a `no-responder@`, que es exactamente el problema que esta variable evita |
| `CONTACTO_CORREO` | `application.yml` (`contacto.correo`) | dirección de ventas que el backend cita en correos y en respuestas de error de pago | módulo de pagos, `core/email` | opcional | el correo omite la línea de contacto en vez de inventar una dirección |
| `CONTACTO_WHATSAPP` | `application.yml` (`contacto.whatsapp`) | número de ventas que el backend cita en correos | `core/email` | opcional | igual: se omite la línea |
| `SOPORTE_CORREO` | `application.yml` (`soporte.correo`) | dirección de ayuda que el backend cita en avisos a clientas | `core/email`, módulo de pagos | opcional | se omite la línea, nunca se sustituye por otra dirección |

**La regla, y por qué es asimétrica.** Si falta una variable **opcional**, la interfaz es **honesta**:
no pinta el camino que no puede recorrer, y lo dice — es exactamente lo que ya hace `lib/contacto.ts`
(«el contacto se publicará aquí en cuanto esté configurado», `lib/i18n.ts:200`), y el motivo está
escrito en su cabecera: un botón que no lleva a nadie es peor que su ausencia. Si falta una variable
**obligatoria de pagos** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), **el arranque falla y
explica qué poner**, con el mismo patrón que ya usa `templates2.assets.bucket`
(`application.yml:100-107`: sin valor por defecto a propósito, «sin esta propiedad la aplicación NO
arranca y explica qué poner»). La asimetría no es capricho: un canal de contacto ausente degrada la
experiencia de una persona que puede escribir por otro medio; un `STRIPE_WEBHOOK_SECRET` ausente
significa **aceptar webhooks sin verificar la firma**, es decir, permitir que cualquiera declare
pagada cualquier invitación. Un sistema que cobra a medias es peor que uno que no cobra: cobra sin
entregar, o entrega sin cobrar, y en los dos casos alguien pierde dinero en silencio. Fallar al
arrancar es la única forma de que ese fallo se vea antes de que haya una clienta detrás.

Total documentado en esta fase: **16 variables** (6 de frontend, 10 de backend, de las cuales
`FRONTEND_URL` se reutiliza y las otras nueve son nuevas).

---

## B7. Presupuesto de peso y accesibilidad de lo nuevo

### Cómo se mide hoy

`apps/web/scripts/check-budget.mjs` pesa el **JS de primera carga por ruta** (comunes + los chunks
propios de la ruta, sin los polyfills `nomodule`, que tienen techo aparte de 64 KB) sobre el `.next`
que acaba de construir Playwright, y **rompe con código 1** si excede. Los límites vigentes están en
la constante `LIMITES_BASE` (`scripts/check-budget.mjs:47-56`): `/i/[publicToken]` **150 KB gz**, `/`
**150 KB gz**, `/editor/[invitationId]` **600 KB gz**. La compuerta corre además como prueba, con
una prueba negativa que verifica que de verdad falla (`e2e/presupuesto.spec.ts:32-44`), y una tercera
que verifica que mide el JS **propio** de cada ruta y no solo el runtime común (`:46-59`). Cifras
medidas al cierre de la fase 3-C: `/i/[publicToken]` 142,0 KB, `/` 148,2 KB (margen de 1,8 KB), editor
419 KB (`handoffs/3c-para-siguiente.md §4`). Subir un límite exige ADR (`contratos.md §8`).

### Qué hereda cada ruta nueva

| ruta | límite propuesto | por qué |
|---|---|---|
| `/r/[token]` | **150 KB gz** | es ruta **pública y móvil**, se abre desde un enlace de WhatsApp con datos móviles: mismo trato que `/i/[publicToken]`, sin excepción. Es el mismo render más una tarjeta y un formulario pequeño; si no cabe, lo que sobra es el chrome que se coló, no el presupuesto |
| `/precios` | 150 KB gz | pública y de primera impresión, exactamente el argumento con el que la portada entró en la compuerta (`check-budget.mjs:50-53`) |
| `/contacto` | 150 KB gz | pública, y es poco más que dos tarjetas: debería sobrar mucho margen |
| `/legal` | 150 KB gz | pública y de puro texto |
| `/pago` | 150 KB gz | la abre una clienta que viene de fuera del dominio, a veces en móvil, y es la pantalla en la que menos se puede permitir un tiempo de espera largo |
| `/perfil` | 300 KB gz | chrome autenticado, formularios del sistema, sin lienzo, sin `zustand`, sin `dnd-kit` |
| `/editor/[invitationId]/invitados` | 300 KB gz | chrome autenticado con tabla, búsqueda e importación; **no** carga el lienzo ni el store del editor |
| `/editor/[invitationId]/plan` | 300 KB gz | chrome autenticado, dos tarjetas y una tabla |
| `/admin` | 300 KB gz | chrome autenticado con tablas y filtros |

El 300 KB no es una medición, es un techo deliberado: la mitad del que tiene el editor, que es la
ruta más pesada del producto por razones conocidas y aceptadas. Si una de estas cuatro rutas se
acerca a él, la respuesta es partir la pantalla o cargar bajo demanda, **nunca** subir el número: la
compuerta existe precisamente porque «un presupuesto que solo avisa se ignora»
(`check-budget.mjs:2-3`). La primera medición real de cada ruta va a la bitácora de su sesión.

### Qué exige axe (y qué no basta)

- Toda ruta nueva entra en una compuerta de accesibilidad con el criterio **estricto** de
  `e2e/a11y-producto.spec.ts`: `violations` **vacío de cualquier impacto** (no solo grave/crítico), e
  `incomplete` **no se ignora** — la única entrada tolerada siempre es `color-contrast`, porque axe la
  devuelve en cuanto hay un degradado y no significa nada (`a11y-producto.spec.ts:1-27`). Con un
  `Dialog` modal abierto se tolera además `aria-hidden-focus`, y solo ahí, por el `FocusScope` de
  Radix; aplica al `Sheet` de compartir y al de importación de `/invitados`, y al diálogo de
  confirmación de `/perfil`.
- **`axe` no vale como compuerta de contraste.** El contraste se mide sobre la **pila renderizada**
  con `medirContraste` (`e2e/util/contraste.ts`), umbral por tamaño computado (4,5 normal / 3,0 texto
  grande). Se exige en las pantallas nuevas con fondo compuesto o foto: `/r/[token]` (tarjeta opaca
  sobre la portada), `/precios` (tarjetas sobre `Rays`) y `/perfil` (formulario denso). Las demás las
  cubre la galería `/design`, que usa los mismos componentes y los mismos tokens.
- Objetivo de toque **>= 24 px** y foco no obstruido (`e2e/design-objetivos.spec.ts`). En
  `/r/[token]` se sube el listón a **44 px** para los controles de respuesta y los `+`/`-` de pases:
  es una pantalla de pulgar, y 24 px es un mínimo legal, no un objetivo de diseño.
- Movimiento sobrio y apagado con `prefers-reduced-motion`: afecta al `ProgressRing` de `/pago` y a
  cualquier `breathe` de las formas de fondo de `/precios` y `/contacto`.
- **`noindex`** en `/r/[token]`, exactamente igual que en `/i/[publicToken]`: lleva el nombre de una
  persona y sus lugares apartados. Se pone en las **tres** capas que ya existen para la ruta pública
  (metadatos de la página, metadatos del layout del grupo para que lo hereden `not-found`/`error`, y
  la cabecera `X-Robots-Tag` de `next.config.ts`), por el motivo escrito en
  `app/(public)/layout.tsx:16-21`: el `generateMetadata` de la página solo corre cuando la página se
  renderiza. Además, `/r/[token]` es **dinámica y sin caché compartida**: su contenido es personal.
  `/perfil` y `/admin` también van con `noindex`; `/precios`, `/contacto` y `/legal` sí se indexan.
- Ficheros de prueba **uno por sesión**, para que no choquen: `e2e/a11y-invitados-rsvp.spec.ts` (E2),
  `e2e/a11y-cuenta-legal.spec.ts` (E3), `e2e/a11y-pagos.spec.ts` (E4), `e2e/a11y-admin.spec.ts` (E5).
  Ninguna sesión edita `a11y-producto.spec.ts`, que es la compuerta de las pantallas ya cerradas.
- LCP: `/r/[token]` hereda el objetivo de `/i/[publicToken]`, **< 2,5 s en móvil**, medido igual (3
  corridas, mediana). La referencia de la fase 3-C es 1 998 ms para `/i`
  (`handoffs/3c-para-siguiente.md §4`); `/r` añade una tarjeta y un formulario sobre el mismo render,
  así que un LCP peor que ese señala que se coló algo que no debía.

---

## B8. Preguntas abiertas

Formato de `memoria/preguntas-abiertas.md`. **Van escritas aquí, no en ese fichero**: las añade el
orquestador.

- [Fase 5 · 5-0b-B] **P-5-0B-1.** El catálogo cerrado de la fase nombra `NEXT_PUBLIC_SITIO_URL`, pero
  el código ya usa `NEXT_PUBLIC_SITE_URL` en 35 lugares, incluidas dos compuertas que impiden
  arrancar un despliegue mal configurado (`lib/enlace-publico.ts:100`, `:160`) y sus pruebas.
  **Supuesto tomado:** `lib/env.ts` acepta las dos y prefiere `NEXT_PUBLIC_SITIO_URL`; el resto del
  código pasa a pedirle el valor a `lib/env.ts`. Así manda el nombre nuevo sin romper ningún
  despliegue ni ninguna compuerta existente. Renombrar en seco y de golpe es la alternativa que se
  descartó por riesgo, no por gusto.
- [Fase 5 · 5-0b-B] **P-5-0B-2.** ¿El pago es único por invitación o suscripción? El prompt maestro
  recomienda pago único y `InvitationEntity` solo tiene `is_paid`/`total_amount`
  (`InvitationEntity.kt:47-51`), sin fecha de vigencia. **Supuesto tomado:** pago único por
  invitación, sin caducidad. Es lo que el modelo ya soporta sin migración y lo que hace que la
  matriz de ADR-5-0B-01 no necesite un estado «vencida».
- [Fase 5 · 5-0b-B] **P-5-0B-3.** Si el dueño quisiera suscripción, ¿con cuánta antelación se avisa
  del vencimiento y qué pasa con una invitación publicada que vence **el día del evento**?
  **Supuesto tomado:** no se implementa vencimiento en esta fase; si se implementara, dos avisos (7
  días y 1 día) y **nunca** despublicar dentro de las 72 h previas a la fecha del evento, porque
  dejar sin invitación a los invitados el día de la boda es un daño desproporcionado frente al
  importe en juego.
- [Fase 5 · 5-0b-B] **P-5-0B-4.** Los tokens de invitado tienen 128 bytes en base64url
  (`JwtUtil.kt:59-64`): 171 caracteres. Un enlace `https://linoysello.com/r/<171 caracteres>` es
  larguísimo para pegarlo en WhatsApp y se ve mal en la vista previa del mensaje. **Supuesto
  tomado:** no se toca la generación en esta fase (cambiarla afecta a los tokens ya emitidos y es
  territorio de 5-0b-A); se registra que 32 bytes (43 caracteres) siguen siendo 256 bits, sobra para
  cualquier umbral, y darían un enlace legible. Decidirlo es de 5-0b-A con ADR.
- [Fase 5 · 5-0b-B] **P-5-0B-5.** `GET /public/invitation/guest-info/{token}`
  (`PublicGuestInfoController.kt:58`) devuelve hoy dos cosas que `/r/[token]` no debería recibir: el
  `cancellationToken` del invitado (un segundo secreto, que si viaja al navegador se puede filtrar
  por captura de pantalla o por historial) y `invitationDetail`, la invitación **entera** del módulo
  antiguo (`:77` y `:100`). **Supuesto tomado:** `/r/[token]` se diseña contra una respuesta
  recortada —nombre, pases, estado, reglas del evento y nada más— y la invitación se pinta desde el
  render nuevo, no desde ese campo. El endurecimiento del endpoint es de 5-0b-A.
- [Fase 5 · 5-0b-B] **P-5-0B-6.** No hay ninguna ruta de invitados para el rol USER: todas cuelgan de
  `/admin/invitations/**` (`AdminGuestsController.kt:34`). **Supuesto tomado:** hace falta el
  equivalente de cliente, y `/editor/[invitationId]/invitados` se diseña contra él; qué forma tiene y
  si se endurece el existente o se crea uno nuevo lo decide 5-0b-A.
- [Fase 5 · 5-0b-B] **P-5-0B-7.** `invitation_plan` solo tiene `name` e `is_premium`
  (`InvitationPlanEntity.kt:13-24`): **no hay precio, ni moneda, ni límite de invitados, ni
  identificador de precio de Stripe**. `/precios` y `/editor/[invitationId]/plan` no se pueden pintar
  con lo que hay. **Supuesto tomado:** los wireframes se dibujan con los campos que el producto
  necesita (nombre, precio, moneda, qué incluye, tope de invitados, recomendado sí/no) y el catálogo
  real lo define 5-0b-A; mientras no exista, las dos pantallas caen a su estado vacío honesto, que es
  el bloque de contacto que ya funciona hoy.
- [Fase 5 · 5-0b-B] **P-5-0B-8.** ¿Cuántos planes hay y cómo se llaman? En los wireframes aparecen
  tres («Sencillo», «Fiesta», «Grande») y los precios van como `$ ___ MXN`. **Supuesto tomado:** son
  nombres de relleno para dibujar, no una propuesta comercial; los fija el dueño. Un precio inventado
  en una pantalla es exactamente el error que `Planes.tsx:3-8` se negó a cometer.
- [Fase 5 · 5-0b-B] **P-5-0B-9.** El registro no verifica el correo y no existe columna para ello en
  el backend. **Supuesto tomado:** si la verificación no cabe en la fase, el producto funciona sin
  ella y `/perfil` enseña el estado «sin verificar» con reenvío, sin bloquear nada. Bloquear detrás
  de una verificación que no se puede probar de punta a punta dejaría a la clienta fuera de su propia
  cuenta.
- [Fase 5 · 5-0b-B] **P-5-0B-10.** ¿Marca de agua en la invitación sin pagar, en vez de puerta de
  publicación? **Supuesto tomado:** no. No hay logotipo todavía (D-02) y convierte un criterio
  binario en una negociación estética. Queda registrada por si el dueño la prefiere.
- [Fase 5 · 5-0b-B] **P-5-0B-11.** `/legal` como una sola página con dos secciones, o `/legal/privacidad`
  y `/legal/terminos` por separado. **Supuesto tomado:** una sola página con dos secciones
  enlazables por ancla: es menos superficie, un solo presupuesto y un solo `noindex` que decidir, y
  partirla después no rompe ningún enlace si las anclas se conservan.
- [Fase 5 · 5-0b-B] **P-5-0B-12.** ¿La clienta puede borrar su cuenta sola? El wireframe de `/perfil`
  dibuja «Pedir que borren mi cuenta», no un borrado inmediato. **Supuesto tomado:** solicitud, no
  borrado automático: hay invitaciones publicadas e invitados con enlaces vivos detrás, y un borrado
  en caliente los tumbaría sin avisar a nadie. El borrado real lo ejecuta un administrador.
- [Fase 5 · 5-0b-B] **P-5-0B-13.** `lib/i18n.ts` es un solo objeto de 672 líneas y las cuatro sesiones
  necesitan añadirle texto. **Supuesto tomado:** se parte en `lib/i18n/` con un fichero por área y un
  barril que conserva el export `es_MX`, y la partición la hace la primera sesión en aterrizar, en un
  commit propio sin texto nuevo. Si el orquestador prefiere no moverlo, la alternativa es que cada
  sesión escriba su propio módulo y que él resuelva los conflictos a mano en cada merge.

---

# Parte C — Módulo `modules/product`: esqueleto del backend

*Agente 5-0c (Opus). Documento original: `_12c-modulo-product.md`. Encabezados descolgados un nivel al integrar.*


Autor: sub-agente **5-0c** (esqueleto del módulo backend nuevo) · Fecha: 2026-09-09 · Rama `claude/fase-5-cimientos-adenda-u150eq`.

Este documento describe el **andamio** que la fase 5 usa como territorio del backend. No hay lógica de negocio: cuatro rutas de salud, tres objetos de configuración tipada y cuatro pruebas. Todo lo demás lo escriben E2, E3, E4 y E5 dentro de su subpaquete.

---

### 1. Árbol del módulo y dueño de cada subpaquete

Un subpaquete por sesión. **Ninguna sesión escribe fuera del suyo**, y los tres ficheros de la raíz del módulo quedan congelados por 5-0c para que ninguna de las cuatro tenga que abrirlos.

```
src/main/kotlin/mx/evolutiondev/invitaciones/modules/product/
├── ProductHealthResponse.kt      CONGELADO (5-0c) · cuerpo de las 4 rutas de salud: {module, status}
├── ProductPropertiesConfig.kt    CONGELADO (5-0c) · @EnableConfigurationProperties de las 3 clases
├── account/                      ← sesión E3 (cuenta, marca, legal)
│   ├── AccountHealthController.kt      GET /product/account/health
│   ├── ProductMailProperties.kt        producto.correo.*   (remitente de marca)
│   └── ProductContactProperties.kt     producto.contacto.* (correo, WhatsApp, soporte)
├── guests/                       ← sesión E2 (invitados, RSVP, compartir)
│   └── GuestsHealthController.kt       GET /product/guests/health
├── payments/                     ← sesión E4 (pagos con Stripe, planes)
│   ├── PaymentsHealthController.kt     GET /product/payments/health
│   └── ProductPaymentsProperties.kt    producto.pagos.stripe.*
└── admin/                        ← sesión E5 (administración del producto nuevo)
    └── ProductAdminHealthController.kt GET /product/admin/health

src/test/kotlin/mx/evolutiondev/invitaciones/modules/product/
├── account/AccountHealthControllerTest.kt         3 pruebas
├── guests/GuestsHealthControllerTest.kt           3 pruebas
├── payments/PaymentsHealthControllerTest.kt       3 pruebas
└── admin/ProductAdminHealthControllerTest.kt      3 pruebas
```

`ProductMailProperties` y `ProductContactProperties` viven en `account/` porque su dueña es E3, pero **E2 las inyecta tal cual** para los correos de invitados: inyectar no es escribir y no genera conflicto de fusión.

La clase del subpaquete `admin` se llama `ProductAdminHealthController`, no `AdminHealthController`, para que buscar por nombre no confunda el módulo nuevo con `modules/admin`, que es el administrativo viejo y sigue en pie hasta la fase 7.

#### 1.1 Las cuatro rutas

| Ruta | Roles | Cuerpo |
|---|---|---|
| `GET /product/account/health`  | `USER`, `ADMIN`, `MASTER` | `{"module":"product.account","status":"ok"}` |
| `GET /product/guests/health`   | `USER`, `ADMIN`, `MASTER` | `{"module":"product.guests","status":"ok"}` |
| `GET /product/payments/health` | `USER`, `ADMIN`, `MASTER` | `{"module":"product.payments","status":"ok"}` |
| `GET /product/admin/health`    | `ADMIN`, `MASTER`         | `{"module":"product.admin","status":"ok"}` |

---

### 2. La decisión de seguridad, con la evidencia

**Las cuatro rutas son autenticadas, no públicas**, y no revelan nada más que el nombre del subpaquete y `ok`.

La configuración se leyó antes de decidir, en `src/main/kotlin/mx/evolutiondev/invitaciones/core/auth/security/SecurityConfig.kt:36-47`:

```
SecurityConfig.kt:37   /auth/**                        permitAll()
SecurityConfig.kt:38   /public/**                      permitAll()
SecurityConfig.kt:39   /error                          permitAll()
SecurityConfig.kt:40   /admin/dashboard                hasAnyRole ADMIN, MASTER, USER
SecurityConfig.kt:41   /admin/administrators/users/**  hasRole MASTER
SecurityConfig.kt:42   /admin/**                       hasAnyRole ADMIN, MASTER
SecurityConfig.kt:43   /user/**                        hasAnyRole USER, ADMIN, MASTER
SecurityConfig.kt:44   /master/**                      hasRole MASTER
SecurityConfig.kt:45   /api/whatsapp/**                hasAnyRole ADMIN, MASTER, USER
SecurityConfig.kt:46   /webhook                        permitAll()
SecurityConfig.kt:47   anyRequest()                    authenticated()
```

Consecuencias verificadas del prefijo `/product/`:

1. **No casa con ninguna regla**, así que cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`). La ruta **nace cerrada**: no hace falta tocar el núcleo, que está fuera del territorio de 5-0c. Es la misma situación en la que quedó `/editor/` en la fase 2 (`CatalogController.kt:16-20`).
2. **`/product/admin/health` NO hereda la regla de `/admin/**`** (`SecurityConfig.kt:42`): `requestMatchers("/admin/**")` casa por prefijo de ruta, y `/product/admin/health` no empieza por `/admin/`. Sin una anotación, una clienta con rol `USER` habría podido llamar a una ruta administrativa. Por eso ese controlador lleva `@PreAuthorize("hasAnyRole('ADMIN','MASTER')")`, la misma pareja de roles que el `/admin/**` del núcleo.
3. **`@PreAuthorize` de clase en los cuatro** como defensa en profundidad, posible porque `@EnableMethodSecurity` está activo (`SecurityConfig.kt:17`). Es el patrón que ADR-1R-B-10 fijó para `/editor/` y que `CatalogController.kt:22-25` implementa: si mañana alguien añadiera una regla que abriese `/product/**`, la anotación seguiría siendo la barrera. Cada prueba comprueba la anotación, porque una anotación borrada en un refactor no rompe ninguna prueba funcional.
4. **Cuerpo mudo a propósito.** Dos campos y nada más — sin versión, sin `commit`, sin estado de la base ni nombres de bean —, y hay una prueba por subpaquete que afirma que el JSON tiene **exactamente dos** claves. Una sonda que enumera dependencias es un mapa del sistema regalado a quien la consulte.
5. **Aviso escrito para E4**: el webhook de Stripe llega **sin** token de la aplicación y por tanto **no puede** colgar de `/product/payments/`, donde recibiría `401`. Los dos caminos legítimos —colgarlo de `/public/` + `**` verificando la firma `Stripe-Signature` con `producto.pagos.stripe.secreto-webhook`, o registrar una ADR para añadir una regla a `SecurityConfig`— quedan en el KDoc de `PaymentsHealthController.kt`.

---

### 3. Convenciones copiadas, con `fichero:línea`

Nada de esto se inventó: todo sale de código que ya está en el repositorio.

| Convención | De dónde | Cómo se aplicó |
|---|---|---|
| Paquete `mx.evolutiondev.invitaciones.modules.<módulo>.<subpaquete>` y escaneo automático desde `@SpringBootApplication` | `InvitationsApplication.kt:6-7` (raíz `mx.evolutiondev.invitaciones`) | `modules.product.*` se escanea sin registrar nada |
| `@RestController` + `@RequestMapping` de clase con el prefijo, `@GetMapping` con el resto de la ruta | `CatalogController.kt:22-23`, `DashboardController.kt:12-13` | `@RequestMapping("/product/account")` + `@GetMapping("/health")` |
| Tipo de retorno **directo** (no `ResponseEntity`) cuando siempre se responde `200` | `CatalogController.kt:42` (devuelve `CatalogResponse`) | `fun health(): ProductHealthResponse` |
| `@PreAuthorize` de clase como defensa en profundidad, con el KDoc que cita la línea de `SecurityConfig` | `CatalogController.kt:16-25`, `MasterTemplateRegistryController.kt:22-36` | Los cuatro controladores |
| **No** capturar errores en el controlador; excepciones tipadas y advice | `MasterTemplateRegistryController.kt:30-33`, `Templates2ExceptionHandler.kt:55` | No aplica todavía: las sondas no fallan. El advice de `templates2` está acotado con `basePackages = […templates2.api]` y **no alcanza** a `modules.product`; cuando E2–E5 necesiten errores tipados tendrán que declarar su propio advice acotado o caer en `GeneralExceptionHandler` |
| `data class` para el cuerpo de respuesta, en su propio fichero | `Templates2CatalogDtos.kt`, `MailerSendEmailStrategy.kt:20-29` | `ProductHealthResponse.kt` |
| `companion object` con las constantes del contrato | `CatalogController.kt:60-63` | `SUBPAQUETE`, `ESTADO_OK`, `MONEDA_POR_DEFECTO`, `NOMBRE_POR_DEFECTO` |
| Nombres de clase en **inglés**, comentarios y KDoc en **español de México** | Todo el repositorio (`CatalogController`, `DashboardController`, `MailerSendProperties`) | Igual |
| `@ConfigurationProperties(prefix=…)` sobre `data class` con valores por defecto + `@EnableConfigurationProperties` | `MailerSendEmailStrategy.kt:31-35` y `:40` | Las tres clases de propiedades, registradas en `ProductPropertiesConfig.kt` |
| Placeholder `${VAR:}` en `application.yml`, con comentario que explica qué significa el valor vacío | `application.yml`, bloque `templates2.assets` y `templates2.revalidate` | El bloque `producto:` |
| Pruebas de controlador con `MockMvcBuilders.standaloneSetup(...)`, sin contexto de Spring ni base de datos | `CatalogControllerTest.kt:28-32` | Las cuatro pruebas |
| Prueba que afirma el `@PreAuthorize` leyendo la anotación con `AnnotatedElementUtils` | `Templates2AnotacionesSeguridadTest.kt:24-40` | Tercer caso de cada una de las cuatro pruebas |
| Nombres de prueba en español entre acentos graves | `CatalogControllerTest.kt:35`, `:51` | Igual |

**Trampa encontrada y evitada** (queda escrita para quien venga detrás): en Kotlin los comentarios de bloque **anidan**, así que escribir `` `/product/**` `` dentro de un KDoc abre un comentario nuevo y el compilador falla con `Unclosed comment`. Por eso en todo el módulo se escribe `` `/product/` + `**` ``, que es exactamente la forma que ya usaban `CatalogController.kt:17` y `MasterTemplateRegistryController.kt:23`.

---

### 4. Variables de entorno añadidas

Bloque `producto:` **añadido al final** de `src/main/resources/application.yml` (26 líneas, cero modificaciones a lo existente: `git diff` da 26 inserciones y 0 borrados). `FRONTEND_URL` **no se toca**: ya existe como `app.frontend.url` y se reutiliza tal cual.

| Variable | Propiedad Spring | Quién la lee | ¿Obligatoria? | Qué pasa si falta |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | `producto.pagos.stripe.clave-secreta` | E4 (`ProductPaymentsProperties`) | Sí en producción, no en desarrollo | Vacía. `ProductPaymentsProperties.configurado` es `false` = **pagos desactivados**. E4 decide si falla al arrancar o degrada la compra; lo que **no** puede hacer es cobrar contra una clave adivinada |
| `STRIPE_WEBHOOK_SECRET` | `producto.pagos.stripe.secreto-webhook` | E4 | Sí si hay webhook | Vacío: no se puede verificar la firma `Stripe-Signature`, así que la ruta del webhook **no debe** aceptar nada |
| `STRIPE_MONEDA` | `producto.pagos.stripe.moneda` | E4 | No | Vale `MXN`. El producto vende en México (ADR-DUENO-02); es un valor de negocio, no un secreto |
| `MAIL_FROM` | `producto.correo.remitente` | E3, y E2 para los correos de invitados | Sí en producción | Vacío = **sin remitente**: no se manda correo con una dirección inventada |
| `MAIL_FROM_NOMBRE` | `producto.correo.remitente-nombre` | E3, E2 | No | Vale `Lino & Sello`. Entrecomillado en el YAML: aunque `&` a mitad de escalar no es ancla, la cadena empieza por `$` y el entrecomillado quita toda duda |
| `MAIL_RESPONDER_A` | `producto.correo.responder-a` | E3, E2 | No | Vacío: no se pone `Reply-To`. Previsto `hola@linoysello.com` (ADR-DUENO-02) |
| `CONTACTO_CORREO` | `producto.contacto.correo` | E3 | No | Vacío = **no se pinta ese contacto**. Un pie sin correo es aceptable; uno con un correo de ejemplo, no |
| `CONTACTO_WHATSAPP` | `producto.contacto.whatsapp` | E3 | No | Vacío: no se pinta el enlace `wa.me`. Es **solo click-to-chat**, sin API de WhatsApp Business (ADR-DUENO-02) |
| `SOPORTE_CORREO` | `producto.contacto.soporte` | E3 | No | Vacío: no se pinta. Previsto `soporte@linoysello.com` |

Regla común: **ningún secreto se escribe en el YAML ni se registra en un log**, y **vacío significa función desactivada**, nunca "usa el valor de siempre". Es la misma disciplina de `templates2.assets.bucket` (ADR-2-ORQ-03), suavizada en un punto: allí la ausencia impide arrancar porque el único defecto natural era el bucket de producción; aquí no hay ningún defecto peligroso, así que la aplicación arranca con pagos y correo desactivados y es cada sesión la que decide su compuerta.

---

### 5. ADR-5-0C-01

### ADR-5-0C-01 — Módulo nuevo `modules/product` con cuatro subpaquetes disjuntos, en vez de extender `modules/templates2`
- Fecha: 2026-09-09 · Estado: propuesta · Autor: 5-0c (esqueleto del módulo backend de la fase 5)
- Contexto: la fase 5 la escriben **cuatro sesiones en paralelo** (E2 invitados/RSVP/compartir, E3 cuenta/marca/legal, E4 pagos, E5 admin) sobre un backend que ya tiene un módulo nuevo (`modules/templates2`, fases 1–3) y un montón de módulos viejos. ADR-DUENO-02 levantó la prohibición sobre `auth`, `guests`, `admin` y pagos para construir el producto completo; ADR-DUENO-01 fijó que no hay migración y que el módulo antiguo se retira en la fase de cierre. La pregunta abierta era **dónde** escribe ese código nuevo. Evidencia de lo que `templates2` es hoy, leída en el árbol: sus siete subpaquetes son `api`, `catalog`, `composition`, `domain`, `migration`, `persistence` y `schema`, y su superficie HTTP está **cerrada por una prueba de inventario** — `Templates2RouteInventoryTest.kt:19-46` afirma «las 20 rutas de `03 §2`, ninguna más y ninguna menos», con el argumento explícito de que «una ruta añadida sin contrato es superficie de ataque que nadie revisó». Además, `contratos.md §4` prohíbe `require`/`check`/`error()` en **todo** el código de producción de `templates2`, y `NoRequileOrCheckArchitectureTest` lo comprueba recorriendo el árbol de fuentes del módulo. Es decir: `templates2` no es una carpeta, es un módulo con contratos y compuertas propias.
- Decisión: se crea `modules/product` con cuatro subpaquetes **disjuntos** —`account`, `guests`, `payments`, `admin`—, uno por sesión, más tres ficheros congelados en la raíz (`ProductHealthResponse.kt`, `ProductPropertiesConfig.kt`) que 5-0c entrega cerrados. Cada subpaquete estrena con un controlador de salud bajo `/product/<subpaquete>/health`, autenticado, con cuerpo mudo y una prueba que lo ejerce y afirma su `@PreAuthorize`. Las propiedades de entorno se exponen como tres `@ConfigurationProperties` tipadas para que **nadie tenga que reabrir `application.yml`**. Y se fija por escrito la regla de territorio: **`modules/user/invitations`, `modules/master/templates` y `MongoDataInitializer` siguen prohibidos para toda la fase 5; se retiran en la fase 7** (ADR-DUENO-01). Ninguna sesión de la fase 5 los lee, los edita ni depende de ellos.
- Alternativas descartadas y por qué:
  - **(a) Extender `modules/templates2` con subpaquetes nuevos.** `templates2` es el módulo de **plantillas e invitaciones-como-documento**: esquema (`schema`), composición (`composition`), catálogo y registro de paquetes (`catalog`), publicación y render público (`api`). Cuenta, invitados, pagos y administración son **otro dominio**: hablan de personas, dinero y permisos, no de documentos. Meterlos ahí obliga además a romper dos compuertas vivas: `Templates2RouteInventoryTest` tendría que pasar de 20 rutas a 20 + N y dejaría de significar «la superficie que el contrato revisó», y la prohibición de `require`/`check`/`error()` de `contratos.md §4` se extendería a código de pagos que no la ha acordado. La fase 7 quiere dejar una superficie limpia y auditable; mezclar los dos dominios en un módulo la ensucia justo antes de la limpieza.
  - **(b) Un módulo nuevo por sesión (`modules/account`, `modules/guests`, `modules/payments`, `modules/admin2`).** Da el mismo aislamiento, pero cuatro módulos hermanos sin techo común no comparten ni la configuración ni el prefijo de ruta, y `modules/admin2` junto a `modules/admin` es un nombre que nadie querrá explicar en la fase 7. Un solo módulo con cuatro subpaquetes da el mismo aislamiento **y** un sitio natural para lo compartido.
  - **(c) Repartir el código nuevo por los módulos viejos** (`modules/user/invitations` para invitados, `modules/admin` para administración). Choca de frente con ADR-DUENO-01: esos módulos se retiran; todo lo que se escriba ahí hay que volver a mudarlo o se pierde. Y `modules/user/invitations`, `modules/master/templates` y `MongoDataInitializer` están prohibidos por decisión del dueño.
  - **(d) Sin subpaquetes: `modules/product` plano.** Cuatro sesiones en paralelo sobre un mismo paquete es conflicto de fusión garantizado en cada fichero de configuración, de rutas y de pruebas. Los subpaquetes disjuntos son precisamente el mecanismo que hace que las cuatro puedan escribir a la vez.
  - **(e) Rutas de salud públicas.** Se descartó: aunque el cuerpo sea mudo, una ruta pública confirma qué módulos existen y a quién puede escanearlos le sirve. `anyRequest().authenticated()` (`SecurityConfig.kt:47`) ya las cierra sin tocar el núcleo, así que abrirlas habría sido trabajo extra para tener menos.
- Consecuencias:
  - Cada sesión tiene un territorio con frontera comprobable: `git diff --stat` debe caer entero dentro de su subpaquete. Los tres ficheros de la raíz están congelados y, si alguien necesita registrar una clase de propiedades nueva, es un cambio de una línea en `ProductPropertiesConfig.kt` que hay que anunciar al orquestador.
  - El `@RestControllerAdvice` de `templates2` está acotado con `basePackages = ["…modules.templates2.api"]` (`Templates2ExceptionHandler.kt:55`) y **no alcanza** a `modules.product`: hoy los errores del módulo nuevo saldrían por `GeneralExceptionHandler`, sin `code` tipado. Quien necesite errores tipados en la fase 5 tendrá que declarar su propio advice acotado a su subpaquete, y eso merece su propia ADR.
  - `templates2` conserva intactas sus dos compuertas (inventario de 20 rutas y prohibición de `require`/`check`), porque el código nuevo no entra en su árbol.
  - La retirada de la fase 7 queda acotada: `modules/user/invitations`, `modules/master/templates`, `modules/master/*`, `MongoDataInitializer` y `modules/admin` se borran sin que nada de `modules/product` ni de `modules/templates2` dependa de ellos. Verificable por búsqueda: ningún fichero de `modules/product` los importa.
  - Coste asumido: durante la fase 5 conviven un módulo administrativo viejo (`modules/admin`) y uno nuevo (`modules/product/admin`). Se mitiga con el nombre `ProductAdminHealthController` y con esta ADR; se resuelve en la fase 7.

---

# Parte D — Puntos de enganche del frontend

*Agente 5-0d (Opus), completado por el orquestador de E1. Documento original: `_12d-enganches-frontend.md`.*


## D1. Qué se creó

```
frontend/apps/web/
├── lib/panel/
│   ├── tipos.ts              contrato de una entrada de navegación      NO SE TOCA
│   ├── nav.ts                compositor determinista                    NO SE TOCA
│   ├── nav.invitados.ts      entrada «Invitados»                        E2
│   ├── nav.compartir.ts      entrada «Compartir» (solo si publicada)    E2
│   ├── nav.plan.ts           entrada «Plan»                             E4
│   ├── nav.test.ts           orden, ids únicos, href, etiqueta, icono
│   ├── Marcador.tsx          la pantalla «en construcción» compartida
│   └── Marcador.test.tsx
├── lib/env.ts                catálogo de variables del frontend
├── lib/env.test.ts
└── app/
    ├── (chrome)/editor/[invitationId]/invitados/   page.tsx + README    E2
    ├── (chrome)/editor/[invitationId]/plan/        page.tsx + README    E4
    ├── (chrome)/admin/                             page.tsx + README    E5
    ├── (chrome)/perfil/                            page.tsx + README    E3
    ├── (chrome)/(sitio)/precios/                   page.tsx + README    E4
    ├── (chrome)/(sitio)/pago/                      page.tsx + README    E4
    ├── (chrome)/(sitio)/contacto/                  page.tsx + README    E3
    ├── (chrome)/(sitio)/legal/                     page.tsx + README    E3
    └── (public)/r/[token]/  page.tsx + textos.ts + pagina.module.css + README   E2
```

## D2. Tabla ruta × sesión dueña × grupo de ruta

| Ruta | Sesión | Grupo | Por qué ese grupo | `noindex` |
|---|---|---|---|---|
| `/editor/[invitationId]/invitados` | E2 | `(chrome)` | cuelga del editor, que ya vive ahí | temporal |
| `/editor/[invitationId]/plan` | E4 | `(chrome)` | ídem | temporal |
| `/r/[token]` | E2 | `(public)` | la ve un invitado, sin sesión y sin chrome | **permanente** |
| `/precios` | E4 | `(chrome)/(sitio)` | página de venta, con cabecera y pie | temporal |
| `/pago` | E4 | `(chrome)/(sitio)` | vuelta de Checkout, dentro del sitio | **permanente** |
| `/admin` | E5 | `(chrome)` | consola del equipo, no web de venta | **permanente** |
| `/perfil` | E3 | `(chrome)` | producto detrás de sesión | **permanente** |
| `/contacto` | E3 | `(chrome)/(sitio)` | página pública de venta | temporal |
| `/legal` | E3 | `(chrome)/(sitio)` | página pública | temporal |

«Temporal» quiere decir que el marcador lleva `noindex` **solo mientras sea marcador**: la sesión
dueña lo quita al poner la pantalla real, porque son páginas que deben indexarse. «Permanente»
quiere decir que la línea se queda.

El grupo decide también el `contenedor` del marcador: las rutas de `(sitio)` pasan `contenedor="div"`
porque `MarcoSitio` ya envuelve el contenido en `<main id="contenido">`, y dos `<main>` en el mismo
documento son una violación de axe (`landmark-no-duplicate-main`). Las de `(chrome)` usan el `main`
por defecto.

## D3. Cómo añade una entrada de navegación una sesión

1. Edita **solo** tu `lib/panel/nav.<area>.ts`.
2. Declara la entrada con el tipo `EntradaDeNavegacion` de `tipos.ts`: `id` único, `etiqueta` como
   **clave** de `es_MX.panel.nav` (nunca un literal), `href` como función de `invitationId`, `icono`
   por nombre, `orden` en múltiplos de 10, y `visible(estado)`.
3. Si tu icono no está en la unión `NombreDeIcono`, añádelo ahí. `nav.test.ts` comprueba contra el
   paquete real que el nombre existe, así que un icono inventado rompe la suite.
4. Si tu etiqueta no está en `es_MX.panel.nav`, añádela. El tipo te obliga.
5. **No toques `nav.ts` ni `tipos.ts`** salvo el punto 3. Un área nueva que hoy no existe es lo único
   que obliga a tocar `nav.ts`, y entonces lo hace el orquestador al integrar.

El orden es por `orden` y, en empate, por `id` alfabético con configuración regional fijada: nunca
por orden de importación, para que mover un `import` no pueda cambiar la barra que ve la clienta.

## D4. Catálogo de variables de entorno del frontend

| Variable | Estado | Para qué | Si falta |
|---|---|---|---|
| `NEXT_PUBLIC_CONTACTO_WHATSAPP` | ya existía | número E.164 del WhatsApp de contacto | la interfaz dice honestamente que el contacto se publicará; nunca un botón muerto |
| `NEXT_PUBLIC_CONTACTO_CORREO` | ya existía | correo de contacto y ventas | ídem |
| `NEXT_PUBLIC_SITE_URL` | ya existía | origen absoluto del sitio: enlaces que se comparten, `metadataBase`, `og:image` | se cae al origen local con aviso (`app/(public)/layout.tsx:32`) |
| `NEXT_PUBLIC_E2E_HOOKS` | ya existía | expone el store del editor para Playwright; se hornea en el build | los e2e del editor fallan; en producción no se define |
| `NEXT_PUBLIC_SOPORTE_CORREO` | **nueva** | correo de soporte en `/ayuda` | la ayuda cae al correo de contacto |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **nueva** | clave publicable de Stripe para el cliente | `/precios` no puede abrir Checkout y lo dice; no se simula una compra |

**Se reutiliza `NEXT_PUBLIC_SITE_URL` y no se inventa una segunda variable de origen.** Dos variables
para lo mismo darían enlaces compartidos distintos según qué código los construyera, que es
exactamente el defecto que cerró N-02 (`ADR-3C-N02-01`). `lib/env.ts` es el **catálogo**: documenta
y valida, pero la fuente de cada dato sigue donde ya estaba (`lib/contacto.ts` para los dos de
contacto, `lib/enlace-publico.ts` para el origen). No duplica lógica de resolución.

La clave **secreta** de Stripe (`STRIPE_SECRET_KEY`) y el secreto del webhook
(`STRIPE_WEBHOOK_SECRET`) **no aparecen aquí y no pueden aparecer nunca**: son del backend. Una
variable `NEXT_PUBLIC_*` viaja al navegador de cualquiera que abra la página.

## D5. Decisiones tomadas y por qué

- **`lib/panel/` y no `components/`**: la fase 5 reparte `components/**` entre las cuatro sesiones;
  el andamio no puede aterrizar en un directorio que otra sesión esté editando.
- **`Marcador` es Server Component y no importa el barril `@invitaciones/ui`**: el barril reexporta
  25 componentes, la mitad con Radix dentro, y metería todo ese lado cliente en el JS de rutas que
  solo enseñan un título y un párrafo (medido en 3C-5: 92,3 → 8,9 KB gz en la portada).
- **`/r/[token]` no usa `Marcador` ni `lib/i18n.ts`**: vive en `(public)`, que no carga Tailwind, y
  `es_MX` es un solo objeto que arrastra el chrome entero. Textos propios en `textos.ts` y CSS module
  propio, igual que la ruta hermana `/i/[publicToken]`.
- **Ningún marcador llama al backend ni finge datos.** El de `/admin` no insinúa que haya
  información detrás; el de `/r/[token]` es deliberadamente ciego y responde lo mismo para un token
  válido, uno caducado y uno inventado, para no ser ya un oráculo de enumeración.
- **`robots.ts` y `sitemap.ts` no se crearon**: no existen hoy en el proyecto y son trabajo de E3.
  Mientras, la defensa de `/r/**` son las tres capas de `noindex` (layout de `(public)`, `metadata`
  de la página, `X-Robots-Tag` de `next.config.ts`).

## D6. Medido

`pnpm -r typecheck` 6/6 paquetes · `pnpm --filter web test` **598 pasan** (566 antes de este
andamio: +32) · `pnpm --filter web run build` lista las nueve rutas nuevas · `./gradlew test --tests
'*product*'` **12/12**.

Sigue rojo `components/sitio/portada.test.tsx`, **preexistente y ajeno**: lo rompió la integración de
la imagen de portada (`bfdcbaa`), que llegó sin pruebas ejecutadas. Comprobado con `git stash`: falla
igual sin ninguno de estos cambios.
