# Preguntas abiertas para el dueño

Formato: `- [Fase N · agente] Pregunta. **Supuesto tomado:** …`

**Agrupadas por área al cierre de la fase 1 (2026-09-03).** Ninguna bloqueó el diseño: cada sub-agente tomó la opción más conservadora y siguió. Lo que sigue son los supuestos que un sub-agente de la fase 2 **no debe volver a decidir por su cuenta** sin consultarlos antes. Total: 63.


## Dominio y esquema (11)

- [Fase 1 · 1-dominio] ¿Existe algún consumidor externo que dependa hoy de la forma exacta de `InvitationConfig`? No hay frontend en el repositorio para verificarlo. **Supuesto tomado:** no hay compatibilidad de formato que preservar; la compatibilidad se preserva en el *render* (mismos textos e imágenes visibles), nunca en la forma del JSON (`01 §9`).
- [Fase 1 · 1-dominio] Contenido real de las plantillas `templateId` 11, 12, 14, 16, 17 (solo en producción, no reproducibles desde el repo, H-11/H-42). **Supuesto tomado:** se tratan como cohorte aparte de migración, sin bloquear el resto del diseño (`01 §9`, `05 §7`).
- [Fase 1 · 1R-dominio] Al **cambiar de plantilla** en una invitación ya editada, ¿qué espera el dueño que se conserve? El diseño conservador (ADR-1R-D-07) transporta solo los 17 roles singleton (nombres, fotos de portada y de celebrantes, fecha límite) y manda al `attic` **todo lo que viva en un grupo**: itinerario, galería, mesa de regalos, código de vestimenta, historia. **Supuesto tomado:** se prefiere perder de la vista contenido recuperable antes que emparejar por parecido y reintroducir H-01/H-02; el editor avisa antes de confirmar (`01 §6.4`).
- [Fase 1 · 1R-dominio] Una plantilla **no puede** dejar que el cliente añada un grupo nuevo (p. ej. un tercer bloque de familia además de "Mis Padres" y "Mis Padrinos"), porque los grupos no anidan y el manifiesto declara cuántos hay. `default_visual_xv_premium.json` sí anidaba (`sectionFamily.items[].items[]`). ¿Es aceptable? **Supuesto tomado:** sí — la plantilla declara tantos bloques `group` como grupos quiera ofrecer; el cliente añade ítems dentro, no grupos (`01 §3.2`).
- [Fase 1 · 1R-dominio] ¿Los `assetId` del render público se sirven con **URL de CDN estable** o con URL firmada temporal? `contentHash` (ADR-1R-D-02) es el `ETag` del render y hashea el `ComposedDocument`, así que una URL firmada dentro cambiaría el `ETag` en cada petición y anularía la caché. **Supuesto tomado:** URL de CDN estable dentro del documento compuesto; si hiciera falta firma, se aplica en la capa HTTP **después** de calcular el hash (`01 §5.5`).
- [Fase 1 · 1R-dominio] `contentHash` y `package_hash` llevan el prefijo `"sha256:"` en `01 §5.5`/`§2.1`, pero `02 §2` los declara `CHAR(64)` con `CHECK ~ '^[0-9a-f]{64}$'`. **Supuesto tomado:** el prefijo es preferible (deja la puerta abierta a cambiar de algoritmo sin migrar la columna), pero la decisión es del orquestador; está registrada como contradicción a dirimir en `handoffs/1R-dominio.md`, no resuelta unilateralmente.
- [Fase 1 · 1R-dominio] ¿El catálogo de plantillas será alguna vez **multiidioma real** (una invitación en `en-US`)? I-27 obliga ahora a que un manifiesto que declare un locale traiga **todas** sus etiquetas en ese locale, lo que encarece añadir un idioma a una plantilla existente. **Supuesto tomado:** sí se quiere multiidioma real y es preferible el coste de traducir todo a un fallback silencioso a español (`01 §5.3`).
- [Fase 1 · 1R-dominio] El pipeline Zod → JSON Schema **no se validó con TypeScript 7.x**, que es lo que `contratos.md` §7 pedía cerrar en fase 1: `pnpm add typescript` instala 7.0.2 (cuyo `tsc --version` responde `Version 6.0.2`) y produce errores que 5.x no reproduce. **Supuesto tomado:** la verificación canónica de esta ronda se hizo con `typescript@5.9.3`, coincidiendo con `ADR-1R-F-01` del bloque de frontend; TypeScript 7 queda como tarea de fase 2, no como supuesto cerrado.
- [Fase 1 · 1R-dominio] `zod@4.5.4` **sí existe** en el registro npm y se instaló sin desviación (queda dicho porque el brief preveía que pudiera no existir). Lo que **no** existe es el modo `z.toJSONSchema({A, B})` con objeto literal: lanza `TypeError` en 4.5.4. **Supuesto tomado:** se usa `z.toJSONSchema(registry)`, que sí funciona (ADR-1R-D-08).
- [Fase 1 · dirimidor-1R] Las tolerancias exactas de `image.aspect` (X-06, ADR-1R-X-02) no las sostiene ningún documento: nadie ha dicho cuánto puede desviarse una foto "cuadrada". **Supuesto tomado:** `square` `|w/h − 1| ≤ 0.02`, `portrait` `w/h < 1`, `landscape` `w/h > 1`, `wide` `w/h ≥ 1.6`, `free` sin comprobación; si faltan `width`/`height` en `tpl_asset` no se comprueba y se registra, nunca se rechaza por falta de dato. Ajustarlas es cambiar cinco constantes y su tabla de casos.
- [Fase 1 · dirimidor-1R] `text.pattern` se retira del esquema (X-06, ADR-1R-X-02) porque dos motores de regex no garantizan la misma respuesta sobre el mismo documento. **Supuesto tomado:** ninguna plantilla futura necesita validar texto libre con una expresión regular propia; si alguna la necesitara, la salida correcta es un **tipo de bloque nuevo** en el catálogo cerrado (implementado y probado dos veces), no reabrir `pattern`.

## Persistencia, API y seguridad (14)

