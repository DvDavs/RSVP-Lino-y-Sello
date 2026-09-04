# Handoff — 1R-calidad → orquestador de fase 1, fases 2/4/5

Entregables: `diseno/05-migracion.md` (93→613 líneas), `06-pruebas-y-calidad.md` (140→743), `07-extension-ia.md` (61→354). 16 ADR propuestas `ADR-1R-C-01…16`. 18 preguntas nuevas. Bitácora con toda la salida ejecutada: `bitacora/1R-calidad.md`.

## A. Cambios de contrato que el orquestador debe volcar

### A.1 A `contratos.md` §6 (Pruebas y umbrales) — reemplazar el párrafo actual
- Cobertura Kotlin: **JaCoCo 0.8.12** (Kover descartado: verificado que `KoverVerifyRule` 0.9.1 no tiene `filters`, no admite umbrales por paquete). Reglas: `PACKAGE` `composition*`/`migration*` ≥85 % líneas y ≥70 % ramas; `CLASS` `Invariants*` ≥95 %; `BUNDLE` ≥80 % con `classDirectories` filtrado a `templates2/**`. Comando: `./gradlew test jacocoTestReport jacocoTestCoverageVerification`.
- Cobertura TS: **Vitest 3 + `@vitest/coverage-v8`**, con umbral obligatorio de **`functions`** además de `lines` (verificado: una función de una sola sentencia nunca llamada puede reportar `Lines 100 %`). `schema` 90/95/85, `sections` 70/75/60, `apps/web` 60/65/50.
- Golden files: **ruta única** `frontend/packages/schema/golden/{templates,invariants,blocks,operations,migrations}/`, sin copia ni symlink; Kotlin la monta con `sourceSets.test.resources.srcDir(...)`. Prueba de inventario en ambos lados.
- Invariantes: **29** (I-01…I-29), no 21 ni 23 — `1R-dominio` añadió I-24…I-29 en paralelo durante esta ronda. Un fichero de casos por invariante, con caso que viola, caso que no y caso extra; más `invariant-catalog.contract.test.ts`, que falla si un código nuevo entra sin fichero en los dos lados.
- Casos de contrato: 14 ficheros por tipo de bloque (6 casos cada uno) + 10 por operación.
- Postgres en pruebas: contrato por variable **`TPL_TEST_JDBC_URL`**; `services: postgres:16` en GitHub Actions, clúster efímero **delegado en el usuario `postgres`** en local (verificado: `initdb` no corre como root). Testcontainers y H2 descartados.
- CI: `ci.yml` completo está en `06 §9`, listo para copiar en fase 2; 3 jobs, JDK 21, cachés, `PLAYWRIGHT_BROWSERS_PATH` del espacio de trabajo (en el runner **no** existe `/opt/pw-browsers`), `webServer` de Playwright.

### A.2 A una sección §9 "Migración" nueva de `contratos.md`
- **Alcance: cuatro cohortes** (ADR-1R-C-07). Se construyen **9 paquetes** desde el repositorio (`templateId` 4,5,6,7,8,9,10,**11**,13), de los que `boda-clasica@1.0.0` ya cubre el 5. El **13 no tiene fila Flyway**; el **11** tiene su par de JSON pero comentado en el sembrador; **12 y 14** son reconstruibles desde `payload-template-{xv-2,graduacion}.json`; solo **16 y 17** no son reproducibles. La afirmación previa "8 plantillas, ids 11-17 solo en producción" queda derogada.
- **Tres fuentes, no una** (ADR-1R-C-01): F1 JSON del repositorio, F2 `default_visual_configs` (pierde 4 rutas por H-12), F3 `invitation_configs`. El **paquete** se construye desde F1 con `JSON.parse`; el golden `before` sale de F3. Prohibido usar `EditorModels.kt` como parser.
- **Clave de correlación: puntero RFC 6901**, nunca el `id` legado (ADR-1R-C-02; verificado: 20-103 ids duplicados por fichero y `null` en 3 de 9).
- **Procedencia sin umbral de longitud** (ADR-1R-C-04, deroga el "≥12 caracteres" de ADR-022): toda coincidencia con el baseline va a cola de revisión. El baseline se lee de **Mongo**, no del repositorio, y se resuelve por **`(eventTypeId, planId)`** con marca de ambigüedad (ADR-1R-C-05; el `templateId` no lo determina, H-21).
- **Verificación por texto visible completo**, no filtrada por procedencia (ADR-1R-C-06 y `05 §6`): `missingUserText` y `missingImages` bloquean; `missingDemoText` informa. Igualdad exacta tras normalización de 6 pasos, sin umbral difuso.
- **Corte idempotente** `INSERT … ON CONFLICT (invitation_id) DO UPDATE` que **no** regenera `public_token`; **retención ≥180 días** de Mongo y S3 legados; rollback = `uses_templates2 = false` + fila de auditoría, **sin borrar** `tpl_document`; ventana de rollback barato de 7 días.
- **Tabla nueva `tpl_migration_run`** (migración `V37`, **fase 5**, fuera del rango `V29`-`V36` de `02 §2`).
- **Herramienta en TypeScript** en `frontend/packages/migration-legacy/`, reutilizando `@invitaciones/schema` y `compose` (ADR-1R-C-03), con contra-condición si se decide Kotlin.

