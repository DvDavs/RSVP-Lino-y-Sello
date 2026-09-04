# Bitácora — 1R-calidad (ronda 1R, revisión independiente y profundización)

Fecha: 2026-09-03 · Rama: `claude/agent-network-invitation-41nx5y` · Sin commits, sin push (según brief).
Alcance: `diseno/05-migracion.md`, `diseno/06-pruebas-y-calidad.md`, `diseno/07-extension-ia.md`.
Scratchpad: `/tmp/claude-0/-home-user-RSVP---Lino-Sello/0ef13c98-327a-5e1f-ac50-6589ef84feda/scratchpad/1R-calidad/`.

## 1. Qué hice

1. Leí la memoria completa indicada por el brief (`brief-comun`, `00-INDICE`, `contratos`, `glosario`, ADR-001…009 y 022…028, los 7 handoffs), la auditoría relevante (`H-hipotesis.md` hipótesis 5 y 7 íntegras, `ANALISIS-GENERACION-PLANTILLAS.md` §4.6, §5.2 H-03/H-12/H-28, §7) y, en solo lectura, `01-dominio-y-esquema.md`, `02-persistencia-y-catalogo.md` §2/§4, `03-api.md` §1-§4, `04-frontend-y-editor.md` §1-§2.1 y los seis `esquema/*.ts`.
2. **Verifiqué contra el repositorio, ejecutando**, cada afirmación factual de los tres documentos sobre datos, plantillas, build o entorno. Ahí aparecieron las 6 objeciones altas de migración y las 6 de pruebas/IA.
3. Reescribí los tres documentos en sitio, multiplicando su extensión (05: 93 → 613 líneas; 06: 140 → 743; 07: 61 → 354) y añadiendo a cada uno la sección final "Revisión independiente (1R-calidad)" con la tabla de objeciones.
4. Añadí 16 ADR nuevas en estado *propuesta* (`ADR-1R-C-01`…`16`) con un **único** `cat tmp >> decisiones.md`, y 18 preguntas nuevas con un único append a `preguntas-abiertas.md`, para no entrelazarme con los otros tres agentes de la ronda.
5. No toqué ni un byte de código del repositorio. `git status` al terminar solo muestra los ficheros de `docs/rediseno-plantillas/` que me tocaban (más los `esquema/*.ts` que ya estaban modificados por otro agente antes de que yo empezara).

## 2. Evidencia ejecutada (salida literal)

### 2.1 Forma real de los 9 pares de JSON (H-12, cohortes)

```
$ jq -r '.templateId' src/main/resources/data/mongo/default_visual_*.json
7  4  5  11  8  9  10  13  6

$ for f in default_content_*.json; do echo "$f: templateId=$(jq -r '.templateId // "NULL"' $f) eventTypeId=... planId=..."; done
default_content_bautizo.json:        templateId=NULL eventTypeId=3 planId=2
default_content_boda_basico.json:    templateId=NULL eventTypeId=1 planId=1
default_content_boda_premium.json:   templateId=NULL eventTypeId=1 planId=2
default_content_boda_premium_2.json: templateId=NULL eventTypeId=1 planId=2
default_content_comunion.json:       templateId=NULL eventTypeId=4 planId=2
default_content_confirmacion.json:   templateId=NULL eventTypeId=5 planId=2
default_content_cumpleanos.json:     templateId=NULL eventTypeId=6 planId=2
default_content_evento.json:         templateId=NULL eventTypeId=7 planId=2
default_content_xv_premium.json:     templateId=NULL eventTypeId=2 planId=2
```
→ ningún contenido declara `templateId`; `(1,2)` colisiona entre `boda_premium` y `boda_premium_2`. Base de la objeción M-03.

### 2.2 Ids legados: duplicados y nulos (H-28 ampliado)

