# Registro de decisiones (ADR) — append-only

Formato obligatorio de cada ADR:
```
## ADR-NNN — Título
- Fecha: AAAA-MM-DD · Estado: propuesta | aceptada | rechazada (motivo) · Autor: <sub-agente>
- Contexto: (con referencias a hallazgos H-xx de la auditoría)
- Decisión:
- Alternativas descartadas y por qué:
- Consecuencias:
```
Solo el orquestador cambia el estado a aceptada/rechazada. Un contrato vigente solo cambia por una ADR nueva que lo reemplace.

---

## ADR-001 — Documento de invitación en cuatro capas
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: el `InvitationConfig` actual mezcla presentación, estructura, contenido y datos de negocio en un único blob sin separación (H-27, H-31–H-34: 14 literales de FontAwesome, arrays RGBA, `fontFamily` hardcodeado en Kotlin). No hay forma de distinguir "esto lo puso el autor de la plantilla" de "esto lo puso el cliente" (H-03).
- Decisión: el documento se divide en paquete de plantilla (inmutable, Git+`tpl_template_version.manifest`), `theme` (solo ids de paleta/tipografía), `structure` (secciones con `key`/`variant`/`visible`/orden) y `content` (mapa por id de bloque). Datos de negocio (invitados, RSVP, fecha, hashtag) viven en Postgres relacional y entran a la composición por rol, nunca copiados al documento.
- Alternativas descartadas: (a) mantener un único documento con overrides por ruta de campo (opción B del informe, 4×–6×) — exige reconciliación en cada lectura y no separa presentación; (b) mantener el modelo actual endureciendo validaciones (opción A, 1×) — no ataca la causa raíz.
- Consecuencias: el backend queda sin ninguna decisión de presentación (P3, auditable por búsqueda); toda la migración (05) debe extraer estas 4 capas de cada `invitation_configs` existente.

## ADR-002 — Merge por id estable; `content` es un mapa plano por `blockId`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-01 (familia por texto de título, pierde datos en 5/6 plantillas no-boda), H-02 (familia en boda por posición de arreglo sobre campos nullable), H-25 (galería reescribe ids), H-28 (ids duplicados en mesa de regalos), H-38 (sincronización por posición sin `ORDER BY`).
- Decisión: `content` es `Record<blockId, BlockValue>`; los grupos repetibles llevan `itemId` ULID generado por el servidor, estable a través de reordenamientos y de cambios de versión. El `blockId` es único en todo el manifiesto (no solo por sección).
- Alternativas descartadas: árbol anidado por sección (reintroduce dependencia posicional al serializar); emparejamiento por `role` sin id propio (el rol identifica *qué es*, no *cuál instancia*, no sirve para grupos con más de un ítem del mismo rol).
- Consecuencias: el merge es estructuralmente imposible de equivocar por índice; toda operación de edición y de IA direcciona por `blockId`/`itemId`, nunca por posición.

## ADR-003 — Catálogos cerrados: 12 tipos de sección, 14 tipos de bloque, roles explícitos
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: `fases/J-inventario-json.md` §3/§5 (13 claves de sección idénticas en 9 `default_visual_*.json`); H-11/H-12 (capacidades codificadas por `templateId` mágico, `itemsSinglePlace` muerto); H-33 (listas heterogéneas colapsadas a un elemento); H-49 (itinerario sin `locationButton`); H-51 (dress code solo primera fila).
- Decisión: catálogo cerrado de tipos de sección (`01 §3.1`) y de bloque (`01 §3.2`), catálogo cerrado de `role` (`01 §3.3`) ampliable solo por versión mayor del manifiesto. Un `kind`/`type`/`role` no reconocido rechaza el registro o la escritura (`TPL_BLOCK_TYPE_MISMATCH`, `TPL_ROLE_UNKNOWN`).
- Alternativas descartadas: tipos de bloque abiertos por plantilla (reintroduce H-45: acepta cualquier cosa); capacidades inferidas del `eventTypeId` (perpetúa H-11/H-20).
- Consecuencias: cubre las 8 plantillas sembradas verificadas en `J-inventario-json.md`; una capacidad nueva de dominio exige ADR y versión mayor del `manifestVersion`, nunca un `if (templateId == X)` en Kotlin.

## ADR-004 — Zod 4 como fuente única; `z.toJSONSchema` nativo
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-35 (dos `ObjectMapper` con reglas distintas); `contratos.md` §7 fija `zod@4.5.4` y pide verificar `zod-to-json-schema@3.25.2` contra Zod v4.
- Decisión: verificado en esta fase que `z.toJSONSchema` existe nativamente en Zod 4.5.4 y emite `draft-2020-12` con `additionalProperties:false`, `discriminatedUnion`→`oneOf`+`const`, y `z.registry()`→`$defs`/`$ref`. Se usa exclusivamente; `zod-to-json-schema` se elimina del árbol de dependencias.
- Alternativas descartadas: mantener `zod-to-json-schema` "por si acaso" — dependencia extra sin función, riesgo de deriva entre dos generadores.
- Consecuencias: un solo generador (`packages/schema/scripts/emit-json-schema.ts`); el validador Kotlin (`com.networknt:json-schema-validator`) consume el `.schema.json` commiteado; CI falla si `git diff` detecta que el archivo generado difiere del commiteado (mata H-35 por construcción, un solo esquema para ambos lados).

## ADR-005 — Prohibido `.refine()`/`.superRefine()` en esquemas exportados; invariantes duplicadas y probadas en ambos lados
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: verificado en esta fase con `zod@4.5.4`: `.refine()`/`.superRefine()` se descartan en silencio al emitir JSON Schema, incluso con `unrepresentable:"throw"` (no lanza en este caso — el chequeo de esa opción no cubre refinamientos). Esto repetiría exactamente el defecto de P1 (regla no escrita en ningún esquema) si se usara para invariantes entre campos.
- Decisión: regla dura de lint (`06-pruebas-y-calidad.md` §5.2): ningún archivo de `packages/schema/src/*.ts` usa `.refine()`/`.superRefine()`/`.transform()`. Las 21 invariantes entre campos (`I-01`…`I-21`, `esquema/invariants.ts`) se implementan dos veces — TypeScript y Kotlin (`templates2/schema/Invariants.kt`) — y se prueban con la misma tabla de casos JSON compartida.
- Alternativas descartadas: usar `.refine()` y documentar la invariante solo en prosa (exactamente el patrón que causó H-12); generar el JSON Schema con `unrepresentable:"throw"` confiando en que fallaría (verificado que NO falla para refinamientos, solo para algunos otros tipos no representables).
- Consecuencias: más código (dos implementaciones), pero cero invariantes fantasma; una prueba de contrato (`06 §5`) corre la tabla de casos contra ambas implementaciones y falla si divergen.

