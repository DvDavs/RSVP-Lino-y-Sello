# 0-inventario — inventario del repositorio (fase 0)

VERIFICADO salvo donde se marque INFERIDO/NO DETERMINABLE. Repo: `/home/user/RSVP---Lino-Sello`, rama `claude/agent-network-invitation-41nx5y`.

## 1. Árbol de módulos backend (`src/main/kotlin/mx/evolutiondev/invitaciones/`)

| Módulo | Qué es | Trato del módulo nuevo |
|---|---|---|
| `core/auth/**` | JWT, `SecurityConfig`, `CustomerEntity`/`Role`, `HierarchyValidationService` | **Integrar (solo lectura)**: usar `Authentication`/`JwtTokenFilter` para userId; `HierarchyValidationService.validateInvitationAccess` como referencia de autorización |
| `core/error/**` | `GeneralExceptionHandler` (`@RestControllerAdvice`), `ErrorMessage`, excepciones tipadas | **Integrar**: registrar `@ExceptionHandler` propios ahí o en un advice paralelo; no romper los existentes |
| `core/s3/**` | Cliente S3 (`S3Client`/`S3Presigner`), buckets, generación de keys | **Integrar (reusar)**: `S3Service`, `S3KeyService`, `S3Buckets` |
| `core/data/MongoDataInitializer.kt` | Seeder de plantillas/legacy en Mongo (`CommandLineRunner`) | **No tocar**; es del módulo antiguo (ver sección 2 del prompt) |
| `core/hibernate/**` | Filtro Hibernate `enabledFilter` (soft delete) vía `@Filter`, aspecto que lo activa por request | **Integrar (leer)**: entidades relevantes usan `@SQLDelete` + `@Filter("enabledFilter")` |
| `core/email/**`, `core/util/**`, `core/validation/**`, `core/model/**` | Envío de correo, formatters, validadores Bean Validation | No tocar; usar utilidades si aplica (ninguna dependencia obligatoria) |
| `modules/admin/**` (dashboard, guests, invitations, users) | Panel de administración: CRUD de invitaciones, gestión de invitados, dashboard | **No tocar** (fuera de alcance explícito, prompt §1). `InvitationAdminService.updateInvitation` es la ruta que hoy desincroniza Mongo (H-04/H-05) |
| `modules/all/**` (invitations, templates) | Endpoints **públicos** sin auth: catálogo, RSVP del invitado | **Integrar (consumir/extender)**: es el "enlace público" — ver sección 2 |
| `modules/auth/**` | Login/registro, `AuthController` | No tocar |
| `modules/master/**` (dresscodes, eventtypes, extramodules, giftmessages, guests, phrases, plans, profile, songs, **templates**) | Catálogos maestros por rol MASTER; `master/templates` es el alta de plantillas **actual** (a sustituir) | `master/templates/**` es código de referencia de "lo que hay que sustituir" (prompt §2), no se toca ni se reutiliza tal cual; los demás catálogos (dresscodes, songs, giftmessages, plans, eventtypes) son **datos de negocio, solo lectura** para el módulo nuevo |
| `modules/profile/avatar/**` | Fotos de perfil de usuario | No tocar |
| `modules/public/profile/**` | Perfil público mínimo | No tocar |
| `modules/shared/guests/**` | `InvitationGuestEntity`, `InvitationGuestsRepository`, notificador (email/WhatsApp) | **Integrar (solo lectura)**: leer invitados/RSVP para el render público; no escribir |
| `modules/shared/invitations/**` | `InvitationPersistenceHelper` (helpers de subcomponentes), `InvitationValidationService` | **Integrar (solo lectura)** salvo que una ADR de fase 2 diga lo contrario |
| `modules/shared/whatsapp/**` | Envío WhatsApp | No tocar |
| `modules/user/invitations/**` | El módulo **actual** a sustituir: `DefaultConfigGeneratorService` (2743 líneas), `InvitationConfigService`, `EditorModels.kt`, endpoints `/user/invitations/**` | **No tocar el código**; es la referencia de sustitución (prompt §2). El módulo nuevo vive en un paquete propio, p. ej. `modules/templates2` (a fijar por ADR fase 1) |
| `modules/user/profile/**` | Perfil de usuario autenticado | No tocar |
| `modules/user/template/**` | `GET`/`PUT /user/template/{invitationId}` — **son *stubs*** que no persisten nada (H-46) | No tocar; el nuevo editor sustituye esta ruta por completo |