- [Fase 1 · 1-persistencia] Tamaño real esperado de `manifest`/`composed` en producción (catálogo de cuántas plantillas). **Supuesto tomado:** decenas, no miles — el índice GIN sobre `manifest` (`02 §2.2`) se diseñó para ese orden de magnitud (`02 §7`).
- [Fase 1 · 1-persistencia] ¿Quién puede figurar como `tpl_release.published_by` — solo el dueño de la invitación, o cualquier rol autorizado (MASTER/ADMIN publicando en su nombre)? **Supuesto tomado:** el `requesterId` autenticado que ejecuta `POST .../release`, sea o no el dueño (`02 §7`).
- [Fase 1 · 1-api] ¿Hay una cuota de almacenamiento S3 por cliente/plan que la API de assets deba respetar? **Supuesto tomado:** cuota conservadora de 200 assets por invitación, ajustable sin cambiar el contrato (`03 §10`).
- [Fase 1 · 1-api] ¿Debe `:choose-template` bloquear por `minPlanTier` insuficiente, o es solo informativo en el catálogo? **Supuesto tomado:** sí bloquea, `403 TPL_PLAN_TIER_INSUFFICIENT` (`03 §10`).
- [Fase 1 · 1R-backend] ¿El bucket `ASSETS` (`core/s3/S3Buckets.kt:156`) es realmente de lectura pública? `S3Service.uploadPublicFile` (`:57-69`) no fija ninguna ACL y `S3Buckets.kt` solo declara nombres; la afirmación de que "ya es público" no es verificable desde el repositorio. **Supuesto tomado:** sí lo es; la URL del render público se construye por patrón con la propiedad configurable `templates2.assets.public-base-url` (por defecto `https://{bucket}.s3.{aws.region}.amazonaws.com`), de modo que apuntar a un CDN o a otra convención no exige migrar ninguna fila (`02 §10.4`).
- [Fase 1 · 1R-backend] ¿Hay un plazo legal máximo entre el borrado de una invitación/cliente y la desaparición efectiva de sus imágenes en S3? **Supuesto tomado:** no hay requisito explícito; se fija un objetivo operativo de 24 h mediante `tpl_asset_gc` y un job horario con reintentos (`02 §5.3`, `§10.3`).
- [Fase 1 · 1R-backend] ¿Se acepta elevar `spring.servlet.multipart.max-file-size` a 15MB y `max-request-size` a 64MB globalmente, sabiendo que hoy no están configurados (rigen 1MB/10MB) y que el cambio también relaja el límite efectivo del módulo antiguo? Es imprescindible para `POST /master/templates2/versions` (paquete de plantilla). **Supuesto tomado:** sí, pero **solo** por esa ruta MASTER; la subida de assets del editor evita el problema usando cuerpo binario crudo (ADR-1R-B-12), para no relajar nada por causa del flujo de cliente.
- [Fase 1 · 1R-backend] ¿Se acepta que las rutas del editor vivan bajo `/editor/**`, que **no** está declarado en `SecurityConfig` y cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`), protegido solo por `@PreAuthorize` del módulo y por `HierarchyValidationService`? La alternativa sería colgarlas de `/user/**`, que ya tiene regla de rol, pero colisiona conceptualmente con el módulo antiguo (`/user/invitations/{invitationId}/config`). **Supuesto tomado:** `/editor/**` con `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` a nivel de clase (`03 §2`), sin tocar `SecurityConfig`.
- [Fase 1 · 1R-backend] ¿Cuál es el tope razonable de tamaño de un documento de invitación? Se necesita uno porque el esquema no acota el `richText` de forma efectiva (contradicción C-01). **Supuesto tomado:** 1 MiB serializado, comprobado en la aplicación y respaldado por un `CHECK` sobre `tpl_document.doc_bytes` (`02 §2` V32), con `422 TPL_DOCUMENT_TOO_LARGE`.
- [Fase 1 · 1R-backend] Al despublicar o rotar el enlace público, la respuesta anterior puede seguir sirviéndose desde el CDN hasta 300 s (`Cache-Control: max-age=300`). ¿Es aceptable esa ventana, o se requiere revocación inmediata (que exige purga activa del CDN, fuera de este módulo)? **Supuesto tomado:** aceptable; se documenta la ventana y se deja la purga como operación de la capa de despliegue (`03 §7`).
- [Fase 1 · 1R-backend] ¿Puede un `ADMIN` o un `MASTER` publicar y despublicar en nombre del cliente, además de editar? El diseño lo permite porque `HierarchyValidationService` no distingue operaciones. **Supuesto tomado:** sí; `tpl_release.published_by` guarda el `requesterId` real, sea o no el dueño (ya asumido por `1-persistencia`, aquí se extiende a despublicar y a rotar el token).
- [Fase 1 · 1R-backend] ¿Cuál es la versión disponible más reciente de `com.networknt:json-schema-validator`? Sin acceso a Maven Central desde esta sesión. **Supuesto tomado:** `1.5.4`; el requisito duro es el soporte de draft 2020-12 (el que emite `emit-json-schema.ts:22`), no el número exacto — fase 2 fija la última 1.5.x disponible.
- [Fase 1 · 1R-backend] ¿Existe algún consumidor que dependa del cuerpo de error actual (`ErrorMessage`, sin campo `code`) de forma que un cuerpo distinto para las rutas nuevas le moleste? **Supuesto tomado:** no, porque el módulo nuevo aún no tiene consumidores; `templates2` devuelve `TplErrorResponse` con `code` y no modifica `core/error` (`03 §10.2`).
- [Fase 1 · dirimidor-1R] Tras un rollback (X-09, ADR-1R-X-04) los invitados que ya tuvieran el enlace **nuevo** (`/i/{publicToken}`) reciben `404`: el módulo antiguo no conoce `public_token` y este módulo no conoce la forma del enlace legado. **Supuesto tomado:** se acepta el `404` y la regla operativa "el rollback solo es barato mientras el enlace nuevo no se haya repartido"; la alternativa (una tabla de redirección `public_token` → URL legada) es superficie nueva que ata el módulo nuevo al antiguo y no se construye salvo que el dueño la pida.

## Frontend y editor (13)

- [Fase 1 · 1-frontend] ¿El editor debe soportar edición táctil real desde el móvil del propio cliente, o solo previsualizar cómo se ve en móvil? **Supuesto tomado:** el editor es desktop-first (formularios, drag-and-drop); la vista móvil es solo un modo de visualización del lienzo (`04 §8`).
- [Fase 1 · 1-frontend] Biblioteca de recorte de imagen para "recorte básico" (objetivo 5, sección 1 del prompt maestro). **Supuesto tomado:** decisión de fase 3, no bloquea el contrato de datos (`ImageValue.focal` ya es independiente de la herramienta elegida) (`04 §8`).
- [Fase 1 · 1R-frontend] `03-api.md` §2 no lista ninguna ruta de **catálogo de plantillas para el cliente**, pero el flujo "elegir plantilla" la necesita antes de `:choose-template`. **Supuesto tomado:** existe `GET /public/templates2/catalog?eventKind&planTier` devolviendo `{slug, version, name, previewImageUrl, minPlanTier}`; se diseña el catálogo contra ese contrato y se eleva como cambio pendiente del bloque 03 (`04 §22` H-F-01).
- [Fase 1 · 1R-frontend] `ImageValue` no guarda rectángulo de recorte (solo `assetId`, `alt`, `focal`), así que el **recorte es destructivo**: no se puede reencuadrar una foto pasada la sesión sin volver a subirla. ¿Se acepta, o se quiere recorte no destructivo (campo `crop` en `ImageValue`, o `parent_asset_id` en `tpl_asset`)? **Supuesto tomado:** recorte destructivo; el archivo original se conserva solo en memoria durante la sesión (`04 §13.3`).
- [Fase 1 · 1R-frontend] No existe ruta para **desactivar un release** (retirar del aire una invitación ya publicada). El `public_token` es estable y no cambia al republicar, así que "cambiar el enlace" no sirve como retirada. **Supuesto tomado:** la retirada se hará poniendo `is_active = false` sobre el release, tras lo cual `/i/{token}` muestra "Esta invitación ya no está disponible"; el endpoint falta y se eleva al bloque 03 (`04 §22` H-F-04).
- [Fase 1 · 1R-frontend] ¿Puede la infraestructura proveer un **nombre DNS y certificado adicionales** (`lienzo.<dominio>`) si la compuerta de aislamiento del lienzo falla (ADR-1R-F-02)? **Supuesto tomado:** no se solicita hoy; la contingencia queda diseñada y solo se activa si fallan las comprobaciones A2/A4 de `04 §8.5`.
- [Fase 1 · 1R-frontend] ¿Puede añadirse una **regla CORS** (`Access-Control-Allow-Origin: *`, solo `GET`) al bucket S3 `ASSETS` y a las rutas estáticas del frontend? Sin ella, las tipografías no cargan dentro del lienzo aislado y la vista previa deja de ser fiel. **Supuesto tomado:** sí, son archivos públicos y la regla no amplía ninguna superficie; queda como tarea de infraestructura de fase 2/4 (`04 §8.4 C1`).
- [Fase 1 · 1R-frontend] El backend tendría que llamar al frontend (`POST /api/revalidate`) al publicar, con un secreto compartido: una dirección de dependencia nueva. ¿Se acepta, o se prefiere que el frontend sondee? **Supuesto tomado:** webhook con secreto, con `revalidate: 300` como red de seguridad si la llamada falla (ADR-1R-F-09).
- [Fase 1 · 1R-frontend] `SectionSpec.variants` es una lista de `Ident` **sin etiqueta ni imagen por variante**, pero el editor promete "elegir entre miniaturas". **Supuesto tomado:** el selector usa las etiquetas es-MX y los diagramas SVG del `sectionRegistry` del frontend (`variantLabels`), no fotos de la plantilla (`04 §22` H-F-06); si se quisieran miniaturas reales haría falta un campo nuevo en el manifiesto.
- [Fase 1 · 1R-frontend] ¿Se acepta que **no haya modo offline real** (sin red no se pueden subir fotos ni componer)? **Supuesto tomado:** sí; se garantiza únicamente que ninguna edición de texto o de estructura se pierda (cola + `localStorage` + reenganche a `window.online`), y que el indicador diga la verdad en todo momento (`04 §12.8`).
- [Fase 1 · 1R-frontend] `esquema/operations.ts` no tiene `clearItemBlock`, así que deshacer un `setItemBlock` sobre un bloque de ítem que no tenía valor previo no es expresable. **Supuesto tomado:** esa entrada de undo se marca como no deshacible y el botón lo dice; se eleva como hueco del catálogo al bloque 01 (`04 §10.3`).
- [Fase 1 · 1R-frontend] Texto enriquecido: ¿se quiere Tiptap (≈200 KB) para las dos marcas que admite `RichDoc` (negrita y cursiva) más enlaces? **Supuesto tomado:** no; editor propio mínimo sobre `RichDoc`, y se reevalúa si el catálogo de marcas crece (`04 §22` H-F-09).
- [Fase 1 · dirimidor-1R] `I-31_PALETTE_CONTRAST_BELOW_AA` queda **reservada y sin implementar** (X-03) porque implementarla equivaldría a aceptar ADR-1R-F-06, y el estado de las ADR lo fija el orquestador. **Supuesto tomado:** mientras ADR-1R-F-06 siga "propuesta", una plantilla registrada en producción puede traer una paleta que incumpla AA y solo lo detectará `axe` en el e2e de las plantillas del repositorio. Si el orquestador la acepta, entra `I-31` en `esquema/invariants.ts`, en `02 §7` (`InvariantCode.kt`) y en `06 §4` con su fichero de casos.

## Migración (14)

- [Fase 1 · 1-migracion] Nombres visibles exactos de los 7 `templateId` restantes (4, 6, 7, 8, 9, 10, 13) — no releídos en esta fase por economía de tokens. **Supuesto tomado:** fase 4 los obtiene directamente de `invitation_template.name` en Postgres al construir cada paquete, no bloquea el diseño del proceso (`05 §8`).
- [Fase 1 · 1-migracion] Volumen real de invitaciones con `invitation_configs` generado (sin acceso a producción desde esta sesión). **Supuesto tomado:** el diseño de corte por invitación, sin lote global (`05 §4`), es intencionalmente insensible al volumen.
- [Fase 1 · 1-migracion] Umbral para distinguir "contenido de demostración" de "dato real corto" al migrar (¿12 caracteres es el corte correcto?). **Supuesto tomado:** 12 caracteres, conservador, con cola de revisión humana para los casos ambiguos en vez de auto-clasificación (`05 §3.2`, `05 §8`).
- [Fase 1 · 1R-calidad] Las fechas del itinerario legado son texto libre sin año (`"Miércoles 31, Diciembre"`). ¿De dónde sale el año al convertirlas a `IsoDate`? **Supuesto tomado:** de `invitation.date` en Postgres; si no hay `invitation.date`, la invitación va a cola de revisión en vez de inventar un año (`05 §4.3` decisión 3).
- [Fase 1 · 1R-calidad] Tres campos legados no tienen destino en el catálogo cerrado: `sectionDresscode.items[].bullet` (18 apariciones), un segundo hashtag por sección de galería, y un `body` con más de una URL distinta en mesa de regalos/recomendaciones. ¿Se amplía el catálogo o se descartan explícitamente? **Supuesto tomado:** **BLOQUEAN** el registro del paquete hasta que haya ADR; nunca se descartan en silencio (P1, `05 §4.2`/`§4.3` decisión 4).
- [Fase 1 · 1R-calidad] Los `templateId` 4 y 5 tienen el campo `name` **vacío** en el dump de `V1__initial_schema.sql:1133-1136`, así que su nombre y su slug nuevos son una decisión de producto. **Supuesto tomado:** `boda-basica` (4) y `boda-clasica` (5), coherentes con el ejemplo ya construido en `diseno/ejemplos/` (`05 §3`).
- [Fase 1 · 1R-calidad] Para el `templateId` 11 hay **dos** artes distintos en el repositorio: `default_visual_boda_premium_2.json` (comentado en el sembrador) y `payload-template-2.json` (lo que `scripts/upsert_template_11_12.js` escribió en producción). ¿Cuál es la verdad? **Supuesto tomado:** no determinable desde aquí; el paquete del 11 no se construye hasta leer `default_visual_configs` de producción (`05 §10.1`).
- [Fase 1 · 1R-calidad] Tras el corte, lo que el cliente edite en el editor nuevo **no se retro-propaga** a `invitation_configs`, así que un rollback tardío pierde ese trabajo de cara al render. ¿Se acepta una ventana de "rollback barato" de 7 días por invitación, tras la cual revertir exige avisar al cliente? **Supuesto tomado:** sí; construir un compositor inverso se descarta por coste y riesgo (`05 §7.5`).
- [Fase 1 · 1R-calidad] ¿Se acepta una retención mínima de **180 días** de `invitation_configs`, `default_visual_configs`, `default_content_configs` y los objetos S3 legados tras el corte de la última invitación, antes de cualquier borrado? **Supuesto tomado:** sí, y además el borrado exige aprobación explícita del dueño registrada (`05 §7.2`, `§9`).
- [Fase 1 · 1R-calidad] La tabla de auditoría `tpl_migration_run` es una migración Flyway nueva (`V37`) que **no** estaba en el rango `V29`-`V36` de `02 §2`. ¿Se acepta como migración de **fase 5**, fuera del alcance de la fase 2? **Supuesto tomado:** sí; sin ella no hay rastro de qué se comparó ni forma de auditar un rollback (`05 §7.2`).
- [Fase 1 · 1R-calidad] Sustituye a la pregunta previa de `1-migracion` sobre el umbral de 12 caracteres: ese umbral clasificaba `"Georgina"` (nombre de la niña ficticia del bautizo de demostración) como dato real del cliente. **Supuesto tomado:** se elimina todo umbral de longitud; toda coincidencia con el baseline de demo va a cola de revisión humana, y el baseline se lee de Mongo, no del repositorio (ADR-1R-C-04, `05 §5.3`).
- [Fase 1 · 1R-calidad] Los códigos `TPL_AI_*` (`07 §6`) deben entrar en la tabla de errores de `03 §5`, y la tabla `tpl_ai_proposal` es una migración futura fuera de `V29`-`V36`. Este bloque no edita `03-api.md` ni `02-persistencia-y-catalogo.md`. **Supuesto tomado:** se elevan como contradicción a dirimir CD-7 para que el orquestador los vuelque.
- [Fase 1 · 1R-calidad] Sustituye a la pregunta previa de `1-pruebas` sobre Docker en el runner: verificado que Docker **no** está en este entorno local (`initdb` como root también falla). **Supuesto tomado:** `services: postgres` en GitHub Actions y clúster efímero delegado en el usuario `postgres` en local, unificados por la variable `TPL_TEST_JDBC_URL`; Testcontainers descartado en los dos (ADR-1R-C-10, ADR-1R-C-12).
- [Fase 1 · 1R-calidad] La IA es la única parte del sistema con coste marginal por uso. ¿Cuál es el presupuesto por cliente del que depende el valor concreto de la cuota (`402 TPL_AI_QUOTA_EXCEEDED`)? **Supuesto tomado:** 10 propuestas/hora/invitación y 60/hora/cliente como tope técnico, con la cuota económica sin fijar hasta que haya proveedor (`07 §7`).

## Pruebas, CI y calidad (7)

- [Fase 1 · 1-pruebas] ¿El runner de GitHub Actions de este repositorio tiene Docker disponible (habilitaría Testcontainers como alternativa)? **Supuesto tomado:** no se asume — el camino primario (`pg_ctl`/`initdb` local) funciona en cualquier caso; Testcontainers queda como alternativa condicional, no como diseño primario (`06 §8`).
- [Fase 1 · 1R-calidad] `default_visual_boda_basico.json` marca `visibility: false` en cinco secciones y `mergeConfiguration` lo pisa a `true` (H-24), así que el cliente lleva tiempo viendo secciones que la plantilla decidió ocultar. Al migrar, ¿se respeta la intención de la plantilla (`false`) o lo que el cliente ha estado viendo (`true`)? **Supuesto tomado:** se migra `true` — migrar no es el momento de cambiar el producto (`05 §4.3` decisión 1).
- [Fase 1 · 1R-calidad] Sección de mesa de regalos vacía y visible (H-06): ¿se oculta al migrar, se deja visible y vacía, o se bloquea la publicación? **Supuesto tomado:** se migra visible tal cual y `report.stillDefault` la señala en el editor; no se oculta automáticamente (`05 §4.3` decisión 2).
- [Fase 1 · 1R-calidad] `06 §9` sondea `GET /actuator/health` para saber si el backend ya arrancó en el job `e2e`, pero no está verificado que Actuator esté habilitado en este proyecto. **Supuesto tomado:** si no lo está, fase 2 sustituye el sondeo por una ruta pública equivalente sin cambiar la forma del workflow (`06 §11`).
- [Fase 1 · 1R-calidad] Seis restricciones declaradas en `esquema/blocks.ts` (`richText.maxLength`, `text.pattern`, `text.multiline`, `image.aspect`, `image.maxBytes`, `audio.maxBytes`) no las verifica ninguna invariante: `validateValueAgainstSpec` solo tiene `case` para `text`, `listText`, `dateTimeRange`, `choice` y `group`. Es una regla escrita en el esquema que nadie aplica, que es justo lo que ADR-005 quiso eliminar. ¿Se amplían las invariantes o se retiran esas constraints del esquema? **Supuesto tomado:** no se toca el esquema desde este bloque; `06 §4.1` añade la prueba `invariant-gaps.contract.test.ts` que hace visible el hueco (hoy fallaría con 6), y se eleva como contradicción a dirimir CD-4.
- [Fase 1 · 1R-calidad] `esquema/composed.ts:32` usa `z.any()` para `richText`, y la regla de lint de ADR-005 que `06 §7` endurece lo prohibiría. ¿Se excluye `composed.ts` de la regla (no se exporta a JSON Schema) o se tipa el `RichDoc` también en el compuesto? **Supuesto tomado:** se excluye `composed.ts` de la regla y se eleva como contradicción a dirimir CD-5.
- [Fase 1 · 1R-calidad] **Nota de sincronización al cierre de la ronda.** Dos de mis preguntas quedaron resueltas por `1R-dominio` mientras trabajábamos en paralelo: el `z.any()` de `composed.ts` ya no existe (la regla de lint de `06 §7` se aplica sin excepciones), y `reorderSections` ya tiene semántica definida para todos (**I-24 `REORDER_NOT_A_PERMUTATION`**, permutación exacta). La pregunta de las constraints sin validador sigue viva pero **reducida a cinco**: `text.pattern`, `text.multiline`, `image.aspect`, `image.maxBytes`, `audio.maxBytes` (`richText.maxLength` ya se valida). **Supuesto tomado:** las cinco se dejan como están y la prueba `invariant-gaps.contract.test.ts` de `06 §4.1` las mantiene visibles hasta que el bloque 01 decida ampliarlas o retirarlas.

## Extensión de IA (3)

- [Fase 1 · 1-ia] Proveedor de IA concreto (Vercel AI SDK es la recomendación de `contratos.md`, sin versión ni proveedor fijado). **Supuesto tomado:** decisión de la fase de implementación real, fuera de esta fase de diseño (`07 §6`).
- [Fase 1 · 1R-calidad] `esquema/operations.ts:20` permite `reorderSections` con una lista de **una sola** clave, y `03 §3.3` no define qué pasa con las secciones que no aparecen en `order`. ¿Es una permutación exacta obligatoria, o una lista parcial que solo mueve lo nombrado? **Supuesto tomado:** para propuestas de IA, permutación exacta (A-INV-01 lo exige); para el editor humano queda sin decidir y se eleva como contradicción a dirimir CD-6.
- [Fase 1 · 1R-calidad] El diseño permite que un operador de la jerarquía (agencia, ADMIN) lance sugerencias de IA sobre la invitación de un cliente, porque reusa `HierarchyValidationService` sin distinguir operaciones. ¿Se quiere así, o la IA debe restringirse al dueño de la invitación? **Supuesto tomado:** se permite, igual que el resto de las rutas de edición; si se quiere restringir hace falta una comprobación extra (`07 §10`).

## Proceso y orquestación (no son decisiones de producto) (1)

- [Fase 1 · orquestador] Esta sesión no tuvo acceso a una herramienta de sub-agentes (Task/Agent) — el entorno solo expone `mcp__Claude_Code_Remote__create_session` (sesiones remotas completas, pensadas para paralelismo entre sesiones con su propio contenedor, no para reparto fino de tareas de diseño dentro del mismo árbol de trabajo). **Supuesto tomado:** el orquestador ejecutó los 7 roles de diseño y los 2 roles adversariales directamente, en secuencia dentro de la misma sesión, en vez de delegarlos a sub-agentes con modelos distintos como pedía el brief — documentado explícitamente en cada bitácora y en el reporte final del chat, sin ocultar la sustitución.

## Fase 2 · 2-0a — cimientos (7)

- [Fase 2 · 2-0a] `06 §3` describe **un solo** `golden/templates/_business.json` compartido, pero los dos ejemplos disponibles usan `BusinessSnapshot.date` distinto (`2026-12-12` boda-clasica, `2026-11-14` xv-jardin — verificado comparando `cover.date` en los `compuesto.json` de referencia): un fichero único habría obligado a fabricar un valor incorrecto para uno de los dos. **Supuesto tomado:** un `business.json` **por plantilla** dentro de `golden/templates/<slug>-<version>/`, con los valores literales de `NOTAS.md` cuando existen (boda-clasica) o el único campo de negocio realmente consumido por el manifiesto más valores conservadores sin efecto observable (xv-jardin). Documentado en `frontend/packages/schema/golden/README.md`.
- [Fase 2 · 2-0a] El `AssetIndex` que necesita `compose()` no tiene fuente en ningún documento de diseño (ni `01` ni `06` dicen cómo se construye la URL a partir del `assetId` fuera de la propia composición). **Supuesto tomado:** `url = "https://cdn.invitaciones.evolutiondev.mx/a/" + assetId.slice(3) + ".webp"` (quitar el prefijo `as_`, añadir `.webp`) — **verificado**, no solo supuesto: con esta regla, `compose()` reproduce byte a byte los dos `compuesto.json` ya existentes en `diseno/ejemplos/` (que la ronda 1R había generado por otra vía no documentada). Si un futuro ejemplo con extensión distinta (`.jpg`, `.png`) rompe esta regla, hay que generalizarla, no ampliar el golden a mano.
- [Fase 2 · 2-0a] `operations-reducer.ts` (`applyOperation`, `01 §6.5`) y `migrate.ts` (`migrate`, `01 §6.1`) **no están entre los 10 archivos que la fase 1 dejó en `diseno/esquema/`** — son lógica de negocio del reductor y de la migración, fuera del alcance declarado de 2-0a ("no escribas lógica de negocio del módulo templates2"). Sin ellos, `golden/operations/*.cases.json` no puede traer el "resultado esperado del reductor" que pide `06 §5.4`, y `golden/migrations/` no puede traer pares `antes/despues-esperado` reales. **Supuesto tomado:** entregar lo verificable sin esos dos archivos (forma Zod válida/inválida + comprobación referencial contra el manifiesto para operaciones; forma de las 11 `MigrationOp` para migraciones) y dejar `reducerResult: null, reducerResultPending: true` / "0 pares" documentado explícitamente, en vez de simular un reductor que no existe. El siguiente agente que escriba `operations-reducer.ts`/`migrate.ts` en TypeScript (o su equivalente Kotlin) debe regenerar estos golden con el resultado real.
- [Fase 2 · 2-0a] `06 §5.3` pide "100 % de esquemas exportados" con caso válido/inválido cruzado Zod↔ajv, pero `@invitaciones/schema` exporta ~70 esquemas Zod individuales y el bundle de JSON Schema solo hospeda 15 `$defs` independientes (el resto se inlinea dentro de esos 15, por diseño del emisor — `emit-json-schema.ts` `COMPARTIDOS`/`RAICES`). **Supuesto tomado:** `schema-coverage.contract.test.ts` cubre los 15 `$defs` reales (los que de verdad cruzan a Kotlin vía `json-schema-validator`), no los ~70 símbolos exportados uno por uno; es la intersección que importa para P1 (paridad TS↔Kotlin), pero no es literalmente "cada export". Si se quiere el 100 % literal, hay que decidir primero si los ~55 esquemas restantes deben emitirse también como `$defs` propios (cambio en `emit-json-schema.ts`, fuera de mi permiso de "no reescribir el emisor").
- [Fase 2 · 2-0a] El script de Postgres efímero de `06 §6.2` se llama `pg-test-cluster.sh`; el brief de este sub-agente pide explícitamente `scripts/pg-ephemeral.sh`. **Supuesto tomado:** se usa el nombre del brief (autoridad más específica); mismo contrato de variables de entorno (`TPL_TEST_JDBC_URL`/`_DB_USER`/`_DB_PASSWORD`), con la diferencia añadida de puerto **aleatorio** por defecto (el brief lo exige; `06 §6.2` usaba un puerto fijo 55432) y sub-comandos `status`/`selftest` añadidos para poder verificarlo sin escribir Kotlin.
- [Fase 2 · 2-0a] `.gitignore` de la raíz tenía la línea `src/test/` (ignoraba TODO el árbol de pruebas Kotlin), que habría bloqueado en silencio el primer commit de pruebas de 2-0b bajo `src/test/kotlin/...templates2/**` (P9). Lo señalé sin tocarlo (fuera de mi lista de archivos permitidos). **Resuelto durante esta misma sesión** (fuera de mis llamadas a herramientas): la línea fue retirada y sustituida por un comentario explicativo en el mismo lugar del archivo. Verificar de todos modos antes del primer commit de `src/test/kotlin/**` que la línea siga ausente.
- [Fase 2 · 2-0a] `TextSpec.constraints` en `blocks.ts` no incluye `pattern` (retirado en X-06), pero el golden `text.cases.json` de `06 §5.2` que describe la tabla de casos menciona límites de longitud sobre `TextValue` (2000 chars, hard cap del esquema) distintos de `TextSpec.constraints.maxLength` (200 por defecto, blando). **Supuesto tomado:** el caso `N-limit` de `text` usa el límite DURO del esquema (2001 chars → zod inválido); el límite blando del spec (I-16) ya está cubierto por `golden/invariants/I-16-*.json` y por el caso "extra" de `listText` con `maxItemLength` reducido a propósito — documentado con comentarios en `scripts/gen-golden-blocks.ts`.

## Fase 2 · 2-0b — verificación Kotlin y cimiento del módulo (6)

- [Fase 2 · 2-0b] `06 §4` dice que la comparación de invariantes es por `code` **y `path`**, pero el `expect` de `golden/invariants/` solo lleva códigos y el `path` se descarta en los dos lados (objeción O-11 de `2-0a-REV`, sin registrar hasta ahora). Un `Invariants.kt` con los códigos correctos y las rutas mal pasaría los 102 casos. **Supuesto tomado:** se emiten las rutas exactas de `invariants.ts` y se comprueban en una prueba aparte (`InvariantPathTest`, 31 pruebas: `sections.<key>.defaultVariant`, `blocks.<id>`, `theme.defaultPaletteId`, `defaults.<key>`, `content.<key>`, `structure.<key>.variant`, `meta.locale`, `operations.reorderSections.order`, `<path>[<itemId>].<itemBlockId>`). **No** se regeneran los 30 ficheros con `path` dentro de `expect`: eso cambia el formato publicado del golden y necesita ADR del orquestador. ¿Se regeneran, o basta con la prueba de rutas del lado Kotlin?
- [Fase 2 · 2-0b] `./gradlew check` ahora depende de `verifyJsonSchemaEmitted`, que exige Node 22 + pnpm 10 con `pnpm install` hecho en `frontend/` (ADR-2-0b-02: falla explícitamente si falta `pnpm`, nunca pasa en silencio). El job `backend` de `.github/workflows/ci.yml` no instala nada de Node. **Supuesto tomado:** no toco `ci.yml` (fuera de mi lista de ficheros permitidos) y lo dejo como acción del orquestador: o añadir `pnpm install` en `frontend/` al job `backend`, o ejecutar `./gradlew check -x verifyJsonSchemaEmitted` allí y dejar la compuerta de deriva al job `frontend` (que ya la tiene desde la corrección O-04 de 2-0a-REV). Recomiendo lo primero: es la única forma de que el build de Kotlin rompa ante deriva.
- [Fase 2 · 2-0b] `02 §7.1` pide `Templates2Exception` "con `code: TplErrorCode` y `status: HttpStatus`" en un paquete que la misma sección declara "sin Spring". **Supuesto tomado:** `TplErrorCode.httpStatus` es `Int` y la capa `api` traduce a `HttpStatus` (ADR-2-0b-03). ¿Se corrige `02 §7.1` o se prefiere relajar la pureza del dominio?
- [Fase 2 · 2-0b] `03 §5` es "la fuente única" de `TplErrorCode` (35 códigos), pero `01 §2.1` cita `TPL_PACKAGE_UNEXPECTED_FILE` y `TPL_MIGRATION_PLAN_ORPHAN`, que **no** están en esa tabla (sí lo está `TPL_MIGRATION_PLAN_MISSING`). **Supuesto tomado:** el enum contiene **exactamente** los 35 de `03 §5`, para que `ErrorCatalogParityTest` pueda compararlos; los dos códigos de registro que faltan se elevan aquí para que el orquestador decida si entran en la tabla o si el registro los reporta como `TPL_MANIFEST_INVALID` con detalle. Los 8 códigos de `OperationError` (`01 §6.5`) **no** son problema: allí `code` es `String`, no `TplErrorCode`.
- [Fase 2 · 2-0b] Objeción **O-15** de `2-0a-REV` sigue abierta: `golden/invariants/I-14-*.json` e `I-19-*.json` tienen 2 casos y `contratos.md §6` pide tres (viola / no viola / extra), mientras `06 §4` marca "—" en la columna de extra para esas dos. **Supuesto tomado:** no las toco — añadir los 2 casos cambiaría el recuento publicado (102 casos) y regeneraría golden sin ADR. Mi `InvariantParityTest` fija hoy 30 ficheros / **102** casos; si se añaden, hay que actualizar esa cifra en la prueba y en `handoffs/2-0a.md`.
- [Fase 2 · 2-0b] Objeción **O-12**: `CompositionReport.invalidValues` está declarado y el `compose()` de TypeScript **no lo puebla jamás**; los dos `reporte.json` congelan `[]`. Este bloque no escribe `compose()`, así que no lo replica: solo deja el riesgo anotado en el KDoc de `CompositionReport.kt` y en el handoff. **Supuesto tomado:** la decisión es del bloque 2-2 y debe tomarse **con ADR** (poblarlo en Kotlin rompería la paridad byte a byte con los golden; no poblarlo hace que TS y Kotlin coincidan en un silencio que viola P1). Hace falta decidir además si se corrige `compose.ts` y se regeneran los dos `reporte.json`.

## Fase 2 · 2-1 — persistencia (5)

- [Fase 2 · 2-1] **Hallazgo, no solo pregunta**: `InvitationGuestEntity.kt:28` (módulo antiguo, `modules/shared/guests`) mapea una columna `graduates_name` sobre `invitation_guest` que **ninguna** migración de `db/migration` crea (verificado: `grep` sobre todos los `.sql` de esa carpeta, cero resultados fuera del propio Kotlin). Con `spring.jpa.hibernate.ddl-auto: validate` (`application.yml:32`), esto ya haría fallar el arranque de la aplicación completa **hoy**, sin ningún cambio de `templates2` — verificado reproduciendo el fallo exacto (`SchemaManagementException: Schema-validation: missing column [graduates_name] in table [invitation_guest]`) al intentar un `@DataJpaTest` sin acotar `@EntityScan`. No es competencia de este bloque arreglarlo (`modules/shared/guests/**` es del módulo antiguo, prohibido tocar). **Supuesto tomado:** `SpringPersistenceTestSupport` acota el slice de Spring a `templates2.persistence` (ADR-2-1-02) para que la prueba de `ddl-auto: validate` de este bloque no dependa de un defecto ajeno. ¿Quién y cuándo corrige `InvitationGuestEntity` (o añade la migración que crea `graduates_name`, si la columna sí existe en producción por fuera de Flyway)? Mientras no se corrija, **ningún** futuro `@SpringBootTest`/`@DataJpaTest` sin acotar del proyecto completo puede pasar.
- [Fase 2 · 2-1] El mapeo `event_type.name`/`is_wedding` → `EventKind` y `invitation_plan.is_premium` → `planTier` de `BusinessSnapshotReader` no tiene fuente en `02`/`03` (ADR-2-1-04): es una tabla fija en Kotlin, verificada contra el catálogo hoy sembrado (6 `event_type`, 2 `invitation_plan`). **Supuesto tomado:** conservador, con `GENERIC` como cajón de sastre y `planTier` binario (1/2, nunca 3). ¿Se acepta este mapeo en código, o debe vivir en una tabla de correspondencia en base de datos (más flexible para producto, más superficie para P1)? ¿Existe ya, fuera de este repositorio, un tercer nivel de plan que debiera mapear a `planTier = 3`?
- [Fase 2 · 2-1] `scripts/pg-ephemeral.sh` reutiliza el clúster si `TPL_TEST_STATE_DIR` ya está en marcha (`start` es idempotente). `PgTestCluster` usa por defecto `/tmp/templates2-pg-2-1`, fijo. Si un bloque posterior (2-2/2-3/2-4/2-5) copia este patrón con el mismo nombre por descuido, dos suites de la misma máquina compartirían clúster y el `stop` de una mataría el de la otra (documentado en la cabecera del script). **Supuesto tomado:** cada bloque que añada su propio `PgTestCluster`-como debe fijar su propio `TPL_TEST_STATE_DIR` (`/tmp/templates2-pg-<bloque>`); no hay mecanismo automático que lo fuerce. ¿Se prefiere que `IntegrationTestBase`/`PgTestCluster` de 2-1 se conviertan en la ÚNICA infraestructura de Postgres del módulo (import compartido desde otros bloques) en vez de que cada uno reimplemente el bootstrap?
- [Fase 2 · 2-1] Los métodos nativos que escriben `jsonb` (`TplDocumentRepository.insertIfAbsent`/`applyRevision`) reciben el documento como `String` (JSON ya serializado por el llamador con `Templates2Json.canonical(node)`) y hacen `CAST(:doc AS jsonb)` en la sentencia, en vez de aceptar un `JsonNode` directamente — Hibernate 6.6 no tiene un camino fiable para bindear `JsonNode` como parámetro con nombre de una `@Query(nativeQuery = true)` sin registrar un `UserType` adicional, que `02 §8.1` prohíbe ("sin dependencias nuevas"). **Supuesto tomado:** los bloques 2-2/2-3 (que escriben `DocumentStore`/`ReleaseStore`, los que de verdad llaman a estos métodos) deben serializar con `Templates2Json.canonical(...)` antes de llamar — documentado en el KDoc de cada repositorio y en `handoffs/2-1.md`. ¿Se acepta esta firma (`String` + `CAST`), o se prefiere que el repositorio reciba `JsonNode` y serialice internamente (mismo resultado, pero mueve la responsabilidad)?
- [Fase 2 · 2-1] `tpl_document_snapshot.origin` acepta `'operations'|'choose_template'|'restore'|'import'|'ai'` (`CHECK`, `02 §2` V33) pero ningún documento de diseño lista qué escribe `origin = 'import'` — no hay ninguna ruta de "importar documento" en `03-api.md` ni en `05-migracion.md` (que usa `INSERT`/`DO UPDATE` directos sobre `tpl_document`, no pasa por snapshot con ese origen literal descrito). **Supuesto tomado:** se deja el valor en el `CHECK` tal cual lo fija `02 §2` (no se toca DDL sin ADR) y se eleva aquí para que el bloque que primero necesite escribir un snapshot de importación confirme si `'import'` es el valor correcto o si migración usa otro.

## Composición y migración (fase 2, bloque 2-2) — 7

- [Fase 2 · 2-2] `CompositionReport.invalidValues` no lo poblaba nadie (objeción O-12) y ahora sí. ¿Quiere el dueño que un valor inválido **además** deje de renderizarse, o basta con que quede registrado y `preflight` bloquee la publicación? **Supuesto tomado:** solo se registra; el `ComposedDocument` no cambia ni un byte, porque dejar de renderizar sería una pérdida visible de contenido del cliente decidida por el backend (ADR-2-2-01).
- [Fase 2 · 2-2] Un `DateSpec` puede declarar `formatId: "h12"` y un `TimeSpec` `formatId: "long"` con datos perfectamente válidos: `formatId` es un `Ident` libre y ninguna invariante lo acota al tipo del bloque. ¿Se añade una invariante nueva (`I-32_FORMAT_ID_NOT_APPLICABLE`) que lo prohíba en el registro del paquete? **Supuesto tomado:** no se añade —el catálogo de 30 invariantes está cerrado por ADR-005/ADR-1R-D-05 y ampliarlo exige decisión del dueño—; en su lugar los formateadores devuelven el valor crudo, igual en TypeScript y en Kotlin (ADR-2-2-03).
- [Fase 2 · 2-2] Una sección con `required: true` y `defaultVisible: false` produce, cuando el documento no la menciona, una sección **obligatoria e invisible**: R1 fuerza `visible = true` solo sobre las que están en `doc.structure` (I-17), y R1c inserta las ausentes con `spec.defaultVisible` tal cual (`01 §5.3`). ¿Es un manifiesto que debería rechazarse en el registro, o R1c debe aplicar también I-17? **Supuesto tomado:** se conserva el pseudocódigo normativo y la paridad con TypeScript, y el comportamiento queda congelado en `golden/compose/r1c-required-con-defaultVisible-false.case.json` para que ningún bloque lo cambie sin darse cuenta.
- [Fase 2 · 2-2] El catálogo **cerrado** de 11 operaciones de migración (`01 §6.2`) no tiene ninguna que remapee la **variante** de una sección, así que una versión nueva que retire una variante solo puede cubrir ese elemento del diff estructural retirando o renombrando la sección entera (ADR-028 exigiría entonces rechazar el registro). ¿Se añade una operación `renameVariant`/`remapVariant` al catálogo, o se acepta que retirar una variante obliga a retirar la sección? **Supuesto tomado:** no se amplía el catálogo (ampliarlo exige ADR y espejo en TypeScript); `MigrationPlanCoverageChecker` lo reporta como no cubierto y lo dice con el nombre de las operaciones que sí lo cubrirían.
- [Fase 2 · 2-2] `migrate` genera los `itemId` de `moveIntoGroup` con un contador determinista, de modo que dos invitaciones migradas con el mismo plan reciben los mismos `itemId`. ¿Le importa al dueño que esos ids no sean opacos ni únicos globalmente? **Supuesto tomado:** no importa —I-03 solo exige unicidad **dentro** del grupo y el `itemId` no autoriza nada—, y la pureza que exige `01 §6.3` lo requiere; hay una sobrecarga lista para inyectar `UlidGenerator` si se prefiere lo contrario (ADR-2-2-06).
- [Fase 2 · 2-2] `switchTemplate` devuelve `{doc, report}` **sin** rama de error, tal como lo declara `01 §6.4`, pero su paso 6 dice que el documento resultante "se valida contra I-01…I-30 antes de escribirse". ¿Debe `switchTemplate` devolver también las violaciones, o basta con que el llamador (`:choose-template`, bloque 2-4) ejecute `validateInvariants`? **Supuesto tomado:** se respeta la firma declarada y valida el llamador; documentado como garantía **no** dada en `handoffs/2-2.md`.
- [Fase 2 · 2-2] `Violation.detail` **ya diverge** entre TypeScript (`"text ≠ image"`, U+2260, `invariants.ts:183`) y Kotlin (`"text != image"`, `Invariants.kt:308-310`), y ninguna prueba lo detecta porque los golden solo comparan códigos (objeción O-11, sigue abierta). ¿Qué lado manda? **Supuesto tomado:** ninguno de los dos se toca desde este bloque (`templates2/schema` estaba congelado) y las comparaciones del reductor y de la migración recortan `detail`; es un carácter en cualquiera de los dos lados y queda como acción del orquestador.

## Fase 2 · orquestador — escaladas de la revisión de persistencia (2)

- [Fase 2 · orquestador] **`invitation_guest.graduates_name` no la crea ninguna migración**, pero `InvitationGuestEntity.kt:28` la mapea y `application.yml:32` fija `ddl-auto: validate`. Verificado: una base de datos construida solo con Flyway **no arranca la aplicación**; afecta a cualquier entorno nuevo y al job `backend` del CI, no solo a las pruebas. Es un defecto **preexistente del módulo antiguo**, medido por 2-1-REV como el único desajuste esquema/entidad del proyecto. **Supuesto tomado:** la fase 2 **no lo corrige** (invitados es área prohibida por el brief y exigiría una migración fuera de `V29`–`V37` sobre una tabla ajena); se acotan los contextos Spring del módulo, con el patrón ya probado en ADR-2-1-02. Pregunta para el dueño: ¿quién crea esa columna y con qué número de migración? Basta `ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255)`. Hasta entonces, ningún entorno nuevo levanta la aplicación completa (ADR-2-ORQ-02).
- [Fase 2 · orquestador] El `UlidGenerator` **monótono** que exige `02 §7.4` hace que dentro del mismo milisegundo el ULID sucesor sea el anterior **+1** (medido por 2-1-REV), lo que vuelve adivinable un `public_token` acuñado junto a otro conocido — y ese token es una URL-capacidad sin autenticación. **Supuesto tomado:** se separa la generación (ADR-2-ORQ-01): `public_token` con `SecureRandom` fresco, `assetId`/`itemId` siguen monótonos. Pregunta para el dueño: ¿se acepta perder la localidad de índice del token a cambio de imprevisibilidad real? La respuesta conservadora, y la tomada, es que sí.

## Fase 2 · 2-3 — catálogo y registro de plantillas (8)

- [Fase 2 · 2-3] **Los dos ejemplos de `diseno/ejemplos/` no son registrables tal cual** [V]: sus manifiestos declaran digestos de relleno (`aa00…01`, `bb00…01`) que ningún archivo real puede tener, y `02 §4` paso 2 exige que `sha256`/`bytes`/`contentType` coincidan con el archivo subido (`422 TPL_PACKAGE_ASSET_MISMATCH`). **Supuesto tomado:** son ejemplos de *forma*, no paquetes; la prueba de aceptación fabrica archivos deterministas del tamaño y tipo declarados y sustituye **solo** el `sha256` del manifiesto (`PaqueteFixture`), registrando el resto del ejemplo sin tocar. ¿Quién produce los assets reales de `boda-clasica`/`xv-jardin` — el kit de autor de la fase 4 — y se versionan junto a los JSON, o los ejemplos se quedan como están y el paquete registrable se construye siempre?
- [Fase 2 · 2-3] `01 §2.1` nombra **`TPL_PACKAGE_UNEXPECTED_FILE` y `TPL_MIGRATION_PLAN_ORPHAN`**, que no existen en el catálogo cerrado de `03 §5` ni en `domain.TplErrorCode`; y usa `TPL_MIGRATION_PLAN_MISSING` con un significado distinto del que ese código tiene en `03 §5` (allí es de `:choose-template`, 409). **Supuesto tomado:** los tres casos salen como `422 TPL_MANIFEST_INVALID` con `details.packageError = "<el nombre del código>"` (ADR-2-3-02), sin inventar códigos. ¿Se añaden al enum y a la tabla de `03 §5` como códigos de primera clase (la ampliación es mecánica), o se quedan como detalle?
- [Fase 2 · 2-3] **`domain.Templates2Exception` es una `sealed class`**, así que `02 §7.5` ("todas las excepciones heredan de `Templates2Exception`") no es implementable desde otro paquete: Kotlin exige las subclases directas en el mismo paquete y módulo. **Supuesto tomado:** jerarquía paralela `catalog.TemplateRegistryException` con la misma superficie (`code`, `details`, `status`), y el advice de 2-5 mapea las dos (ADR-2-3-01). ¿Se prefiere que un bloque con permiso sobre `domain` mueva esas nueve clases dentro de `Templates2Exception` y borre la base paralela?
- [Fase 2 · 2-3] **`AssetContentType` no incluye `audio/aac`**, pero `ck_tpl_asset_content_type` de `V31` sí lo admite: hoy un asset AAC no se puede declarar en un manifiesto, aunque la base lo aceptaría. **Supuesto tomado:** no se toca (`domain` congelado y el catálogo de tipos es contrato de `blocks.ts`). ¿Se añade `AUDIO_AAC` al catálogo del esquema, o se quita de la migración cuando haya ocasión?
- [Fase 2 · 2-3] Los assets de **plantilla** quedan con `width`/`height` a `NULL`: `AssetEntry` (`01 §2.2`) no los declara y el registro no decodifica las imágenes (ADR-2-3-07). Los assets de **invitación** sí los tendrán (`02 §10.1`). **Supuesto tomado:** `ResolvedImage` los admite nulos y `compose` funciona; el render no podrá reservar espacio para las imágenes de plantilla. ¿Se añaden `width`/`height` opcionales a `AssetEntry` (los aportaría el kit de autor, sin coste en el servidor) o se decodifica la imagen en el registro?
- [Fase 2 · 2-3] `03 §3.1` no dice si el catálogo devuelve **una entrada por plantilla o todas las versiones publicadas**, ni qué hacer sin `planTier`. **Supuesto tomado:** una entrada por plantilla —la versión publicada más alta— y, sin `planTier`, el catálogo **completo** con el `minPlanTier` de cada ítem a la vista, porque quien bloquea por plan es `:choose-template` (ADR-2-3-04, ADR-2-3-05). ¿Se confirma que el cliente debe ver las plantillas que su plan no cubre (marcadas), o el catálogo debe ocultarlas?
- [Fase 2 · 2-3] Una fila de `tpl_template_version` cuyo `manifest` **no decodifique** (solo posible si se escribió por fuera del registrador) se **omite del catálogo con `log.error`** en vez de propagar la excepción, para que una fila corrupta no deje sin catálogo a todos los clientes (ADR-2-3-06). **Supuesto tomado:** omitir ruidosamente. ¿Se prefiere el fallo ruidoso (500 con `TPL_INTERNAL`) para que nadie pueda ignorar el log?
- [Fase 2 · 2-3] `02 §4` paso 5 no dice qué hacer al registrar una versión **anterior** a la última publicada (un parche de una rama vieja): el diff se calcula siempre contra la de mayor `(major, minor, patch)` y "bump mayor" es `nueva.major > anterior.major`, así que una versión inferior con diff no vacío se rechaza (ADR-2-3-09). **Supuesto tomado:** la opción conservadora, sin modelo de ramas. ¿Habrá ramas de mantenimiento reales (`1.0.x` viva junto a `2.x`)? Si las hay, `02 §4` necesita una regla nueva y `tpl_template_version` probablemente una columna de rama.

## Fase 2 · 2-4 — documento, operaciones, snapshots y publicación (6)

- [Fase 2 · 2-4] **La condición de `TPL_NOT_MIGRATED` no es computable desde `templates2`** [V]: `03 §3.2` la define como "`uses_templates2 = true` **o** la invitación no tiene `invitation_configs`", pero `invitation_configs` vive en **Mongo** (`02 §6`) y ADR-009 prohíbe Mongo en este módulo (comprobado: ninguna migración de `db/migration` crea esa tabla). **Supuesto tomado:** costura `LegacyConfigProbe` con tres respuestas y política conservadora — solo un `false` **verificado** autoriza empezar a editar con la bandera en `false`; la implementación por defecto responde "no lo sé" y produce `409 TPL_NOT_MIGRATED` (ADR-2-4-02). Consecuencia práctica: **hoy, una invitación nueva no puede usar el editor hasta que alguien active `uses_templates2`**. ¿Quién publica la sonda real — la fase 5 con su acceso a Mongo — y mientras tanto, se acepta que el corte lo active siempre el proceso de migración?
- [Fase 2 · 2-4] `03 §3.4` punto 6 promete devolver "el `idMap` guardado" al reintentar un lote, pero `tpl_document_snapshot` **no tiene columna donde guardarlo** y añadir una exigiría una migración fuera de `V29`-`V37`. **Supuesto tomado:** se reconstruye resimulando el lote sobre el snapshot anterior con ULIDs deterministas, y si ese snapshot ya se purgó se devuelve un mapa **vacío** en vez de uno inventado (ADR-2-4-05). ¿Se prefiere una columna `id_map JSONB` en una migración futura (respuesta exacta siempre, coste: una columna más y una migración) o basta la reconstrucción?
- [Fase 2 · 2-4] **`@EnableScheduling` no existe en la aplicación** y sin él `@Scheduled` no se ejecuta nunca. **Supuesto tomado:** lo activa un `@Configuration` del propio módulo, apagable con `templates2.retention.enabled=false`; verificado que `SnapshotRetentionJob` es el **único** `@Scheduled` del repositorio, así que no despierta nada del módulo antiguo (ADR-2-4-06). ¿Se prefiere que el planificador se active en `InvitationsApplication` (decisión del núcleo, fuera de este módulo) para que quede a la vista de todos?
- [Fase 2 · 2-4] `03 §3.6` no dice qué hacer con un valor restaurado que **ya no valida** contra el manifiesto vigente, ni `01 §6.4` qué hacer si el resultado de `switchTemplate` no pasa las invariantes. **Supuesto tomado:** ambos mandan ese valor al `attic` y lo anuncian en `movedToAttic`, en vez de rechazar la operación entera (ADR-2-4-04). ¿Se confirma que es preferible restaurar/cambiar perdiendo de la vista un campo recuperable, antes que devolver un `422` que el cliente no puede arreglar desde el editor?
- [Fase 2 · 2-4] El `stale` de un release compara el `business_snapshot` congelado con el actual **campo a campo y como texto**, porque `invitation.date`/`time`/`hashtag` son `VARCHAR` libres en el módulo antiguo. Un cambio de formato sin cambio de valor (`"2027-5-1"` → `"2027-05-01"`) marcaría el release desfasado sin serlo. **Supuesto tomado:** avisar de más nunca de menos; no se normaliza nada, porque normalizar sería el backend interpretando datos del módulo antiguo. ¿Interesa una comparación normalizada por campo (fecha/hora) o el aviso de más es aceptable?
- [Fase 2 · 2-4] `GET .../document` **no** devuelve `409 TPL_NOT_MIGRATED` aunque `03 §3.3` lo liste entre sus errores: sin la sonda de Mongo, una lectura no puede distinguir "no migrada" de "no empezada". **Supuesto tomado:** `404 TPL_DOCUMENT_NOT_STARTED` para toda ruta de lectura sin documento, y el `409` solo en `:choose-template`, que es donde se toma la decisión. ¿Se corrige `03 §3.3` para quitar ese `409` de la lista, o se quiere que la lectura también lo emita cuando la sonda real esté disponible?

## Fase 2 · 2-5 — errores, límites, assets y render público (7)

- [Fase 2 · 2-5] **`POST {frontend}/api/revalidate` tras publicar (ADR-1R-F-09) no está implementado.** El punto de enganche exacto es `ReleaseService.publish` **después del commit** (dentro del método la transacción aún no ha commiteado, así que hace falta un `TransactionSynchronization` o un `@TransactionalEventListener(AFTER_COMMIT)`), más una propiedad con el `x-revalidate-token` y una política de fallo que **no** tumbe la publicación. **Supuesto tomado:** no implementarlo — el brief de este bloque no lo enumera entre sus archivos, exige modificar un servicio de 2-4 y hoy no existe frontend al que llamar; el `revalidate: 300` de Next.js es la única red mientras tanto. ¿Lo escribe la fase 3 (que sí tendrá el handler al otro lado) o un bloque de cierre de la fase 2?
- [Fase 2 · 2-5] **El barrido semanal de huérfanos de S3 (`02 §10.3`) no está implementado**: `core/s3/S3Service` no expone ninguna operación de listado y añadirla es tocar el núcleo; además es una operación destructiva sobre un bucket real, imposible de probar en este entorno. **Supuesto tomado:** `AssetGcJob` cubre la cola `tpl_asset_gc` (que es la que captura los tres caminos de borrado) y el barrido queda fuera; consecuencia real: un objeto cuyo `INSERT` falló tras subirse permanece en S3 hasta que alguien lo retire a mano, aunque la clave determinista impide que se acumulen copias. ¿Se amplía `S3Service` con un listado, se usa `S3Client` directamente desde `templates2`, o se resuelve con una regla de ciclo de vida del bucket (que sería lo más barato y no necesita código)?
- [Fase 2 · 2-5] **La subida de assets rechaza `image/svg+xml` y `font/woff2`** aunque el catálogo del esquema los admita (ADR-2-5-04): un SVG del cliente servido desde un bucket público es un vector de XSS y las fuentes son assets de paquete, no de invitación. **Supuesto tomado:** la lista de la ruta 7 es `image/webp|png|jpeg` + `audio/mpeg`. ¿Habrá algún caso real de cliente subiendo un SVG (un monograma, por ejemplo)? Si lo hay, hace falta un saneador y una decisión explícita, no relajar la lista.
- [Fase 2 · 2-5] **Un asset referenciado solo desde el `attic` no se puede borrar** (ADR-2-5-05) y **no existe hoy ninguna operación que vacíe el `attic`**, así que ese asset queda bloqueado para siempre y sigue ocupando cuota (200 por invitación) y almacenamiento. **Supuesto tomado:** no borrar, porque borrarlo convertiría un `restore` futuro en una imagen rota en silencio. ¿Debe existir una operación de "vaciar `attic`" (con su aviso al cliente), o la cuota debe contar solo los assets vivos?
- [Fase 2 · 2-5] **`03 §10.3` se declara "lista cerrada" de nueve handlers, pero con esos nueve un `invitationId` no numérico en la ruta sale como `500 TPL_INTERNAL`** — un error del cliente contado como fallo del servidor, contra la regla dura de ADR-016. **Supuesto tomado:** cinco handlers más, todos con códigos ya existentes de `03 §5` (ADR-2-5-02). ¿Se actualiza `03 §10.3` para incluirlos, o el orquestador prefiere la lista literal asumiendo el `500`?
- [Fase 2 · 2-5] **El `403 TPL_INVITATION_UNAVAILABLE` del render público revela que un `publicToken` existe**, mientras que todo lo demás responde el mismo `404` precisamente para no ser un oráculo (ADR-2-5-06). Es lo que fijan `03 §3.15` y `§5`, y es coherente con el módulo antiguo. **Supuesto tomado:** respetar el contrato. ¿Se prefiere un `404` uniforme también para la invitación deshabilitada —perdiendo la capacidad de decirle al dueño "tu invitación está bloqueada, no rota"— o se acepta la fuga?
- [Fase 2 · 2-5] **El cableado de los beans nuevos en la aplicación completa no está probado de extremo a extremo**, porque el contexto Spring sin acotar no arranca por `InvitationGuestEntity.graduates_name` (ADR-2-ORQ-02, defecto ajeno y preexistente). Sí están probados sus constructores y dependencias en el *slice*, y el `@Qualifier("templates2ObjectMapper")` del filtro coincide con el nombre de `Templates2JsonConfig.kt:35`. **Supuesto tomado:** acotar el contexto, como 2-1 y 2-4. La pregunta sigue siendo la del orquestador: quién crea esa columna y con qué migración; hasta entonces, **ningún entorno nuevo levanta la aplicación completa** y por tanto nadie ha visto estas rutas responder sobre Tomcat real.

## Fase 2 · 2-6 — consolidación de cierre (5)

- [Fase 2 · 2-6] **El cuerpo del `POST {frontend}/api/revalidate` lo fija este bloque, no el contrato.** `contratos.md §8` fija el verbo, la ruta, la cabecera `x-revalidate-token` y qué hace el handler (`revalidateTag("invitation:{publicToken}")`), pero **no el cuerpo**, y el handler es de la fase 3: todavía no existe al otro lado. **Supuesto tomado:** `{"tag": "invitation:<publicToken>", "publicToken": "<publicToken>", "reason": "published|unpublished|token-rotated"}` — la etiqueta ya formada, para que el handler no reconstruya la convención, y sus dos partes por separado (ADR-2-6-01). ¿Lo confirma la fase 3 antes de escribir `/api/revalidate`, o prefiere otra forma? Cambiarlo después es cambiar los dos lados a la vez.
- [Fase 2 · 2-6] **La llamada de revalidación es síncrona en el hilo de la petición**, así que publicar puede tardar hasta `templates2.revalidate.timeout-ms` (3 000 por defecto) más de lo que tardaba. **Supuesto tomado:** síncrona con tope corto, porque `@Async` exigiría un `@EnableAsync` de alcance global —el mismo problema que el `@EnableScheduling` de ADR-2-4-06— y despertaría cualquier `@Async` dormido del módulo antiguo. ¿Se acepta ese coste, o el orquestador autoriza `@EnableAsync` acotado al módulo (o una cola de reintentos, que es infraestructura nueva para una ventana de 300 s que el contrato ya acepta)?
- [Fase 2 · 2-6] **Una fila de `tpl_asset` con un `bucket` distinto del configurado ahora produce `500`**, en vez de una URL rota en silencio (ADR-2-6-04). Hoy no puede ocurrir —los dos escritores usan la misma constante—, pero ocurriría si alguien moviera objetos de bucket o cambiara `templates2.assets.bucket` con filas ya escritas: el editor y el catálogo de esa invitación dejarían de responder. **Supuesto tomado:** fallar en voz alta, porque una imagen rota dentro de un `composed` ya congelado en `tpl_release` no la detecta nadie (P1). ¿Se prefiere degradar (servir la URL del bucket de la fila y avisar) si algún día hay más de un bucket de verdad? Eso exigiría además una `public-base-url` por bucket.
- [Fase 2 · 2-6] **Apagar `templates2.retention.enabled` ya no apaga el planificador entero** (ADR-2-6-02): quien dependiera de ese efecto colateral debe usar `templates2.scheduling.enabled=false`. **Supuesto tomado:** el cambio es correcto porque el efecto colateral era el defecto (dejaba de drenar `tpl_asset_gc`, que es el derecho al olvido), y las tres propiedades siguen teniendo `true` por defecto, así que ningún despliegue actual cambia de comportamiento salvo en eso. ¿Hay algún entorno que hoy ponga `templates2.retention.enabled=false` esperando apagar **todas** las tareas periódicas?
- [Fase 2 · 2-6] **`image.aspect` sigue sin comprobarse cuando la cabecera de la imagen no se puede leer**, tanto en assets de plantilla como de invitación: `ImageDimensions` devuelve `null` y el reductor no rechaza por falta de dato (`01 §6.5`). **Supuesto tomado:** es el comportamiento correcto y ya vigente; ADR-2-6-03 cierra el hueco real —las dimensiones a `NULL` **siempre** para los assets de plantilla—, no este residual. ¿Debería el registro **rechazar** un asset de imagen cuya cabecera no se entiende (hoy solo se comprueba el número mágico, que es más laxo), o el residual es aceptable?


---

# Índice de las preguntas de la fase 2, agrupadas (53 en total)

Las secciones de arriba las escribió cada sub-agente. Este índice las agrupa por a quién le toca
decidir, para que el dueño no tenga que leerlas todas para encontrar las suyas.

## A. Las que bloquean algo hoy (decidir antes de la fase 3)
1. **`invitation_guest.graduates_name` no la crea ninguna migración** y `ddl-auto` es `validate`:
   ningún entorno nuevo arranca la aplicación completa, así que las 19 rutas nunca han respondido
   sobre un Tomcat real. Es **preexistente y ajeno** al módulo. Falta asignarle número de migración
   (no `V38`/`V39`) y dueño. Supuesto tomado: no tocarlo (ADR-2-ORQ-02).
2. **Bucket de S3 de pruebas**: `templates2.assets.bucket` es ahora obligatoria y sin defecto
   (ADR-2-ORQ-03), a petición del dueño. Falta decidir **qué bucket** se usa en desarrollo y en CI.
3. **`TPL_NOT_MIGRATED` y `uses_templates2`**: `invitation_configs` vive en Mongo y ADR-009 lo prohíbe
   en el módulo nuevo, así que la sonda responde "no lo sé" por defecto y **una invitación nueva no
   puede empezar hasta que alguien active la bandera**. ¿Se acepta, o el corte debe ser automático?
   (ADR-2-4-02.)

## B. Contenido y plantillas (fase 4, pero condicionan al kit de autor)
4. Los ejemplos de `diseno/ejemplos/` traen **digestos de relleno** y no son registrables tal cual.
5. ¿Se añaden `TPL_PACKAGE_UNEXPECTED_FILE` y `TPL_MIGRATION_PLAN_ORPHAN` al catálogo cerrado?
6. `audio/aac` está en el `CHECK` de `V31` pero no en el catálogo de tipos aceptados.
7. El catálogo enseña plantillas fuera del plan del cliente cuando no se puede resolver el `planTier`.

## C. Contrato con el frontend (fase 3)
8. El **cuerpo** del `POST /api/revalidate` lo fijó el backend, no el contrato de diseño.
9. `AssetIndex`: la URL de producción sale de `tpl_asset.s3_key`, **no** del `assetId`; la convención
   `<ULID>.webp` de los golden es de fixture y no debe llegar al frontend.
10. Rutas y cabeceras del render público (`ETag`, `304`, `Cache-Control`) — ver `handoffs/2-5.md`.

## D. Deuda técnica reconocida, sin bloquear
11. `Templates2Exception.Internal` devuelve su mensaje al cliente en el `500`, con nombres de tabla e
    ids internos; el handler final sí es opaco. Los dos caminos al mismo `500` no se comportan igual.
12. `testRuntimeOnly("com.h2database:h2")` sigue en el classpath de pruebas pese a que `contratos §6`
    da H2 por descartado. Ninguna prueba de `templates2` lo usa; es la trampa que lo haría posible.
13. Barrido semanal de huérfanos de S3: `S3Service` no expone listado.
14. CORS de tipografías (`contratos §8`): infraestructura, fase 3/4.
15. **Credenciales AWS y secreto JWT en texto plano en `application.yml`** (H-48, preexistente). Si
    son reales, conviene rotarlas; está fuera del alcance de este módulo.

---

## Fase 3 · 3-0a — arranque real del backend y paquetes registrables (7)

- [Fase 3 · 3-0a] **Las credenciales de AWS de `application.yml` son válidas y funcionan desde este entorno** [V]. La subida de prueba a un bucket inventado devolvió `404 The specified bucket does not exist` **firmado** (`Request ID: AQ7GC5KJHKMQDWFD`), no un `403 InvalidAccessKeyId`: el par `AKIAQD24JOD45NZSYC3G` / secreto en claro de `application.yml:14-16` autentica de verdad contra `s3.us-east-2.amazonaws.com`. Es el H-48 que la fase 2 dejó anotado como "si son reales, conviene rotarlas", ahora **confirmado**. **Supuesto tomado:** no se creó ningún bucket ni se escribió nada en AWS; se implementó el adaptador local (ADR-3-0a-02). ¿Se rotan esas credenciales y se sacan del repositorio (variables de entorno, como ya se hace con la base de datos), y quién lo hace? Mientras sigan ahí, cualquiera con acceso al repositorio puede escribir en el bucket de producción.
- [Fase 3 · 3-0a] **`previewUrl` no caduca en modo local.** `03 §3.7` la define como URL firmada de 15 minutos; el adaptador local devuelve una URL sin firmar y permanente, porque en disco no hay nada que firmar. **Supuesto tomado:** la diferencia es aceptable en desarrollo y el contrato de la ruta no cambia (sigue siendo "una URL que el cliente abre con un `GET`"). ¿Debe `apps/web` tratar `previewUrl` como caducable siempre —volviendo a pedirla— para que el mismo código valga en los dos modos?
- [Fase 3 · 3-0a] **`invitation` tiene ocho columnas booleanas y `total_amount` NULLables que `InvitationEntity` mapea a tipos primitivos de Kotlin** (`InvitationEntity.kt:34-75`: `childrenAllowed`, `youngAllowed`, `isEnabled`, `isPaid`, `totalAmount`, `hasMusic`, `hasGallery`, `hasExtraModules`) [V]. Una fila con `NULL` en cualquiera de ellas rompe la lectura con `JpaSystemException: Null value was assigned to a property … of primitive type` y **toda** ruta de `templates2` sobre esa invitación responde `500 TPL_INTERNAL`. Es el mismo tipo de desajuste que `graduates_name`, pero al revés (la columna existe y admite `NULL`; el mapeo no). Es **preexistente y ajeno** al módulo (`modules/admin/invitations/**`, área prohibida): no se tocó. **Supuesto tomado:** el fixture de `scripts/smoke.sh` rellena las nueve columnas y lo documenta. ¿Se añade una migración que ponga `DEFAULT false` + `NOT NULL` a esas columnas (y `0` en `total_amount`), o se hace nullable el mapeo? Hoy cualquier invitación creada fuera de la API (script, importación, backup viejo) deja al editor nuevo devolviendo `500`.
- [Fase 3 · 3-0a] **`uses_templates2` sólo se puede activar por SQL** [V]. Confirma lo que ADR-2-4-02 anticipó: no hay ninguna ruta HTTP que la ponga a `true` —`templates2` no crea invitaciones y el módulo antiguo es área prohibida—, así que `scripts/smoke.sh` la activa con un `INSERT`/`UPDATE` directo. **Supuesto tomado:** para desarrollo y para la fase 3 basta con SQL, y el corte de producción lo hará la migración de la fase 5. ¿Hace falta una ruta MASTER de "activar templates2 en esta invitación" para poder hacer pruebas piloto con clientes reales antes de la fase 5?
- [Fase 3 · 3-0a] **`MongoDataInitializer` alarga el arranque ~8 minutos si no hay Mongo** [V]. Es un `CommandLineRunner` del módulo antiguo que hace 16 operaciones y captura sus propias excepciones (no tumba el arranque), pero con el tiempo de selección de servidor por defecto (30 s) cada una espera lo suyo. `scripts/dev-backend.sh` lo evita fijando `serverSelectionTimeoutMS=250` en la URI, sin tocar código. **Supuesto tomado:** es cosa del entorno de desarrollo, no del módulo. ¿Interesa que ese sembrador se pueda apagar con una propiedad (`app.mongo.seed.enabled`), o que el `docker-compose`/entorno de desarrollo de la fase 3 traiga un Mongo?
- [Fase 3 · 3-0a] **Los paquetes registrables viven en `frontend/templates/<slug>/<version>/` y son una copia derivada de `diseno/ejemplos/`** [V], generada por `frontend/templates/scripts/build-packages.mjs` (que sólo reescribe `assets[]` y `previewImage`). Hay por tanto **dos** sitios con el mismo manifiesto. **Supuesto tomado:** los ejemplos del diseño siguen siendo la fuente y el paquete es derivado y reproducible (`--check` falla si hay deriva); el kit de autor de la fase 4 decidirá dónde vive el original. ¿Debe la fase 4 mover el original a `frontend/templates/` y dejar en `diseno/ejemplos/` sólo un puntero, o al revés?
- [Fase 3 · 3-0a] **Los assets de los paquetes son PNG generados por script, no WebP** [V]: el entorno no tiene ImageMagick, `sharp`, Pillow ni acceso a bancos de imágenes, y escribir un codificador WebP a mano no era razonable; PNG está en el catálogo de tipos admitidos (`AssetContentType.IMAGE_PNG`) y el número mágico se verifica. Pesan entre 500 KB y 600 KB cada uno. **Supuesto tomado:** obra propia, sin derechos de terceros, calidad suficiente para la miniatura del catálogo. ¿Los sustituye el kit de autor de la fase 4 por WebP reales (mismo dibujo, un tercio del peso), y quién aporta la fotografía de portada de verdad?

## Fase 3 · 3-0b — compuerta A1-A8 del lienzo aislado (6)

1. **El Chromium preinstalado no casa con la versión de Playwright del contrato.** `/opt/pw-browsers`
   trae la revisión **1194** (`chromium-1194`, `chromium_headless_shell-1194`) y
   `@playwright/test@1.62.1` (§21) busca la **1234**, así que arranca con
   `Executable doesn't exist … chromium_headless_shell-1234` y pide `playwright install`, que
   `contratos.md §7` prohíbe. **Supuesto tomado:** apuntar `launchOptions.executablePath` a
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (sobreescribible con `PW_CHROMIUM_PATH`);
   verificado, esa revisión se conduce sin problemas con este driver y los 4 tests pasan. Decisión
   pendiente para `apps/web` y para el CI: ¿se actualiza la imagen a los binarios de 1.62.1, o se
   baja `@playwright/test` a la versión que casa con 1194? Fijar `executablePath` a una ruta
   absoluta funciona en este contenedor pero **no es portable a GitHub Actions**.
2. **Next 16 renombró el convenio `middleware.ts` a `proxy.ts`.** El build avisa
   («The "middleware" file convention is deprecated. Please use "proxy" instead») y `04 §8.4` no lo
   contempla, porque se escribió antes. **Supuesto tomado:** el spike usa `proxy.ts` con
   `export default function proxy(request)`; funciona y el build lo lista como `ƒ Proxy (Middleware)`.
   `04 §8.4` debería decir `proxy.ts` cuando se actualice.
3. **El `jitless` de Zod alcanza también al chrome del editor.** ADR-3-0b-02 desactiva el JIT de Zod
   al importar `@invitaciones/schema/canvas`, y el puente del padre importa ese mismo módulo, así
   que el documento del editor —que no tiene CSP restrictiva— pierde la ruta rápida de validación
   sin necesitarlo. **Supuesto tomado:** se acepta; el coste no está medido y el editor valida
   poco por interacción. Si 3-4 lo mide y molesta, el chrome puede hacer `z.config({jitless:false})`
   **después** de importar el puente. Queda anotado para no descubrirlo por sorpresa.
4. **La tipografía del spike no es la del producto.** A2 se midió con Fraunces (OFL) en `woff2`,
   copiada desde `/mnt/skills/examples/morning/assets/fonts/` porque el repositorio no tiene ninguna
   fuente. **Supuesto tomado:** el spike solo demuestra el **mecanismo** (`next/font/local` +
   `Access-Control-Allow-Origin: *` en `/_next/static/media/**`); el catálogo real de familias
   `source:"bundled"` de `04 §5.5`, sus licencias y su alojamiento siguen sin decidir y son de la
   fase 4. No se ha adoptado ninguna tipografía para el producto.
5. **`APP_ORIGIN` y `CDN_ORIGIN` de la CSP se resuelven en tiempo de build.** La CSP del lienzo lleva
   hosts literales, y el spike los toma de `NEXT_PUBLIC_EDITOR_ORIGIN`/`NEXT_PUBLIC_CDN_ORIGIN`, que
   Next **incrusta al compilar**. Un mismo artefacto no sirve para dos dominios. **Supuesto tomado:**
   se declaran en el entorno de build, con los valores locales como defecto; si se quiere una imagen
   única para varios entornos, hay que leerlos en `proxy.ts` desde variables de servidor (sin el
   prefijo `NEXT_PUBLIC_`) y pasar el origen del editor al lienzo por otra vía.
6. **El spike vive fuera del workspace pnpm y se instala con `npm`.** `frontend/pnpm-workspace.yaml`
   solo declara `packages/*` y `apps/*`. **Supuesto tomado:** no se añade `spikes/*` al workspace
   para no chocar con el andamiaje de 3-1, y `frontend/spikes/canvas-gate/` se instala con
   `npm install` (su `package-lock.json` se versiona). Consume `packages/schema` por
   `file:../../packages/schema`, lo que produce **dos copias de `zod`** — el motivo por el que existe
   `configureZodForCanvas()`. En `apps/web`, dentro del workspace, habrá una sola.

## Fase 3 · 3-2a — cimiento de packages/sections: tema, tokens y bloques (7)

- [Fase 3 · 3-2a] **`ResolvedTheme.fonts.heading/body` no lleva ninguna URL de archivo de fuente** (`composed.ts:80-83`, verificado [V]), ni para `source:"bundled"` ni para `source:"google"`; `compose()` no la resuelve. `04 §5.5` da por hecho que `ThemeProvider` "inyecta `@font-face` en tiempo de ejecución con esa URL", pero no hay ninguna URL que inyectar. **Supuesto tomado:** `packages/sections/src/theme/fonts.ts` se limita a la allowlist de familias `source:"google"` y a construir la cadena CSS `font-family` (familia + pila de reserva) para `--inv-font-heading/body` (ADR-3-2a-06); la carga real de archivos de fuente (`@font-face`/`next/font/google`) queda para `apps/web`, que sí puede recibir una URL real del backend. ¿Se añade `AssetIndex`-como-URL de fuente a `ResolvedTheme` (cambio de esquema, fuera de mi alcance), o `apps/web` resuelve la URL de otra forma (convención de ruta fija por `assetId` del manifiesto, sin pasar por `compose()`)?
- [Fase 3 · 3-2a] **La paleta `"blush"` de `boda-clasica@1.0.0` —la PRIMERA y `defaultPaletteId` del `theme.json`— no cumple AA en 2 de las 5 parejas de `04 §17.1`**: `accentInk/accent` = 2.78 (exige ≥ 4.5) y `accent/bg` = 2.62 (exige ≥ 3.0). Verificado [V] con la fórmula exacta de `04 §17.1`, de forma independiente (python) y con la prueba de `contrast.ts` (`test/theme/u08-contrast.test.ts`). `I-31_PALETTE_CONTRAST_BELOW_AA` sigue "reservada" (ADR-1R-F-06 "propuesta", contratos.md §8), así que hoy nada del lado de registro la rechaza. **Supuesto tomado:** no se toca `frontend/templates/boda-clasica/1.0.0/theme.json` (fuera de mi alcance de archivos) ni se relaja el umbral de la prueba: `u08-contrast.test.ts` afirma el resultado real (3 parejas pasan, 2 no) con un comentario que cita este hallazgo. ¿Quién corrige los tokens hex de `blush` (probablemente `accent: "#C98B8B"` necesita oscurecerse, o `accentInk` dejar de ser blanco puro), y se acepta ADR-1R-F-06 para que `I-31` empiece a bloquear el registro de plantillas con este defecto?
- [Fase 3 · 3-2a] **La tabla "bloques admitidos" de `01 §3.1` no incluye la variante `masonry` de `gallery`** (solo lista `grid-6`/`grid-9`/`carousel`), pero `frontend/templates/boda-clasica/1.0.0/template.json` declara de verdad `gallery.variants: ["grid-6", "masonry"]` (verificado [V]). **Supuesto tomado:** `sectionRegistry.gallery.supportedVariants` incluye las cuatro (unión de la tabla de diseño y la plantilla real), para que la regla 5 del contrato del registro (`04 §5.2`) no falle contra el paquete que de verdad existe. ¿Se corrige `01 §3.1` para incluir `masonry` (y decidir si `grid-9`/`carousel`, que ningún paquete real usa hoy, se quedan o se retiran), o se corrige la plantilla para usar una de las tres ya documentadas?
- [Fase 3 · 3-2a] **`@invitaciones/schema` no exporta `type` para `ComposedSection`, `ComposedBlock`, `ComposedGroup`, `ResolvedValue`, `ResolvedTheme` ni `Palette`** (solo el VALOR — el esquema Zod — con ese nombre; verificado [V] contra `composed.ts` y `manifest.ts`). El propio código de ejemplo de `04 §5.2` hace `import type { ComposedSection, ComposedBlock, ComposedGroup } from "@invitaciones/schema"`, que no compila tal cual hoy. **Supuesto tomado:** se trabajó alrededor con `ReturnType<typeof X.parse>` en `src/schema-types.ts` (sin añadir `zod` como dependencia directa de `packages/sections`, que no está en el `package.json` exacto de `04 §2.1`) — no se toca `packages/schema` (solo lectura). ¿Se añade `export type X = z.infer<typeof X>` junto a cada uno de esos seis valores en la próxima vez que se edite `packages/schema`? Es un cambio de una línea por tipo, sin implicaciones de esquema/JSON Schema.
- [Fase 3 · 3-2a] **`ComposedSection.blocks: Array<ComposedBlock | ComposedGroup>` no es una unión discriminada limpia para TypeScript**: `ComposedBlock.type` es el `BlockKind` COMPLETO (incluye el literal `"group"` como uno de sus 14 valores posibles, aunque el dominio nunca lo produzca ahí — 01 §2.5, los grupos no anidan), así que `block.type === "group"` no excluye de forma fiable el miembro `ComposedBlock` al hacer *narrowing*. **Supuesto tomado:** se distingue por la presencia de `items` (`isComposedGroup`, en `schema-types.ts`), que sí narrowea de forma exclusiva; documentado en el propio código. ¿Vale la pena que `composed.ts` use `z.discriminatedUnion` con una forma que sí distinga limpiamente (p. ej. dando a `ComposedBlock` un `type` que EXCLUYA `"group"` en su propio tipo), o se acepta el patrón `isComposedGroup` como la forma estándar de trabajar con esa unión?
- [Fase 3 · 3-2a] **`jest-axe@11.0.0` no publica tipos TypeScript propios** (verificado [V]: no hay ningún `.d.ts` en el paquete instalado) y `@types/jest-axe` no está en el `package.json` exacto de `04 §2.1`. **Supuesto tomado:** declaración ambiental mínima propia en `test/jest-axe.d.ts` (solo lo que este paquete usa) + augmentación de `Assertion` de Vitest en `test/vitest-matchers.d.ts` (separado porque un `.d.ts` con `import` propio deja de aplicar su `declare module` de forma global — verificado [V]). ¿Se acepta `@types/jest-axe` como dependencia si en algún momento se publica, o se mantiene la declaración local (más control, menos superficie)?
- [Fase 3 · 3-2a] **No existe `eslint.config.mjs` en este árbol de trabajo** (raíz del monorepo, propiedad de 3-1 según `contratos.md` §1), así que las prohibiciones duras de `04 §19.3` (`dangerouslySetInnerHTML`, `style={{`, utilidades de Tailwind, imports de `next/*`/`zustand`/etc.) no tienen ninguna compuerta mecánica de CI todavía. **Supuesto tomado:** se añadió `test/lint-guards.test.ts` dentro de `packages/sections` como compuerta real (falla `pnpm test` si se viola una regla), citando exactamente qué archivo del árbol de sección lo comete. ¿Cuándo 3-1 (u otro bloque) publique `eslint.config.mjs`, se retira esta prueba o se deja como red de seguridad adicional (recomendado: dejarla, es barata y no depende de que el lint corra)?
## Fase 3-B · I-03 — compuerta de la CSP del lienzo (2)

1. **[MEDIA]** [P-3B-I03-1] **El `jitless` de Zod alcanza ahora a TODO consumidor de
   `@invitaciones/schema`, no solo al lienzo y al chrome.** ADR-3B-I03-01 mueve el
   `import "./canvas-runtime.ts"` a `common.ts`, la raíz del grafo del paquete, porque es el único
   punto donde la garantía «`jitless` antes del primer `z.object`» se sostiene sea cual sea el
   empaquetador (medido: el orden de ESM no lo respeta Turbopack entre chunks). Eso incluye el
   **render público en servidor** y la validación de lotes de operaciones, que antes sí usaban la ruta
   JIT. **Supuesto tomado:** se acepta, porque es el precio de que A4 se cumpla en el producto y no
   solo en un spike, y porque cerrar el `eval` de otra forma exigiría aflojar la CSP (rechazo
   automático) o depender de detalles internos de Zod. **El coste NO está medido.** Amplía la pregunta
   3 de «Fase 3 · 3-0b», que solo hablaba del chrome. Si algún día molesta, la salida es
   `z.config({ jitless: false })` en el arranque del proceso de servidor, **nunca** dentro del lienzo.
   ¿Quiere el dueño que se mida el coste con una carga representativa del render público antes de la
   fase 4, o se deja hasta que aparezca un síntoma?
2. **[BAJA]** [P-3B-I03-2] **Nada impide a priori que un linter de orden de imports rompa la garantía
   en silencio.** El invariante «`./canvas-runtime.ts` es la PRIMERA dependencia de `common.ts` y de
   `canvas-protocol.ts`» está avisado en la cabecera de los dos archivos y **detectado** por dos
   pruebas (`packages/schema/test/zod-jitless.contract.test.ts` en Node, sin navegador, y
   `apps/web/e2e/lienzo-csp.spec.ts` en Chromium con CSP real), pero no hay ninguna regla de ESLint
   que lo **prevenga**. **Supuesto tomado:** basta con detectarlo, porque las dos pruebas corren en CI
   y fallan con un mensaje que explica la causa. ¿Se quiere además una regla
   (`import/order` con `pathGroups`, o una regla propia) que fije el primer import de esos dos
   archivos?

## Fase 3 · 3-1 — andamiaje de `apps/web` (7, una CERRADA por I-03)

1. **Presupuesto de JS de `/i/[publicToken]` (04 §16.1, 150 KB gz): el suelo real de `next@16.3.4` +
   Turbopack, sin código de aplicación, mide 165,9 KB gz** — verificado, `check-budget.mjs` rompe de
   verdad (`exit 1`), sin ningún componente cliente propio en esa ruta. Se probó un `browserslist`
   moderno para reducir el *chunk* de *polyfills*: sin efecto medible. **Supuesto tomado:** no se
   relaja la constante (ADR-3-1-01, propuesta); el hallazgo queda para que el dueño decida entre subir
   el presupuesto, investigar una configuración de *build* que lo baje, o esperar a medir con
   contenido real en la fase 4. ¿Qué prefiere el dueño?
2. **`04 §16.2` dice "lee `.next/app-build-manifest.json`"; ese fichero no existe en `next@16.3.4`**
   (probado con Turbopack, el bundler por defecto, y con `next build --webpack`, los dos). El
   manifiesto real y estable por ruta es `.next/server/app/<ruta>/page/build-manifest.json` →
   `{rootMainFiles, polyfillFiles}`. **Supuesto tomado:** `scripts/check-budget.mjs` se escribió
   contra esa forma real, documentado en el propio script. ¿Se corrige `04 §16.2` para que el próximo
   bloque no pierda tiempo con el nombre de fichero equivocado?
3. ~~**`script-src`/`eval` de Zod SÍ se dispara dentro de `apps/web` en `/editor/[id]/canvas`, a pesar
   de `canvas-runtime.ts`…** Cuarentena documentada (`// QUARANTINE`, `06 §8.2.6`) en la propia
   prueba; sospecha sin confirmar de que Turbopack separase Zod con instancia de módulo propia.~~
   **CERRADA en I-03 (2026-09-05, `bitacora/3b-i03.md`, ADR-3B-I03-01). Ya no hay cuarentena ni
   `console.warn`: la prueba afirma cero violaciones con `expect` y se ha visto en rojo.** La causa
   estaba medida al revés: el marcador `CANVAS_ZOD_JITLESS` es un `export const` que nadie consume y
   el minificador lo elimina de **todos** los chunks, así que su ausencia no probaba nada. La causa
   real, medida sobre el bundle servido, es de **orden de evaluación**: Turbopack funde `common.ts`
   con el chunk de Zod y lo evalúa antes de que corra el cuerpo de `canvas-protocol.ts`, que vive en
   otro chunk. Arreglo: `common.ts` importa `./canvas-runtime.ts` como su primera dependencia.
4. **`noUncheckedIndexedAccess: true` (04 §2 lo pide para `tsconfig.base.json`) rompe el typecheck de
   `packages/schema`** — verificado: `tsc` desde `apps/web` (que consume `.ts` fuente de
   `@invitaciones/schema`, no `.d.ts` compilados) hereda el *flag* y produce errores nuevos en
   `compose.ts`/`invariants.ts` que no existen al correr el typecheck de `schema` de forma aislada.
   **Supuesto tomado:** no se aplica en ningún `tsconfig.json` del monorepo (ni base ni `apps/web`),
   porque `packages/schema` es de solo lectura para este bloque y no se puede corregir ahí. ¿Se acepta
   la ausencia del *flag*, o se resuelve compilando `packages/schema` a `.d.ts` (cambiaría cómo lo
   consumen TODOS los paquetes) para que cada consumidor pueda tener sus propias `compilerOptions`
   estrictas sin filtrarse a los demás?
5. **`POST /auth/token` responde `{"accessToken", "refreshToken", "role", "isSurveyAnswered"}`, no
   `{"token"}`** — verificado contra el backend real; ningún documento de `03-api.md`/memoria lo decía
   (esa ruta es de `modules/auth`, fuera de `templates2`). **Supuesto tomado:** `lib/api-types.ts`
   (`AuthTokenResponse`) se ajustó a la forma real. Ningún cambio de contrato pedido: solo se registra
   para que nadie vuelva a perder tiempo adivinando el nombre del campo.
6. **`packages/schema` sigue con `"lint": "echo 'lint: pendiente'"` (placeholder de la fase 2) y es de
   solo lectura para este bloque** — las reglas de ADR-005 SÍ están declaradas en el
   `eslint.config.mjs` raíz (alcanzables con `pnpm exec eslint packages/schema/src`), pero
   `pnpm -r run lint`/`turbo run lint` no las ejecuta contra `schema` porque su propio script no
   invoca `eslint`. **Supuesto tomado:** no se tocó `packages/schema/package.json` (fuera de mi
   alcance). ¿Quién tiene permiso para completar ese script — el mismo agente que complete
   `packages/sections`, o requiere volver a abrir `packages/schema` a un bloque futuro?
7. **`/editor/[invitationId]` y `/preview/[invitationId]` son Client Components, no RSC como marca
   `04 §6`** — el token de sesión vive en `sessionStorage` (P8, `lib/api-client.ts`) y un Server
   Component no puede leerlo; no existe hoy ningún mecanismo de sesión legible en el servidor (cookie
   httpOnly, por ejemplo). **Supuesto tomado:** ambas rutas cargan sus datos en el cliente, mismo
   patrón que ya usa toda la parte autenticada. ¿Se introduce una cookie de sesión en un bloque
   futuro para que estas rutas puedan volver a ser RSC (mejor rendimiento, menos JS), o se acepta el
   patrón cliente como definitivo?
## Fase 3 · 3-2d — arte e imaginería de las plantillas (5)

- **[ALTA]** [Fase 3 · 3-2d] **Un paquete de plantilla NO puede referenciar sus propias imágenes desde `defaults.json`, así que toda invitación recién creada sale sin una sola foto** [V, evidencia en `evidencia/fase-3/arte/diagnostico-assetid-defaults.txt`]. `defaults.json:15` declara `assetId: "as_01J8DEM000000000000000C0V1"`, pero `AssetEntry` (`packages/schema/src/manifest.ts:45-50`) no tiene campo de id y `TemplateRegistrationService.kt:104` acuña `publicId = "as_" + ulid.next()`, aleatorio en cada registro; `compose.ts:70,77` resuelve `idx[assetId] ?? null` y el bloque queda `provenance:"empty"`. Medido: `report.missingRequired = ["cover.image"]` y `preflight.canPublish = false` en una invitación recién creada. **Peor**: `rsvp.background` es `source:"fixed"`, así que ni el cliente puede darle valor (`422 TPL_BLOCK_NOT_EDITABLE`) — el fondo de la sección RSVP es hoy **inalcanzable por cualquier camino**. **Supuesto tomado:** no lo arreglo (`modules/templates2/**` es área prohibida para 3-2d); la demostración sube su imaginería como assets de invitación por la ruta HTTP real. **Parche mínimo propuesto** (~11 líneas, sin tocar la base de datos, aditivo y retrocompatible): `AssetEntry.id` opcional + alias `manifestId → StoredAsset` en `EditorDocumentService.almacenados()` y en `assetMeta`; detalle y alternativas descartadas en `bitacora/3-2d.md §5.4`. ¿Se aplica en la fase 3, se aplaza a la 4, o se acepta que una plantilla nunca traiga arte propio y `rsvp.background` deje de ser `fixed`?
- **[ALTA]** [Fase 3 · 3-2d] **Las paletas corregidas a WCAG AA sólo existen en `frontend/templates/`**: `diseno/ejemplos/*/theme.json` y `frontend/packages/schema/golden/templates/boda-clasica-1.0.0/theme.json` conservan los colores que incumplen (`blush.accent #C98B8B`, `garden.accent #7CA35C`, etc.). No los toqué porque el árbol de ejemplos es contrato de la fase 1 y los golden se **generan**, no se editan a mano (ADR-1R-D-09): editarlos desde aquí rompería en silencio las pruebas del dueño de `packages/schema`. **Supuesto tomado:** la corrección vive en `scripts/art/paleta-aa.mjs` (ADR-3-2d-04) y el paquete registrable sale limpio. ¿Quién propaga los hexes nuevos a `diseno/ejemplos/` y regenera los golden, y en qué bloque?
- [Fase 3 · 3-2d] **`I-31_PALETTE_CONTRAST_BELOW_AA` sigue sin implementar** (ADR-1R-F-06 en estado *propuesta*), así que el registro acepta hoy cualquier paleta que incumpla AA [V: registré las dos plantillas con las paletas malas y no hubo ni un aviso]. El gate de `build-packages.mjs` sólo cubre las plantillas de este repositorio. **Supuesto tomado:** el gate del generador es suficiente para la fase 3. ¿Se acepta ADR-1R-F-06 y se implementa `I-31` en la fase 4, antes de que exista el kit de autor de plantillas?
- [Fase 3 · 3-2d] **No hay fotografía y no la habrá con este utillaje.** Los retratos de celebrante se resuelven con un medallón de papelería y una inicial; la galería son seis estudios botánicos. Es un lenguaje legítimo de invitación premium, pero **no es lo mismo que las fotos del cliente**. **Supuesto tomado:** el dueño juzga la calidad del sistema, no las fotos de esta invitación concreta, y en producción las fotos las sube el cliente. ¿Quiere el dueño que la plantilla traiga fotografía de archivo (lo que exigiría licenciar un banco de imágenes y una ruta de red que hoy está cerrada)?
- [Fase 3 · 3-2d] **`footer.music` (`backgroundMusic`) se queda vacío**: no hay forma de sintetizar un MP3 con calidad suficiente en este entorno, y una pista mala es peor que ninguna. **Supuesto tomado:** el bloque es opcional y se deja sin sembrar; `handoffs/2-5.md` confirma que `audio/mpeg` es el único tipo aceptado. ¿Aporta el dueño una pista libre de derechos para la demostración?