## ADR-006 — `attic`: contenido huérfano tras migración nunca se borra
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-04/H-05 (cambios que dejan estado mixto sin trazabilidad); ninguna vía actual de alta o edición conserva lo que un cambio de plantilla descarta.
- Decisión: `InvitationDocument.attic` es un mapa `{"<slug>@<version>": {blockId: value}}` de solo escritura para el sistema (el editor no puede escribirlo, P8). Toda migración o cambio de plantilla que elimina un bloque/sección mueve su valor ahí en vez de borrarlo.
- Alternativas descartadas: borrar directamente el contenido removido (pérdida de datos irreversible, contraviene P5); tabla de auditoría aparte (más aparato para el mismo fin; `attic` viaja con el documento y es visible al inspeccionarlo).
- Consecuencias: el documento nunca disminuye por accidente; `05-migracion.md` reporta cuánto contenido cae en `attic` por invitación como métrica de pérdida potencial (no real: sigue recuperable).

## ADR-007 — Composición pura, sin regeneración explícita; nueve reglas R1–R9
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-04 (ningún cambio en Postgres se propaga), H-05 (cambio de plantilla deja estado mixto), H-27 (fechas inconsistentes entre secciones).
- Decisión: `compose(pkg, doc, business, locale)` es una función pura (R6, sin reloj/E/S/aleatoriedad) que se ejecuta en cada lectura del editor y una sola vez al publicar (se congela en `tpl_release.composed`). No existe operación "regenerar": cambiar la fecha en Postgres cambia el preview de inmediato y marca el release activo `stale`. Reglas R1 (estructura por defecto del manifiesto + overrides por key), R2 (fallback user→default→empty), R3 (`provenance` por bloque), R4 (negocio por rol/`source:business`, nunca por posición), R5 (nada se fabrica si el manifiesto no lo declara), R7 (grupos por `itemId`), R8 (tema con fallback registrado), R9 (idempotencia — JSON canónico, bytes idénticos).
- Alternativas descartadas: job de regeneración periódica (mantiene una copia que puede desincronizarse, exactamente H-04); componer y persistir en cada `PUT` (mezcla edición con congelación, complica el undo).
- Consecuencias: no hay "documento compuesto" persistido salvo el `release`; el editor siempre ve el estado fresco; el golden file de `06-pruebas-y-calidad.md` fija el comportamiento de estas 9 reglas antes de tocar el motor real en fase 2.

## ADR-008 — Registro de plantilla en un solo paso idempotente por `packageHash`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-07 (`reuseExistingContent` falla siempre, deja huérfanos), H-09 (el seed pisa plantillas en cada arranque), H-15 (índice único creado dentro de un `catch` vacío), H-16/H-17 (alta parcial sin visual, arranque sin plantillas si Mongo no responde).
- Decisión: registrar una plantilla es un único paso (CLI o endpoint MASTER) que empaqueta el directorio `templates/<slug>/<version>/`, calcula `packageHash = sha256(canonicalJson(manifest) ‖ sha256 de cada asset ordenado por ruta)` y hace `INSERT … ON CONFLICT (slug, version) DO NOTHING` devolviendo el existente si el hash coincide, o `409 TPL_VERSION_HASH_MISMATCH` si alguien intenta registrar el mismo `slug@version` con contenido distinto. Una versión publicada nunca se sobrescribe.
- Alternativas descartadas: upsert que sobrescribe siempre (repite H-09); alta en dos pasos Postgres+Mongo (repite H-07/H-08).
- Consecuencias: registrar dos veces el mismo paquete es un no-op seguro (idempotencia real, no solo nominal); el detalle de tablas e índices se fija en `02-persistencia-y-catalogo.md`.

## ADR-009 — PostgreSQL con JSONB como único almacén transaccional del módulo nuevo
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-persistencia
- Contexto: H-08 (cero transaccionalidad Mongo/Postgres, Mongo standalone sin replica set), H-36/H-37 (configs huérfanas, sin contraste de claves de negocio); `contratos.md` §2 ya fija esta decisión como stack por defecto (prompt maestro §7).
- Decisión: el módulo nuevo (`templates2`) no usa MongoDB. Manifiestos, temas, defaults, documentos de cliente, snapshots y releases viven en tablas Postgres con columnas `JSONB`, en la misma base y motor transaccional que `invitation`/`invitation_guest`.
- Alternativas descartadas: mantener Mongo para el catálogo de plantillas y Postgres para documentos (perpetúa H-08 para la mitad del sistema); outbox/saga entre dos almacenes (más aparato operativo sin necesidad — la escala del producto no lo justifica).
- Consecuencias: FK real `tpl_document.invitation_id → invitation.id`; una sola transacción JDBC cubre "guardar cambios del editor + tocar `invitation`" cuando aplique; el módulo antiguo sigue usando Mongo sin cambios (P10, conviven).

## ADR-010 — Modelo de tablas: `tpl_template`, `tpl_template_version`, `tpl_document`, `tpl_document_snapshot`, `tpl_release`, `tpl_asset`, `tpl_template_registration`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-persistencia
- Contexto: ADR-001/002/004/008; necesidad de índices únicos reales (mata H-15) y de un rastro auditable de cada alta (mata H-16/H-17: "arranca sin plantillas" deja de ser posible en silencio).
- Decisión: ver `02-persistencia-y-catalogo.md` §2 para DDL completo. Resumen: `tpl_template(id, slug unique)`; `tpl_template_version(id, template_id fk, version, manifest jsonb, theme jsonb, defaults jsonb, package_hash unique per template_id, status, published_at)`; `tpl_document(id, invitation_id fk unique, template_version_id fk, doc jsonb, revision, updated_at)`; `tpl_document_snapshot(id, document_id fk, revision, doc jsonb, created_at)`; `tpl_release(id, invitation_id fk, template_version_id fk, composed jsonb, content_hash, theme jsonb, published_at, is_active)`; `tpl_asset(id, template_version_id fk nullable, invitation_id fk nullable, s3_key, sha256, content_type, bytes)`; `tpl_template_registration(id, template_id fk, version, requested_hash, result, error_code, created_at)` (auditoría de cada intento de alta, éxito o fallo).
- Alternativas descartadas: una sola tabla `tpl_document_version` sirviendo tanto de snapshot de trabajo como de release (mezcla mutable/inmutable, complica la invalidación de caché del render público).
- Consecuencias: `tpl_release` es la única tabla que lee el render público; `tpl_document`/`tpl_document_snapshot` son privadas del editor autenticado.