```
default_visual_bautizo.json          ids=33   únicos=23  dups: f1,f2,msg-1,s1,s2
default_visual_boda_basico.json      ids=32   únicos=22  dups: event-1,event-2,msg-1,s1,s2
default_visual_boda_premium.json     ids=78   únicos=35  dups: null,event-1,event-2,event-3,f0,f1,msg-1,msj1,msj2,s1,s2,s3
default_visual_boda_premium_2.json   ids=134  únicos=31  dups: null,msg-1,s1,s2,s3
default_visual_comunion.json         ids=33   únicos=23  dups: f1,f2,msg-1,s1,s2
default_visual_confirmacion.json     ids=33   únicos=23  dups: f1,f2,msg-1,s1,s2
default_visual_cumpleanos.json       ids=33   únicos=23  dups: f1,f2,msg-1,s1,s2
default_visual_evento.json           ids=30   únicos=20  dups: f1,f2,msg-1,s1,s2
default_visual_xv_premium.json       ids=62   únicos=31  dups: null,f1,f2,msg-1,msj1,msj2,s1,s2,s3
```

### 2.3 `itemsSinglePlace` en el JSON crudo (lo que el modelo Kotlin descarta, H-12)

```
tid=7  default_visual_bautizo.json          -> 0 tarjetas
tid=4  default_visual_boda_basico.json      -> 2 tarjetas
tid=5  default_visual_boda_premium.json     -> 3 tarjetas
tid=11 default_visual_boda_premium_2.json   -> 0 tarjetas
tid=8/9/10/13/6                             -> 0 tarjetas
```

### 2.4 Prototipo del extractor (Node 22.22, `extract-proto.mjs`, 100 reglas de mapeo a mano)

```
default_visual_bautizo.json          hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_boda_basico.json      hojas=  5003  mapeadas=  112  presentacion=  4788  descartadas=  3  SIN MAPEAR=  100
default_visual_boda_premium.json     hojas=  6623  mapeadas=  185  presentacion=  6305  descartadas=  3  SIN MAPEAR=  130
default_visual_boda_premium_2.json   hojas=  5500  mapeadas=  156  presentacion=  5087  descartadas=  3  SIN MAPEAR=  254
default_visual_comunion.json         hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_confirmacion.json     hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_cumpleanos.json       hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_evento.json           hojas=  3671  mapeadas=  123  presentacion=  3479  descartadas=  3  SIN MAPEAR=   66
default_visual_xv_premium.json       hojas=  4793  mapeadas=  182  presentacion=  4522  descartadas=  3  SIN MAPEAR=   86

--- patrones de hoja SIN MAPEAR (extracto: los 12 más frecuentes) ---
     36x  /config/sectionCouple/backgroundColor/content/*
     36x  /config/sectionFamily/backgroundColor/content/*
     36x  /config/sectionGallery/backgroundColor/content/*
     30x  /config/sectionFamily/intro/*/id
     30x  /config/sectionFamily/intro/*/content
     20x  /config/sectionEvent/items/*/date/timeStart/content
     20x  /config/sectionEvent/items/*/date/timeEnd/content
     20x  /config/sectionEvent/items/*/time/dateDay/content
     20x  /config/sectionEvent/items/*/time/dateMonthYear/content
     18x  /config/sectionDresscode/items/*/bullet/content
     10x  /config/sectionStory/items/*/{id,image,title,date,body}/content
      5x  /config/sectionEvent/itemsSinglePlace/*/{id,title,time,date,locationText}/content
total de patrones sin mapear: 146
```
**Es un prototipo de diagnóstico, no un extractor funcional**: enumera y clasifica hojas, y no produce todavía un `InvitationDocument` válido. Lo digo explícitamente para no dar por hecho lo que no verifiqué. Lo que sí demuestra, y era el objetivo, es (a) que el ~95 % de las hojas es presentación, (b) que un mapa de 100 reglas escrito a conciencia deja 146 patrones sin mapear, y (c) que el mapa **no puede ser único**: los 6 patrones de `sectionCouple` de las plantillas de boda (`groomName`, `brideName`, `groomPhoto`, `bridePhoto`, `groomText`, `brideText`) no existen en las no-boda.

