# Handoff — fase 2 (backend) → orquestador de la fase 3 (frontend)

## 1. Qué hay
- Backend: `src/main/kotlin/.../modules/templates2/{domain,schema,composition,migration,persistence,catalog,api}`; migraciones `V29`–`V37` (`V38`/`V39` siguen reservadas).
- Esquema compartido: `frontend/packages/schema` (`@invitaciones/schema`) — Zod 4.5.4, bundle JSON Schema y golden files. **TypeScript es la fuente; Kotlin, el espejo.**
- Verificado al cierre: **1 186 pruebas Kotlin y 458 TS, 0 fallos**; cobertura BUNDLE 94,6 % líneas / 81,2 % ramas.

## 2. Arrancar el backend en local (comando exacto)
```bash
source scripts/pg-ephemeral.sh start        # PostgreSQL efímero; no hay Docker
export TEMPLATES2_ASSETS_BUCKET=mi-bucket-de-pruebas   # OBLIGATORIO, sin defecto (ADR-2-ORQ-03)
./gradlew bootRun
```
**AVISO — hoy esto NO arranca, y no es del módulo.** `InvitationGuestEntity.kt:28` mapea `invitation_guest.graduates_name`, que **ninguna migración crea**, con `ddl-auto: validate` (`application.yml:32`). Único desajuste del proyecto, **previo** a esta fase. Lo desbloquea una línea que alguien debe numerar (no `V38`/`V39`): `ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255);`
Consecuencia a decir con todas las letras: **las 19 rutas nunca se han visto responder sobre un Tomcat real**; las pruebas de contrato corren sobre contextos Spring **acotados**. Resuélvelo antes que nada: el editor necesita el backend levantado.
Datos de ejemplo: registrar las dos plantillas de `diseno/ejemplos/` con el comando de línea de `handoffs/2-3.md`. **Ojo**: traen digestos de relleno y no son registrables tal cual (pregunta abierta de 2-3).

## 3. JWT de prueba
No hay emisor propio del módulo: se reusa el login de `modules/auth` y `JwtTokenFilter`. Cómo firmar uno a mano (secreto en `application.yml:8`, en texto plano — H-48): `handoffs/2-5.md`.

## 4. Qué consume el editor (las 19 rutas de `03 §2`, todas implementadas)
Formas y contratos exactos en `handoffs/2-5.md`. Lo que **no** se deduce del diseño:
- `:choose-template` es el **único** creador del documento; `GET .../document` da **`404 TPL_DOCUMENT_NOT_STARTED`** y no crea nada. El editor llama primero a `:choose-template`.
- `baseRevision` es obligatorio en `operations`, en `restore` **y** en `:choose-template`.
- Idempotencia del lote por `(document_id, clientBatchId)`: ante timeout el reintento da `200 {applied:false, revision:<la que produjo>}`. El editor **debe** enviar `clientBatchId`.
- Assets: **cuerpo binario crudo**, no `multipart` (la única multipart es el registro de plantillas).
- Límite de cuerpo: **768 KiB** en `operations`, **8 KiB** en el resto de rutas JSON.
- Render público: `GET /public/i/{publicToken}/render`, sin auth, `ETag = contentHash` (prefijo `sha256:`) y `304` ante `If-None-Match`.
- Errores: `TplErrorResponse {timestamp, statusCode, code, message, details}`, 35 códigos `TPL_*`. Los 401/403 de la cadena de filtros **no** llevan `TPL_*`.

## 5. Webhook de revalidación (lo implementa la fase 3 del lado Next)
Tras publicar, despublicar o rotar el token, el backend llama `POST {templates2.revalidate.url}` con cabecera `x-revalidate-token`. **El cuerpo exacto lo fijó el backend, no el contrato**: está en `bitacora/2-6.md`. `/api/revalidate` debe hacer `revalidateTag("invitation:{publicToken}")`. Desactivado si faltan `url`/`token`.

## 6. Qué NO se implementó y por qué
- **CORS de tipografías** (`contratos §8`): infraestructura y `apps/web`, no este backend. Fase 3/4.
- **Barrido semanal de huérfanos de S3**: `S3Service` no expone listado. La cola `tpl_asset_gc` y su drenaje sí funcionan.
- **Contrato de IA** (`TPL_AI_*`, `tpl_ai_proposal`): fuera de alcance, sigue reservado.
- **`apps/web`, `packages/sections`, `packages/migration-legacy`**: fases 3 y 5. En `frontend/` sólo existe `packages/schema`. El job `e2e` del CI está en `if: false` hasta que exista `apps/web`.

## 7. Qué leer primero
1. `memoria/contratos.md` — **manda**; su **§11** es el cierre de la fase 2 con todas las enmiendas.
2. Este handoff y `handoffs/2-5.md`. 3. `diseno/04-frontend-y-editor.md` (tu documento principal).
4. `memoria/preguntas-abiertas.md` — supuestos que **no** debes volver a decidir por tu cuenta.
5. `bitacora/2-adv.md` — lo que la revisión de cierre dejó abierto.

**Primera tarea obligatoria de la fase 3** (`contratos §8`, ADR-1R-F-02): la **compuerta medible A1-A8** que confirma que el lienzo en iframe sin `allow-same-origin` es viable. Todo lo demás depende de su resultado; hay contingencia preaprobada (origen dedicado `lienzo.<dominio>`).