## ADR-011 — Retención: snapshots por revisión + purga diferida; releases nunca se purgan mientras estén activos o enlazados
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-persistencia
- Contexto: necesidad de acotar el crecimiento de `tpl_document_snapshot` sin perder la capacidad de deshacer del lado servidor descrita en `03-api.md` §4.
- Decisión: se conserva un snapshot por cada `OperationBatch` aplicado durante 30 días o las últimas 200 revisiones por documento (lo que ocurra primero), purgados por un job diario; el snapshot correspondiente a cada `tpl_release.template_version_id`+`content_hash` publicado se conserva indefinidamente (no cuenta contra el límite). `tpl_release` nunca se borra automáticamente; solo un `DELETE` explícito de MASTER (fuera de alcance de este módulo) lo retira.
- Alternativas descartadas: sin límite de snapshots (crecimiento sin cota, mismo problema no resuelto que hoy con Mongo); purgar por tiempo únicamente (pierde el undo de una sesión de edición larga con pocos autoguardados).
- Consecuencias: el undo de servidor (`03-api.md` §4) tiene una ventana garantizada de 200 pasos o 30 días; la migración/kit de plantillas no depende de snapshots de documento.

## ADR-012 — Paquete Kotlin del módulo nuevo: `mx.evolutiondev.invitaciones.modules.templates2`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-persistencia
- Contexto: `contratos.md` §1 deja el nombre pendiente de ADR; `handoffs/0-inventario.md` §1 ya usa `templates2` como referencia provisional; evitar colisión con `modules/user/invitations` (a sustituir, no tocar) y con `modules/master/templates` (alta actual, no tocar).
- Decisión: el módulo nuevo vive íntegro bajo `src/main/kotlin/mx/evolutiondev/invitaciones/modules/templates2/` con subpaquetes `domain`, `schema`, `composition`, `persistence`, `api`, `migration`. Sin overlap de nombres de clase con el módulo antiguo.
- Alternativas descartadas: `modules/templates` a secas (colisiona conceptualmente con `modules/master/templates`, confuso en code review); reemplazar en sitio el módulo antiguo (viola P10, sin convivencia detrás de bandera).
- Consecuencias: el `git diff` de fase 2 queda acotado a esta carpeta + pruebas + build; retirar el módulo antiguo (fase 6) es borrar `modules/user/invitations/**` y `modules/master/templates/**` sin tocar `templates2`.

## ADR-013 — API separada en tres superficies: edición autenticada, publicación (release), render público
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-api
- Contexto: H-39 (orden de operaciones no garantizado: un `PUT` antes del primer `GET` se salta la generación desde plantilla); no existe hoy ruta pública que sirva el documento renderizable completo.
- Decisión: tres grupos de rutas (`03-api.md` §2): `/editor/invitations/{id}/document/**` (autenticada, documento de trabajo mutable vía operaciones), `/editor/invitations/{id}/release` (publicar, autenticada), `/public/invitations/{token}/render` (sin auth, lee solo `tpl_release`, cacheable). El documento de trabajo se crea perezosamente en el primer acceso autenticado (mismo patrón que hoy, pero con `INSERT … ON CONFLICT DO NOTHING` en vez de una carrera de `ReentrantLock` por JVM, mata H-44).
- Alternativas descartadas: una sola ruta que sirve tanto edición como público (mezcla autorización y caché; el invitado tocaría la misma tabla mutable que el editor, repite el riesgo de H-04).
- Consecuencias: el invitado nunca toca `tpl_document`; publicar es la única operación que puede fallar por validación de negocio (bloques `required` en `default`, R3/ADR-007).

## ADR-014 — Edición por operaciones (reductor único, `OperationBatch`, revisión optimista) en vez de reemplazo total del documento
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-api
- Contexto: H-45 (`PUT .../config` sin `@Valid` ni límite de tamaño, acepta cualquier JSON); H-13 (`_id` inyectable en el body); necesidad de un modelo compatible con undo/autoguardado (P7) y con el contrato de IA (07).
- Decisión: `POST /editor/invitations/{id}/document/operations` recibe `OperationBatch{baseRevision, clientBatchId, operations[≤50]}` (`esquema/operations.ts`), aplicado por un reductor único compartido con la UI humana y con `EditProposal` de IA. `baseRevision` implementa control optimista: revisión desactualizada → `409 TPL_REVISION_CONFLICT` con el documento actual. `clientBatchId` da idempotencia real al autoguardado (reintentar el mismo lote es un no-op).
- Alternativas descartadas: `PUT` de documento completo (repite H-45: sin forma barata de validar solo lo que cambió, ni de dar idempotencia sin comparar el documento entero); bloqueo pesimista por invitación (mata la posibilidad de autoguardado en segundo plano sin fricción).
- Consecuencias: cada operación se valida contra el manifiesto antes de aplicarse (mismo validador que `invariants.ts`); el editor, el autoguardado y la IA comparten una sola ruta de escritura (auditable, deshacible).

## ADR-015 — Autorización reutilizando `HierarchyValidationService`; todo id sensible lo genera o valida el servidor
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-api
- Contexto: H-13 (`_id` de Mongo inyectable, permite pisar la config de otra invitación) — el hallazgo de seguridad más alto de la auditoría para este rol.
- Decisión: toda ruta de `/editor/**` exige `HierarchyValidationService.validateInvitationAccess(requesterId, invitationId)` (mismo servicio que usa el resto del backend, `core/auth/service/HierarchyValidationService.kt:41-55`) antes de tocar `tpl_document`. `invitationId` viene siempre de la ruta, nunca del body; `itemId` de grupos y `assetId` los genera el servidor (ULID); ninguna operación acepta un id de documento, snapshot o release ajenos — se resuelven siempre por el `invitationId` autorizado de la ruta.
- Alternativas descartadas: autorización propia paralela a `HierarchyValidationService` (duplica lógica de roles MASTER/ADMIN/USER, riesgo de divergencia).
- Consecuencias: mata H-13 por construcción (no hay campo donde inyectar un id ajeno); toda prueba de contrato de autorización (`06-pruebas-y-calidad.md` §3) reutiliza los mismos casos que ya cubren `HierarchyValidationService` en el resto del backend, más los propios de `templates2`.