### 2.5 Cadenas de demo de menos de 12 caracteres (rompe el umbral de `05 §3.2`)

```
default_content_bautizo.json:      strings=103  <12 chars=24
default_content_boda_basico.json:  strings= 72  <12 chars=15
default_content_boda_premium.json: strings= 55  <12 chars=15
default_content_cumpleanos.json:   strings=119  <12 chars=34
default_content_xv_premium.json:   strings=115  <12 chars=29

$ jq -r '[.. | strings | select(length>0 and length<12)] | unique | .[]' default_content_bautizo.json
# · #bautizo · 4:30 PM · 5:30 PM · 7:00 PM · 7:30 PM · Amenidades · Caballeros · Ceremonia ·
Damas · Dress Code · Fiesta · Galería · Georgina · Hotel · Itinerario · Marck Luga ·
Mi bautizo · Mis Padres · cash · custom · fas fa-copy · store
```
`"Georgina"` es el nombre de la niña ficticia del bautizo de demostración. Con el umbral previo se habría publicado como dato real del cliente.

### 2.6 Clúster Postgres efímero — el script de `06 §6` **falla** como estaba

```
$ /usr/lib/postgresql/16/bin/initdb -D "$PGDATA" -U postgres --auth=trust
initdb: error: cannot be run as root
initdb: hint: Please log in (using, e.g., "su") as the (unprivileged) user that will own the server process.
pg_ctl: cannot be run as root
createdb: error: connection to server at "127.0.0.1", port 55432 failed: Connection refused
```
Con la corrección (`su postgres`), funciona:
```
Success. You can now start the database server using: ...
waiting for server to start.... done
server started
CREATE TABLE
INSERT 0 1
 v | contains
---+----------
 1 | t
PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu, compiled by gcc 13.3.0, 64-bit
waiting for server to shut down.... done · server stopped
CLUSTER EFIMERO OK (via su postgres)
```
Los operadores JSONB `->>` y `@>` funcionan de verdad: es lo que descarta H2.

### 2.7 Kover vs JaCoCo (elección de herramienta de cobertura)

Kover 0.9.1 resuelve y falla correctamente un umbral **global**:
```
> Rule 'global >= 80%' violated: lines covered percentage is 0.000000, but expected minimum is 80
BUILD FAILED in 27s · EXIT=1
```
Pero **no admite umbrales por paquete**. Intento de escribirlo:
```
Line 11: filters { includes { classes("...templates2.composition.*") } }
         ^ 'fun filters(config: Action<KoverReportFiltersConfig>): Unit' can't be called in this
           context by implicit receiver. Use the explicit one if necessary
```
Introspección del jar del plugin, que lo confirma:
```
$ javap -classpath /tmp/koverjar kotlinx.kover.gradle.plugin.dsl.KoverVerifyRule
public interface kotlinx.kover.gradle.plugin.dsl.KoverVerifyRule {
  public abstract Property<GroupingEntityType> getGroupBy();
  public abstract Property<Boolean> getDisabled();
  public abstract void bound(Action<KoverVerifyBound>);
  public abstract void minBound(int); ... maxBound(int); ...
}      # no existe `filters`
```
JaCoCo 0.8.12 sí, con dos reglas y dos umbrales distintos:
```
[ant:jacocoReport] Rule violated for bundle jacoco-probe: lines covered ratio is 0.50, but expected minimum is 0.80
[ant:jacocoReport] Rule violated for package mx.evolutiondev.invitaciones.modules.templates2.composition:
                   lines covered ratio is 0.50, but expected minimum is 0.85
BUILD FAILED in 32s · EXIT=1
```
Entorno de las dos pruebas: Gradle 8.14.3, Kotlin 1.9.25, toolchain Java 21, proyectos aislados en el scratchpad; **el repositorio no se tocó**.