## 2. Puntos de integración obligatorios

**Entidad invitación (Postgres, tabla `invitation`).** `InvitationEntity` — `src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/invitations/repository/model/InvitationEntity.kt:14-60`. Columnas clave: `id` (PK identity), `template_id` FK→`invitation_template.id` (`@ManyToOne nullable=false`, EAGER), `customer_id` FK→`core/auth/model/CustomerEntity` (EAGER), `date`/`time` (String, sin formatear), `children_allowed`, `young_allowed`, `hashtag`, `cover_photo_url`, `is_enabled` (soft delete vía `@SQLDelete`+`@Filter("enabledFilter")`), `is_paid`, `total_amount`, auditoría (`created_by`/`updated_by`/`deleted_by`). El "usuario" es `CustomerEntity`; la propiedad de una invitación se resuelve por `invitation.customer.id == requesterId` o jerarquía de roles vía `HierarchyValidationService.validateInvitationAccess` (`core/auth/service/HierarchyValidationService.kt:41-55`).

**Invitados/RSVP (solo lectura).** `InvitationGuestEntity` — `modules/shared/guests/repository/model/InvitationGuestEntity.kt:16-60+`: `invitation_id` FK, `full_name`, `email`, `phone`, contadores `adults_count`/`children_count`/`young_count` y sus `*_confirmed`, `confirmation_token`, `cancellation_token`, `attendance_status` (enum). Repositorio `InvitationGuestsRepository` (`modules/shared/guests/repository/InvitationGuestsRepository.kt:15-47`) expone `findByInvitationIdAndIsEnabledTrue`, `findByConfirmationToken`, etc. El módulo nuevo **lee** de aquí para el render público; no escribe.

**Enlace público (`modules/all/**`).** `PublicGuestInfoController` — `GET /public/invitation/guest-info/{token}` (`modules/all/invitations/presentation/PublicGuestInfoController.kt:52-60+`) resuelve un invitado por `confirmationToken` vía `InvitationGuestsRepository.findByConfirmationToken`, y de ahí obtiene `invitation` (y por tanto `template_id`) directamente de PostgreSQL — **no lee Mongo**. `PublicInvitationInfoController` (`.../PublicInvitationInfoController.kt:21-31`) sirve catálogos públicos (dress code, event-type, plan, gift-registry, music) por `eventId`/`planId`, sin auth. `PublicInvitationTemplateController` (`modules/all/templates/presentation/`) es el equivalente para plantillas. **No hay hoy una ruta pública que sirva el documento renderizable de la invitación (el `InvitationConfig`) — solo datos de invitado y catálogos**; el render público del nuevo módulo es una ruta nueva.

**S3 / almacenamiento de imágenes.** Sí existe cliente: `core/s3/S3Service.kt` (`uploadFile`/`uploadPublicFile`/`deleteFile`/presigned URLs, AWS SDK v2), `S3KeyService.kt` (construye keys `user/{userId}/invitation/{invitationId}/{sectionPath}/{uuid}.{ext}`), `S3Buckets.kt` (`EDITOR="invitacionesdigitaleseditor"`, `ASSETS="invitacionesdigitalesassets"`), `S3ClientConfig.kt` (credenciales `aws.credentials.access-key/secret-key` en texto plano en `application.yml:9-13`, H-48). El editor actual sube fotos vía `InvitationAssetsController`/`AssetUploadResponse` (`modules/user/invitations/presentation/InvitationAssetsController.kt`) reusando este `S3Service`. **Reusar tal cual** para el módulo nuevo.

**Autenticación (`core/auth/**`).** JWT propio (`core/auth/jwt/JwtUtil.kt`, secreto en `application.yml:8`, también texto plano). `JwtTokenFilter` (`core/auth/security/JwtTokenFilter.kt:31-70`) valida el bearer token, carga `CustomerEntity` y puebla `SecurityContextHolder` con `UsernamePasswordAuthenticationToken`. Los controladores reciben `org.springframework.security.core.Authentication authentication` como parámetro (p. ej. `InvitationConfigController.kt:29,47`) y de ahí el `userId`. Propiedad de invitación: `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)` (`core/auth/service/HierarchyValidationService.kt:41-55`) — MASTER siempre; ADMIN si `invitation.customer.createdBy == requesterId` (INFERIDO por patrón de `validateUserAccess`); USER solo si `invitation.customer.id == requesterId`. **Reusar este servicio** para la autorización del editor nuevo (P8).