## ADR-016 — Contrato de errores tipado (`TPL_*`) con `@RestControllerAdvice` propio
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-api
- Contexto: H-14 (excepciones tipadas tragadas por un `catch(Exception)`, 500 genérico); H-52 (el mismo caso "sin permiso" responde 403 o 400 según la capa).
- Decisión: excepciones tipadas propias de `templates2` (`TemplateVersionNotFoundException`, `RevisionConflictException`, `BlockValidationException`, etc.) con un `@ExceptionHandler` explícito por tipo en `GeneralExceptionHandler.kt` (o un advice paralelo que no reemplaza el existente), cada una mapeada a un código `TPL_xxx` + HTTP status fijo documentado en `03-api.md` §5. Ninguna excepción de `templates2` cae al 500 genérico de Spring sin pasar antes por un handler explícito.
- Alternativas descartadas: reusar `IllegalArgumentException`/`IllegalStateException` genéricas (exactamente la causa de H-14).
- Consecuencias: el frontend puede diferenciar por código, no por texto de mensaje; la tabla completa de códigos vive en `03-api.md` §5 y se prueba con un caso de contrato por código (06 §3).

## ADR-017 — Frontend en una sola app Next.js (`apps/web`) con rutas `/editor/...` y `/i/...`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-frontend
- Contexto: el prompt maestro §7 fija por defecto `apps/editor` + `apps/site` separadas; el brief de esta orquestación (sección "Ronda 1, punto 4") pide explícitamente evaluar una sola app salvo ADR en contrario, dado el tamaño real del producto (SaaS de un solo tipo de documento, sin necesidad de desplegar/escalar editor y sitio público por separado en esta fase).
- Decisión: monorepo pnpm con `packages/schema` (ADR-004), `packages/sections` (componentes de sección, compartidos por editor y render), `apps/web` — una sola app Next.js App Router con `/editor/[invitationId]/...` (autenticado, dinámico) y `/i/[publicToken]/...` (público, ISR). Ambas rutas importan los mismos componentes de `packages/sections`, garantizando que el editor renderiza exactamente lo que verá el invitado (mismo código, ver ADR-018).
- Alternativas descartadas: `apps/editor` + `apps/site` separadas (el stack por defecto) — dos despliegues, dos configuraciones de caché, y una sincronización de versión de `packages/sections` entre ambas sin beneficio claro al tamaño actual del catálogo (8-20 plantillas, tráfico de un solo producto); se revalúa por ADR si el render público necesita escalar independientemente del editor.
- Consecuencias: un solo `next.config`, una sola pipeline de build; el render público usa `export const dynamic` con ISR por invitación en vez de un despliegue estático aparte; si el tráfico público exige un CDN totalmente desacoplado del editor, esta ADR se reemplaza por una nueva, no se edita.

## ADR-018 — Lienzo del editor como iframe aislado con mensajes tipados por `postMessage`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-frontend
- Contexto: `handoffs/1-aura-lecciones.md` lección 2 (anexo primario aura.build §3): preview aislado, comunicado por mensajes tipados, nunca por acceso directo al DOM/estado del otro proceso.
- Decisión: el lienzo que renderiza las secciones de la invitación (los mismos componentes de `packages/sections` que usa `/i/...`) corre en un `<iframe>` con `src` propio de la app; el "chrome" del editor (barra de secciones, panel de edición, undo, autoguardado) vive en la ventana padre y se comunica con el iframe exclusivamente por un canal `postMessage` tipado (`packages/schema` define los mensajes: `SELECT_BLOCK`, `SCROLL_TO_SECTION`, `PREVIEW_UPDATE`, `VIEWPORT_CHANGE`). El iframe nunca recibe credenciales ni toca `tpl_document` directamente: solo recibe el `ComposedDocument` ya resuelto por el padre.
- Alternativas descartadas: renderizar el lienzo en el mismo árbol React que el chrome sin aislamiento (acopla estilos/eventos del editor con los de la plantilla, riesgo de que CSS del chrome se filtre a la vista pública — anti-patrón documentado en el anexo aura.build §2.3).
- Consecuencias: el "chrome" y el "lienzo" pueden evolucionar con dependencias de estilos independientes; cualquier bug de una sección de plantilla no puede romper el editor completo (aislamiento de fallos); se detalla el catálogo de mensajes en `04-frontend-y-editor.md` §3.

## ADR-019 — Estado y undo: Zustand + Immer con pila de undo propia; autoguardado por `OperationBatch` con debounce
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-frontend
- Contexto: `contratos.md` §2 deja "zundo o pila propia" como decisión de esta ADR; `0-inventario.md` §7 marca zundo con historial de publicación escaso.
- Decisión: pila de undo propia (~80 líneas, `packages/schema` no la incluye: vive en `apps/web`) que registra el `Operation` inverso de cada operación aplicada (p. ej. `setBlock` inverso es `setBlock` con el valor previo) en vez de snapshots completos del documento; Zustand+Immer para el estado del documento de trabajo en memoria; autoguardado con debounce de 2s que agrupa operaciones pendientes en un `OperationBatch` y lo envía a `03-api.md` §3.3, reintentando con el mismo `clientBatchId` ante fallo de red (idempotente por ADR-014).
- Alternativas descartadas: `zundo` (dependencia con historial de publicación escaso para algo que se implementa en menos de 100 líneas con más control sobre qué es "una acción" del punto de vista del usuario, no de cada tecleo).
- Consecuencias: el undo es semántico (una acción de usuario = un paso de undo, no cada carácter tecleado gracias a debounce de texto); el servidor también puede reconstruir el historial desde `tpl_document_snapshot` (ADR-011) como red de seguridad si el estado del cliente se pierde.

