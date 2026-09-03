# 05 — Migración de plantillas e invitaciones existentes

Autor: fase 1, rol `1-migracion`. Estado: propuesto para aceptación (ADR-022, ADR-023).
Evidencia: `handoffs/0-resumen-auditoria-migracion.md`, `fases/A-modelo-datos.md`, `fases/J-inventario-json.md`, `01-dominio-y-esquema.md` (esquema y ADR-001…008), `02-persistencia-y-catalogo.md` (tablas), `03-api.md` (rutas).

---

## 1. Alcance verificado

8 plantillas **sembradas y reproducibles desde el repo**: ids `4`–`10` y `13` (Flyway + `src/main/resources/data/mongo/default_visual_*.json` + `default_content_*.json`, `handoffs/0-resumen-auditoria-migracion.md`). Ids `11`, `12`, `14`, `16`, `17` existen solo en producción/scripts/código (H-11, H-42) — **NO reproducibles desde este repositorio**; se tratan como una cohorte aparte (§7), nunca se bloquea la migración de las 8 verificadas esperando a resolverlos.

## 2. Migración de las 8 plantillas sembradas (catálogo)

Por cada `templateId` legado, un sub-agente Sonnet de fase 4 (bajo revisor Opus, sección 5 del prompt maestro) ejecuta:

1. **Extraer** `default_visual_<slug>.json` + `default_content_<slug>.json` con el mapeo de tipos de sección de `01 §3.1` (las 13 claves de sección de `J-inventario-json.md` §3/§5 → los 12 `SectionType` cerrados) y de tipos de bloque de `01 §3.2`.
2. **Separar** presentación de contenido: cada literal de color/fuente/icono/tamaño encontrado (H-27, H-31–H-34) se descarta del documento y se traduce a un preset de `theme.json` nuevo (la paleta/tipografía que la plantilla ya usaba visualmente, capturada a mano por quien construye el paquete — no hay forma automática de "adivinar" un preset razonable a partir de un color hex suelto sin criterio humano).
3. **Aplicar roles**: la familia (H-01/H-02) se remapea explícitamente: en las plantillas no-boda (emparejamiento hoy por texto "Padre"/"Padrino") cada fila se asigna a `parentA1`/`parentA2`/`godparentA` etc. por inspección manual del `default_content_<slug>.json`; en la plantilla de boda (hoy por posición `items[0..2+]`) el mapeo es directo (`items[0]→celebrantA` es en realidad el **novio**, ya eso hoy es una posición fija documentada, no una suposición nueva).
4. **Registrar** el paquete resultante vía el único camino de alta (`02 §4`, `POST /master/templates2/register` o CLI equivalente de fase 4) — el registro en sí ya valida el manifiesto contra `invariants.ts`.
5. **Golden file de plantilla**: `defaults.json` de la plantilla nueva compuesto contra un documento vacío (`content: {}`) debe producir, sección por sección, los mismos textos visibles que `default_visual_<slug>.json` + `default_content_<slug>.json` combinados hoy (mismo criterio de comparación por texto visible que en §3, no por igualdad de JSON crudo — la forma cambia a propósito).

`boda-clasica@1.0.0` (`diseno/ejemplos/boda-clasica-1.0.0/`) es el primer resultado de este proceso, ya construido en fase 1 como prueba de que el esquema alcanza — equivalente funcional de `templateId=5` ("Boda Premium", según el comentario de su `template.json`). Los 6 slugs restantes (`templateId` 4, 6, 7, 8, 9, 10 y 13 → 7 paquetes, uno por id) se construyen en fase 4 siguiendo exactamente estos 5 pasos; no se listan nombres de plantilla aquí porque el nombre visible exacto de cada `templateId` **no fue releído en esta fase** (economía de tokens del brief común: el resumen de rol no lo trae y no es necesario para diseñar el proceso) — fase 4 lo obtiene de `invitation_template.name` en Postgres al construir cada paquete.

## 3. Migración de invitaciones existentes (`invitation_configs`)

### 3.1 Por qué el golden `before` es el documento YA guardado, no una regeneración