**Manejo de errores global.** `core/error/GeneralExceptionHandler.kt` (`@RestControllerAdvice`), mapea `UnauthorizedException`→401, `IllegalArgumentException`→400, `ConstraintViolationException`→400, etc. **No** tiene handler para `IllegalStateException` (H-14: cae al 500 genérico de Spring). El módulo nuevo debe añadir sus propias excepciones tipadas con handlers explícitos en este mismo archivo o uno paralelo, sin quitar los existentes.

**ObjectMapper.** **No hay un `@Bean ObjectMapper` global configurado** (verificado: `grep` sin resultados de `Jackson2ObjectMapperBuilder`/`@Bean` sobre `ObjectMapper` en `src/main/kotlin`). Hay dos usos ad hoc con reglas distintas (H-35): `core/data/MongoDataInitializer.kt:27` usa `jacksonObjectMapper()` (Jackson Kotlin module, falla en `FAIL_ON_UNKNOWN_PROPERTIES` por defecto) y `modules/master/templates/service/MasterTemplatesService.kt:32` recibe un `ObjectMapper` inyectado por Spring Boot autoconfig (`FAIL_ON_UNKNOWN_PROPERTIES=false` por defecto de Spring). El módulo nuevo debe declarar **su propio** `ObjectMapper`/config de (de)serialización explícita para el esquema de plantilla (P1), sin depender de ninguno de los dos existentes.

## 3. Versiones exactas

| Pieza | Versión | Evidencia |
|---|---|---|
| Kotlin | 1.9.25 | `build.gradle.kts:4-5` |
| Spring Boot | 3.4.1 | `build.gradle.kts:6` |
| Java target | 17 (toolchain) | `build.gradle.kts:19-22`, `:117-123` |
| Gradle wrapper | 8.11.1 | `gradle/wrapper/gradle-wrapper.properties` |
| Flyway (plugin CLI) | 10.12.0 | `build.gradle.kts:9` |
| Flyway (runtime) | 10.21.0 (`flyway-core`, `flyway-database-postgresql`) | `build.gradle.kts:51-52` |
| Driver Postgres | `org.postgresql:postgresql` sin versión fija (gestionada por Spring Boot BOM 3.4.1) | `build.gradle.kts:48` |
| Driver Mongo | `spring-boot-starter-data-mongodb` sin versión fija (BOM 3.4.1) | `build.gradle.kts:71` |
| AWS SDK S3 | 2.25.19 | `build.gradle.kts:64` |
| Dependencias de test declaradas | `spring-boot-starter-test`, `kotlin-test-junit5`, `spring-security-test`, `mockito-kotlin:5.1.0`, `junit-platform-launcher`, `h2` (runtime), `de.flapdoodle.embed.mongo:4.11.0` | `build.gradle.kts:79-85` |
| Última migración Flyway | `V28__add_whatsapp_sent_column.sql` (28 migraciones, V1–V28, sin huecos) | `src/main/resources/db/migration/` |

## 4. Infraestructura de desarrollo

- `docker-compose.yml`: `postgres-db` (postgres:13, puerto host 5501→5432, user/pass/db `evolution`/`evolution123`/`invitaciones`), `mongo-db` (mongo:6 standalone, sin replica set — confirma H-08, puerto 27017, user/pass `evolution`/`evolution123`), `spring-app` (build local, puerto 6003, credenciales de correo/WhatsApp de prueba embebidas en el propio compose). `docker-compose.dev.yml`: solo Postgres+Mongo, para correr Gradle en el host.
- `application.yml` (único perfil, no hay `application-*.yml` adicionales — verificado con `find`): puerto `6003`; JWT secret y credenciales AWS **en texto plano** (`:8-13`, H-48); Flyway `baseline-on-migrate: true`; JPA `ddl-auto: validate` (el esquema lo gobierna Flyway, no Hibernate); Mongo por `SPRING_DATA_MONGODB_URI` con default a `localhost:27017`.
- Arranque local: `docker compose -f docker-compose.dev.yml up` (bases) + `./gradlew bootRun`, o `docker compose up` (todo en contenedores). `flyway { url = jdbc:postgresql://localhost:5501/invitaciones, user/pass evolution/evolution123 }` en `build.gradle.kts:110-115` coincide con el compose de dev.
- **`./gradlew test` NO funciona en este entorno**: falla en la fase de configuración, no en las pruebas (no hay ninguna: `src/test` no existe). Motivo real, verificado: `build.gradle.kts:19-22` exige un toolchain Java 17, este entorno solo tiene JDK 21 instalado (`java -version` → OpenJDK 21.0.10) y `settings.gradle.kts` (una sola línea, sin plugin `org.gradle.toolchains.foojay-resolver-convention`) no permite a Gradle descargar un JDK 17. `--offline` falla antes, al no poder resolver el plugin `org.jetbrains.kotlin.jvm:1.9.25` desde el Plugin Portal (no está cacheado). Con red (sin `--offline`) los plugins sí resuelven, pero la configuración del proyecto falla por el toolchain. **Esto es un problema de entorno de esta sesión, no necesariamente de CI/producción** — pero cualquier sub-agente de fase 2 que necesite compilar/testear el backend debe resolverlo primero (instalar JDK 17, o añadir el plugin resolver de toolchains).