## ADR-020 — Endurecimiento del patrón de `blockId`/`sectionKey` (hallazgo adversarial S-04)
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio (con hallazgo de 1-adv-esquema/1-adv-seguridad)
- Contexto: un `blockId`/`sectionKey` sin patrón cerrado podría usarse para inyectar rutas de attic, colisionar con nombres reservados del `ComposedDocument`, o exceder límites razonables de payload (ver `09-verificacion-adversarial-seguridad.md` §2, objeción S-04).
- Decisión: `BlockId` = `^[a-z][a-zA-Z0-9]{0,29}(\.[a-z][a-zA-Z0-9]{0,29}){0,3}$` (≤ 80 chars, ≤ 4 segmentos); `SectionKey` = `^[a-z][a-zA-Z0-9]{0,39}$` (≤ 40 chars). Sin `..`, `/`, `$`, espacios ni mayúscula inicial. Aplicado en `common.ts` (frontend) y en el validador Kotlin de forma idéntica.
- Alternativas descartadas: aceptar cualquier string no vacío (superficie de inyección en claves de `attic` y en índices de Postgres por expresión, si se llegaran a usar).
- Consecuencias: un manifiesto o documento con un id fuera de patrón se rechaza en el registro/escritura, nunca en el render.

## ADR-021 — `assetId` opaco; ninguna URL dentro del documento del cliente
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-dominio
- Contexto: H-34 (URL de S3 embebida en Kotlin); riesgo de que el documento del cliente porte URLs firmadas o de un bucket específico, acoplando el documento a la infraestructura de almacenamiento vigente.
- Decisión: `content` solo guarda `assetId` (`^as_[ULID]$`, opaco); la resolución a URL pública (CDN o S3) ocurre exclusivamente en `compose()`, nunca se persiste una URL en `tpl_document.doc`. `tpl_asset` es la tabla que mapea `assetId → s3_key`.
- Alternativas descartadas: guardar la URL de S3 directamente en el documento (acopla el documento a una infraestructura concreta, dificulta migrar de proveedor o de bucket sin tocar cada documento).
- Consecuencias: cambiar de CDN o de convención de `S3KeyService` no exige migrar ningún documento; la definición de terminado global §3 ("cero presentación en el backend, auditable por búsqueda") incluye "cero URLs" como caso concreto de esa búsqueda.

## ADR-022 — Migración: extractor separa contenido de presentación por invitación; golden files antes de tocar código
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-migracion
- Contexto: H-03 (dato de demo indistinguible de dato real capturado), H-09 (dos cohortes posibles bajo el mismo `templateId` por el seed pisando en cada arranque), H-54 (código muerto/comentado con reglas de precedencia distintas — no usar como fuente).
- Decisión: la migración corre en dos fases: (1) `extractGolden(invitationId)` toma el documento **ya almacenado** en `invitation_configs` (Mongo) — el JSON que el generador produjo la vez que se ejecutó por última vez para esa invitación, NO una re-ejecución del generador hoy — como golden file `before`, por invitación, ANTES de tocar el motor nuevo. Es una decisión deliberada por H-09: el seed pisa `default_visual_*` en cada arranque, así que re-ejecutar el generador hoy contra el seed actual puede no reproducir lo que esa invitación mostró realmente en su momento; el documento ya guardado es la única fuente fiel de "qué vio el cliente". (2) `extractDocument(invitationId)` separa ese `before` en `content`/`structure`/`theme` del nuevo esquema marcando cada valor con su procedencia inferida (coincide con `default_content_configs`/demo de la plantilla correspondiente → candidato a placeholder, va a cola de revisión, no se descarta automáticamente; difiere → dato real capturado), documentando el criterio exacto en `05-migracion.md` §3.
- Alternativas descartadas: regenerar el `before` ejecutando el generador actual contra el seed vigente (ignora H-09, puede comparar contra una versión visual que la invitación nunca mostró); migrar directo al esquema nuevo sin golden file previo (sin forma de detectar una regresión de migración); asumir que todo el contenido es "real" (perpetúa H-03: seguiría publicando datos de demo como si fueran del cliente); clasificar automáticamente "coincide con demo ⇒ es demo" sin cola de revisión (una coincidencia casual de texto corto y común, p. ej. "Sí", produciría un falso positivo).
- Consecuencias: cada invitación migrada tiene un golden file `before` (salida del generador actual) y se verifica automáticamente que el render `after` (compose() nuevo) reproduce los mismos textos e imágenes visibles (no necesariamente el mismo JSON interno).

## ADR-023 — Corte por invitación detrás de bandera; sin doble escritura; sin retorno automático
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-migracion
- Contexto: P10 (convivencia); H-04/H-05 (el estado mixto actual ya es la peor forma de "doble escritura" — no se debe repetir el patrón con el corte).
- Decisión: bandera `invitation.uses_templates2: boolean` (columna nueva en `invitation`, migración Flyway del módulo nuevo — única columna añadida a una tabla existente, ver `contratos.md` regla de qué se puede tocar). Migrar una invitación es una operación de un solo sentido y transaccional: crea `tpl_document` desde la extracción (ADR-022), activa la bandera, y a partir de ahí todo `GET`/edición de esa invitación pasa por `templates2`; el módulo antiguo dejar de leerla (su propio código sigue intacto, simplemente esa invitación ya no pasa por él). No hay doble escritura simultánea a ambos sistemas.
- Alternativas descartadas: doble escritura mientras dura la migración (dos fuentes de verdad simultáneas, exactamente el riesgo que este rediseño elimina); corte único global de todas las invitaciones a la vez (sin forma de aislar una migración fallida a una sola invitación).
- Consecuencias: revertir una invitación a la bandera anterior es posible mientras `invitation_configs` (Mongo) no se borre (retiro real es una decisión de fase 5/6, no de esta fase); el plan de retiro del módulo antiguo se documenta en `05-migracion.md` §6 pero no se ejecuta en esta fase.

