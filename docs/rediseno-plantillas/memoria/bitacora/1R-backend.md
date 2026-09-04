# Bitácora — 1R-backend (ronda 1R, revisión independiente del bloque persistencia + API + seguridad)

Fecha: 2026-09-03 · Rama: `claude/agent-network-invitation-41nx5y` · Sin commits, sin push (por brief).

## Qué hice

1. **Leí la memoria completa del bloque**: `brief-comun.md`, `00-INDICE.md`, `contratos.md` (§1, §4, §5, §7), `glosario.md`, ADR-008…016, 021, 023, 028…033 de `decisiones.md`, `preguntas-abiertas.md`, `tablero.md`, y los handoffs `0-resumen-auditoria-persistencia.md`, `0-resumen-auditoria-api.md`, `0-inventario.md`, `1-persistencia-api.md`.
2. **Leí el código real** (solo lectura; no toqué ni un byte de Kotlin/SQL/YAML/Gradle). Tabla completa con `archivo:línea` en `diseno/02 §12` y `diseno/03 §13`. Lo determinante:
   - `src/main/resources/db/migration/` → **última migración real `V28__add_whatsapp_sent_column.sql`**; `V29`+ libres. La numeración `V29`-`V36` de `contratos.md` §5 **queda confirmada**; añado `V37`.
   - `core/auth/security/SecurityConfig.kt:36-48` → `/master/**` = `hasRole("MASTER")` (confirma ADR-033), `/public/**` = `permitAll`, **`/editor/**` no aparece** (cae en `anyRequest().authenticated()`).
   - `core/auth/service/HierarchyValidationService.kt:42-71` → firma, semántica por rol y uso de `findByIdEvenIfDisabled` (una invitación deshabilitada sigue siendo accesible para su dueño).
   - `core/error/GeneralExceptionHandler.kt:42-52` → `@ExceptionHandler(IllegalArgumentException::class)` → 400 sin código: cualquier `require()` de Kotlin en `templates2` reintroduciría H-14.
   - `core/error/model/ErrorMessage.kt:251-256` → **no tiene campo `code`**; el contrato prometía algo imposible sin tocar el núcleo.
   - `modules/admin/invitations/repository/InvitationRepository.kt:42-43` + `InvitationAdminService.kt:382` + `AdminUsersService.kt:426,433` → **el borrado físico de invitaciones y de clientes existe y se ejecuta hoy**. `V9__add_cascade_delete_to_invitation_relations.sql` fija la convención (`ON DELETE CASCADE`).
   - `core/s3/S3Service.kt:33` → `generatePresignedUrl` con `Duration.ofDays(7)` por defecto; `:57-69` `uploadPublicFile` **sin ACL**; `core/s3/S3KeyService.kt:130-138` → clave con `UUID.randomUUID()` (no determinista); `core/s3/S3Buckets.kt:154-157` → solo dos constantes, nada sobre visibilidad pública.
   - `src/main/resources/application.yml:30-45` → `ddl-auto: validate` (un desajuste de mapeo tumba **toda** la aplicación), Flyway `classpath:db/migration`; **`spring.servlet.multipart` no está configurado en ninguna parte** ⇒ rigen 1 MB/10 MB por defecto.
   - `build.gradle.kts:6,35,42` → Spring Boot 3.4.1 (Hibernate 6.6), `data-jpa`, `jackson-module-kotlin`. Búsqueda de `JdbcTypeCode|SqlTypes` en `src/main/kotlin`: **0 resultados** ⇒ ninguna entidad usa JSON hoy.
   - `modules/all/invitations/presentation/PublicGuestInfoController.kt:65-75` → el módulo antiguo **sí** bloquea invitación deshabilitada / dueño deshabilitado / baneado en su ruta pública.
   - `core/data/MongoDataInitializer.kt:27` y `core/validation/FileValidationService.kt:11` → H-35 (mapper propio) y límite de 5 MB inalcanzable tras el 1 MB del servlet.
3. **Leí el esquema TS** (`diseno/esquema/*.ts`, sobre todo `operations.ts`, `common.ts`, `blocks.ts`, `document.ts`, `composed.ts`, `manifest.ts`, `invariants.ts`, `emit-json-schema.ts`) para que los contratos de API coincidan literalmente con él.
4. **Ataqué el diseño** (25 ataques, `diseno/09` apéndice) y **corregí en sitio**: `02` pasó de 219 a ~745 líneas, `03` de 135 a ~655.
5. Escribí las secciones "Revisión independiente (1R-backend)" en `02 §14` (15 objeciones) y `03 §15` (16 objeciones), el apéndice de `09`, este archivo, `handoffs/1R-backend.md`, 14 ADR `ADR-1R-B-01…14` (propuestas) y 9 preguntas abiertas.