### 2.8 Vitest con provider `v8`

```
 ✓ src/inv.test.ts (2 tests) 4ms
 % Coverage report from v8
 Statements : 100% ( 5/5 )   Branches : 100% ( 2/2 )
 Functions  : 50%  ( 1/2 )   Lines    : 100% ( 5/5 )
ERROR: Coverage for functions (50%) does not meet global threshold (90%)   EXIT=1
```
y, con un cuerpo de función de varias sentencias:
```
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
 inv.ts   |   45.45 |      100 |      50 |   45.45 | 6-11
```
Conclusión que llevé al documento: el provider `v8` sí marca líneas no cubiertas, **salvo** cuando el cuerpo de la función tiene una sola sentencia, donde solo el contador `functions` lo detecta. Por eso `06 §2.2` exige umbral de `functions` además de `lines`.

### 2.9 Otras verificaciones puntuales

- `MongoDataInitializer.kt:36,50`: `default_visual_boda_premium_2.json` y su contenido están **comentados** en la lista de siembra.
- `MongoDataInitializer.kt:83-90` (visual, sobrescribe) vs `:118-123` (contenido, *skip-if-exists*): la siembra de contenido **no** pisa, así que el fichero del repositorio puede no coincidir con producción.
- `scripts/apply_template_11_12_local.sh:18-19` y `scripts/upsert_template_11_12.js:19-32`: los payloads de las plantillas 11 y 12 **sí** tienen referencia en el repositorio (H-59 solo es cierto para `payload-template-boda-3.json`).
- `V1:1133-1136` + `V24:10-13` + `V25:2-8`: Flyway inserta **solo** los `invitation_template` 4-10. El 13 no tiene fila en ninguna migración.
- `/config/sectionCover/button/url` es `"#"` en las 9 plantillas; `sectionGallery.hashtags` es siempre un array de 2 con el mismo `content`; el `body` más largo de mesa de regalos tiene 9 elementos (cabe en `maxItems: 12`).
- `esquema/invariants.ts:96-133`: `validateValueAgainstSpec` solo tiene `case` para `text`, `listText`, `dateTimeRange`, `choice` y `group` — 6 constraints declaradas en `blocks.ts` no las verifica nadie.
- `esquema/invariants.ts:9-17`: son **23** invariantes, no 21 como decía `06 §4`.
- `esquema/composed.ts:32`: `richText: z.any()`.
- Entorno: Node v22.22.2, pnpm 10.33.0, jq 1.7, Gradle 8.14.3 (`/opt/gradle`), OpenJDK 21.0.10, PostgreSQL 16.13. Docker no disponible.

## 3. Qué NO pude hacer o determinar

- **No construí un extractor funcional.** El prototipo clasifica hojas; no emite un `InvitationDocument` ni corre `compose()`. Habría hecho falta implementar `compose` en TS, que es trabajo de fase 2/3, no de una revisión de diseño. Lo digo sin adornos: **el extractor de `05 §5` no está probado**, solo especificado.
- **No pude leer producción**, así que no sé el volumen de invitaciones a migrar, cuál de los dos artes del `templateId` 11 sirve producción, si existen invitaciones con `templateId` 12/14/16/17, ni el valor de `invitation_template_id_seq`.
- **No ejecuté el backend Kotlin.** El toolchain 17 del `build.gradle.kts` no compila aquí (`handoffs/0-build-jdk.md`) y el brief prohíbe tocarlo. Las pruebas de JaCoCo y Kover las hice en proyectos aislados del scratchpad con toolchain 21, que es lo que la fase 2 va a usar.
- **No verifiqué el `ci.yml` en GitHub Actions.** Está escrito con las correcciones que el análisis exige, pero no se ha ejecutado ni una vez. Es diseño, no artefacto probado.
- **No modifiqué `03-api.md` ni `02-persistencia-y-catalogo.md`** aunque `07` y `05` piden cambios en ambos (códigos `TPL_AI_*`, tabla `tpl_ai_proposal`, migración `V37`): quedan como contradicciones a dirimir para el orquestador.