## ADR-024 — Pirámide de pruebas y umbrales de cobertura para aceptar código en fase 2+
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-pruebas
- Contexto: H-19 (cero pruebas, siete dependencias de test declaradas sin usar); recomendación transversal del informe (§9.3): "una batería de pruebas de caracterización que fije el comportamiento actual... antes de tocar nada".
- Decisión: umbrales mínimos para que la fase 2 acepte una entrega — unitarias: ≥ 85% de líneas en `templates2.composition` y `templates2.migration` (el núcleo de lógica entrelazada); contrato: 100% de los esquemas exportados de `packages/schema` tienen al menos un caso positivo y uno negativo probado contra el JSON Schema generado; e2e: el flujo "elegir plantilla → editar → publicar → ver como invitado" pasa en Playwright antes de cualquier PR de fase 3; accesibilidad: cero violaciones `axe` de severidad crítica/seria en el render público. Umbral global de cobertura de líneas del módulo `templates2`: ≥ 80%.
- Alternativas descartadas: cobertura global sin distinguir capas (permite alta cobertura trivial en DTOs y baja en el motor de composición, que es donde vive el riesgo real).
- Consecuencias: `06-pruebas-y-calidad.md` §2 detalla herramientas por capa; el CI (ADR-026) falla el build si algún umbral no se cumple.

## ADR-025 — Postgres en pruebas sin Docker: clúster local efímero vía `pg_ctl`/`initdb`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-pruebas
- Contexto: `contratos.md` §7 (verificado por el orquestador raíz): Docker no disponible en este entorno (daemon apagado), Testcontainers no funciona; Postgres 16 está instalado localmente.
- Decisión: las pruebas de integración de `templates2` que necesitan `JSONB` real levantan un clúster Postgres 16 efímero con `initdb`+`pg_ctl` en un directorio temporal por corrida de prueba (JUnit5 `@BeforeAll`/`@AfterAll` a nivel de módulo, un solo arranque para toda la suite), aplican las migraciones Flyway del módulo nuevo, y lo apagan al terminar. H2 en modo Postgres queda descartado para estas pruebas porque no soporta operadores JSONB reales (`@>`, `->>`) que el módulo usa en consultas.
- Alternativas descartadas: Testcontainers (no disponible en este entorno, aunque sí en CI de GitHub Actions si Docker está presente ahí — se deja como alternativa condicional documentada, no como decisión primaria, ver `06-pruebas-y-calidad.md` §6); H2 en modo Postgres para todo (falla en exactamente las consultas que más importa probar).
- Consecuencias: `06-pruebas-y-calidad.md` §6 incluye el script exacto de arranque/parada; el workflow de CI (ADR-026) puede preferir Testcontainers si Docker está disponible en el runner de GitHub Actions, con el mismo esquema de migraciones, sin duplicar la lógica de prueba.

## ADR-026 — CI con GitHub Actions: jobs `backend`, `frontend`, `e2e`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-pruebas
- Contexto: `handoffs/0-inventario.md` §5: no existe `.github/workflows`; el prompt maestro exige agregarlo en fase 2 "Terminado".
- Decisión: el diseño de fase 1 fija la forma del workflow (implementación en fase 2): `backend` (JDK 21 por `0-build-jdk.md`, arranca Postgres local por ADR-025, `./gradlew test`), `frontend` (pnpm install, `vitest`, `emit-json-schema` + `git diff --exit-code` para detectar deriva de esquema, ADR-004), `e2e` (Playwright con Chromium preinstalado del entorno o el runner de Actions, corre después de `backend`+`frontend` en verde). Los tres jobs son obligatorios para mergear a `claude/agent-network-invitation-41nx5y`.
- Alternativas descartadas: un solo job monolítico (mezcla fallos de dominios distintos, más lento en feedback).
- Consecuencias: la implementación real del archivo `.github/workflows/templates2-ci.yml` es tarea de fase 2, no de esta fase (documentado, no implementado).

## ADR-027 — Contrato de IA: operaciones estructuradas validadas, mismo reductor, sin implementar
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-ia
- Contexto: patrón Canva Magic Design (investigación §6) preferido sobre generación de código libre (aura.build/v0/Bolt); `handoffs/1-aura-lecciones.md` lecciones 1 y 5 (validar→dry-run→aplicar→reparar operación→descartar-y-continuar; nunca fallar el lote completo); H-45/H-13 (mismo principio: catálogo cerrado y validado, ids nunca inventados por el modelo).
- Decisión: `EditProposal{sectionKey, rationale, operations[≤10]}` (`esquema/operations.ts`) usa el MISMO catálogo `Operation` que el editor humano (ADR-014) y se aplica con el MISMO reductor. Pipeline obligatorio antes de persistir: validar cada operación contra el manifiesto de esa versión de plantilla → simular (`dryRun`) el resultado completo → si una operación individual falla, un reintento acotado (1) antes de descartarla sola → aplicar solo las operaciones que sobrevivieron → nunca abortar el lote completo por una operación inválida. Diff previsualizable siempre; nunca autoaplicar sin confirmación humana.
- Alternativas descartadas: el modelo genera HTML/CSS o JSON libre (no validable ni versionable, el antipatrón que motivó excluir aura.build/v0/Bolt como precedente de este contrato); aplicar el lote completo o nada (contradice la lección "descartar-y-continuar" del anexo aura.build §1 pasos 7-8).
- Consecuencias: este documento (`07-extension-ia.md`) es un contrato, no una implementación (objetivo 6 de la sección 1 del prompt maestro: diseñar ahora, implementar después); cuando se implemente, reutiliza el mismo validador de `invariants.ts`/`Invariants.kt` sin código nuevo de validación.

## ADR-028 — Registro de plantilla valida diff estructural contra la versión previa publicada
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-esquema (hallazgo E-01) + 1-persistencia (corrección)
- Contexto: la verificación adversarial de ronda 2 (`08-verificacion-adversarial-esquema.md` E-01) encontró que el algoritmo de registro de `02 §4` validaba el manifiesto nuevo en aislamiento, sin compararlo contra la versión previa del mismo slug — una versión "menor" podía eliminar bloques/secciones o reducir un grupo sin que nada lo impidiera, repitiendo el silencio de H-04/H-05 en un punto nuevo.
- Decisión: el registro (`02 §4` paso 1.5) calcula `structuralDiff(anterior, nueva)` cuando existe una versión previa publicada del slug; si el diff no está vacío y el bump no es mayor, o es mayor sin `MigrationPlan` que cubra cada elemento del diff, el registro se rechaza con `422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`.
- Alternativas descartadas: confiar en que el autor de la plantilla siga la convención de semver por disciplina, sin verificación mecánica (exactamente el patrón que causó el hallazgo).
- Consecuencias: registrar una plantilla es ligeramente más costoso computacionalmente (requiere cargar y comparar la versión anterior), pero cierra la única vía por la que un cambio incompatible podía colarse sin plan de migración.