### A.3 A `contratos.md` §2/§4 (contrato de IA)
- Se añade `packages/schema/src/ai.ts`: `AiModelOutput`, `AiEditProposal` (con `proposalId`, `baseRevision`, `expiresAt`, `status`, `discarded[]`, `diff[]`, `usage`), `AiSuggestRequest` (con `intent` de enum cerrado), `AiApplyRequest`.
- Se añade `packages/schema/src/operations-validate.ts` → `validateOperations(ops, manifest, theme, doc, opts)`, **compartida con el editor humano**; 18 códigos `OP_*`. Es la pieza que `03 §3.3` describía en prosa sin nombrar.
- **Ocho invariantes de IA A-INV-01…08**, siendo A-INV-01 la que aplica el alcance por sección y **prohíbe `reorderSections` y `setTheme` en toda propuesta de IA**.
- Rutas futuras `POST …/document/ai:suggest`, `POST …/document/ai:apply`, `GET …/document/ai:proposals`, con 11 códigos `TPL_AI_*` y tabla `tpl_ai_proposal` (migración futura).
- Límites: ≤10 operaciones, 1 sección, 1 reparación por operación y ≤3 por propuesta, 8 000/2 000 tokens, 20 s/llamada y 35 s/petición, 10 propuestas/hora/invitación, propuesta válida 15 min, 1 en vuelo por invitación.
- Nueve defensas de inyección de prompt D1-D9, ninguna dependiente del modelo.

## B. Contradicciones a dirimir (NO resueltas aquí)

| id | Postura A | Postura B | Evidencia |
|---|---|---|---|
| **CD-1** | `05 §7.5`: tras un rollback, el enlace público debe volver a servirse por el módulo antiguo, luego **la ruta pública también** debe consultar `uses_templates2` | `03 §2`: `GET /public/i/{publicToken}/render` es sin auth y lee solo `tpl_release`; nada menciona la bandera | `03 §2`, `05 §7.5`, ADR-023 |
| **CD-2** | `manifest.ts:53` declara la capacidad `singlePlace`, luego el paquete nuevo puede tenerla | H-12: `itemsSinglePlace` **nunca** llegó a F2 ni a F3, así que ninguna invitación tiene datos de origen para esa capacidad; solo se puede poblar desde F1 como *default de plantilla* | `EditorModels.kt:234-235`, `H-hipotesis.md` §5, `05 §2` |
| **CD-3** | `02 §2.4`: `tpl_document` se crea perezosamente en el primer `GET` autenticado con `INSERT … ON CONFLICT DO NOTHING` | `05 §7.1`: la migración lo crea con `ON CONFLICT DO UPDATE` y contenido poblado. Ambos caminos pueden tocar la misma fila; hay que fijar cuál gana y que ninguno pise al otro | `02 §2.4`, `05 §7.1` |
| **CD-4** (reducida) | `blocks.ts` declara `text.pattern`, `text.multiline`, `image.aspect`, `image.maxBytes`, `audio.maxBytes` | `validateValueAgainstSpec` no tiene `case` para ninguna. **Cinco reglas del esquema no las verifica nadie** — es la forma de H-12 dentro del rediseño. (`richText.maxLength`, la sexta, la cerró `1R-dominio` durante la ronda) | `blocks.ts` vs `esquema/invariants.ts` |
| **CD-7** | `07 §6` define 11 códigos `TPL_AI_*` y la tabla `tpl_ai_proposal` | `03 §5` (tabla de errores) y `02 §2` (`V29`-`V36`) no los contienen, y este bloque no edita esos documentos. También `05 §7.2` pide `V37` para `tpl_migration_run` | `03 §5`, `02 §2` |

**Resueltas durante la propia ronda por `1R-dominio`, sin necesidad de dirimir:** *CD-5* (retirado el `z.any()` de `composed.ts`) y *CD-6* (añadida **I-24 `REORDER_NOT_A_PERMUTATION`**, que fija la permutación exacta también para el editor humano). Quedan **CD-1, CD-2, CD-3, CD-4 y CD-7**.

## C. Objeciones altas cerradas en sitio (detalle en la §13/§12/§11 de cada documento)

`M-01` alcance de cohortes falso · `M-02` sin regla de JSON crudo (H-12) · `M-03` baseline por `templateId` inexistente · `M-04` umbral de 12 caracteres publica `"Georgina"` como dato real (H-03) · `M-05` la verificación de regresión no veía el texto de demo visible · `M-06` faltaba la tabla de mapeo y el algoritmo de texto visible · `Q-01` el `ci.yml` no habría funcionado · `Q-02` umbrales sin herramienta ni comando · `Q-03` el script de `pg_ctl` falla como root · `Q-04` 21 invariantes en vez de 23, sin enumerar · `Q-05` 6 constraints sin validador (→ CD-4) · `Q-06` sin casos por tipo de bloque ni por operación · `A-01` `sectionKey` no ataba las operaciones · `A-02` el validador citado no cubre 7 de 10 operaciones · `A-03` sin modelo de amenaza de inyección · `A-04` propuesta sin `baseRevision` ni caducidad.

## D. Lo que sigue sin poder determinarse

Volumen real de invitaciones a migrar; cuál de los dos artes del `templateId` 11 sirve producción; si existen invitaciones con `templateId` 12/14/16/17; si el runner de GitHub de este repositorio tiene Docker (el diseño no depende de ello); proveedor y presupuesto de IA. El `ci.yml` de `06 §9` **no se ha ejecutado nunca**: es diseño verificado por análisis, no artefacto probado.