## 4. Riesgos que dejo señalados

1. **El mapa de campos de la migración es un proyecto en sí mismo**, no un apéndice: ~250 filas por plantilla y al menos dos variantes (boda / no-boda). Si la fase 4 lo aborda como "traducir unos cuantos campos", se comerá el presupuesto y producirá pérdidas silenciosas. El gate de "cero patrones sin mapear" es lo único que lo evita.
2. **La cola de revisión de procedencia necesita un humano con autoridad de producto** y tiempo real. Sin ese compromiso, la migración se para en la primera invitación ambigua o alguien la salta y H-03 vuelve.
3. **`compose()` implementado dos veces** es el riesgo estructural de todo el rediseño. Los golden files de ruta única (`06 §3`) son la única defensa; si un lado se salta la tabla compartida, la divergencia aparecerá en producción.
4. **Seis constraints del esquema sin validador** (`06 §4.1`): hoy es un hueco pequeño, pero es exactamente la forma de H-12 y crecerá si el catálogo de bloques crece sin la prueba de huecos.
5. **La ventana de rollback se degrada con el tiempo** y eso no es evidente para quien opere la migración. Está escrito en `05 §7.5`, pero conviene que llegue al runbook de fase 5, no solo al diseño.

## 5. Sincronización al cierre (agentes en paralelo)

Al terminar releí `esquema/*.ts` porque el agente `1R-dominio` trabajaba en paralelo sobre los mismos ficheros. Había cambiado tres cosas que afectan a mis documentos, y las incorporé antes de cerrar:

| Cambio de `1R-dominio` | Efecto en mi trabajo |
|---|---|
| `InvariantCode` pasa de 23 a **29** (`I-24_REORDER_NOT_A_PERMUTATION`, `I-25_GROUP_ROLE_MISMATCH`, `I-26_SINGLETON_ROLE_DUPLICATE`, `I-27_LOCALIZED_TEXT_MISSING_LOCALE`, `I-28_DEFAULT_FOR_BUSINESS_BLOCK`, `I-29_RESERVED_OBJECT_KEY`) | `06 §4` reescrito para 29 invariantes, con las 6 filas nuevas y sus casos; `§2.3`, `§3`, `§10` y la objeción Q-04 actualizados; añadido `§4.2` (prueba de exhaustividad del catálogo) precisamente porque el número cambió tres veces en una fase |
| `case "richText"` añadido a `validateValueAgainstSpec` | mi objeción Q-05 baja de 6 huecos a **5**; CD-4 se mantiene pero reducida. La prueba `invariant-gaps.contract.test.ts` que propuse habría detectado el cierre sola: es la señal de que está bien planteada |
| `z.any()` retirado de `composed.ts` | **CD-5 resuelto**; la regla de lint de `06 §7` se aplica sin excepciones |
| `I-24` con `validateReorder(order, actuales)` | **CD-6 resuelto**: la permutación exacta de `reorderSections` deja de ser solo una regla de IA y pasa a ser regla del reductor para todos. A-INV-01 sigue siendo más estricta (prohíbe la operación a la IA) y las dos conviven. `07` actualizado |
| `I-29` sobre el JSON crudo | `07 §5` paso 1: el pipeline de IA comprueba claves reservadas **antes** de `AiModelOutput.parse()`, porque Zod las descarta en silencio |

Quedan vivas las contradicciones **CD-1, CD-2, CD-3, CD-4 (reducida) y CD-7**. Los números de línea que cito de `esquema/invariants.ts` en las primeras versiones de mis documentos se sustituyeron por referencias por nombre de función o de constante, precisamente porque el fichero está cambiando bajo los pies de todos.