## ADR-029 — `restore` revalida y renormaliza contra la plantilla vigente, nunca copia el `doc` crudo
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-esquema (hallazgo E-02) + 1-api (corrección)
- Contexto: hallazgo adversarial E-02 (`08-verificacion-adversarial-esquema.md`): tras un cambio de plantilla (flujo C, `04 §2.1`), restaurar una snapshot de ANTES del cambio reintroducía `blockId`s que ya no existen en la plantilla vigente, sin pasar por ninguna validación.
- Decisión: `POST .../document/restore` (`03 §4`) toma solo `content`/`structure`/`theme` de la snapshot, los pasa por el mismo normalizador que `:choose-template` (mueve a `attic` lo que no coincide con el manifiesto vigente) y solo entonces valida y persiste como revisión nueva. La respuesta incluye `movedToAttic`.
- Alternativas descartadas: copiar el `doc` crudo de la snapshot (el comportamiento original, roto); prohibir `restore` tras un cambio de plantilla (demasiado restrictivo — pierde una función legítima de recuperación).
- Consecuencias: `restore` es funcionalmente un no-op cuando la snapshot es de la misma versión de plantilla vigente (caso común); el costo adicional de renormalizar solo aparece en el caso adversarial que lo motivó.

## ADR-030 — Validación de propiedad de `assetId` en cada operación de escritura
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-seguridad (hallazgo S-01) + 1-api (corrección)
- Contexto: hallazgo adversarial S-01 (`09-verificacion-adversarial-seguridad.md`): ninguna validación comprobaba que un `assetId` referenciado en una `Operation` perteneciera a la invitación autorizada o a la plantilla vigente — misma familia de riesgo que H-13 (referenciar un recurso ajeno por id), con el resultado de que la foto de otro cliente podía reutilizarse si se conocía su `assetId`.
- Decisión: toda `Operation` con `ImageValue`/`AudioValue` se valida contra `tpl_asset` por pertenencia (`invitation_id` o `template_version_id` correctos) antes de aplicarse; sin fila, `422 TPL_ASSET_NOT_OWNED` (`03 §3.3`, tabla de errores `§5`). El pipeline de IA (`07 §4`) hereda el mismo control.
- Alternativas descartadas: confiar en que el `assetId` opaco (ULID) es "suficientemente difícil de adivinar" (cierto para adivinarlo a ciegas, pero no protege contra reutilización de un id ya conocido por otra vía legítima de acceso).
- Consecuencias: una consulta adicional por cada `assetId` en un lote de operaciones (barata, índice único sobre `public_id`); cierra una clase de fuga de datos entre clientes.

## ADR-031 — iframe del lienzo sin `allow-same-origin`
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-seguridad (hallazgo S-03) + 1-frontend (corrección)
- Contexto: hallazgo adversarial S-03: `sandbox="allow-scripts allow-same-origin"` (`04 §3`, primer borrador) combina dos flags que juntos anulan buena parte del aislamiento real del sandbox — un patrón conocido de sandbox-bypass — sin que el diseño necesitara `allow-same-origin` para nada (la comunicación ya es exclusivamente por `postMessage`, ADR-018).
- Decisión: `sandbox="allow-scripts"` a secas.
- Alternativas descartadas: mantener ambos flags "por si acaso" (exactamente el razonamiento que debilita la contención sin beneficio funcional demostrado).
- Consecuencias: si fase 3 encuentra una necesidad real de same-origin dentro del iframe, es señal de revisar la arquitectura de canvas, documentado explícitamente para que no se resuelva restaurando el flag sin más.

## ADR-032 — Límite de body HTTP del editor elevado a 768 KiB
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-seguridad (hallazgo S-05) + 1-api (corrección)
- Contexto: hallazgo adversarial S-05: un `OperationBatch` de 50 operaciones con `richText` cerca de su máximo de 8000 caracteres puede pesar ≈400 KB, superando el límite de 256 KiB propuesto originalmente en `03 §8` — el límite de transporte rechazaría lotes que el propio esquema permite construir.
- Decisión: límite de body HTTP de `templates2` = 768 KiB.
- Alternativas descartadas: exigir que el cliente trocee lotes grandes (más complejo del lado cliente para un caso que un límite más alto resuelve sin quitar ninguna protección real).
- Consecuencias: el límite sigue siendo un orden de magnitud menor que un ataque de payload masivo (H-45), solo se ajustó al tamaño real que el esquema permite.

## ADR-033 — Ruta de registro de plantillas formalizada: `POST /master/templates2/versions`, rol MASTER
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-seguridad (hallazgo S-02) + 1-api (corrección)
- Contexto: hallazgo adversarial S-02: la tabla de rutas de `03 §2` no incluía ninguna ruta de registro de plantillas; `02 §4` la mencionaba solo en prosa ("CLI o endpoint MASTER"), sin verbo HTTP, ruta ni control de rol explícito atado.
- Decisión: `POST /master/templates2/versions`, protegida por el control de rol simple ya usado en el resto de `modules/master/**` (no `HierarchyValidationService`, que es para invitaciones — aquí no hay invitación que autorizar). Añadida a la tabla de `03 §2`.
- Alternativas descartadas: dejarlo como "detalle de implementación de fase 2" sin ruta fijada (viola el criterio de terminado de la fase: diseño concreto para implementar sin volver a diseñar).
- Consecuencias: fase 2 tiene la ruta y el control de autorización exactos, sin ambigüedad.

## ADR-034 — Invariantes I-22/I-23 e invariantes de complemento menores de la ronda adversarial
- Fecha: 2026-09-03 · Estado: aceptada · Autor: 1-adv-esquema (hallazgos E-04, E-06) + 1-dominio (corrección)
- Contexto: E-04: nada impedía declarar un `itemBlock` con `source: business|fixed` dentro de un grupo, sin que R4 definiera cómo resolverlo. E-06: ninguna invariante verificaba que `doc.meta.locale` estuviera entre los `locales` declarados por la plantilla.
- Decisión: `I-22_ITEM_BLOCK_SOURCE_NOT_USER` (`validateManifest`, rechaza cualquier `itemBlock` con `source !== "user"`) e `I-23_LOCALE_NOT_SUPPORTED` (`validateDocument`, rechaza `doc.meta.locale ∉ manifest.locales`). Implementadas en `esquema/invariants.ts`; la implementación Kotlin espejo (`Invariants.kt`) es tarea de fase 2, con la misma tabla de casos (ADR-005).
- Alternativas descartadas: dejarlo como comportamiento indefinido documentado en prosa (repite exactamente el patrón que P1 prohíbe).
- Consecuencias: el catálogo de invariantes pasa de 21 a 23; `06-pruebas-y-calidad.md` §4 exige un archivo de casos por cada una, incluidas estas dos.