## Resultado en una línea por objeción alta

- **B-01** FK sin `ON DELETE` habrían roto el borrado de invitaciones/usuarios que la administración ya ejecuta → cascadas correctas.
- **B-02** el borrado en cascada dejaba objetos de S3 huérfanos y sin rastro (imposible cumplir el derecho al olvido) → `tpl_asset_gc` + trigger (`V37`) + `AssetGcJob`.
- **B-03 / A-05** la idempotencia del `OperationBatch` era nominal: tras un timeout el cliente reenvía con la misma `baseRevision` → índice único `(document_id, client_batch_id)` + respuesta `200 {applied:false}`.
- **B-05 / T-06** `richText` sin validación de longitud ⇒ documento sin cota → `doc_bytes` + `CHECK` de 1 MiB + `TPL_DOCUMENT_TOO_LARGE`.
- **B-07 / A-13** el render público no comprobaba invitación deshabilitada ni dueño baneado (regresión frente al módulo antiguo) → `TPL_INVITATION_UNAVAILABLE`.
- **A-01 / A-07** no había forma de despublicar ni de revocar un enlace filtrado → `DELETE …/release` y `POST …/public-token:rotate`.
- **A-10** el "límite de body de Spring MVC" no existe para JSON (H-45 seguía vivo) → `Templates2BodyLimitFilter`.
- **A-11** un `require()` de Kotlin habría dado un 400 genérico por el handler del núcleo (H-14 reintroducido) → advice propio con `@Order(HIGHEST_PRECEDENCE)` acotado por `basePackages` + prueba de arquitectura.

## Qué no pude determinar (y qué asumí)

- Si el bucket `ASSETS` es de lectura pública: `S3Buckets.kt` solo declara nombres y `uploadPublicFile` no fija ACL. **Asumido**: sí, con la URL construida por una propiedad configurable (`templates2.assets.public-base-url`) para poder corregirlo sin migrar datos.
- Última versión disponible de `com.networknt:json-schema-validator` (sin acceso a Maven Central desde aquí). **Asumido** `1.5.4`; el requisito duro es soporte de draft 2020-12.
- Si hay requisito legal de plazo para el borrado efectivo en S3. **Asumido**: objetivo operativo de 24 h.
- Volumen real de plantillas y tamaño de `manifest`/`composed` en producción (sin acceso a datos reales).
- No ejecuté nada: `./gradlew` no compila en este entorno (toolchain Java 17 ausente, `handoffs/0-inventario.md`); mi entregable es documentación, no código.

## Riesgos que dejo abiertos

1. **C-01 — cerrada durante la ronda.** Detecté que `validateValueAgainstSpec` no tenía rama `richText` (⇒ `maxLength` nunca se aplicaba, ~4·10⁶ caracteres posibles por valor). Al cerrar verifiqué que `1R-dominio`, trabajando en paralelo, ya lo corrigió (`esquema/invariants.ts`: `richTextLength()` + caso `"richText"` con I-16). Igual mantengo el tope de 1 MiB por documento como defensa en profundidad. Lo mismo ocurrió con C-03, C-04 y C-05: cerradas por `1R-dominio`. **Solo queda C-02** (creación perezosa del documento en `GET` según ADR-013 frente a creación exclusiva por `:choose-template`), que es contrato de API y debe dirimir el orquestador.
2. **Cambio de rango de migraciones**: `V29`-**`V37`** (antes `V29`-`V36`). `contratos.md` §5, `00-INDICE.md` y `06 §7` citan el rango viejo; el orquestador debe actualizarlos.
3. **Dos cambios de contrato de transporte**: assets del editor por cuerpo binario crudo (no multipart) y `spring.servlet.multipart.max-file-size/max-request-size` a elevar **solo** por la ruta MASTER de registro de plantillas. El segundo es la única modificación de `application.yml` que este módulo pide, y toca configuración global compartida con el módulo antiguo.
4. **`@PreAuthorize` como única regla de rol para `/editor/**`**: si alguien cambia `anyRequest().authenticated()` en `SecurityConfig`, la protección de rol del módulo nuevo queda solo en las anotaciones. Documentado, no mitigable sin tocar el núcleo.
5. **Las 5 contradicciones C-01…C-05** con `01-dominio-y-esquema.md` / `esquema/*.ts` siguen abiertas por diseño (no me corresponde resolverlas).