H-09 (el seed pisa `default_visual_*` en cada arranque) significa que **volver a ejecutar el generador de 2743 líneas hoy** contra el seed vigente puede no reproducir lo que una invitación mostró realmente cuando se generó. La única fuente fiel de "qué vio el cliente" es el documento ya persistido en `invitation_configs` (Mongo). Por eso (ADR-022, corregido explícitamente sobre el primer borrador de esa ADR):

```kotlin
// templates2.migration.LegacyExtractor
fun extractGolden(invitationId: Long): JsonNode   // lee invitation_configs YA GUARDADO, no re-genera
fun extractDocument(invitationId: Long, golden: JsonNode, mapping: TemplateMapping): ExtractedDocument
```

`extractGolden` nunca invoca `DefaultConfigGeneratorService`. Si `invitation_configs` no tiene documento para esa invitación (generación perezosa nunca disparada, H-10), esa invitación no tiene golden `before` que comparar — se migra igual (documento nuevo desde los defaults de su plantilla) pero queda marcada `noPriorRender: true` en el reporte, sin comparación de regresión posible (no hay nada contra qué comparar).

### 3.2 Separación de contenido y procedencia (mata H-03 en la migración)

`extractDocument` compara, campo mapeado a campo mapeado, el valor del `golden` contra el valor correspondiente en `default_content_<slug>.json`/`default_visual_<slug>.json` de la plantilla que esa invitación usa (resuelta por su `templateId` en el momento de la extracción — la plantilla vigente hoy, ya que no hay historial de versiones del generador antiguo):

- **Coincide byte a byte y el valor tiene ≥ 12 caracteres** (umbral conservador contra falsos positivos de frases cortas/comunes) → candidato a `provenance: default`, **va a una cola de revisión** (`migration_review_queue`, tabla de trabajo temporal de la herramienta de migración, no parte del esquema final) — no se descarta silenciosamente.
- **Difiere, o coincide pero tiene < 12 caracteres** → se trata como dato real del cliente, migra a `content` con `provenance: user`.
- La cola de revisión se resuelve por un humano (dueño del producto) antes del corte de esa invitación específica — hasta entonces, esa invitación no activa `uses_templates2` (§4). Esto es deliberadamente más lento que una heurística automática total, y es la decisión correcta dado que H-03 es exactamente "public a un extraño los datos de una pareja ficticia": el costo de una migración más lenta es mucho menor que el de reintroducir ese hallazgo.

### 3.3 Verificación automática (golden files/diffs)

```kotlin
data class RegressionReport(
    val invitationId: Long,
    val missingTexts: List<String>,      // texto visible en `before` que no aparece en `after`
    val missingImages: List<String>,     // URL/asset de imagen visible en `before` sin equivalente en `after`
    val extraTexts: List<String>,        // texto visible en `after` sin origen en `before` (no debería ocurrir salvo defaults nuevos de secciones opcionales)
    val passed: Boolean                  // missingTexts y missingImages vacíos
)
fun compareRendered(before: JsonNode, after: ComposedDocument): RegressionReport
```
La comparación es por **texto e imagen visibles**, no por igualdad de JSON (la forma cambia a propósito, ADR-001): se extrae de `before` la lista de todos los strings de valor no vacío de las claves de sección conocidas (`sectionCover.title`, etc., usando el mismo mapeo de `02 §2` — no todas las claves de `before`, solo las que el contrato implícito de `fases/J-inventario-json.md` reconoce como visibles) y de `after` (`ComposedDocument`) la lista de `ResolvedValue` con `provenance ∈ {user, business}` (el contenido que vino del cliente o de sus datos reales — no se compara contra `default`/`fixed`, que es contenido de la plantilla, no de la invitación). Toda invitación con `RegressionReport.passed == false` bloquea su propio corte (§4) hasta revisión manual; no bloquea a las demás.

## 4. Corte (ADR-023)