---

## Aceptación de cierre de fase 1 (orquestador)

Las 34 ADR anteriores (ADR-001…034) se aceptan en bloque, cada una por el motivo de una línea listado abajo. Ninguna se rechaza: las 3 objeciones de severidad alta y las 6 medias de la ronda de verificación adversarial (`08-verificacion-adversarial-esquema.md`, `09-verificacion-adversarial-seguridad.md`) se resolvieron con correcciones concretas a los documentos atacados (ADR-028…034) antes de este cierre, no descartando el diseño original ni aceptándolo con reservas sin corregir.

| ADR | Motivo de aceptación (una línea) |
|---|---|
| ADR-001 | Separación en 4 capas verificada consistente en los 9 documentos de diseño y en los 2 ejemplos completos; cita evidencia H-xx correcta. |
| ADR-002 | Content como mapa plano por `blockId` es la única forma que hace el merge por índice estructuralmente imposible; sin alternativa mejor propuesta ni objetada. |
| ADR-003 | Catálogos cerrados cubren verificablemente las 8 plantillas sembradas (`J-inventario-json.md`); ninguna objeción adversarial los rompió. |
| ADR-004 | Verificación empírica real con `zod@4.5.4` en esta sesión (no una suposición); elimina una dependencia sin pérdida de función. |
| ADR-005 | Cierra el mismo defecto de origen (P1) que causó H-12; el costo de doble implementación es proporcional al riesgo que evita. |
| ADR-006 | Coherente con P5 (nunca destruir ediciones); mitigado su único riesgo (crecimiento no acotado) con una corrección de UX en ronda 3. |
| ADR-007 | Las 9 reglas están verificadas a mano contra los 2 golden files completos de `01 §7`; no se encontró ninguna que produjera un resultado no determinista. |
| ADR-008 | El algoritmo de 4 pasos cierra las 4 causas raíz de las 6 vías de alta actuales (H-07/09/15/16/17); fortalecido en ronda 3 con el diff estructural de ADR-028. |
| ADR-009 | Sigue la decisión ya fijada en `contratos.md` §2 (prompt maestro §7); elimina H-08 de raíz para el módulo nuevo. |
| ADR-010 | DDL completo, revisado línea por línea contra Postgres 13/16; nombres y columnas listos para Flyway sin reinterpretación. |
| ADR-011 | Ventana de 200 revisiones/30 días es un valor razonable y ajustable sin romper el contrato; protege siempre lo que respalda un release. |
| ADR-012 | Sin colisión de nombres con el módulo antiguo; convivencia detrás de bandera queda mecánicamente garantizada por la separación de paquete. |
| ADR-013 | La separación en 3 superficies es la única que impide que el invitado toque la tabla mutable (mata H-04/H-05 en la capa de API). |
| ADR-014 | Operaciones + revisión optimista dan idempotencia real y compatibilidad directa con undo/autoguardado (P7) sin lock distribuido. |
| ADR-015 | Reusa el único servicio de autorización ya probado en el resto del backend; cierra H-13 sin lógica de roles duplicada. |
| ADR-016 | Tabla de errores completa y verificada contra los 13 códigos usados en el resto de los documentos; ninguna excepción sin handler. |
| ADR-017 | Decisión explícita del brief de esta orquestación, justificada por el tamaño real del producto, con condición de reversión documentada. |
| ADR-018 | Aplica directamente la lección primaria de aura.build (`handoffs/1-aura-lecciones.md` #2); fortalecido en ronda 3 (ADR-031). |
| ADR-019 | Pila de undo propia evita una dependencia de historial de publicación escaso (zundo) por menos de 100 líneas propias. |
| ADR-020 | Cierra una clase de inyección de ids antes de que la ronda adversarial tuviera que encontrarla — buena práctica proactiva de 1-dominio. |
| ADR-021 | Desacopla el documento de la infraestructura de almacenamiento concreta; consistente con P3. |
| ADR-022 | La corrección hecha DENTRO de esta misma ronda (golden `before` = documento ya almacenado, no regeneración) es la decisión correcta frente a H-09; ver bitácora de 1-migracion. |
| ADR-023 | Corte por invitación sin lote global es la única opción coherente con P10 y con el propio riesgo que este rediseño existe para eliminar. |
| ADR-024 | Umbrales diferenciados por riesgo real (núcleo de composición más exigente que el resto) en vez de un umbral plano. |
| ADR-025 | Verificado contra el entorno real de esta sesión (sin Docker, Postgres 16 local disponible) — no es una suposición sobre CI. |
| ADR-026 | Diseño de 3 jobs proporcional a las 3 capas de prueba reales; implementación queda correctamente diferida a fase 2. |
| ADR-027 | Aplica las lecciones primarias de aura.build (#1, #5) sin implementar nada — cumple exactamente el objetivo 6 de la sección 1 del prompt maestro. |
| ADR-028 | Cierra el hallazgo adversarial ALTO E-01 con un mecanismo verificable (diff estructural), no solo una advertencia en prosa. |
| ADR-029 | Cierra el hallazgo adversarial ALTO E-02; el costo adicional es cero en el caso común (misma versión de plantilla). |
| ADR-030 | Cierra el hallazgo adversarial ALTO S-01 con el mismo patrón de verificación de pertenencia que ya usa el resto de la API (P8 consistente). |
| ADR-031 | Elimina una combinación de flags de sandbox conocida por debilitar el aislamiento, sin ningún costo funcional (el diseño ya no dependía de `allow-same-origin`). |
| ADR-032 | Corrige un límite que habría rechazado tráfico legítimo permitido por el propio esquema; no reduce ninguna protección real. |
| ADR-033 | Cierra una omisión de especificación (ruta de registro ausente de la tabla de API) que habría dejado una decisión de seguridad implícita para fase 2. |
| ADR-034 | Dos invariantes de una línea que cierran huecos reales del catálogo (E-04, E-06) sin alternativa razonable de dejarlos sin cubrir. |