## Fase 3 · 3-4 — núcleo del editor: store, undo/redo, autoguardado y lienzo (7)

- **[ALTA]** [Fase 3 · 3-4] **Ninguna de las 19 rutas devuelve el `TemplateManifest` al cliente, y el editor lo necesita en cuatro sitios** [V, revisado ruta por ruta contra `handoffs/2-5.md` y `lib/api-types.ts`]. `04 §10.2` da por hecho un `TemplateContext` de solo lectura con el manifiesto; sin él no hay: (a) `BlockSpec` para el resolver de `react-hook-form` del panel (`04 §10.2`, tabla de selectores); (b) `SectionSpec.required` para que el interruptor de una sección obligatoria **no exista** (`04 §7.1` paso 9) — medido: ocultar `cover` responde `422 TPL_OPERATION_INVALID` con `TPL_SECTION_REQUIRED`, así que hoy el cliente puede intentarlo y solo se entera al fallar; (c) `ChoiceSpec.options` para el selector de elección; (d) `theme.json` para el selector de paleta con vista previa al pasar el ratón (`04 §7.1` paso 8). **Supuesto tomado (ADR-3-4-02):** no se adivina nada — esos bloques entran en `pendingBlocks` con `aria-busy` y la verdad llega en el `RENDER` de la respuesta (≤ 2 s, son operaciones de disparo inmediato), que es la misma regla que `04 §12.4` ya fijaba para `formatted`. **No se duplica el manifiesto en el frontend: sería H-27 otra vez.** ¿Se añade un campo `manifest` (o `specs`) a la respuesta de `GET .../document` y de `:choose-template`, o una ruta nueva `GET /editor/templates2/{slug}/{version}/manifest`? Es lo primero que bloquea al bloque 3-5.
- **[ALTA]** [Fase 3 · 3-4] **`app/layout.tsx` anulaba en silencio los tres layouts raíz de `04 §19`** y con ello el lienzo no arrancaba dentro de `apps/web` (`<html>` dentro de `<body>`, `style=` en línea que viola la CSP, hidratación abortada con React #418; medido en Chromium sobre el build de producción). Corregido en ADR-3-4-01 borrando ese archivo y moviendo el 404 a `app/(chrome)/`. **Supuesto tomado:** el 404 global vive dentro del grupo del chrome. Lo que queda abierto es la **compuerta**: Next no avisa si alguien vuelve a crear `app/layout.tsx`, y el fallo solo se ve abriendo un navegador. ¿Se añade una prueba que afirme que el HTML servido de `/editor/{id}/canvas` tiene exactamente un `<html>` y cero atributos `style`, y en qué bloque?
- [Fase 3 · 3-4] **El editor expone el store en `window.__editorStore` cuando `NEXT_PUBLIC_E2E_HOOKS === "1"`**, porque los formularios del panel son del bloque 3-5 y hoy no hay UI con la que teclear en un e2e. La variable solo la pone `playwright.config.ts`; verificado sobre el bundle de producción que el guarda no se cumple sin ella, y el store no contiene el token (P8 intacto). **Supuesto tomado:** es aceptable como enganche temporal y 3-5 lo retira al tener `BlockForm`. ¿Se acepta, o se prefiere no tener ningún enganche y esperar a que exista la UI para escribir estos e2e?
- [Fase 3 · 3-4] **`packages/sections` marca cada `<section>` con `data-section-type`, no con la clave de la sección**, y una plantilla puede declarar dos secciones del mismo tipo; `SECTION_IN_VIEW` y `SCROLL_TO_SECTION` (`04 §9.3-9.4`) necesitan la clave. **Supuesto tomado:** el lienzo sella `data-section-key` él mismo por correspondencia posicional con `composed.sections.filter(visible)` — exacta porque `SectionsRoot` pinta en orden y cada componente emite un solo `<section>` de primer nivel [V, 12/12]. No toqué `packages/sections` (contrato integrado y probado). ¿Se añade `data-section-key` en el propio paquete, que es donde le corresponde? Relacionado: `SelectionOverlay` etiqueta el recuadro con el `blockId` crudo (`COVER.SUBTITLE` en `evidencia/fase-3/editor/lienzo-con-seleccion.png`); con el manifiesto podría ser la etiqueta legible.
- [Fase 3 · 3-4] **`apps/web` importa `tokens.css` de `packages/sections` por ruta relativa** (`../../../../packages/sections/src/theme/tokens.css`) porque el `exports` de ese paquete solo publica `"."` y añadirle `"./theme/tokens.css"` exigiría tocarlo. **Supuesto tomado:** ruta relativa con el motivo escrito al lado. ¿Se añade esa entrada al `exports` de `packages/sections` cuando el paquete vuelva a ser escribible?
- [Fase 3 · 3-4] **Los e2e del editor escriben en la invitación de demostración** (id 3, la que abre el dueño): cada prueba restaura el valor que cambió, pero la `revision` del documento sube en cada corrida y el historial acumula lotes de prueba. **Supuesto tomado:** es aceptable porque el contenido queda idéntico y `04 §20.3` exige backend real sin mocks. ¿Se prefiere que los e2e siembren su **propia** invitación completa (más lento y con más SQL, porque `uses_templates2` no tiene ruta HTTP), o se acepta compartir la de demostración?
- [Fase 3 · 3-4] **`pnpm -r lint` esta en rojo, y no por este bloque**: `packages/sections` falla con 6 errores «Definition for rule 'react-hooks/exhaustive-deps' was not found» [V]. El plugin `eslint-plugin-react-hooks` no esta registrado en `frontend/eslint.config.mjs` y varios componentes de ese paquete llevan `eslint-disable-next-line react-hooks/exhaustive-deps`, que ESLint 10 trata como error cuando la regla no existe. Verificado que `packages/**` esta intacto respecto de la base de la fase (diff vacio) y que `eslint apps/web` sale limpio. **Supuesto tomado:** no lo arreglo — `packages/sections` es contrato integrado y prohibido para este bloque, y el archivo de configuracion raiz lo esta tocando otra sesion en paralelo. ¿Se registra `eslint-plugin-react-hooks` en la configuracion raiz (una linea), o se retiran esas directivas del paquete? Hasta entonces `pnpm -r lint` no puede ser compuerta de integracion.
## Fase 3 · 3-3 — render público de la invitación (7)

- **[ALTA]** [Fase 3 · 3-3] **Un import de VALOR en `packages/sections` mete `zod` y todo `@invitaciones/schema` (87,2 KB gz) en el navegador de cada invitado, y es lo único que separa la ruta pública de su presupuesto** [V, `bitacora/3-3.md §3`]. `frontend/packages/sections/src/schema-types.ts:13` escribe `import { ComposedBlock as ComposedBlockSchema, … } from "@invitaciones/schema"` para usar esos cinco nombres **solo en posición de tipo** (`ReturnType<typeof X.parse>`); con `verbatimModuleSyntax: true` (heredado de `tsconfig.base.json`) TypeScript conserva la sentencia y el grafo del esquema —que construye esquemas Zod al cargarse, así que no se puede sacudir— viaja al cliente. Atribuido con el `page_client-reference-manifest.js` de la ruta y confirmado por marcadores (`ZodError`/`invalid_union` en ese chunk, ningún símbolo de secciones; el chunk de secciones tiene `GiftTable`/`inv-theme` y ningún símbolo de zod). Desglose real: 127,7 KB runtime de Next + 87,2 KB zod + 9,8 KB las 12 secciones + 5,6 KB fronteras = 230,3 KB, contra 150 KB. **Supuesto tomado:** no lo arreglo — `frontend/packages/**` es área prohibida para este bloque y el brief manda documentarlo, no aplicarlo (lo intenté solo para medir el contrafactual y el propio entorno lo bloqueó; `git status frontend/packages/` queda vacío). **La corrección es una palabra**: `import {` → `import type {`, que admite `typeof` sobre lo importado y no cambia ni un tipo; deja la ruta en **143,1 KB gz, dentro del presupuesto**. ¿Quién aplica esa palabra, y en qué bloque? Mientras no se aplique, `pnpm --filter web run budget` y `e2e/presupuesto.spec.ts` quedan en rojo a propósito.

- **[ALTA]** [Fase 3 · 3-3] **La portada —la primera pantalla de la invitación, la que decide si parece cara— sale con el texto blanco sobre una lámina clara y el nombre de los novios en sans**, por dos defectos de `packages/sections` [V, evidencia lado a lado en `evidencia/fase-3/render-publico/defecto-portada-{antes,despues}.png`]. (1) `CoverSection.module.css:42` deja `.scrim` sin posicionar mientras `ImageBlock.module.css:1-3` da `position: relative` a `.frame`: en el mismo contexto de apilamiento lo posicionado se pinta después, así que el velo del 92 % de tinta queda DEBAJO de la foto y no se ve; el `linear-gradient` está bien escrito y bien calculado, simplemente no llega a pintarse. (2) `.heroName` sí fija `font-family: var(--inv-font-heading)` (línea 98), pero `TextBlock` pinta el texto en un `<span class="blocks-module__text">` que fija `--inv-font-body` en el propio nodo y gana por especificidad, así que el título de portada nunca usa la tipografía de titular. **Supuesto tomado:** no lo parcheo desde `apps/web` —sería presentación propia en la ruta pública (P3) y taparía el defecto donde no está—; queda documentado con las dos declaraciones que lo arreglan (`.scrim { position: relative }` y `font-family: inherit` en el `span` de `.heroName`/`.eyebrow`). ¿Se deriva a un bloque con permiso sobre `packages/sections` **antes** de que el dueño juzgue las capturas de `evidencia/fase-3/render-publico/`?

- **[ALTA]** [Fase 3 · 3-3] **`04 §17.1` pide `muted/bg ≥ 3.0` pero los componentes usan `--inv-color-muted` en texto pequeño, donde WCAG exige 4,5:1 — y axe lo caza** [V, `evidencia/fase-3/render-publico/axe.txt`]. Una sola violación `serious` (`color-contrast`), 4 nodos, todos en `CelebrantSection` (`.kicker`, `.dateRow > time`, los dos párrafos de `.quote`). Medido con la fórmula exacta de `04 §17.1`: `blush.muted #9A8A86 / bg #FDF7F5 = 3,12:1` (pasa el umbral de §17.1, escrito para "texto secundario **grande**") y `3,31:1` sobre `surface`. Es también el único motivo de `categories:accessibility = 0.96` en las 5 corridas de Lighthouse, que incumple el `minScore: 1` de `04 §16.2`. Hay dos arreglos y ninguno cae en `app/(public)/**`: (a) `muted → #7B6E6B` en `frontend/templates/boda-clasica/1.0.0/theme.json` — calculado conservando matiz: 4,62:1 sobre `bg` y 4,90:1 sobre `surface`; (b) que `packages/sections` deje de usar `muted` por debajo de 18,66 px. **Supuesto tomado:** no toco ni la plantilla ni el paquete; ADR-024 queda incumplida y las dos pruebas de `e2e/a11y-publico.spec.ts` en rojo, con la salida a la vista. ¿Se corrige la paleta, se corrigen los componentes, o se corrige `04 §17.1` para exigir 4,5:1 a `muted` (que es lo que de verdad hace falta si se usa en texto de cuerpo)?

- [Fase 3 · 3-3] **`notFound()` y `forbidden()` pintan la página correcta pero responden HTTP 200, no 404/403, en `next@16.3.4`** [V]. Aislado: no lo causa mi `error.tsx` (probado quitándolo), ni `generateStaticParams` (probado quitándolo), y ya pasaba en el esqueleto de 3-1. En esa versión el estado solo se fija para el pathname `/404` o para un not-found de acción de servidor (`next/dist/server/app-render/app-render.js:1483-1485` y `:1738`); un `notFound()` lanzado dentro del render lo captura el `HTTPAccessFallbackBoundary` del cliente y la respuesta ya salió con 200. Una URL no enrutada sí da 404 (`curl /` → 404). **Supuesto tomado:** se conserva `notFound()`/`forbidden()`, que es lo que el diseño y el brief exigen y lo que pinta la página correcta; la protección de indexación no depende del estado (va por `X-Robots-Tag` y por la etiqueta `robots`). ¿Se acepta el 200 como limitación conocida de Next 16, se abre incidencia aguas arriba, o se resuelve con una regla en `proxy.ts` que consulte `GET /public/i/{token}/exists` antes de renderizar (una petición extra por visita no cacheada, que es justo lo que la ISR evita)?

- [Fase 3 · 3-3] **`metadataBase` no tiene un origen declarado en ninguna parte del proyecto**, y sin él Next resuelve `og:image` contra `http://localhost:3000` y avisa en cada build [V]. **Supuesto tomado:** `app/(public)/layout.tsx` lo toma de `NEXT_PUBLIC_SITE_URL` con el origen local como defecto, y avisa por consola si el valor no es una URL válida en vez de tumbar el render. ¿Cuál es el dominio público real del producto y quién declara esa variable en el despliegue? Sin ella, la tarjeta de WhatsApp —que es el canal principal por el que llega una invitación— no se ve en producción.

- [Fase 3 · 3-3] **`ImageBlock` pone `loading="lazy"` en TODAS las imágenes, incluida la de portada, y nunca `fetchpriority="high"` ni `sizes`/`srcset`** (`packages/sections/src/blocks/ImageBlock.tsx:50-58`), mientras `04 §16.1` pide exactamente lo contrario para la portada ("`priority`/`fetchpriority="high"`, `next/image` con `sizes`"). Hoy no penaliza porque el LCP de la invitación de demostración resultó ser **texto** (el nombre de los novios) y no la lámina; con una fotografía real de portada sí lo hará, y Lighthouse ya marca `uses-responsive-images` con 172 KiB de ahorro estimado. **Supuesto tomado:** no lo toco (`packages/**`), y tampoco añado un `<link rel="preload">` de la portada desde la página, porque el elemento LCP medido no es la imagen y habría sido optimizar a ciegas. ¿Se le da a `ImageBlock` una prop de prioridad que `CoverSection` active para su hueco de imagen, en qué bloque, y se acepta que ese paquete no puede usar `next/image` (04 §19.3 solo lo permite como excepción, pero `next/image` obliga a conocer `width`/`height`, que `ResolvedValue` no trae)?

- [Fase 3 · 3-3] **`@next/bundle-analyzer@16.3.4` no funciona con `next@16.3.4`**: el propio build avisa "The Next Bundle Analyzer is not compatible with Turbopack builds, no report will be generated. Consider trying the new Turbopack analyzer via `next experimental-analyze`" [V]. `04 §16.2` lo nombra como el complemento de diagnóstico oficial. **Supuesto tomado:** se deja enganchado bajo `ANALYZE=1` en `next.config.ts` (antes ni siquiera estaba cableado, así que la orden documentada no hacía nada) y el desglose por ruta se obtiene con `scripts/check-budget.mjs`, que atribuye los chunks a módulos por el `page_client-reference-manifest.js` y es más accionable que un treemap. `next experimental-analyze -o` también funciona y escribe en `.next/diagnostics/analyze`, pero su formato es binario y necesita levantar su interfaz web. ¿Se corrige `04 §16.2` para nombrar `next experimental-analyze`, o se pasa el build a `--webpack` solo para el diagnóstico (probado en 3-1: mismo resultado de tamaños, pero es un bundler distinto del que se despliega)?

## Fase 3 · 3-4b — el `TemplateManifest` expuesto al editor (2)

- **[ALTA]** [Fase 3 · 3-4b] **El contrato congelado hablaba de UN campo `manifest`; entrego DOS, `manifest` y `theme`, y necesito que se acepte o se rechace explícitamente** [V]. Motivo: el punto (5) del defecto que se me encargó resolver son las **paletas y los conjuntos tipográficos**, y en este esquema **no están en el manifiesto**: `01 §2.2` dice que «el manifiesto **no** tiene campo `theme`», `domain/TemplateManifest.kt:26-27` lo repite, son columnas distintas (`tpl_template_version.manifest` y `.theme`, `V30`), y `frontend/packages/schema/src/manifest.ts:65` declara `TemplateManifest` como `z.strictObject` — meter `theme` dentro de `manifest` haría que el propio frontend rechazara el cuerpo al parsearlo. Con un solo campo, el selector de paleta seguiría siendo imposible. **Supuesto tomado (ADR-3-4b-01):** dos campos hermanos, cada uno idéntico a su columna, que es la forma en que el paquete de plantilla ya está partido (`template.json` + `theme.json`, `01 §2.1`). Sigue sin haber ruta nueva: **19 rutas** y `Templates2RouteInventoryTest` intacto y en verde. ¿Se acepta el segundo campo, o el orquestador prefiere que las paletas se resuelvan en otro bloque y `theme` se retire?
- [Fase 3 · 3-4b] **Queda por decidir si `:choose-template` (`03 §3.2`) debe llevar también `manifest` y `theme`** [V: hoy no los lleva; `ChooseTemplateResponse` no cambió]. El editor puede vivir sin ello — tras elegir plantilla ya recarga el documento —, pero es un viaje de más en el arranque y en el cambio de plantilla, que es justo cuando el manifiesto cambia entero. **Supuesto tomado:** no lo toco; el encargo era `GET .../document` y el cambio más pequeño que resuelve el problema es ese. (`restore` no lo necesita: verificado que usa `versionDe(fila)`, la versión vigente, y nunca la de la snapshot — `api/EditorDocumentService.kt:589`.) ¿Se replica en `:choose-template` en el bloque 3-5, o se deja que el editor recargue?
---

## Bloque 3-3b (2026-09-05) — correcciones de portada, presupuesto y contraste

**P-3-3b-1 (MEDIA, presupuesto) · El editor arrastra 87,1 KB gz de Zod por el mismo defecto que D2.**
`apps/web/lib/composed-patch.ts:22-24` importa `ComposedBlock`/`ComposedGroup`/`ComposedSection` por
VALOR para usarlos solo como `ReturnType<typeof X.parse>`. Con `verbatimModuleSyntax` el import
sobrevive y, como `packages/schema/package.json` no declara `sideEffects: false`, ningún empaquetador
lo elimina. `/editor/[invitationId]` mide 268,5 KB de 600, así que no rompe su compuerta, pero son
87,1 KB que no hacen nada. Es `import type` + mover el uso de valor si lo hubiera. Supuesto tomado:
no se toca — `apps/web/**` es área prohibida para este bloque y hay otro agente dentro.

**P-3-3b-2 (MEDIA, visual) · Otros dos huecos siguen sin la tipografía de titular.**
`GallerySection.module.css:130` `.hashtag` y `FamilySection.module.css:79` `.blessing` declaran
`font-family: var(--inv-font-heading)` alrededor de un `TextBlock`, que fija la de cuerpo en su
propio `<span>` y gana: salen en palo seco, igual que salía el nombre de portada. Dos caminos
(ADR-3-3b-01): repetir el `font-family: inherit` en esos dos archivos, o cambiar
`blocks/blocks.module.css .text` a `inherit` de una vez (arreglaría los tres a la vez y la raíz ya
fija la familia de cuerpo, así que el defecto no cambia). Supuesto tomado: solo se arregla la
portada, que es el defecto medido; el resto necesita capturas antes/después que juzgue el dueño.

**P-3-3b-3 (MEDIA, diagnóstico) · El informe de axe se recorta a 4 nodos y ocultó la mitad del
defecto.** `apps/web/e2e/a11y-publico.spec.ts:29` hace `v.nodes.slice(0, 4)`. La aserción compara la
lista completa, así que no oculta un fallo — pero el bloque 3-3 diagnosticó con lo que veía y se dejó
9 de 13 nodos fuera, lo que hizo que D3 llegara descrito como la mitad de lo que era. Conviene subir
el corte o imprimir el mensaje de axe (que trae los dos colores y el ratio). Área prohibida aquí.

**P-3-3b-4 (BAJA, arte) · El escritorio de la portada queda más liso que el móvil.**
Con la portada ya corregida, un recorte apaisado (1440×900) de una lámina 5:7 se come el ornamento:
queda un degradado casi liso arriba y el texto legible abajo. Es exactamente lo que avisaba
`handoffs/3-2d.md §4` ("un recorte cuadrado de la portada se come el ornamento"). Se arregla con arte
(una lámina apaisada para la portada, o mover el motivo), no con CSS. En móvil, que es donde se abre
una invitación, se ve completo: `evidencia/fase-3/correcciones/portada-corregida-movil.png`.

**P-3-3b-5 (MEDIA, pruebas) · `pnpm --filter web run e2e` es inestable con `fullyParallel: true`.**
Medido en corridas repetidas: fallan pruebas DISTINTAS cada vez (`render-publico` "una sección oculta
desaparece", `conflicto` E-06, y una vez `a11y-publico`), y en aislamiento los archivos pasan. La
causa es la que 3-3 ya anotó como riesgo: "una sección oculta" MUTA y republica la invitación de
demostración compartida mientras las demás la leen, y si se interrumpe la deja con una sección menos.
La política anti-flake de `contratos.md §6` prohíbe la cuarentena sin issue: esto es el issue.
Arreglo probable: que esa prueba trabaje sobre una invitación propia, o `fullyParallel: false` para
los archivos que tocan la demostración. Área prohibida aquí (`apps/web/e2e/**`).

**P-3-3b-6 (BAJA, higiene) · `u08-contrast.test.ts` afirma sobre copias caducadas de la paleta.**
Sus tres paletas son literales anteriores a 3-2d y a 3-3b, y una prueba dice explícitamente que
`blush` incumple `accentInk/accent` y `accent/bg`, lo que ya no es cierto del paquete registrado.
Pasa en verde porque se afirma a sí misma. Se le añadió un aviso de cabecera apuntando a
`contraste-plantillas.test.ts` (que sí lee los archivos reales); actualizar o retirar los literales
es decisión del dueño del paquete.

**P-3-3b-7 (BAJA, contrato) · `04 §17.1` y la invariante `I-31` se quedan cortos.**
Sus umbrales para `muted/bg` y `accent/bg` (3,0) están escritos para texto grande y para componentes
de interfaz; `packages/sections` usa los dos tokens como color de TEXTO normal, donde manda WCAG
1.4.3 (4,5). Una paleta puede pasar `04 §17.1` y aun así dar una violación `serious` de `axe` en el
render público — que es exactamente lo que pasó. ADR-3-3b-03 lo endurece en el generador y en las
pruebas del frontend; falta enmendarlo en el documento de diseño y en `I-31` cuando el orquestador
acepte ADR-1R-F-06, o el backend seguirá admitiendo paletas que el render público no puede usar.

**P-3-3b-8 (ALTA para las pruebas, módulo antiguo) · `/auth/token` da 500 con inicios de sesión
simultáneos del mismo usuario.** Medido [V] en el log del backend, 16 ocurrencias durante las
corridas de e2e:
`IncorrectResultSizeDataAccessException: Query did not return a unique result: 2 results were
returned` en `mx.evolutiondev.invitaciones.modules.auth.service.RefreshTokenService.createOrUpdateRefreshToken(RefreshTokenService.kt:20)`,
llamado desde `AuthController.attemptAuth(AuthController.kt:40)`. Dos autenticaciones concurrentes del
mismo usuario crean dos filas de refresh token, y a partir de ahí toda autenticación de ese usuario
responde 500. `e2e/util/demo.ts` hace `POST /auth/token` desde CADA archivo de prueba y
`playwright.config.ts` tiene `fullyParallel: true`, así que la carrera se dispara sola: con seis
corridas seguidas de la suite, seis terminaron con las dos pruebas de `a11y-publico` fallando por
`POST /auth/token respondió 500`. Es la causa raíz principal de P-3-3b-5. `modules/auth` es el
módulo ANTIGUO y el brief común lo declara rechazo automático, así que **no se toca**: se reporta con
archivo y línea para quien tenga ese ámbito. Mitigación posible sin entrar ahí: que `e2e/util/demo.ts`
autentique una vez y comparta el token entre archivos (`globalSetup`), en vez de una vez por archivo.

## Fase 3 · 3-5 — paneles y flujos del editor (6)

- **[CERRADA por 3-5b — ver `bitacora/3-5b.md` y ADR-3-5b-01]** ~~**[ALTA]**~~ [Fase 3 · 3-5] **La vista previa en vivo de paleta/tipografía (`04 §7.1` paso 8) llega al lienzo pero no cambia ningún color** [V: script de diagnóstico aparte — `data-theme-palette` del `<div>` de `ThemeProvider` cambia de `blush` a `olive` al pasar el ratón, pero `getComputedStyle(...).getPropertyValue("--inv-color-bg")` se queda en `#FDF7F5` (el de `blush`) antes y después]. Causa raíz: `app/(canvas)/editor/[invitationId]/canvas/LienzoCliente.tsx` (de 3-4, `app/(canvas)/**`, fuera de mi alcance) construye `compuestoEfectivo` intercambiando solo `theme.paletteId`/`theme.fontSetId` cuando llega `PREVIEW_THEME`, sin volver a resolver `theme.tokens` para ese id nuevo — y `ThemeProvider` (`packages/sections`, contrato integrado, tampoco tocable desde aquí) pinta los `--inv-color-*` a partir de `theme.tokens`, no del id. El protocolo (`PreviewThemeMessage`, `packages/schema/src/canvas-protocol.ts`, congelado) solo lleva los identificadores, nunca los tokens completos — a propósito, es un mensaje efímero y pequeño — así que la resolución tiene que pasar en el receptor. **Supuesto tomado:** de mi lado (`ThemePicker.tsx`) el cableado es correcto y no invento una resolución de tokens fuera de mi archivo; mejoré el propio interruptor de la paleta (borde visible en `:hover`) para que al menos la interacción se vea con claridad mientras el lienzo no reacciona. ¿Quién (3-4, o quien herede `app/(canvas)/**`) añade en `LienzoCliente.tsx` la resolución de `paletteId`→`tokens` usando el mismo `ThemeSpec` que ya expone `lib/manifest.ts`, para que el paso 8 de `04 §7.1` se cumpla de verdad?
- **[ALTA]** [Fase 3 · 3-5] **El fallback `required: spec?.required ?? false` de `SectionList.tsx` era inseguro** — sin manifiesto (el caso normal hoy: el contrato `manifest` en `GET .../document` no existe todavía), TODA sección caía a "no obligatoria" y mostraba un interruptor activo, incluidas Portada/Confirmación/Pie. Lo descubrí mirando `enlace-copiado.png` después de un `page.reload()` real (que borra el *fixture* en memoria) — exactamente la situación de producción de hoy. **Corregido en este bloque** (`required: spec ? spec.required : true`, conservador: sin confirmación positiva del manifiesto, toda sección se trata como obligatoria) con prueba unitaria y e2e nuevas (`SectionList.test.tsx`, `secciones.spec.ts` › `U-18/E-degradado`). Lo dejo como pregunta porque es un patrón que puede repetirse en otros componentes que consultan el manifiesto con un `?? false`/`?? true` a ciegas: ¿vale la pena una regla de revisión (o un *lint* propio) que marque cualquier `spec?.<booleano> ?? <valor>` fuera de `lib/manifest.ts`, para que el próximo campo opcional del manifiesto no repita el mismo error por defecto equivocado?
- [Fase 3 · 3-5] **`ThemeSpec`/`theme.json` no están prometidos por el contrato nuevo** (solo se anunció `manifest` en `GET .../document`, `bitacora/3-4.md §2.1`) — sin ellos, `ThemePicker` no tiene catálogo de paletas/tipografías que ofrecer y se degrada a mostrar la combinación actual de solo lectura, con el texto «Las demás combinaciones de esta plantilla todavía no están disponibles aquí para elegir» (P1: explicado, no oculto ni roto). **Supuesto tomado:** construí y probé el camino completo contra el `theme.json` REAL de `boda-clasica` vía *fixture* (ADR-3-5-01), dejando `useTemplateManifest` listo para el campo real cuando llegue. ¿Se añade `theme` (o se anida dentro de `manifest`) en la misma respuesta que resuelva la pregunta ALTA de 3-4 sobre `manifest`, o llega por una ruta aparte?
- [Fase 3 · 3-5] **`window.__editorStore` (de 3-4) sigue vivo** aunque `BlockForm` ya existe, porque `editor-nucleo.spec.ts`/`deshacer.spec.ts`/`conflicto.spec.ts` (de 3-4, fuera de mi alcance) siguen tecleando en el store directamente por ese enganche en vez de por la UI real [V: `grep` confirma su uso en los tres]. **Supuesto tomado** (ADR-3-5-05): no lo retiro — retirarlo rompería esos tres archivos en silencio y no tengo mandato para reescribirlos. Añadí `window.__seedManifestFixture` bajo el mismo guardián en vez de crear uno nuevo. ¿Quién reescribe esos tres e2e para conducir la UI real (ahora que existe) y libera el retiro de `window.__editorStore`?
- [Fase 3 · 3-5] **`editor-nucleo.spec.ts` (de 3-4) tiene 2 pruebas rotas por consecuencia directa de este bloque, no por un defecto mío** — diagnosticado, no corregido (archivo fuera de mi alcance): **E-N2** espera `aside [aria-current="true"]` tras seleccionar un bloque del lienzo, pero mi `BlockForm` reemplaza legítimamente el `<aside>` de secciones por el panel de contenido en cuanto `panel==="block"` (comportamiento pedido por el brief), así que ese `aria-current` ya no existe donde la prueba lo busca. **E-N4** falla en un `waitForFunction` que exige ≥3 `<img>` cargadas en 15 s; verificado por la captura de contexto de error que clic/selección/desplazamiento/`BlockForm` funcionaron correctamente — parece contención de recursos de una máquina con varias sesiones de agentes en paralelo (ver el punto siguiente), no una regresión funcional. ¿Actualiza el dueño de ese archivo el selector de E-N2 para apuntar al panel de contenido real, y confirma si E-N4 es flaky de entorno o una regresión genuina?
  **[E-N2 cerrado por 3-6]**: cambiada la aserción a `[id="campo-<blockId>"]` (el campo exacto que `BlockForm` pinta para el bloque clicado), verificada en 5 corridas. **E-N4 sigue siendo flaky de entorno, ahora medido con precisión**: en 4 corridas completas de 3-6 (140 ejecuciones), 2 fallos por timeout de 20 s esperando `.lienzo-raiz` del `<iframe>` (una vez en E-N2 antes de mi arreglo, una vez en E-N3, nunca en el mismo test dos veces) — confirmado como contención de CPU de la máquina compartida (bitácora 3-6 §3.3), no una regresión. Sigue sin corregirse (no es mi archivo y subir un `timeout` a ciegas sin saber el perfil del runner real de CI sería adivinar).
- [Fase 3 · 3-5] **La máquina aloja varias sesiones de agentes en paralelo compartiendo puertos, el clúster de Postgres, el backend y las credenciales de la invitación de demostración** [V: encontrado un proceso `next start` de OTRO *worktree* (`agent-a2c211173de1d1936`) escuchando en el puerto 3000 durante este bloque]. Usé `PW_PORT=3013` (mecanismo de ADR-3-4-04) para no interferir y maté solo los procesos que yo mismo levanté. Relacionado: `POST /auth/token` tiene una condición de carrera real (`500 IncorrectResultSizeDataAccessException`, filas duplicadas en `refresh_tokens` bajo *logins* concurrentes de la misma cuenta de demostración) — `modules/auth`, fuera de mi alcance; mitigado corriendo mis e2e con `--workers=1`. ¿Vale la pena que cada sesión de la fase 3 tenga su propia cuenta/invitación de demostración en vez de compartir la id 3, para que estos dos problemas de contención dejen de aparecer del todo?

## Fase 3 · 3-5b — la vista previa de paleta cambia el color de verdad (4)

**CERRADA la ALTA de 3-5** («la vista previa de paleta llega al lienzo pero no cambia ningún
color»): corregida y medida en `bitacora/3-5b.md`. El síntoma estaba bien diagnosticado; el sitio
del arreglo, no — el lienzo **no puede** resolver `paletteId → tokens` (cuatro paredes medidas,
§2.2 de esa bitácora), así que la resolución vive ahora en `lib/store.ts` y los tokens viajan en un
`RENDER` efímero (ADR-3-5b-01). `--inv-color-accent` computado dentro del iframe: `#B05555` → 
`#657446` al pasar el ratón por «Olivo y marfil», y de vuelta al salir [V].

- **[ALTA]** [Fase 3 · 3-5b] **`04 §9.3` describe un `PREVIEW_THEME` que su receptor no puede
  cumplir, y la corrección de verdad es una línea del protocolo** [V, `bitacora/3-5b.md` §2.2]. El
  mensaje lleva solo `paletteId`/`fontSetId`, pero el lienzo no tiene el `theme.json` ni ninguna vía
  para obtenerlo: `PreviewThemeMessage` es `z.strictObject` y un campo extra hace que el mensaje se
  descarte entero (`canvas-protocol.ts:115-120`, `:242-249`); `connect-src 'none'`
  (`apps/web/proxy.ts:28`) impide pedirlo; `eslint.config.mjs:118-124` impide importar
  `lib/manifest.ts`; y el componente de servidor de la ruta del lienzo tampoco puede, porque la
  sesión va por cabecera `Authorization` desde `sessionStorage` (`lib/api-client.ts:52-71`) y las
  rutas que sirven `theme.json` están todas bajo `@PreAuthorize` (`api/CatalogController.kt:23-24`).
  **Supuesto tomado (ADR-3-5b-01):** con el protocolo congelado y `frontend/packages/**` prohibido,
  los tokens viajan por el único mensaje que los transporta, `RENDER`, con la misma `revision` y sin
  escribir nada. Funciona y está probado en las dos capas, pero manda un `ComposedDocument` completo
  por cada entrada/salida del ratón donde el diseño quería dos identificadores. ¿Se añaden
  `tokens`/`fonts` **opcionales** a `PreviewThemeMessage` (y se corrige `04 §9.3`) cuando
  `packages/schema` vuelva a ser escribible, para devolver la resolución al lienzo y retirar el
  `sink.render(...)` de `previewTheme`? Es una línea de esquema más dos de `ThemePicker`.

- [Fase 3 · 3-5b] **`aria-busy` (`04 §12.4`) no aparecía NUNCA en el lienzo desde 3-4, por un choque
  de espacios de claves** [V: montando `LienzoCliente` con un `PATCH` `pending:true` y contando los
  nodos ocupados — 0]. `LienzoCliente` indexaba `pendientes` con `refKey(ref)`
  (`sectionKey::blockId::itemId::itemBlockId`, la clave de la SELECCIÓN,
  `packages/sections/src/canvas/CanvasContext.tsx:64-66`) mientras `packages/sections` busca por
  `blockId` (`sections/CoverSection.tsx:38-39`) y por `` `${itemId}.${itemBlockId}` ``
  (`blocks/dispatch.ts:41`). **Corregido en este bloque** con una función local de tres líneas,
  porque hacía falta para probar ADR-3-5b-02. La duplicación del formato de clave es fea: el paquete
  tiene `itemPendingKey` pero **no lo reexporta** (`packages/sections/src/index.ts:33` exporta
  `refKey` y no `itemPendingKey`). ¿Se añade `itemPendingKey` al `index.ts` del paquete cuando
  vuelva a ser escribible, y el consumidor lo importa en vez de repetir el formato?

- [Fase 3 · 3-5b] **El titular de la banda de acento («¿Nos acompañas?» de la sección de
  confirmación) tiene poco contraste en las tres paletas de `boda-clasica`**, visible en las dos
  capturas de `evidencia/fase-3/correcciones/paleta-preview-{antes,despues}.png` — es tinta sobre
  acento, no `muted` sobre fondo, así que **no** es el defecto que 3-3b corrigió. **Supuesto
  tomado:** no lo toco (`packages/sections`/`frontend/templates` prohibidos para este bloque) y no
  es una regresión: se ve idéntico antes y después. ¿Entra en la próxima pasada de contraste
  (`04 §17.1` no lista la pareja `ink`/`accent` entre las cinco que audita), o se corrige en la
  sección?

- [Fase 3 · 3-5b] **`GET .../document` entrega `theme` y ahora lo consumen DOS caminos que no se
  hablan**: `lib/manifest.ts` (para `ThemePicker`, con su propia caché por invitación+versión) y
  `lib/store.ts` (`themeSpec`, para resolver la vista previa). Los dos leen el MISMO campo de la
  MISMA respuesta y los dos hacen su propio `safeParse` porque `lib/api-types.ts` todavía no declara
  `manifest`/`theme` en `GetDocumentResponse`. **Supuesto tomado:** no unifico — `lib/manifest.ts`
  es de 3-5 y `lib/store.ts` de 3-4, y unir las dos cachés es un refactor de más de un bloque.
  ¿Se declaran `manifest` y `theme` en `lib/api-types.ts` (que es donde el contrato de 3-4b debería
  estar escrito) y se deja una sola fuente para los dos consumidores?
  **[Cerrado a medias por 3-6]**: la carrera de `POST /auth/token` se corrigió del lado de los e2e con un login único por corrida (`e2e/global-setup.ts`, ADR-3-6-01), sin tocar `modules/auth` — cero autenticaciones concurrentes medidas en 5 corridas completas posteriores. La invitación compartida se corrigió con un mutex real entre procesos (ADR-3-6-02) en vez de invitaciones separadas por sesión — sigue habiendo UNA invitación de demostración compartida entre sesiones de agentes DISTINTAS de la máquina (fuera del control de cualquier bloque de esta fase), así que la pregunta de fondo ("una invitación de demo por sesión") sigue abierta para quien decida el aprovisionamiento del entorno compartido, no para el código de la suite.

## Fase 3 · 3-6 — pruebas e2e y calidad (7)

- **[ALTA]** [Fase 3 · 3-6] **`frontend/apps/web/lib/store.ts:558-566` (y ~754/1025/1057) nunca actualiza `s.document.content` tras las 11 operaciones** — solo `s.composed` se parchea de forma optimista; el árbol crudo solo se asigna en `load()`/`restoreFromHistory`/conflicto, y el servidor no lo reenvía (`POST .../document/operations` responde sin `document`, verificado por HTTP). Consecuencia medida: subir una foto por primera vez en un campo `image` que empezaba sin valor dentro de la MISMA sesión deja el botón diciendo "Elegir foto" para siempre (`ScalarBlockField.tsx:74` deriva `assetId` de `rawValue`) y `alCambiarAlt`/`alMoverFocal` (`ImageField.tsx`, guardan con `if (!value) return`) dejan de mandar nada — pese a que el servidor SÍ tiene la foto. Alcance más amplio SIN confirmar empíricamente (marcado `[I]`): `ctxBloque`/`ctxItemBlock` (~582-599) también leen ese árbol para calcular la inversa de undo, así que un SEGUNDO `setBlock` sobre el MISMO bloque en la misma sesión (fuera de la ventana de coalescencia) podría calcular su "antes" contra el valor ORIGINAL de sesión en vez del de la primera edición. `apps/web/lib/**` es área prohibida para este bloque. **Supuesto tomado:** documentado con precisión quirúrgica y parche propuesto en `bitacora/3-6.md` §6.1/ADR-3-6-04; `flujo-principal.spec.ts` (E-01) se escribió para no depender de la señal rota (verifica el `<img>` del lienzo y el contenido por HTTP en su lugar). ¿Quién tiene permiso sobre `apps/web/lib/store.ts` para aplicar el parche propuesto (una función `applyOperationToRawDocument` hermana de `applyOperationOptimistic`, en los mismos 4 puntos de llamada), y confirma o descarta la sospecha sobre el cálculo de undo del segundo `setBlock`?
- **[MEDIA]** [Fase 3 · 3-6] **El job `frontend` de `.github/workflows/ci.yml` está en rojo hoy por `pnpm -r lint`** (6 errores en `packages/sections`: `react-hooks/exhaustive-deps`/`react/no-array-index-key` "not found", el plugin no está registrado en el `eslint.config.mjs` raíz — ya documentado por 3-4, `preguntas-abiertas.md` § "Fase 3 · 3-4"). **Verificado que esto bloquea el job `e2e`**: `needs: [backend, frontend]` significa que GitHub Actions nunca ejecutaría `e2e` mientras `frontend` siga fallando — todo el trabajo de este bloque quedaría sin correr en un PR/push real. `packages/**` y el `eslint.config.mjs` raíz son área prohibida para 3-6 también. **Supuesto tomado:** no se toca; se documenta el efecto exacto (bloqueo de `e2e` vía `needs:`) que 3-4 no había medido. ¿Quién registra `eslint-plugin-react-hooks`/la regla que falta en la configuración raíz, y en qué bloque — antes de fusionar cualquier PR que dependa de que `e2e` corra de verdad?
- [Fase 3 · 3-6] **LCP del render público mide por encima del presupuesto de 2 500 ms en las 3 ejecuciones de LHCI de este bloque** (medianas 3 191 / 3 544 / 3 433 ms), con una variabilidad enorme entre corridas individuales de la MISMA build (1 561–3 627 ms) típica de contención de CPU en esta máquina compartida — no de un cambio de código: este bloque no tocó ni una línea de `packages/**`/`apps/web/{app,components,lib}`. 3-3 había medido 2 314 ms de mediana con la misma plantilla, en una sesión anterior de este mismo tipo de entorno. **Supuesto tomado:** no se trata como una regresión a corregir (no hay mecanismo de causa) ni se certifica que el presupuesto se cumple (los tres valores lo superan). ¿Puede re-medirse en un runner de GitHub Actions real (menos contendido que este contenedor de desarrollo) antes de decidir si hace falta trabajo de rendimiento real, y quién lo hace dado que no hay acceso a CI desde ninguna sesión de esta fase hasta ahora?
- [Fase 3 · 3-6] **E-08/E-09 (`04 §20.2`) tienen cobertura PARCIAL, no completa** — `a11y-publico.spec.ts` (de 3-3) solo mide `boda-clasica`, nunca `xv-jardin`, y el criterio literal de E-08 pide "las dos plantillas"; `a11y.spec.ts` (de 3-1) solo mide el catálogo VACÍO y el estado "no disponible" del editor, nunca `/editor/{id}` con una plantilla ya elegida y el panel de contenido montado (el estado real que un cliente usa la mayor parte del tiempo). **Supuesto tomado:** no se amplió por el riesgo de tiempo restante en este bloque, no por imposibilidad — publicar una invitación de `xv-jardin` y auditar el editor CARGADO son extensiones directas de patrones que ya existen en la suite (`crearInvitacionPublicable`-como para el primero, `sembrarManifiesto` + `new AxeBuilder` para el segundo). ¿Se completa esta cobertura en un bloque futuro, y se acepta mientras tanto que E-08/E-09 están "cumplidos parcialmente" y no "cumplidos"?
- [Fase 3 · 3-6] **El alcance de teclado DENTRO del `<iframe>` del lienzo (E-10) queda sin determinar, no como "sin trampa"** — `document.activeElement` del documento padre solo informa el `<IFRAME>` en sí, nunca el nodo real con foco dentro del `sandbox` sin `allow-same-origin`; preguntándole al FRAME por su propio `activeElement` se obtuvieron lecturas INCONSISTENTES entre corridas idénticas (medido: un `<span>` decorativo de `SelectionOverlay.tsx` sin `tabIndex` — verificado leyendo el componente, no puede tener foco de verdad — se reportó "enfocado" varias veces seguidas en una corrida y ninguna en la siguiente). **Supuesto tomado:** `e2e/teclado-editor.spec.ts` se detiene, sin fallar, en el borde del `<iframe>`, y deja el interior sin afirmar nada en ningún sentido — territorio de una auditoría dedicada del lienzo (E-07/A1-A8), no de este archivo. ¿Vale la pena una auditoría de teclado específica DENTRO del lienzo (con el mismo mecanismo que `editor-nucleo.spec.ts` usa para leer su documento — `page.frames().find(f => f.url().includes("/canvas"))` — pero con foco real, no lectura entre documentos), y en qué bloque?
- [Fase 3 · 3-6] **`window.__editorStore` (de 3-4, ADR-3-5-05) sigue vivo** — `conflicto.spec.ts`/`deshacer.spec.ts` (ambos ahora también envueltos en el mutex de ADR-3-6-02, pero con su lógica interna intacta) lo siguen usando para teclear directamente en el store. No lo retiré por el mismo motivo que 3-5: no tengo mandato para reescribir archivos ajenos bajo presión de tiempo. Sigue siendo la MISMA pregunta abierta de 3-5, sin resolver: ¿quién reescribe esos e2e para conducir la UI real?
- [Fase 3 · 3-6] **El paso de siembra que añadí a `.github/workflows/ci.yml` (`scripts/seed-demo.sh` con un `state.env` mínimo escrito a mano y `PGPASSWORD` forzado) no se verificó contra un runner real de GitHub Actions** — solo contra el clúster de Postgres de ESTA sesión, simulando el escenario (puerto fijo conocido, sin `pg-ephemeral.sh` de por medio). Riesgos concretos sin confirmar: (a) si `postgresql-client` viene preinstalado en la imagen `ubuntu-latest` que use el runner real en el momento de correr (documentado por GitHub como parte del "toolset" por defecto, pero no verificado aquí); (b) si el `pg_hba.conf` por defecto del servicio `postgres:16` de GitHub Actions exige contraseña de la misma forma que se asumió. ¿Confirma alguien con acceso a GitHub Actions que el paso corre limpio la primera vez que se dispare el workflow?

## Fase 3 · 3-8 — corrección de las ocho fricciones altas de la revisión de uso (7)

- **[ALTA]** [P-3-8-6] **La fecha del evento sigue sin poder cambiarla la clienta** (U-3, resuelto solo
  a medias). Verificado en el backend: **ninguna ruta de cliente escribe `invitation.date`** — solo
  `PUT /admin/invitations/{id}`, rol ADMIN (`InvitationAdminService.kt:414`); `POST
  /user/invitations/create` la fija al contratar y nada la modifica después. El editor la muestra 🔒
  porque es `source: "business"` y la composición ignora cualquier valor que se escriba en
  `document.content` para esos bloques (I-28). **Supuesto tomado (ADR-3-8-06):** el candado deja de
  ser mudo —lleva un enlace «Dónde se cambia» a `/ayuda#fecha`, que explica con todas las letras que
  hoy solo puede cambiarla quien gestiona la cuenta y cómo pedirlo—, pero **no se inventa una
  pantalla que edite lo que la API no deja editar**. ¿Se abre una ruta de cliente para la fecha (y
  con qué reglas: se puede cambiar después de publicar, hay que avisar a los invitados) y en qué
  fase? Sin ella, el tercer verbo del criterio de terminado del dueño («cambiar la fecha») no lo
  puede completar nadie sin escribir a soporte.

- **[ALTA]** [P-3-8-5] **El webhook `/api/revalidate` del backend sigue sin configurarse en el
  arranque** — `application.yml:125-128` deja `TEMPLATES2_REVALIDATE_URL`/`_TOKEN` vacías («VACIAS =
  FUNCION DESACTIVADA») y el arranque documentado no fija `REVALIDATE_SECRET` en el frontend, así que
  el `RevalidationNotifier` (que funciona y está probado) no llama a nadie. `src/**` y `scripts/**`
  son zona prohibida para este bloque. **Supuesto tomado (ADR-3-8-04):** el editor dispara la
  invalidación por su cuenta contra un handler propio (`/api/revalidate/tras-publicar`) y espera su
  respuesta antes de decir «ya se puede ver». Eso cubre lo que la clienta hace desde el editor, pero
  **no** cubre los cambios que no nacen del editor (una despublicación administrativa, un cambio de
  datos de negocio que altera el render). ¿Quién fija las tres variables de entorno en el arranque
  real —y en `scripts/dev-backend.sh` para que se pueda medir de punta a punta— y en qué bloque?

- [P-3-8-1] **Qué hace `/editor` cuando el cliente tiene varias invitaciones, o ninguna** — la pregunta
  no estaba respondida en `04 §6` (que solo define `/editor` como catálogo) ni en ninguna memoria.
  **Supuesto tomado (ADR-3-8-02, el más conservador):** `/editor` lista «Mis invitaciones»; con
  ninguna, se explica que la invitación se crea al contratar y **no se pinta ningún botón**; con una
  sin plantilla, las tarjetas actúan sobre ella; con varias, un `<select>` etiquetado elige el
  destino. Elegir plantilla **nunca crea** una invitación (no existe ruta que lo permita, ADR-2-4-02).
  ¿Es esta la puerta de entrada que quiere el dueño, o el cliente debería llegar al editor desde el
  sitio de marketing / su panel de cuenta, con la invitación ya elegida en la URL?

- [P-3-8-2] **Una invitación no tiene nombre propio en el modelo de datos.** `InvitationResponseItem`
  (`InvitationResponse.kt:3`) da `id`, `status`, `event` («Boda»), `plan`, `date`, `time` — nada que
  distinga dos bodas de la misma fecha, y `04 §6.2` dibuja «Boda de Ana y Luis». **Supuesto tomado:**
  la lista muestra el nombre HUMANO leído del documento ya empezado (`tituloDe(composed)` →
  «Mariana & Rodrigo»); las que aún no tienen plantilla no tienen de dónde sacarlo y salen como
  «Boda · sin plantilla todavía», con la fecha y su número («nº 37») para poder distinguirlas y para
  poder citarlo a soporte. ¿Se añade un nombre editable a la invitación (campo de negocio), o basta
  con derivarlo del documento?

- [P-3-8-3] **Cómo se decide que un arranque es «un despliegue real»** para exigir un origen público
  no local (U-6). El criterio obvio —`NODE_ENV=production`— tumbaría las propias compuertas del
  repositorio: Playwright y Lighthouse levantan `next start` (producción) sobre `127.0.0.1`, y
  `lighthouserc.cjs` es zona prohibida para este bloque, así que no se le puede pasar una puerta de
  escape. **Supuesto tomado (ADR-3-8-03):** el arranque falla cuando `NEXT_PUBLIC_SITE_URL` falta o
  es local **y** `NEXT_PUBLIC_API_BASE_URL` NO apunta al bucle local (señal de que se habla con un
  backend real); `PERMITIR_ORIGEN_LOCAL=1` es la puerta de escape explícita. ¿Prefiere el dueño una
  bandera de despliegue explícita (`INVITACIONES_ENTORNO=produccion`) en vez de la heurística?

- [P-3-8-4] **La incoherencia de fechas avisa, no bloquea** (U-4). El brief pedía «un bloqueo o al
  menos un aviso». **Supuesto tomado (ADR-3-8-05):** aviso ⚠ que no impide publicar, porque una boda
  de dos días, un civil la víspera o un brunch al día siguiente son legítimos y un bloqueo dejaría a
  esas clientas sin publicar y sin entender por qué. ¿Se quiere endurecer a bloqueo cuando la
  diferencia supera cierto margen (p. ej. más de 2 días), o se deja como aviso?

- [P-3-8-7] **`pnpm -r lint` está en rojo por dos hallazgos ajenos a este bloque**, ninguno en
  archivos que 3-8 haya tocado: `e2e/preparar.ts:120` («There is no `cause` attached to the symptom
  error being thrown», regla `preserve-caught-error`) y `e2e/flujo-principal.spec.ts:94`
  (`campoFoto` asignada y no usada). `e2e/**` ajeno es de solo lectura para este bloque (el encargo
  dice «solo archivos nuevos tuyos»). **Supuesto tomado:** no se tocan; quedan aquí anotados con
  archivo y línea. ¿Quién los corrige — el mismo bloque que dejó esos archivos, o quien esté ahora
  sobre `eslint.config.mjs`?
## Fase 3 · 3-7 — los tres defectos de cierre (5)

- **[Cierra la de ALTA de 3-6]** El defecto de `store.ts` está **corregido** (ADR-3-7-01,
  `bitacora/3-7.md` §1): `applyOperationToRawDocument` en los cuatro puntos de llamada, más
  `applyIdMapToRawDocument` que el parche propuesto no contemplaba. La sospecha que 3-6 marcó `[I]`
  sobre el undo del segundo `setBlock` queda **confirmada `[V]`** y cubierta con prueba.
- **[Cierra la de MEDIA de 3-6]** El job `frontend` está en verde (ADR-3-7-02): plugins registrados,
  `pnpm -r lint` con código de salida 0, `e2e` desbloqueado por `needs:`.
- **[Cierra la del LCP de 3-6]** La contradicción 3-3/3-6 está resuelta **midiendo**, no eligiendo
  (ADR-3-7-03/04, `evidencia/fase-3/cierre/lcp-3-7.md`): la métrica era bimodal con el simulador de
  Lantern, y la causa real del incumplimiento era la animación de portada, no las tipografías. Ya no
  hace falta re-medir en un runner de GitHub para decidir.

- **[MEDIA]** [Fase 3 · 3-7] **`total-blocking-time` incumple el objetivo de `04 §16.1` cuando se
  mide con estrangulamiento real**: 215-626 ms frente a los 200 ms declarados (con `simulate` salía
  en 99-160 ms). Está declarado `warn` en `lighthouserc.cjs`, así que no rompe la compuerta. **No es
  una regresión de 3-7** —es el mismo código medido mejor, ver ADR-3-7-03—, pero es el primer dato
  fiable de CPU de la ruta pública. El mismo aviso vale para el CLS: pasa de 0,000 simulado a 0,033
  medido, muy por debajo de 0,1 pero ya no cero. ¿Se abre trabajo de INP/TBT sobre `/i/[publicToken]`
  (los candidatos que Lighthouse señala son `unused-javascript` 53 KiB y `legacy-javascript`
  13 KiB), o se acepta el valor y se sube el objetivo de `04 §16.1` con ADR?

- [Fase 3 · 3-7] **`restoreFromHistory()` deja `s.document` obsoleto**, por la misma raíz que D1:
  `RestoreResponse` (`lib/api-types.ts`) no incluye el documento crudo, igual que
  `OperationBatchResponse`. El síntoma visible es el mismo (el `assetId` de un campo `image` deja de
  resolver tras restaurar una revisión), pero el único arreglo posible desde el cliente es recargar
  entero con `load()`, que es un cambio de flujo y no un parche. No muerde el undo, porque `restore`
  vacía ambas pilas (§11.4). **Supuesto tomado:** fuera del alcance de este bloque, que corrige el
  camino de las 11 operaciones. ¿Se resuelve haciendo que `restoreFromHistory` recargue, o
  añadiendo `document` a `RestoreResponse` y a `OperationBatchResponse` del lado del backend — que
  es el arreglo de raíz para los dos casos?

- [Fase 3 · 3-7] **Encender `react/no-array-index-key` y `react-hooks/exhaustive-deps` en todo el
  monorepo saca 5 errores y 8 avisos REALES en `apps/web`** (`ConflictDialog.tsx:79,148`,
  `PublishDialog.tsx:188,205`, `ListTextField.tsx:52` usan el índice como `key`;
  `GroupField`/`PhotoManager` recrean una expresión lógica que rompe la memoización de su `useMemo`,
  el mismo defecto que se corrigió en `CanvasContext.tsx`; cuatro campos de `components/fields/**`
  omiten `reset` de sus dependencias). ADR-3-7-02 las enciende solo en `packages/sections/src/**`
  porque ampliar la política sobre código que este bloque no revisa no es «arreglar el job roto».
  ¿En qué bloque se encienden para todo el monorepo y se corrigen esos 13 hallazgos?

- [Fase 3 · 3-7] **El worktree asignado vuelve a llegar en `4358fc8`** (previo a la fase 2, sin
  `frontend/` ni `docs/rediseno-plantillas/diseno/`). Es el segundo bloque seguido —3-6 lo documenta
  en su §1— que gasta su primer turno en `git reset --hard` a la rama de orquestación. ¿Puede el
  aprovisionamiento crear los worktrees desde `claude/fase-3-frontend-orchestration-yuh8sx` en vez
  de desde el commit raíz?

- [Fase 3 · 3-7] **La invitación de demostración cambió de contenido a mitad de las mediciones de
  LCP** (`Paulina & Emilio` → `Teclado & Sololo`): otra sesión de agente corría e2e contra la MISMA
  fila sembrada. El mutex de ADR-3-6-02 serializa a los workers de Playwright DENTRO de una corrida,
  pero no puede saber nada de un proceso ajeno como LHCI. No altera las conclusiones de D3 (las
  comparaciones A/B se hicieron todas después del cambio, sobre el mismo contenido), pero es la
  tercera vez que la invitación compartida entre sesiones contamina una medición. Es la misma
  pregunta de aprovisionamiento que 3-5 y 3-6 ya elevaron: **una invitación de demostración por
  sesión**, no una por máquina.

## Fase 3-B · I-04 — `smoke.sh` vuelve a las 19 rutas (1)

- [Fase 3-B · I-04] `ADR-3-I04-01` reserva el número de versión `1.0.99` de `xv-jardin` para la
  versión DESECHABLE que la ruta 19 deprecia (así su `documentsUsing` es 0 por construcción y la
  ruta deja de depender de qué demostración esté sembrada). Queda para siempre en
  `tpl_template_version` con `status=deprecated` en cada clúster donde corra `smoke.sh` — no aparece
  en ningún catálogo público, pero **sí** en `GET /master/templates2/versions` de cualquiera que lo
  consulte, y ningún paquete real debería usar jamás ese número. **Supuesto tomado:** es preferible a
  deprecar temporalmente una plantilla real en un backend compartido con otros agentes leyendo al
  mismo tiempo (ver alternativas descartadas en el ADR); si el dueño prefiere que `smoke.sh` no deje
  ningún rastro permanente en `tpl_template_version`, la alternativa (b) del ADR —borrar por SQL el
  `tpl_document` de la propia ruta 2 antes de la 19— libera una versión real, a cambio de un `DELETE`
  sobre una tabla del módulo nuevo cuyo efecto en cascada no se verificó en este bloque.

## Fase 3-B · I-01 — negrita y cursiva devolvían 500 (3)

- [Fase 3-B · I-01] **El «después» de I-01 no está medido por HTTP**, sólo por la suite. El backend
  compartido de `127.0.0.1:6003` corre el binario SIN el arreglo y el encargo prohíbe recompilarlo o
  reiniciarlo, así que el `500 TPL_INTERNAL` con `marks` está reproducido contra el servidor real
  (evidencia en la bitácora) pero el `200 applied=true` posterior no. **Supuesto con el que sigo**:
  la prueba de verdad es la de la suite —162 pruebas en las cuatro clases tocadas, de 9 fallos a 0—
  y el arreglo de una línea no tiene ninguna rama que la suite no recorra. ¿Quiere el dueño una
  pasada HTTP contra un backend con el binario nuevo antes de aceptar la ADR?

- [Fase 3-B · I-01] **`golden/templates/` deja de ser el espejo de `diseno/ejemplos/`.** Hasta hoy
  toda carpeta de `golden/templates/` venía de un ejemplo de la fase 1 y `Golden.Ejemplos.plantillas`
  servía para las dos cosas; `richtext-marcas-1.0.0` es sintetizada, así que en Kotlin se separan
  `Golden.plantillas` (lo que hay en `golden/`) y `Golden.Ejemplos.plantillas` (lo que hay en
  `diseno/ejemplos/`). **Supuesto**: es la separación correcta, porque el catálogo de golden tiene
  que poder crecer con casos que ningún ejemplo de negocio cubre. ¿Se registra en `contratos.md §3`?

- [Fase 3-B · I-01] **El hueco de método que produjo I-01 sigue abierto.** El defecto no fue la línea
  de `DomainJson`, fue que un campo opcional del esquema (`RichSpan.marks`) tenía casos de *esquema*
  y ningún golden de *documento*, y nadie lo notaba. No hay hoy ninguna compuerta que diga «todo
  campo opcional de `blocks.ts` aparece al menos una vez en un golden que pase por el codificador».
  **Supuesto**: fuera del alcance de esta issue, que era cerrar `marks`. ¿Se abre issue para la
  fase 4 (una prueba de cobertura de campos sobre `golden/templates` + `golden/operations`)?

## Fase 3-B · I-02 — el hotfix de `/auth/token` (7)

Todas quedan **fuera** del hotfix autorizado (ADR-3B-I02-01). Ninguna bloqueó el arreglo: en cada
una se tomó la opción conservadora y se siguió.

- [Fase 3B · I-02] El límite es **por instancia, no distribuido**: los contadores viven en la memoria del proceso, así que con N instancias detrás de un balanceador el límite efectivo es 5 × N por cuenta y 20 × N por IP, y **un reinicio del proceso los borra** (un atacante recupera sus 5 intentos reiniciando… o esperando a un despliegue). **Supuesto tomado:** es aceptable para un hotfix que no debe añadir dependencia ni tabla; un límite real y compartido pide Redis o una tabla en Postgres, y eso es una decisión de arquitectura del dueño, no de este encargo.
- [Fase 3B · I-02] `X-Forwarded-For` se toma como IP del cliente sin proxy de confianza declarado, porque `server.forward-headers-strategy` vive en `application.yml` (área prohibida). Es **falsificable**: un atacante que rote la cabecera esquiva el límite por IP. **Supuesto tomado:** se prefiere eso a usar `remoteAddr`, que detrás de un proxy haría que **todo el tráfico compartiera una IP** y 20 fallos dejaran sin acceso a todos los usuarios a la vez. El control que sostiene el arreglo es el de **cuenta**, que no se puede esquivar. Cerrarlo bien = una línea en `application.yml`: ¿la autoriza el dueño?
- [Fase 3B · I-02] **Bloqueo de cuenta como denegación de servicio**: cualquiera que conozca un correo puede fallar 5 veces y dejar esa cuenta sin acceso 15 minutos, incluso a su dueño con la contraseña correcta. Es inherente a un límite por cuenta y a los números que fijó el dueño (5/15 min). **Supuesto tomado:** se acepta; la alternativa (limitar la pareja cuenta+IP) haría trivial la fuerza bruta distribuida, que es justo el ataque a cerrar. Si al dueño le preocupa más el bloqueo que la fuerza bruta, la salida habitual es un desafío (captcha) a partir del tercer fallo en vez de un bloqueo duro — eso ya es producto, no hotfix.
- [Fase 3B · I-02] **`POST /auth/signup` enumera cuentas por la puerta de al lado**: ante un correo ya registrado devuelve «Este correo no se encuentra disponible, por favor intenta con uno diferente» (`CustomerService.kt:59`). Cerrar el oráculo de `/auth/token` sirve de poco si el alta lo dice en texto plano, y `POST /auth/request-password-reset` merece la misma revisión. **Supuesto tomado:** fuera de la autorización recibida, que era explícitamente `/auth/token` y nada más. **Es lo primero que hay que mirar cuando `auth` tenga dueño.**
- [Fase 3B · I-02] Una cuenta **baneada** responde `403` con un mensaje propio («Su cuenta ha sido bloqueada. Contacte al administrador.»), distinto del `401` uniforme: revela que la cuenta existe, aunque solo a quien ya acertó la contraseña. **Supuesto tomado:** se deja como está; cambiarlo era salirse del encargo y además el mensaje es útil para el usuario legítimo.
- [Fase 3B · I-02] El `429` **no lleva `Retry-After`** ni deja rastro de auditoría por bloqueo (solo un `WARN` cuando el mapa de contadores llega al tope). `Retry-After` sería el único dato del que un atacante podría deducir cuándo empezó su ventana, y registrar cada bloqueo con el correo mete datos personales en los logs. **Supuesto tomado:** sin `Retry-After` y sin registro por bloqueo; si operaciones necesita observar los bloqueos, la salida es una métrica agregada (contador), no una línea de log por intento.
- [Fase 3B · I-02] Los cuatro parámetros del limitador se leen con `@Value` y valor por defecto **en el código** (`auth.token.throttle.*`), para no tocar `application.yml`. Funcionan por variable de entorno sin recompilar (verificado en marcha por el log de arranque). **Supuesto tomado:** el dueño prefiere no tocar `application.yml` a tener los números a la vista en la configuración; si prefiere lo segundo, son cuatro líneas.

- [Fase 3-B · I-06] **`invitation.updated_at`/`updated_by` no reflejan el cambio de fecha de la
  clienta.** `PUT …/event` escribe *sólo* `date` y `time`, que es lo que el dueño autorizó
  literalmente («escritura SÓLO de esas dos columnas»), y está verificado con `curl` real:
  `updated_at` se queda en el valor anterior. La consecuencia es que la administración no ve quién
  ni cuándo tocó la fecha. **Supuesto tomado:** se respeta la autorización al pie de la letra y no
  se tocan las columnas de auditoría del módulo antiguo. ¿Se amplía la autorización a esas dos
  columnas (`updated_at = now()`, `updated_by = requesterId`), o el rastro de esta ruta debe vivir
  en el módulo nuevo (una tabla `tpl_*` de auditoría de negocio) para no escribir más de `invitation`?

- [Fase 3-B · I-06] **La página `/ayuda#fecha` quedó desactualizada.** La creó `ADR-3-8-06` para
  decir, con todas las letras, que «hoy la fecha no se cambia desde el editor ni desde la cuenta».
  Desde esta issue **sí se cambia desde el editor**. La página no se ha tocado en este bloque
  porque es texto de producto y su reescritura la debería revisar quien mande en el tono (y porque
  sigue siendo el destino legítimo de los demás bloques `business`). **Supuesto tomado:** se deja
  como está y se anota. ¿Quién reescribe `#fecha` y qué debe decir ahora: «cámbiala desde el panel
  de Portada» y nada más, o conserva el «cómo pedirlo» para los datos que siguen sin ruta?

- [Fase 3-B · I-06] **Los demás bloques `business` siguen sin ruta de cliente.** `invitation.hashtag`,
  `invitation.childrenAllowed`, `invitation.youngAllowed` y `invitation.coverPhotoUrl` siguen
  saliendo con candado y enlace a `/ayuda#fecha` — un enlace cuyo ancla ya ni siquiera es la suya.
  Es el mismo callejón de U-3 con otro dato. **Supuesto tomado:** el encargo era la fecha; abrir el
  resto sería ampliar la autorización por mi cuenta. ¿Se abre `PUT …/event` a esos campos (deja de
  llamarse «event»), se abre una ruta por dato, o se decide que esos cuatro sí son de administración?

- [Fase 3-B · I-06] **`invitation.time` no tiene bloque en `boda-clasica@1.0.0`.** La ruta acepta y
  valida `time`, y la escribe cuando llega, pero el editor nunca la envía porque la plantilla real
  no declara ningún bloque con `businessField: "invitation.time"` (sólo `invitation.date`, en
  `cover.date` y `couple.date`). Por eso `time` es opcional en el cuerpo. **Supuesto tomado:**
  ausente = «no la toques», nunca «bórrala». ¿Debe `boda-clasica` declarar la hora del evento (y
  entonces el control del panel pasa a editar fecha **y** hora juntas), o la hora del evento es
  siempre cosa del itinerario y `invitation.time` es un campo muerto del módulo antiguo?

- [Fase 3-B · I-06] **`scripts/dev-backend.sh` no le pasa `TPL_DEV_PORT` a Spring.** El script
  calcula `BASE`/la sonda con `TPL_DEV_PORT` pero **nunca exporta `SERVER_PORT`** ni pasa
  `--server.port`, así que `bootRun` arranca siempre en el `server.port: 6003` de `application.yml`.
  Medido en este bloque: con `TPL_DEV_PORT=6023` el backend arrancó en **6003** (log:
  `Tomcat started on port 6003`), la sonda del script nunca respondió y el `start` agotó su tope de
  300 s **con la aplicación arriba**, ocupando el puerto del backend compartido. Se rodeó exportando
  `SERVER_PORT` a mano. Es una trampa para cualquier sesión con varios agentes: dos backends creen
  estar en puertos distintos y pelean por el 6003. Peor: la rama de fallo de `start()` llama a
  `stop()`, que hace `pkill -f InvitationsApplicationKt` y `pg-ephemeral.sh stop` — es decir, un
  arranque fallido de UN agente puede matar los backends y borrar los clústeres de TODOS.
  ¿Se corrige el script (`export SERVER_PORT="$PUERTO"` y que `stop` sólo mate su propio PID)?

- [Fase 3-B · I-09] **Un `id` del manifiesto es ahora parte del contrato público del paquete**
  (ADR-3B-I09-01). Si una versión nueva de una plantilla renombra el `id` de un archivo, todos los
  `defaults.json` que lo referencien dejan de resolver y los bloques vuelven a salir
  `provenance:"empty"`. Hoy sólo lo detectan la compuerta de `build-packages.mjs` y la prueba
  `manifest-asset-id.contract.test.ts`, que se ejecutan en el repositorio, **no en el registro**.
  ¿Debe el registro rechazar también un paquete cuyo `defaults.json` referencie un `assetId` que
  ningún `AssetEntry.id` declara (un `TPL_PACKAGE_DEFAULT_ASSET_UNKNOWN` nuevo)? **Supuesto
  tomado:** no por ahora — sería una invariante nueva (I-32) con espejo Kotlin obligatorio, y el
  encargo de I-09 era el parche mínimo. La compuerta del generador cubre el único camino por el que
  hoy se construyen paquetes.

- [Fase 3-B · I-09] **El arte de demostración que el paquete publica es el de la paleta POR
  DEFECTO.** Si la clienta elige `navy` u `olive` en `boda-clasica`, la portada y los retratos que
  trae el paquete siguen tintados de `blush` hasta que ella suba los suyos — es el mismo defecto
  `O-07` que 3-9 corrigió para el sembrador, que sí sube el juego de la paleta elegida. **Supuesto
  tomado:** aceptable, porque es contenido de demostración destinado a ser sustituido y el
  preflight impide publicar con él (`TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT` incluye ahora
  `cover.image`). Arreglarlo de verdad exigiría un juego de assets por paleta dentro del paquete y
  un `defaults.json` que dependiera de la paleta, que hoy no es expresable.

- [Fase 3-B · I-09] **`xv-jardin` declaraba `honoree.photo` con `aspect: "portrait"` y el arte de
  retrato que genera `build-art.mjs` es cuadrado (1000 × 1000).** ADR-3B-I09-02 cambia el manifiesto
  a `square`, que es lo que `boda-clasica` usa para sus celebrantes. ¿Prefiere el dueño lo
  contrario: dibujar una lámina de retrato vertical y dejar el manifiesto en `portrait`? **Supuesto
  tomado:** `square`, porque cambiar una palabra del manifiesto es reversible y regenerar arte no
  entra en el encargo de I-09 (además, las dependencias nativas del generador no están instaladas
  en este entorno).

- [Fase 3-B · I-09] **El paquete de `boda-clasica@1.0.0` cambió de bytes** (9 assets en vez de 3, y
  `id` en 7 de ellos), así que registrarlo sobre una base donde ya está el paquete anterior devuelve
  `409 TPL_VERSION_HASH_MISMATCH` (H-09, correcto). Para ver el arreglo por HTTP hace falta una base
  **sin** esa versión registrada. ¿Se prefiere que I-09 bombee la versión a `1.0.1` con su
  `MigrationPlan` para poder desplegar sobre una base existente? **Supuesto tomado:** no — la fase 3
  no tiene invitaciones de clientes reales sobre `templates2`, y bombear la versión obligaría a
  tocar `defaults.json`, el ejemplo de diseño y el golden por un motivo de despliegue, no de
  producto. Queda escrito en `bitacora/3b-i09.md §6`.

- [Fase 3-B · I-09] **`family.godparents[].photo` y los demás bloques de imagen dentro de grupos
  siguen sin imagen de demostración** en `boda-clasica` (sí la tienen `gallery.photos` y
  `story.milestones`, que son los que `defaults.json` referenciaba). No es una regresión: nunca la
  tuvieron. ¿Se quiere que todas las imágenes de los ítems por defecto traigan lámina? **Supuesto
  tomado:** no, para no engordar el paquete con arte que la clienta va a sustituir; el criterio
  aplicado es «el paquete trae exactamente lo que su `defaults.json` referencia».

- [Fase 3-B · I-11] **`scripts/measure-lcp.sh` mide con N=9 por defecto; la compuerta de CI
  (`lighthouserc.cjs`, ADR-3-7-03) sigue en N=5.** Son dos usos distintos (disputa puntual vs. gate
  de cada PR) y no tienen por qué compartir N, pero es una asimetría que alguien podría querer
  cerrar. **Supuesto tomado:** no igualar los dos números sin que el dueño lo pida — subir la
  compuerta de CI a 9 alarga cada PR (cada corrida con `throttlingMethod: devtools` tarda más que
  con `simulate`, ADR-3-7-03), y no es una decisión de I-11 (`ADR-3B-I11-01`).

- [Fase 3-B · I-11] **La corrida real de verificación (N=9, `boda-clasica-1.0.0`, `bitacora/3b-i11
  .md §4`) dio mediana 2 405,4 ms y rango 2 195,8-2 794,6 ms — CUMPLE con solo ~95 ms de margen**,
  frente a los ~450-490 ms de margen que sugería la medición previa de 3-7 (mediana 2 010-2 067
  ms). No se ha tocado código de la ruta pública entre una medición y otra; la explicación más
  simple es la carga de la máquina compartida (otra sesión de agente compilando al mismo tiempo,
  verificado por `ps aux`), no una regresión. ¿Vale la pena una medición de referencia "sin ruido",
  tomada con la máquina en exclusiva (fuera de este entorno multi-agente), para tener una cifra de
  producto que no dependa de cuánta CPU le quede libre a Chrome en cada corrida? **Supuesto
  tomado:** no se repite la medición en esta issue —no es su encargo arreglar ni perseguir
  rendimiento, solo dejar el procedimiento en pie— pero se deja escrito que ninguna cifra de LCP
  publicada hasta ahora en la memoria (incluida la propia de este bloque) debería tratarse como "el
  LCP del producto" sin decir también en qué máquina y con qué carga se tomó.

- [Fase 3-B · I-07] **`templates2.revalidate.url`/`.token` ya estaban en `application.yml` desde el
  bloque 2-6** (ADR-2-6-01, commit `52e0b4a`), con los mismos nombres que pedía el encargo de I-07.
  La premisa de la issue («faltan las dos claves de configuración… es configuración, no código») ya
  no describía el estado real del repositorio en el momento de ejecutar este bloque; lo que faltaba
  de verdad era fijarlas en `scripts/dev-backend.sh` (hecho aquí) **y** una línea de código en el
  cliente HTTP (`.version(HTTP_1_1)`, `ADR-3B-I07-01`) sin la cual el webhook fallaba siempre contra
  un `apps/web` real, con las dos claves ya bien puestas. ¿Quién actualiza `issues-fase-3.md` para
  que I-07 refleje que el defecto real era doble (config + cliente HTTP), no sólo config, por si
  alguien vuelve a leer la issue original sin leer esta bitácora?

- [Fase 3-B · I-07] **No se probó el cliente HTTP de `RevalidationNotifier` contra `apps/web` detrás
  de HTTPS** (el hallazgo de `ADR-3B-I07-01` es sobre HTTP en claro / intento de upgrade h2c; con TLS
  el mismo `HttpClient` negocia HTTP/2 por ALPN de forma distinta y el fallo observado podría no
  reproducirse, o podría reproducirse por otra vía). No hay certificado ni dominio real en este
  entorno para probarlo. ¿Alguien con un despliegue de staging con TLS puede confirmar que
  `.version(HTTP_1_1)` sigue siendo necesario o si allí el problema no existía?

- [Fase 3-B · I-07] **`scripts/dev-backend.sh stop` dejaba huérfano el clúster de Postgres efímero
  en el caso normal** (regresión de pipefail del commit `fd4c47d`, `ADR-3B-I07-02`), afectando a
  cualquier agente que use el script, no sólo a I-07. Se corrigió por ser un bloqueador directo del
  propio flujo que este encargo pedía (`stop` seguido de `start` sobre el `TPL_TEST_STATE_DIR`
  propio). ¿Vale la pena una compuerta de CI que ejercite `dev-backend.sh start`→`stop` y falle si
  el código de salida no es 0, para que esta clase de regresión no dependa de que alguien la note a
  mano?

## Fase 3-B · I-05 — contraste medido sobre lo renderizado (3)

- [Fase 3-B · 3b-i05] El velo del RSVP (`RsvpSection.module.css .veil`) sube de `ink` al 55 % a `ink` al **72 %** en el arranque para garantizar 4,5:1 al texto blanco de esa banda sobre **cualquier** fotografía (ADR-3-i05-01). El efecto visible es que la fotografía de fondo del RSVP se ve bastante más apagada. ¿Se prefiere ese velo denso, o un velo claro con otro tratamiento del texto (una tarjeta con fondo sólido dentro de la banda, o texto en `ink` sobre un lavado claro como hizo A1 en la portada)? **Supuesto tomado:** el velo denso, por ser la corrección más pequeña que convierte un número decorativo en una garantía comprobable; la alternativa es un rediseño de la sección y ningún documento de diseño lo pide.
- [Fase 3-B · 3b-i05] **El lavado de la portada tiene el mismo agujero de clase y no lo toqué.** `CoverSection.module.css .scrim` (`--inv-color-bg` al 62 %) compuesto sobre una fotografía **negra** deja `ink` en 4,13:1 (`boda-clasica/olive`) y 4,22:1 (`xv-jardin/garden`), por debajo del 4,5:1 que necesitan el `kicker` (15 px) y el `badge` (13 px) de esa sección; sobre la lámina real de la demostración mide 12,3:1 y hoy no falla. Es la decisión A1 del bloque 3-9, tomada con capturas y recién integrada: subir su opacidad la deshace con una cuenta, sin juicio visual. ¿Se corrige (subir el lavado, o pasar ese texto a un tamaño que le dé el umbral de 3,0) o se acepta como límite conocido? **Supuesto tomado:** no se toca y no se añade aserción; una prueba con un umbral más flojo del que WCAG pide para el texto que hay ahí sería otra compuerta en verde sobre un producto que incumple, que es justo lo que I-05 existe para eliminar.
- [Fase 3-B · 3b-i05] `e2e/a11y-publico.spec.ts` afirma «0 violaciones `critical`/`serious` de `axe`» y **no puede** cazar esta clase de defecto: sobre el estado que incumplía y sobre el corregido, `axe` devuelve exactamente lo mismo (`violaciones=0`, `incompletas=[{color-contrast, 11 nodos, "background gradient"}]`) [V]. ¿Se quiere que esa spec falle también cuando `axe` deje nodos en `incomplete` por degradado sin que exista una medida que los cubra, o basta con la prueba unitaria de `contraste-plantillas.test.ts`? **Supuesto tomado:** basta con la prueba unitaria (que sí se pone roja, verificado), y no se toca `apps/web`, fuera del terreno de este bloque; queda dicho porque el dueño del lienzo (linaje 3-0b/3-1) es quien puede decidirlo.

## Fase 3-B · I-05b — la portada sobre la fotografía de la clienta

- **[RESUELTA por ADR-3-i05b-01]** [Fase 3-B · 3b-i05] «El lavado de la portada tiene el mismo agujero de clase y no lo toqué» (la entrada de I-05 justo arriba). Se cerró midiendo: el agujero era mayor de lo anotado —`.dateRow` pinta `--inv-color-muted`, no `ink`, y daba **1,73:1** sobre foto negra en las cinco paletas— y **no** se arreglaba subiendo el lavado: para que `muted` llegue a 4,5:1 haría falta el 98,6-99,0 %, que es A1 con el signo cambiado. La corrección es la regla de C-01: el bloque de texto lleva su propio papel opaco. La pregunta que I-05 dejaba («¿se corrige o se acepta como límite?») queda contestada con la vía (b) que el propio dueño enumeró.
- [Fase 3-B · 3b-i05b] **El bloque de texto de la portada ahora se ve como una zona de papel más clara sobre la lámina, y en móvil su halo alcanza el filete.** Medido: el móvil conserva el 93,4 % de la tinta del arte y el escritorio el 100 %; el filete no se corta en ninguna fila pero su contraste local en móvil baja de 7,34 a 5,50, y la banda del divisor central queda un 8 % más suave. **Supuesto tomado:** es aceptable, porque el papel cae sobre la zona que el ilustrador declara vacía (`scenes.mjs`, `[0.12, 0.09, 0.88, 0.55]`) y porque la alternativa —cualquier cosa que no sea opaca— no garantiza nada. ¿Prefiere el dueño (i) esto, (ii) un papel sin halo (conserva el 95,8 % del arte pero se le ve el canto), o (iii) que el papel sólo aparezca cuando hay fotografía de cliente y no sobre la lámina del paquete —lo que exigiría que la sección sepa distinguir una de otra, cosa que hoy el contrato no le dice?
- [Fase 3-B · 3b-i05b] **`.dateRow` de la portada es la fila más ajustada de toda la invitación: `muted/bg` da 4,59-4,63:1, un 2 % por encima del mínimo.** Está en verde y hay prueba que la vigila en las cinco paletas, pero cualquier retoque futuro de `muted` o de `bg` la tumba, y es la fecha de la boda en la primera pantalla. ¿Se le sube a `ink` (perdería la jerarquía de "dato secundario" que `04 §17.1` le da) o se acepta el margen justo con la prueba como red?
- [Fase 3-B · 3b-i05b] **En móvil (390 px) el bloque de texto ocupa el 84 % del ancho de la lámina**, porque el nombre de los novios a `--inv-text-4xl` casi no cabe. Con un nombre más largo que «Ana Sofía & Diego» el papel llegará al filete. Es el mismo problema de arte que `P-3-3b-4` («el escritorio queda más liso que el móvil») visto desde el otro lado. ¿Entra en el kit de autor de la fase 4 una lámina por proporción (retrato para móvil, apaisada para escritorio) con la zona segura declarada para cada una?

## Fase 3-B · cierre — DOS ALTAS ABIERTAS que la fase NO cierra (2)

- [Fase 3-B · **N-01 · CRÍTICA · BLOQUEA EL CIERRE**] **`POST /auth/request-password-reset` devuelve
  el token de recuperación en el cuerpo de la respuesta, sin autenticar y para cualquier correo.**
  `ResetPasswordService.kt:52-55` construye `RecoveryPasswordSentResponse(message, resetToken = …)` y
  `/auth/**` es `permitAll` (`SecurityConfig.kt:35`). Con ese token, `POST /auth/reset-password`
  cambia la contraseña: **dos peticiones y la cuenta es tuya**, incluida una MASTER. Reproducido por
  el orquestador contra el backend real:
  ```
  POST /auth/request-password-reset {"email":"demo.master@example.com"}
  → {"message":"Se ha enviado un correo de recuperación a tu cuenta","resetToken":"Q7An2AL9lCrZ…"}
  ```
  Además ese extremo **enumera cuentas** (`400` si el correo no existe, `200` si existe) y **no pasa
  por el limitador** de I-02, que sólo cubre `/auth/token`.
  **Arreglo propuesto, una línea**: quitar `resetToken` de `RecoveryPasswordSentResponse` — el token
  ya viaja por correo (`ResetPasswordService.kt:47` lo mete en el `resetUrl`), así que devolverlo en
  el cuerpo no le sirve a nadie salvo a quien ataca. Después: responder siempre `200` con el mismo
  mensaje exista o no la cuenta, y meter el extremo en el limitador.
  **POR QUÉ NO SE ARREGLÓ AQUÍ:** el dueño acotó la excepción sobre `modules/auth` a I-02 con un
  «NO tocar nada más de `auth`». Esto es más de `auth`, así que **necesita su autorización expresa**.
  El orquestador se ha limitado a completar I-02 (el salto de `X-Forwarded-For`, que sí estaba dentro
  del encargo). **Supuesto tomado:** se registra y no se toca. Es lo primero que debería resolver la
  fase 4, antes que cualquier funcionalidad.

- [Fase 3-B · **N-02 · ALTA**] **El origen del sitio y la CSP del lienzo se hornean en el build.** El
  mismo artefacto servido en otro puerto rechaza el `<iframe>` del lienzo (`Refused to frame …
  frame-ancestors`, vista previa muerta) y reparte enlaces públicos al puerto del build, no al que
  navega la clienta. `ADR-3-8-03` mandó construir el enlace con el origen del sitio y fallar el
  arranque si es local; lo que no está resuelto es que ese origen sea **de despliegue** y no de
  compilación. **Supuesto:** no se toca en 3-B (sería rehacer cómo se parametriza el build, y nadie
  lo pidió); queda como requisito de despliegue de la fase 4. Afecta también a U-6.

- [Fase 3-B · entorno] **`./gradlew clean` borra el almacén local de assets** (`build/templates2-assets`)
  mientras la base sigue apuntando a esos ficheros: el render responde `200` y ninguna imagen carga.
  Contaminó una pasada entera de e2e (10 fallos que no eran del código). Documentado con reproducción
  y salida en `evidencia/fase-3/trampa-gradle-clean.md`. **Arreglo de fondo sugerido:** sacar
  `TEMPLATES2_ASSETS_LOCAL_DIR` de `build/` (p. ej. a `.dev/`). No se hace aquí por disciplina de
  alcance.

## Fase 3-C · bloque -1 (seguridad heredada) — N-01 y N-02 RESUELTAS

- **[RESUELTA por ADR-3C-N01-01]** [Fase 3-B · N-01 · CRÍTICA] «`POST /auth/request-password-reset`
  devuelve el token de recuperación en el cuerpo, sin autenticar y para cualquier correo». Cerrada
  bajo la **excepción explícita del dueño** sobre `modules/auth` (misma clase que la de I-02, acotada
  a `request-password-reset` y `signup`; no se tocó nada más de `auth`). `RecoveryPasswordSentResponse`
  pierde `resetToken`; la respuesta es siempre `200` con el mismo cuerpo exista o no la cuenta; los dos
  extremos entran en `AuthThrottleService` con **prefijo de ámbito**. Reproducido antes y después
  contra el backend real: `evidencia/fase-3c/bloque-menos1/n01-antes-despues.txt`. Compuertas:
  `RequestPasswordResetContractTest` (8 casos, afirmando sobre el JSON serializado) y 5 casos de
  ámbito en `AuthThrottleServiceTest`.
- **[RESUELTA por ADR-3C-N02-01]** [Fase 3-B · N-02 · ALTA] «El origen del sitio y la CSP del lienzo
  se hornean en el build». El origen se resuelve en tiempo de petición (`proxy.ts`), el hijo del
  lienzo valida contra el origen real de quien embebe (`canvas-client.ts`), `origenPublico()` pone
  `window.location.origin` por delante de `NEXT_PUBLIC_SITE_URL`, y una aserción de arranque niega el
  servicio cuando el build no cuadra con lo que se va a servir. A/B sobre el MISMO build en `:3050` y
  `:3000` con los dos puertos CUMPLIENDO: `evidencia/fase-3c/bloque-menos1/ab-origen-salida.txt`.
  **U-6 queda cerrada por las dos puertas.**

**Supuestos y cuestiones nuevas de este bloque:**

- [Fase 3-C · 3c-menos1] **El oráculo de temporización de `request-password-reset` queda igualado a
  medias y NO se ha medido.** El camino «el correo no existe» acuña un token igual que el otro y lo
  descarta, pero no puede fabricar la escritura en la base que sí ocurre cuando la cuenta existe.
  **Supuesto tomado:** la diferencia residual es aceptable —es órdenes de magnitud menor que el
  `400` frente a `200` que había— y el brief no exigía medirla con 30 muestras. ¿Quiere el dueño una
  medición con muestra, o una cola de trabajo asíncrona que iguale también la escritura?
- [Fase 3-C · 3c-menos1] **El bloqueo de cuenta como denegación de servicio SIGUE ABIERTO**, y ahora
  también en el ámbito `RECUPERACION`: cinco peticiones ajenas dejan a la dueña sin poder pedir
  recuperación durante quince minutos. El prefijo de ámbito impide que eso le cierre **el acceso**
  —que era el riesgo nuevo que el propio arreglo podía crear, y está medido que no ocurre— pero no
  resuelve la cuestión de fondo. **Queda FUERA de este bloque** por acuerdo; sigue siendo la misma
  cuestión que `handoffs/3-para-fase-4.md §4` ya listaba (la salida habitual es un desafío al tercer
  intento en vez de un bloqueo duro).
- [Fase 3-C · 3c-menos1] **Con tres ámbitos, el techo total de intentos por IP pasa de 20 a 60 por
  ventana de 15 minutos.** **Supuesto tomado:** es aceptable, porque los tres cubos protegen cosas
  distintas y sólo el de `/auth/token` abre sesión. ¿Prefiere el dueño un cuarto contador global por
  IP por encima de los tres, o límites distintos por ámbito?
- [Fase 3-C · 3c-menos1] **`location.ancestorOrigins` no existe en Firefox.** Ahí el hijo del lienzo
  cae a `document.referrer`, que una `Referrer-Policy` estricta podría dejar vacío; en ese caso
  volvería a usar la constante horneada y reaparecería el defecto de N-02 **en ese navegador**. No se
  ha podido medir: en este entorno sólo hay Chromium (`contratos.md §7` prohíbe `playwright install`).
  La defensa que sí es transversal es `frame-ancestors`, que ahora nombra el origen correcto. **Riesgo
  declarado**, no cerrado.
- [Fase 3-C · 3c-menos1] **`Host` y `x-forwarded-host` los pone el cliente.** Falsificarlos sólo
  cambia la CSP de la respuesta de quien los manda (ruta dinámica, nonce por petición, sin caché) y no
  afloja ninguna directiva, pero la recomendación firme para producción es declarar `EDITOR_ORIGIN`
  (variable de servidor). La aserción de arranque **no** puede exigirla: no sabría distinguir un
  despliegue legítimo detrás de un proxy inverso. ¿Quiere el dueño que sea obligatoria en producción?
- [Fase 3-C · 3c-menos1] **`app/(public)/layout.tsx` sigue tomando `metadataBase` de
  `NEXT_PUBLIC_SITE_URL`.** Es código de servidor —donde la variable es la fuente correcta— pero sigue
  siendo de compilación, así que una tarjeta de enlace de WhatsApp podría llevar el origen del build.
  **Supuesto tomado:** no se toca por disciplina de alcance; la aserción de arranque lo cubre
  indirectamente. Candidato claro a `SITE_URL` de servidor en la fase 4.
- [Fase 3-C · 3c-menos1] **HALLAZGO: `throw` dentro de `register()` de `instrumentation.ts` NO impide
  arrancar en `next@16`.** Next captura la excepción, la imprime como un error más del registro y
  sigue sirviendo (medido: el servidor quedó escuchando y lo delató un `EADDRINUSE`). La guarda de
  arranque de U-6 (`ADR-3-8-03`, bloque 3-8) llevaba desde entonces siendo un mensaje en un log, no
  una guarda. Corregido con `process.exit(1)`. **`ADR-3C-N02-01` enmienda de facto esa mitad de
  `ADR-3-8-03`**; queda para que el orquestador lo registre al aceptar.
- [Fase 3-C · 3c-menos1] **`pnpm run lint` estaba en rojo ANTES de este bloque** (3 errores `no-undef`
  en `frontend/apps/web/scripts/capturas-cierre-3b.mjs`; comprobado con `git stash` sobre el árbol sin
  tocar). Arreglado con la misma convención que su hermano `scripts/capturas-editor.mjs:2`, sin
  cambiar comportamiento, porque «lint en verde» era compuerta del encargo. Queda dicho para que no se
  cuente como trabajo de este bloque.
- [Fase 3-C · 3c-menos1] **La A/B de N-02 no es un e2e y se explica por qué**: `playwright.config.ts`
  reconstruye con el origen del puerto que va a servir, que es exactamente el punto ciego que N-02
  describe. Vive como guion reproducible en `evidencia/fase-3c/bloque-menos1/ab-origen.mjs`, con su
  salida guardada. Cada mitad del mecanismo sí está en pruebas normales (`test/proxy-origen.test.ts`,
  `origenDelPadre` en `lib/canvas-bridge.test.ts`, `motivoDeOrigenDesalineado` en
  `lib/enlace-publico.test.ts`). ¿Quiere el dueño que la fase 4 lo convierta en un trabajo de CI con
  dos `webServer`, asumiendo el coste de un build y dos servidores extra en cada pasada?
- [Fase 3-C · 3c-menos1] **Este bloque NO aporta medición nueva de LCP ni del presupuesto de JS.**
  `proxy.ts` sólo corre en la ruta del lienzo y `enlace-publico.ts` apenas cambia de tamaño, pero los
  márgenes siguen siendo estrechos (144,2 KB de 150; LCP mediana 2 241 ms de 2 500). `e2e/presupuesto.spec.ts`
  sí pasó dentro de la suite completa (50/50).

## Fase 3-C · bloque 0 — sistema de diseño e identidad visual (9)

Todo lo de abajo se tomó como **supuesto** para no bloquear; la elección recomendada vale hasta que el dueño responda. Evidencia para decidir: `evidencia/fase-3c/moodboard/index.html` (ábrelo en el navegador) y `moodboard/capturas/*.png`.

- [Fase 3-C · 3c-0] **Nombre de marca y logotipo.** El frontend no fija marca (el título dice «Invitaciones»; un correo antiguo dice «AGAPE»). **Supuesto:** «Invitaciones» como wordmark de trabajo en Fraunces 800, sin logotipo ni símbolo. El sello festoneado del sistema podría convertirse en símbolo de marca si el dueño quiere; no se ha diseñado nada con ese fin. ¿Cuál es el nombre definitivo y hay identidad previa (logotipo, colores) que respetar?
- [Fase 3-C · 3c-0] **Paleta.** **Supuesto (recomendación, `ADR-3C-0-01`):** A «Bugambilia» (rosa mexicano 352°). Alternativas listas con el mismo sistema: B «Talavera» (cobalto) y C «Jade». Riesgo declarado del rosa: leerse como «solo bodas / solo femenino»; mitigación en `11 §1.7`. ¿Confirma A, o prefiere B para cubrir mejor eventos corporativos?
- [Fase 3-C · 3c-0] **Tipografía.** **Supuesto (recomendación, `ADR-3C-0-02`):** Fraunces + Onest + Red Hat Mono. Segunda opción: Bricolage Grotesque (ya instalada) + Figtree + Azeret Mono. Se retiran Inter (fuente de la referencia) y Outfit. ¿Confirma la pareja 1? ¿Acepta 177 KB de fuentes en el chrome (123 KB si Fraunces va sin los ejes SOFT/WONK)?
- [Fase 3-C · 3c-0] **Imágenes ultrarrealistas.** No hay ninguna y el entorno bloquea bancos de imágenes. **Supuesto:** placeholder del sistema (degradado + icono) en todas las posiciones y lista con prompts en `11 §9` (se vuelca a `imagenes-pendientes.md` en el bloque 3). ¿Quién produce las imágenes (IA elegida por el dueño, fotógrafo, banco con licencia) y con qué licencia se archivan?
- [Fase 3-C · 3c-0] **Tema oscuro.** Existe como mapa de tokens verificado. **Supuesto:** claro por defecto y oscuro solo por ajuste explícito de la persona (no sigue `prefers-color-scheme` automáticamente), para que la vista previa del editor no engañe sobre cómo verán la invitación los invitados. ¿De acuerdo?
- [Fase 3-C · 3c-0] **La raíz `/` y el asistente.** El mapa de pantallas propone landing pública en `/`, registro en `/acceso` (pestaña «Crear cuenta», 3 pasos) y `/editor` como asistente de 4 pasos (evento → plantilla filtrada → datos → editor). Hoy una invitación nace de una compra (ADR-2-4-02) y el registro público no existe en el producto. **Supuesto:** el asistente termina en «Ver planes» cuando no hay invitación contratada, sin inventar compra ni registro. ¿Habrá registro público y compra en línea en la fase 4, o el flujo sigue naciendo de la venta manual?
- [Fase 3-C · 3c-0] **Prueba social en la landing** («12 400 invitaciones enviadas»). Es un hueco: solo se muestra con un dato real. ¿Existe una cifra real que se pueda publicar?
- [Fase 3-C · 3c-0] **Hallazgo:** `lib/i18n.ts` `publicar.yaSeVe` lleva un emoji (palomita verde, U+2705) en la interfaz, contra `10 §1.2`. No se toca en este bloque (no modifica `frontend/`); queda para el bloque 1 con el texto «Tu invitación ya se puede ver en internet.».
- [Fase 3-C · 3c-0] **Peso de las capturas.** Las 17 capturas a 2× pesan 18 MB en `evidencia/`. **Supuesto:** se dejan a 2× para juzgar tipografía y trazo con fidelidad; si el dueño prefiere aligerar el repositorio, `deviceScaleFactor: 1` en `capturar.mjs` las deja en torno a 5 MB.

## Fase 3-C · 3C-4 — biblioteca de formas (5)

Supuestos que tomé para no bloquear. Ninguno cambia el catálogo ni la API acordada en `ADR-3C-0-03`; todos son de implementación y están razonados en `ADR-3C-4-01`.

- [Fase 3-C · 3c-4] **Nombres de las máscaras.** El brief del bloque las llama `rounded-xl`, `soft-star` y `tilted-square`; `11 §3.1` y `ADR-3C-0-03` (aceptada) las llaman `radius-lg`, `seal` y `rotated`, e igual con `WaveDivider`/`RotatedSquare`/`Image` frente a `Wave`/`TiltedSquare`/`PhotoMask`. **Supuesto:** manda el documento 11, que es el contrato aceptado; la equivalencia queda escrita en `mascaras.ts` y en el handoff. Si el dueño prefiere los coloquiales, es un renombrado mecánico de una tarde.
- [Fase 3-C · 3c-4] **Los tokens que uso por nombre y todavía no existen.** `11 §2.2` fija la escala tipográfica y `11 §6.1` las duraciones, pero ninguno de los dos fija el nombre exacto del custom property. Uso `--ui-text-xs`, `--ui-font-text`, `--ui-font-label`, `--ui-dur-respira`, `--ui-radius-{sm,md,lg,xl,pill}` y `--ui-space-{2,3}` (los de `moodboard/styles.css :root`). **Supuesto:** 3C-1/3C-2 los emiten con esos nombres. Si no, la píldora hereda el tipo de su bloque y la respiración cae a su reserva de 12 000 ms: degrada, no rompe. Conviene que el orquestador lo confirme al integrar.
- [Fase 3-C · 3c-4] **La copia provisional de la paleta en la galería.** `/design/formas` trae los tokens de la paleta A en claro dentro de `@layer galeria-provisional` para poder verse (y capturarse) antes de que `@invitaciones/tokens` emita `dist/tokens.css`. Una declaración sin capa gana a cualquier capa, así que se desactiva sola **si `tokens.css` se emite sin `@layer`**, que es lo que dice `handoffs/3c-0.md §3`. **Supuesto:** así será; aun así lo correcto al integrar es borrar las 45 líneas marcadas, no confiar en la cascada. Anotado también en el handoff.
- [Fase 3-C · 3c-4] **Perfiles de onda re-trazados.** Las dos curvas de `moodboard/partes/04-formas.html` están dibujadas para 200 px de ancho; estiradas a 1 440 px con `preserveAspectRatio="none"` se aplanan casi hasta desaparecer y las dos capas de `doble` se solapan. **Supuesto:** las tres curvas se re-trazan con más amplitud y más separación entre capas manteniendo la familia y la regla de «tres perfiles fijos, nada de `path` libre». Si el dueño quiere exactamente la curva del moodboard, es cambiar seis cadenas en `geometria.ts`; la prueba que las vigila solo comprueba que son tres, distintas y cerradas.
- [Fase 3-C · 3c-4] **`Card shadow="color"`.** La tabla de `11 §3.1` describe la sombra de color como una prop de `Card`, pero `Card` es de 3C-2. **Supuesto:** en `shapes/` vive solo el envoltorio `ColorShadow` (que ya pone el desplazamiento 8/8, el borde de tinta de 2 px y el fondo de papel); `Card` puede consumirlo o replicar la clase `.ui-sombra-color`, pero no debe existir una segunda implementación de la sombra. Decisión del bloque 2 al construir `Card`.
## Fase 3-C · 3c-2 (tipografía y fuentes autoalojadas)

- **Placeholder de `packages/tokens/generated/tokens.css`.** `packages/ui/src/estilos.css` importa `@invitaciones/tokens/tokens.css` por instrucción del orquestador (ajuste 2 del bloque 1), pero en el worktree de 3c-2 `packages/tokens` es solo el esqueleto (3C-1 trabaja en paralelo en otro worktree) y ese fichero generado no existía — sin él, `@import` no resuelve y `next build` de `apps/web` rompe (compuerta obligatoria). **Supuesto:** se creó un placeholder mínimo en esa misma ruta con solo las tres variables de familia (`--ui-font-display/text/label`, los mismos valores que ya fija `moodboard/styles.css`), comentado como «lo sustituye `build-css.mjs` de 3C-1 sin más». Si el merge lo marca en conflicto, gana siempre la versión que genere el script real de 3C-1. ¿Puede el orquestador confirmar que 3C-1 sobrescribe esa ruta al integrar, o hace falta coordinar el orden de merge?
- **Nombres de variable para la escala tipográfica (tamaño/interlineado/tracking/peso por rol).** El doc 11 §2.2 fija los VALORES pero no el nombre de la variable CSS; 3C-1 los define en paralelo. **Supuesto:** convención propia `--ui-<rol>-size/-leading/-tracking/-weight` (p. ej. `--ui-display-2xl-size`) usada como `var(--ui-…, valor-de-11-§2.2)` en `typography.css`. Si 3C-1 usa otros nombres, el `clamp()`/media query de reserva sigue garantizando la escala responsiva correcta (mismos valores, mismo aspecto) pero SIN escuchar esas variables tras el merge — solo los tres nombres de familia (`--ui-font-display/text/label`, alta confianza porque ya están en `moodboard/styles.css`) quedan realmente conectados al sistema de tokens. Recomendado alinear nombres en integración si se quiere que la escala responda a cambios de tema/densidad vía tokens.
- **`apps/web/public/fonts/` como artefacto acoplado a `packages/ui`.** Las rutas de precarga (`RUTAS_PRECARGA`) y los `@font-face` de `fonts.css` sirven las fuentes en `/fonts/*`, ficheros que copia `packages/ui/scripts/copiar-fuentes-publicas.ts` (parte de su `build`) desde `node_modules/@fontsource-variable/*` hasta `apps/web/public/fonts/` — un acoplamiento explícito de un paquete de UI escribiendo en la carpeta pública de una app concreta, documentado en `ADR-3C-2-01`. Es deliberado (evita depender del hash que el pipeline de CSS asigna a los `url()` importados, necesario para que el `<link rel="preload">` apunte a algo real) pero no es el patrón habitual de un paquete de componentes. ¿Lo acepta el dueño como definitivo, o prefiere que `apps/web` posea el script de copia (invirtiendo la dependencia)?
- **`.gitignore` de `apps/web/public/fonts/`.** No se añadió una entrada porque no hay convención previa de `public/` en el repo (la carpeta no existía) ni de "generated" fuera de `frontend/**/dist/`. El contenido es 100 % derivado (copia bit a bit de `node_modules`), así que en principio no debería versionarse, pero se deja sin decidir para no tocar `.gitignore` sin que el dueño lo confirme. ¿Se ignora, o se versiona para que un `git clone` sin `pnpm install`/`pnpm run build` previo sirva las fuentes igual?
- **`ss01` y otras `font-feature-settings` de las tres familias.** El brief menciona `ss01` como ejemplo de ajuste posible; no se verificó (sin `fonttools`/`ttx` disponible en el entorno para inspeccionar qué OpenType features declara cada `.woff2`) así que no se aplicó para no afirmar un soporte no comprobado. Sí se aplicó `tabular-nums`/`"tnum" 1` (estándar CSS, no depende de una feature específica del fichero) en `label-*` y en la utilidad `.numeros-tabulares`. Si el dueño confirma que las tres fuentes traen `ss01`, es una línea más en `typography.css`.

## Fase 3-C · 3c-2b (corrección de integración de tipografía)

- **RESUELTA (3c-2 § "Nombres de variable para la escala tipográfica").** `typography.css` ya consume los nombres reales de `packages/tokens` (`--ui-text-<rol>`, `--ui-leading-<rol>`, `--ui-tracking-<rol>`, `--ui-weight-<rol>`, `--ui-variacion-<rol>`); no hizo falta añadir tokens nuevos a `tipografia.ts` (todos los que la escala necesita, móvil y escritorio, ya existían). Prueba de deriva en `test/tipografia.test.ts`.
- **Metric override extendido a la voz `display`, no solo texto/etiqueta.** `11 §2.4`/`ADR-3C-0-02` piden `size-adjust`/`ascent-override` explícitamente en texto y etiqueta (la display se `preload`a); **supuesto:** se generó igual una "Fraunces Fallback" para el caso en que el `preload` no llegue a tiempo (conexión lenta, fuente bloqueada) — mismo mecanismo, sin coste adicional (una familia CSS más en la pila, ningún byte de red). ¿De acuerdo, o se prefiere que la display se quede sin metric override porque siempre se `preload`a?
- **`@capsizecss/metrics` como devDependency nueva de `packages/ui`.** Paquete MIT, solo usado en build-time (`scripts/metric-override.ts`, no llega al bundle de `apps/web`). No se evaluaron alternativas (era la opción que el brief nombraba primero); si el dueño prefiere no depender de un paquete externo para esto, las cuatro cifras por familia quedan documentadas en la bitácora para teclearlas a mano.
## Fase 3-C · 3c-3a (bloque 1, iconos mitad A)

- **Supuesto:** el reparto de la mitad A/B es "los primeros/segundos 41 nombres en el orden
  literal del inventario de 82" (ajuste del orquestador en el prompt de sesión), no la lista de
  categorías del brief `3c-3-iconos.md` §"Reparto" (que agrupa "navegación, edición, cuenta,
  estados y acciones genéricas" para A). Con el reparto por categorías, `chispa`, `compartir`,
  `enlace`, `boda`, `xv-anos`, `cumpleanos`, `graduacion`, `invitacion` (estados/compartir/tipos de
  evento, ya dibujados en el moodboard) habrían caído en A; con el reparto estricto por orden caen
  en B. Se siguió el ajuste del orquestador (más específico y sin ambigüedad de qué nombre cae en
  qué mitad), pero si el dueño prefería el reparto por categorías, faltan 8 SVG ya resueltos en el
  moodboard que habría que mover de mitad.
- **Supuesto:** `tone="duo"` es el valor por defecto de cada icono generado (no lo fija el doc 11
  ni el brief). Alternativa descartada: sin valor por defecto (prop obligatoria) — se prefirió un
  valor por defecto porque casi todo uso del sistema es "dos tonos" y obligar a pasar la prop en
  cada uso habría sido ruido. Ver `ADR-3C-3-01`.
- **Pendiente de otro bloque, no bloquea:** `apps/web/app/(chrome)/design/iconos/iconos.module.css`
  fija tokens `--ui-*` con los valores verificados de la Paleta A (claro) como *fallback local*
  porque `packages/tokens` no publica aún `generated/tokens.css` en este worktree y el chrome
  todavía no lo importa. En cuanto ese paquete y el chrome lo hagan, revisar que el `:root` real
  gane sobre `.pagina` (mismo nombre de variable, mayor alcance debería bastar) y, si no, borrar el
  bloque de variables local.
- **Pendiente de otro bloque, no bloquea:** tras fusionar `packages/icons/svg/*.svg` de la mitad B,
  alguien debe volver a ejecutar `node --experimental-strip-types scripts/generar.ts` desde
  `packages/icons/` para que `src/generated/`, `src/index.ts` e `inventario.json` reflejen los 82
  nombres (cada mitad solo generó y commiteó los suyos; el merge de esos tres artefactos por Git
  no basta sin una regeneración).
## Fase 3-C · 3c-3b

- **Reparto de la mitad B por número, no por categoría.** El brief `3c-3-iconos.md` describe mi mitad como «secciones de invitación, tipos de evento, RSVP, compartir/enlace/WhatsApp, imágenes/galería», pero esa lista de categorías incluye `galeria`, `mesa-de-regalos` y `rsvp-confirmado` (nombres 36/37/40), que quedan en la primera mitad si se cuenta por posición en el inventario de `11 §4.2`. El ajuste del orquestador (mensaje de la tarea) fija explícitamente «del nombre 42 al 82», y esa partición es la que coincide con el reparto real de los 15 SVG ya dibujados (10 caen en 42-82, 5 en 1-41). **Supuesto tomado:** seguí el corte numérico del ajuste, no la descripción por categorías del brief; si la mitad A hizo la misma lectura, el `svg/` compartido no debería tener colisiones (verificado: mis 41 nombres no se repiten). Si A leyó la lista de categorías literalmente, faltarán `galeria`/`mesa-de-regalos`/`rsvp-confirmado` en su mitad y sobrarán en la mía por duplicado — el orquestador debería comprobar esto al fusionar.
- **Dónde vive el valor por defecto de `--tono`.** `ADR-3C-0-04` fija que el relleno es `fill="var(--tono)"` con `--tono` por defecto `var(--ui-primary-soft)`, pero no dice si ese valor por defecto lo pone una hoja de estilos global (como hace el moodboard, con una regla CSS fuera de mi alcance) o el propio componente. **Supuesto tomado:** el componente generado lo fija por `style` inline según la prop `tone`, registrado como `ADR-3C-3-01` (propuesta) en `decisiones.md`; si la mitad A resuelve el segundo tono de otra forma (p. ej. una clase CSS en `packages/ui/estilos.css`), habrá que unificar un solo mecanismo al fusionar `src/index.ts` y decidir cuál de las dos ADR queda vigente.
- **Transformador de SVG a componente sin `@svgr/core`.** El brief permite «un transformador propio si svgr da problemas… documenta cuál y por qué». No llegué a intentar `@svgr/core`: con 41 SVG de un puñado de elementos y atributos conocidos, una tabla de conversión kebab→camel de 4 atributos (`stroke-width/linecap/linejoin/dasharray`) cubre el 100 % de los casos sin fijar una versión de dependencia nueva. **Supuesto tomado:** válido para este inventario; si el bloque 2 (o una fase futura) añade SVG con `<defs>`, `clip-path`, gradientes o `xlink:href`, esa tabla se queda corta y ese es el momento de evaluar `svgr` de verdad — no antes, para no añadir una dependencia sin necesidad medida.
- **Página `/design/iconos` mínima queda en el worktree aunque la sobrescriba A.** No until el merge, esta página SÍ es lo que se ve en `/design/iconos` de este worktree (usada para la captura de evidencia). ¿Confirma el orquestador que efectivamente se descarta en el merge en favor de la de A (ajuste #2), y no hace falta que yo la borre antes de entregar?
## Fase 3-C · 3c-1 — tokens y galería (5)

Supuestos que tomé para no bloquear el bloque. Evidencia para decidir: `/design/tokens` en el propio
producto (conmutador claro/oscuro) y `evidencia/fase-3c/bloque-1/*.png`.

- [Fase 3-C · 3c-1] **Bandera `DESIGN_GALLERY`.** `11 §8.1` pide que la galería quede fuera de
  producción tras una bandera; el orquestador la aplazó. **Supuesto:** `/design` se construye siempre
  (dos rutas estáticas, no toca ninguna otra) y solo lleva `robots: noindex` en sus metadatos. ¿Se
  quiere además una variable de entorno que la haga devolver 404 en producción, o basta con `noindex`
  y que sea documentación viva accesible para el equipo?
- [Fase 3-C · 3c-1] **Puntos de corte de marca.** `11` no los fija. **Supuesto (ADR-3C-1-03):**
  `sm 480 · md 768 · lg 1024 · xl 1280` como DATO (`--ui-bp-*`), sin publicarlos como variantes de
  Tailwind para no tener dos escalas (`md:` y `ui-md:`) en el mismo código; `lg` = 1024 es además la
  anchura de referencia de la escala tipográfica. ¿De acuerdo, o se quiere una escala propia
  sustituyendo a la de Tailwind cuando el bloque 3 migre el chrome?
- [Fase 3-C · 3c-1] **Capas (z-index).** Tampoco estaban escritas. **Supuesto:** `base 0 · elevado 10 ·
  pegajoso 20 · hoja 30 · dialogo 40 · toast 50`, con el aviso por encima del diálogo. ¿Hay algún caso
  del producto (el lienzo del editor, un panel flotante) que necesite otra capa?
- [Fase 3-C · 3c-1] **Radio de tarjeta.** `11 §5` dice «14-24» sin elegir. **Supuesto (ADR-3C-1-03):**
  `card` = 14 y `media`/bloques grandes = 24, para que una rejilla de tarjetas no se vea blanda. Se
  juzga en `/design/tokens`, sección «Espacio y forma».
- [Fase 3-C · 3c-1] **Sombra de color: 6 px o 8 px.** `moodboard/styles.css` usa `6px 6px`, mientras
  `11 §3.1` y `handoffs/3c-0.md §4` dicen `8px 8px`. **Supuesto:** 8 px (las dos fuentes normativas).
  Si el dueño prefiere el boceto, es un número en `espacio.ts` y regenerar.

Sin resolver, heredado y NO tocado por este bloque: el emoji de `lib/i18n.ts` (`publicar.yaSeVe`) y
`lucide-react` en el chrome siguen ahí; `handoffs/3c-0.md` los asigna al agente de iconos.

## Fase 3-C · 3c-b2-f1 (bloque 2, familia de formularios)

- [Fase 3-C · 3c-b2-f1] **Color de la bolita del `Switch`.** `11 §5` dice «bolita 22 con `shadow-1`»
  sin fijar el rol de color. **Supuesto:** `var(--ui-surface-raised)` (blanco en tema claro, oscuro en
  tema oscuro), porque da contraste razonable contra `primary`/`border` en las dos superficies y en los
  dos temas sin inventar un token nuevo. Verificado a ojo en `/design/componentes` (F3 la monta); no
  medí contraste numérico porque no es una pareja de las 42 verificadas por `packages/tokens` — si el
  dueño prefiere una pareja garantizada, la alternativa más cercana es `on-primary`/`on-primary-soft`
  según el estado, con el riesgo de que no contraste igual de bien contra `border` cuando está apagado.
- [Fase 3-C · 3c-b2-f1] **`Textarea`/`Input` a 16 px de fuente en todo tamaño de pantalla**, no solo en
  móvil. `11 §5` pide 16 px mínimo en móvil (evita el zoom de iOS) pero el boceto de escritorio usa 15.
  **Supuesto:** 16 px siempre, sin `media query`, priorizando la regla dura sobre el matiz de 1 px. Si
  el dueño quiere los 15 px de escritorio, hace falta una `clamp()`/`media query` como la de
  `typography.css`, no un valor fijo.
- [Fase 3-C · 3c-b2-f1] **`Button` no fija «ancho igual en reposo y en `loading`»** (`11 §5`, columna de
  estados). No se implementó por presupuesto de tiempo: la vía más simple sería medir el ancho del
  botón en reposo (`ResizeObserver` o una medida en el primer render) y fijarlo por `style.minWidth` al
  entrar en `loading`. Falta.
- [Fase 3-C · 3c-b2-f1] **Sin unión discriminada que obligue `aria-label` en `Button variant="icono"`
  sin hijos de texto.** Se documentó en el JSDoc del componente en vez de en el sistema de tipos: una
  unión que distinga «variant icono sin children de texto» de «con children» habría complicado el tipo
  público de `PropsBoton` (que además admite `asChild`) más de lo que el presupuesto de esta familia
  permitía. Si se quiere gate-keeping en tiempo de compilación, es un cambio de tipos, no de runtime.
- [Fase 3-C · 3c-b2-f1] **`RadioGroup`/`Checkbox` no llevan el tratamiento visual completo de
  «opción grande»** del moodboard (tarjeta con fondo/borde propios cuando está marcada): solo el
  objetivo táctil de 44 px con `<label>`. Si una pantalla real (RSVP, asistente) necesita el peso visual
  de tarjeta, es una variante nueva sobre el mismo componente, no un componente distinto.
- [Fase 3-C · 3c-b2-f1] **Utilidades de `utilidades/foco.ts`/`controlSombra.ts`/`cn.ts` no están
  reexportadas desde `@invitaciones/ui`** (solo internas a `packages/ui/src/componentes/*`). Si F2 o F3
  quieren reutilizar el mismo mecanismo de anillo de foco para sus propios componentes interactivos
  (Tabs, Dialog, Tooltip, Toast…), hay que subir esas tres funciones/el hook al barril público —
  cambio mecánico, sin decisión de diseño de por medio.
## Fase 3-C · 3c-b2-f2 (bloque 2 · familia de superficies y navegación)

Supuestos tomados para no bloquear el bloque; detalle y alternativas descartadas en `ADR-3C-B2F2-01`.

- **Nombres `WizardProgress`/`Stepper`.** El doc 11 solo tiene un «Stepper» (el de pasos del
  asistente); el brief pide además un stepper NUMÉRICO con ese mismo nombre. **Supuesto:** el de
  pasos se llama `WizardProgress` en código (nombre literal del brief) y `Stepper` queda para el
  numérico. ¿Confirma el dueño esta partición, o prefiere que el de pasos conserve el nombre
  `Stepper` del doc 11 y el numérico se llame de otra forma (`QuantityStepper`, `Contador`)?
- **`aria-modal="true"` fijado a mano en `Dialog`/`Sheet`.** Verificado [V] que
  `@radix-ui/react-dialog@1.1.23` no lo escribe por sí solo (a diferencia de versiones anteriores
  documentadas en la web de Radix). Sin pregunta pendiente: es una corrección de conformidad WAI-ARIA,
  no una decisión de diseño; documentado por si una actualización futura de la dependencia lo
  reintroduce y el atributo queda duplicado (inofensivo, pero el comentario del código quedaría
  desactualizado).
- **Retorno de foco de `Dialog`/`Sheet` exige usar la prop `trigger`.** Verificado [V] con Radix
  1.1.23 + React 19.2 en jsdom: `DialogContentModal` devuelve el foco a `context.triggerRef.current`
  (el nodo real de `Dialog.Trigger`), NUNCA a "lo último que tenía el foco" si el diálogo se abre por
  `open`/`onOpenChange` controlados desde un botón ajeno sin pasar por la prop `trigger`. No es un
  defecto de este componente: es el comportamiento de Radix. Documentado en `handoffs/3c-b2-f2.md`
  para que quien use `Dialog`/`Sheet` en el editor real sepa que el retorno automático de foco solo
  funciona si el disparador va por `trigger` (si el diálogo se abre por otra vía — p. ej. tras guardar
  —, hay que devolver el foco a mano).
- **Movimiento de entrada de `Dialog`/`Sheet`/`Toast` NO implementado.** `11 §6.1`/`§6.2` piden
  entradas con `dur-3`/`ease-out`. Implementarlo sin parpadeo exige `forceMount` + una librería de
  animación de salida (Radix no anima la desaparición por sí solo) o `@starting-style`; se dejó fuera
  por presupuesto de este bloque. **Supuesto:** los tres componentes aparecen/desaparecen sin
  transición (cumple `prefers-reduced-motion` trivialmente: no hay nada que apagar) hasta que otro
  bloque lo añada. ¿Es aceptable entregar la fase 3-C sin esa animación, o hace falta antes del cierre?
- **Delay del `Tooltip` por ratón.** `11 §5` no fija un número; se tomó `400 ms` (el valor por
  defecto de Radix es 700 ms, se acortó porque el sistema pide interacciones ágiles). El foco de
  teclado sigue sin retardo (accesibilidad, no configurable). ¿De acuerdo con 400 ms?
- **Icono del `ProgressRing` completo.** El boceto de `moodboard/partes/06-componentes.html` sustituye
  el número por un check al llegar a 100 %; se siguió ese boceto (el `aria-valuetext` sigue diciendo
  «100 %» para quien usa lector de pantalla). ¿Se prefiere mantener el «100 %» visible también en ese
  estado, en vez del check?