Columna `invitation.uses_templates2` (`02` §2, `V36`), por invitación, sin doble escritura. Migrar una invitación es una transacción única:
```sql
BEGIN;
INSERT INTO tpl_document (invitation_id, template_version_id, doc, revision, public_token) VALUES (...);
UPDATE invitation SET uses_templates2 = true WHERE id = ?;
COMMIT;
```
Precondición: `RegressionReport.passed = true` y cola de revisión de §3.2 vacía para esa invitación. El módulo antiguo (`modules/user/invitations/**`) sigue existiendo sin cambios; simplemente deja de ser el que atiende esa invitación en concreto (su código no consulta la bandera — es el enrutador de fase 2, fuera de este documento, el que decide qué módulo atiende cada request según `uses_templates2`; **diseño de esa decisión de enrutamiento queda para fase 2**, no está resuelto aquí).

Orden de corte recomendado: (1) invitaciones sin `invitation_configs` generado aún (sin regresión que verificar, cero riesgo); (2) invitaciones con `RegressionReport.passed = true` sin nada en cola de revisión; (3) el resto, una por una, tras resolver su cola. No hay corte "global de una vez" (mata el riesgo que el prompt maestro P10 pide evitar explícitamente).

## 5. Migración de versión de plantilla (reutiliza `01 §6`)

Cuando una plantilla nueva registra una versión mayor con `MigrationPlan`, cualquier `tpl_document` que use la versión anterior **no migra automáticamente** — migra la próxima vez que su dueño entra al editor (`POST .../document:choose-template` con la misma plantilla, versión nueva, `03 §3.1`), con `dryRun` obligatorio primero. Esto es distinto de la migración legado→nuevo (§3, ejecutada una vez, en bloque, por el equipo): esta es la migración nuevo→nuevo, ejecutada perezosamente, por el propio cliente o un job de fase 4+ que la agende.

## 6. Plan de retiro del módulo antiguo (documentado, no ejecutado en esta fase)

1. Todas las invitaciones con `invitation_configs` generado tienen `uses_templates2 = true` y `RegressionReport.passed = true` (o revisión manual resuelta).
2. Ventana de estabilidad ≥ 30 días sin incidentes reportados contra el render nuevo (criterio de negocio, no técnico — a definir con el dueño).
3. Borrar código: `modules/user/invitations/**` (2743+211+26+494+32+389 líneas, `handoffs/0-inventario.md` §6), `modules/master/templates/**` (772 líneas), `core/data/MongoDataInitializer.kt`.
4. Borrar datos: colecciones Mongo `default_visual_configs`, `default_content_configs`, `invitation_configs`; los 23 archivos de `src/main/resources/data/mongo/*.json` (1.7 MB) y los 5 `data*Premium.ts` de la raíz (H-59: parte de esto puede ya ser basura sin referencia — confirmar antes de borrar, no asumir).
5. Reversión: mientras el paso 4 no se ejecute, revertir una invitación es `UPDATE invitation SET uses_templates2 = false` (el documento viejo en Mongo sigue intacto hasta el borrado real).

## 7. Cohorte no reproducible (ids 11, 12, 14, 16, 17)

Sin manifiesto, sin JSON en el repo (H-11, H-42). Cuando exista acceso a producción (fuera de esta sesión), el mismo `LegacyExtractor` de §3 funciona igual **si** se puede leer su `invitation_configs`/`default_visual_*` real — el proceso no depende de que la plantilla esté en este repo, depende de que el documento generado exista en la base de datos de origen. Se documenta como trabajo pendiente, sin fecha, no bloquea el resto de la migración.

## 8. Lo que no pude determinar

- Nombres visibles exactos de los 7 `templateId` restantes (4, 6, 7, 8, 9, 10, 13) — no releídos en esta fase (`fases/A-modelo-datos.md` los tiene; fase 4 los usa directamente de Postgres al construir cada paquete, no requiere que estén en este documento).
- Volumen real de invitaciones con `invitation_configs` generado (no hay acceso a la base de datos de producción desde esta sesión) — el diseño de §4 (corte por invitación, sin lote global) es intencionalmente insensible a ese volumen.
- Si `default_content_<slug>.json` es la única fuente de comparación para detectar placeholder de demo, o si existe un tercer conjunto de datos "de fábrica" distinto del que vio el usuario en el formulario de alta — no determinable desde el repo; el umbral de 12 caracteres (§3.2) es un supuesto conservador, registrado en `preguntas-abiertas.md`.