## 5. CI

No existe `.github/workflows` (`find .github` → no existe el directorio). **No hay CI configurado en el repositorio.** El prompt maestro (fase 2, "Terminado") exige agregarlo si no existe.

## 6. Tamaño de los archivos del módulo antiguo (prompt §2)

| Archivo | Líneas |
|---|---|
| `modules/user/invitations/service/DefaultConfigGeneratorService.kt` | 2743 |
| `modules/user/invitations/service/InvitationConfigService.kt` | 211 |
| `modules/user/invitations/service/ExtraModulesHandler.kt` (= `ExtraModuleHelper.kt`, único archivo con ese rol) | 26 |
| `modules/user/invitations/model/editor/EditorModels.kt` (`InvitationConfig` actual) | 494 |
| `modules/user/invitations/model/defaults/DefaultVisualConfig.kt` | 32 |
| `modules/user/invitations/model/defaults/DefaultContentConfig.kt` | 389 |
| `modules/master/templates/**` (alta de plantillas, 8 archivos) | 772 (total) |
| `core/data/MongoDataInitializer.kt` | 127 |
| `src/main/resources/data/mongo/*.json` (23 archivos: 8 visual + 7 content + 4 payload + otros) | 1.7 MB; el visual más grande `default_visual_boda_premium.json` = 4813 líneas, el payload más grande `payload-template-boda-3.json` = 5735 líneas |
| `dataBautizoPremium.ts` / `dataComunionPremium.ts` / `dataConfirmacionPremium.ts` (raíz del repo) | 2775 cada uno |
| `dataCumplePremium.ts` (raíz) | 3186 |
| `dataXVPremium.ts` (raíz) | 2871 |

Nota: `ExtraModulesHandler.kt` citado en el prompt no existe con ese nombre exacto; el archivo real con esa responsabilidad es `ExtraModuleHelper.kt` (26 líneas) — verificado por búsqueda de nombre de archivo.

## 7. Versiones exactas de npm (stack sección 7 del prompt, consultadas 2026-09-03 vía `npm view <pkg> version`)

| Paquete | Versión | Nota |
|---|---|---|
| next | 16.3.4 | |
| react | 19.2.8 | |
| react-dom | 19.2.8 | |
| typescript | 7.0.2 | Salto mayor (compilador nativo); verificar compatibilidad de tooling antes de fijarla en fase 1 |
| zod | 4.5.4 | Zod v4: revisar breaking changes vs v3 al diseñar el esquema (fase 1, rol dominio) |
| zustand | 5.0.15 | |
| immer | 11.1.18 | |
| zundo | 2.3.0 | |
| react-hook-form | 7.87.0 | |
| @hookform/resolvers | 5.9.1 | |
| @dnd-kit/core | 6.3.1 | |
| @dnd-kit/sortable | 10.0.0 | |
| tailwindcss | 4.3.3 | Tailwind v4: cambia el pipeline de config (CSS-first) respecto a v3 |
| @playwright/test | 1.62.1 | |
| vitest | 5.0.0 | |
| @tiptap/react | 3.31.2 | |
| zod-to-json-schema | 3.25.2 | Confirmar compatibilidad con Zod v4 antes de adoptarla como generador único (fase 1) |
| turbo | 2.10.12 | Gestor de monorepo recomendado (Turborepo) |
| pnpm | 11.25.0 | Gestor de paquetes recomendado para el monorepo (no listado explícitamente en el prompt, pero implícito en "monorepo TypeScript" — contratos.md ya lo fija) |

Registro npm respondió sin problemas para los 18 paquetes (npm 10.9.7 / node en `/opt/node22`); ninguna versión quedó sin verificar.
