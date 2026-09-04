# Bitácora — 2-1-REV (revisión Opus del bloque 2-1, persistencia)

Revisor adversarial del bloque `2-1` (Sonnet, persistencia), conforme a `brief-comun.md` / prompt maestro §5:
todo entregable de Sonnet que toque esquema, migración o persistencia pasa por revisión Opus antes de integrarse.

- Worktree revisado: `.claude/worktrees/agent-a75a8c04b915a7099`, rama `worktree-agent-a75a8c04b915a7099`, 4 commits sobre `98f3d18`.
- Clúster propio de la revisión: `TPL_TEST_STATE_DIR=/tmp/templates2-pg-rev21*` (nunca el `/tmp/templates2-pg-2-1` del bloque).
- **Veredicto: INTEGRABLE CON RESERVAS** (dos reservas, ninguna del bloque; detalle en §6).

---

## 1. Lo que se verificó y salió bien (`[V]` = verificado ejecutando, no leyendo)

### 1.1 El DDL es transcripción literal de `02 §2` — comprobado mecánicamente
Se extrajeron los 9 bloques ```sql de `diseno/02-persistencia-y-catalogo.md` a ficheros y se compararon línea a
línea (ignorando comentarios y espacios) contra `src/main/resources/db/migration/V29..V37`:

```
===== V29__create_tpl_template.sql              IDENTICO
===== V30__create_tpl_template_version.sql      IDENTICO
===== V31__create_tpl_asset.sql                 IDENTICO
===== V32__create_tpl_document.sql              IDENTICO
===== V33__create_tpl_document_snapshot.sql     IDENTICO
===== V34__create_tpl_release.sql               IDENTICO
===== V35__create_tpl_template_registration.sql IDENTICO
===== V36__add_uses_templates2_to_invitation.sql IDENTICO
===== V37__create_tpl_asset_gc.sql              IDENTICO
```
`ls src/main/resources/db/migration/` confirma que el rango termina en `V37`: **`V38`/`V39` siguen libres** (reservadas
para `tpl_migration_run` y `tpl_ai_proposal`, `contratos.md §5`).

### 1.2 El esquema real, interrogado con `psql` sobre un clúster con `V1`-`V37` aplicadas
No se leyó el SQL: se consultó el catálogo de PostgreSQL. Todos los puntos que `contratos.md §5` marca como
innegociables se cumplen `[V]`:

| Exigencia de `contratos.md §5` | Comprobación real |
|---|---|
| 8 tablas + `tpl_asset_gc` con trigger | las 8 en `pg_tables`; `trg_tpl_asset_gc` en `pg_trigger` sobre `tpl_asset` |
| `package_hash`/`content_hash`/`requested_hash` `VARCHAR(71)` + `CHECK` | `character varying(71)` las tres; `CHECK ((...)::text ~ '^sha256:[0-9a-f]{64}$')` en las tres |
| digestos de archivo sueltos en `CHAR(64)` | `tpl_asset.sha256` = `character(64)` + `CHECK (sha256 ~ '^[0-9a-f]{64}$')` |
| `event_kinds` `JSONB` + GIN `jsonb_path_ops`, **no** `TEXT[]` | `jsonb`; `ix_tpl_template_version_event_kinds_gin USING gin (event_kinds jsonb_path_ops)` |
| `ON DELETE CASCADE` hacia `invitation` | `tpl_asset`, `tpl_document`, `tpl_release` → CASCADE |
| `ON DELETE SET NULL` hacia `customer` | las **6** referencias → SET NULL |
| `ON DELETE RESTRICT` hacia `tpl_template_version` | `tpl_asset`, `tpl_document`, `tpl_release` → RESTRICT (ver O-21-12 para la cuarta) |
| 3 índices de idempotencia | `ux_tpl_document_snapshot_batch`, `ux_tpl_asset_invitation_sha`, `ux_tpl_asset_version_sha`, los tres `UNIQUE` parciales |
| `public_token VARCHAR(30)` con `CHECK` | `character varying(30)` + `CHECK (~ '^pub_[0-9A-HJKMNP-TV-Z]{26}$')` |
| `doc_bytes CHECK ≤ 1 MiB` | `CHECK ((doc_bytes >= 0) AND (doc_bytes <= 1048576))` |
| un solo `is_active` por invitación | `ux_tpl_release_active_per_invitation ... WHERE is_active` |
| `package_hash` único por plantilla | `uq_tpl_template_version_hash (template_id, package_hash)` |
| única columna añadida a tabla existente | `invitation.uses_templates2` y **ninguna otra** (prueba nueva, §4) |

Tipos prohibidos de `02 §8.3`: consulta a `information_schema` sobre las 8 tablas → **0 filas** con `ARRAY`,
`USER-DEFINED`, `json`, `money`, `hstore` o `timestamp without time zone`. Los tipos realmente usados son
`bigint, boolean, character, character varying, integer, jsonb, smallint, timestamp with time zone`.

### 1.3 Mapeo JSONB y dependencias
`[V]` `@JdbcTypeCode(SqlTypes.JSON)` sobre `JsonNode` con `columnDefinition = "jsonb"` en los 9 atributos JSON de
las entidades, exactamente como `02 §8.2`. `[V]` `build.gradle.kts` y `settings.gradle.kts` **no aparecen en el
diff**: cero dependencias nuevas, ni `hypersistence-utils` ni ningún `UserType`. `[V]` `Templates2JsonConfig`
(de 2-0b, no tocado) declara `templates2ObjectMapper` **sin `@Primary`**, y `JsonbRoundTripTest` afirma con
`assertSame` que el bean es el mismo singleton del módulo.

### 1.4 Consultas nativas, inyección SQL y bloqueo optimista
`[V]` Las 10 sentencias nativas y las 6 JPQL usan **exclusivamente parámetros con nombre**: `grep` de concatenación
de variables dentro de cadenas SQL en `templates2/persistence/*.kt` → **0 resultados**. `searchCatalog` no concatena
el literal JSON, lo construye con `jsonb_build_array(CAST(:eventKind AS text))`. **No hay superficie de inyección.**

`[V]` `applyRevision` implementa de verdad el bloqueo optimista: `UPDATE … SET revision = revision + 1 WHERE id = :id
AND revision = :expectedRevision`, y `TplDocumentRepositoryTest` prueba las dos ramas (1 fila / 0 filas → 409).
`[V]` `insertIfAbsent` es `ON CONFLICT (invitation_id) DO NOTHING` y la segunda llamada **no pisa el `public_token`**.
`[V]` `lockByInvitationId`/`lockBySlug` toman de verdad `FOR UPDATE` — comprobado con `EntityManager.getLockMode`,
que devuelve `PESSIMISTIC_WRITE` (aserción que **no existía**, ver O-21-05).

### 1.5 Aislamiento respecto al módulo antiguo
`[V]` `grep` sobre `templates2/**` de `require(`/`check(`/`error(`: **0 usos en código de producción** (solo dos
menciones en KDoc que citan la prohibición de `contratos.md §4`). `[V]` Cero importaciones de `InvitationEntity` o
de `modules.admin/user/shared`. `[V]` `invitation.uses_templates2` se toca **solo** desde `Templates2FlagRepository`
en `src/main` (los dos usos restantes son fixtures JDBC de `src/test`, que no pasan por JPA).

### 1.6 Alcance del diff — limpio
`git diff 98f3d18..HEAD --name-status`: 50 ficheros, **todos `A` (nuevos)** salvo `decisiones.md` y
`preguntas-abiertas.md`. Nada fuera de `db/migration/V29..V37`, `templates2/persistence/**`, `src/test/**` y la
memoria. **No se tocó** `templates2/domain/**` ni `templates2/schema/**` (bloque 0), ni `application.yml`, ni
`build.gradle.kts`, ni `settings.gradle.kts`, ni `scripts/pg-ephemeral.sh`, ni RSVP/invitados/auth/pagos/módulo
antiguo. **No hay motivo de rechazo por alcance.**

### 1.7 Las 536 pruebas existen y pasan
Reproducido desde cero con `TPL_TEST_STATE_DIR` propio:
```
$ ./gradlew cleanTest test --console=plain
BUILD SUCCESSFUL in 41s
total tests=536 failures=0 errors=0 skipped=0  clases=29
```
Cobertura JaCoCo del bundle filtrado a `templates2/**`: **INSTRUCTION 87,8 % · BRANCH 82,9 % · LINE 95,3 %**
(umbral BUNDLE ≥ 80 %, `06 §2`; `jacocoTestCoverageVerification` en verde). Ver O-21-09 sobre la etiqueta.

---

## 2. Prueba de sabotaje de `ddl-auto: validate` — **no es un placebo**

El bloque afirma que `DdlValidateTest` detecta desajustes reales. Se comprobó rompiendo el mapeo a propósito,
corriendo la prueba y **restaurando** (árbol limpio verificado con `git status` tras cada paso).

**Sabotaje A — se elimina `@JdbcTypeCode(SqlTypes.CHAR)` de `TplAssetEntity.sha256`.** Resultado: **FALLA.**
```
DdlValidateTest > el contexto arranca y las 9 migraciones ya se aplicaron (ddl-auto validate en verde)() FAILED
Caused by: org.hibernate.tool.schema.spi.SchemaManagementException: Schema-validation:
wrong column type encountered in column [sha256] in table [tpl_asset];
found [bpchar (Types#CHAR)], but expecting [char(64) (Types#VARCHAR)]
```
Reproduce **literalmente** el mensaje que cita ADR-2-1-03: el hallazgo del bloque es real, no una racionalización.

**Sabotaje B — se renombra `@Column(name = "doc_bytes")` a `"doc_bytes_ROTO"` en `TplDocumentEntity`.** Resultado: **FALLA.**
```
Caused by: org.hibernate.tool.schema.spi.SchemaManagementException:
Schema-validation: missing column [doc_bytes_ROTO] in table [tpl_document]
```

**Sabotaje C — se cambia `nullable = false` a `nullable = true` sobre `doc_bytes` (columna `NOT NULL`).**
Resultado: **PASA en verde.**
```
> Task :test
BUILD SUCCESSFUL in 36s
```
**Conclusión:** la red de seguridad es real para *columna ausente* y *tipo JDBC incompatible*, pero **no cubre la
nulabilidad** — Hibernate no compara `is_nullable` bajo `validate`. El KDoc de `DdlValidateTest` afirmaba lo
contrario; corregido (O-21-06).

---

## 3. `UlidGenerator` — correcto salvo un punto de seguridad heredado del diseño

Pruebas adversariales propias (fichero temporal, ejecutado y después borrado):

```
REV: caracteres distintos observados = 32; prohibidos = []          -> Crockford exacto, sin I/L/O/U
REV: ts original=1767000000123  ts decodificado=1767000000123       -> los 48 bits de tiempo van y vuelven
REV: generados=80000 unicos=80000                                   -> 16 hilos x 5000, CERO colisiones
REV: a=01KDMPGHG0RJYN4TZCRZQRZQYK  b=01KDMPGHG0RJYN4TZCRZQRZQYM  delta=1
```

`[V]` Alfabeto Crockford correcto (32 símbolos, sin `I`/`L`/`O`/`U`), casa con los `CHECK` `[0-9A-HJKMNP-TV-Z]{26}`
de `tpl_asset.public_id` y `tpl_document.public_token`. `[V]` Seguro bajo concurrencia: `synchronized` sobre todo
`next()`, 80 000 ULID en 16 hilos sin una sola colisión. `[V]` Monótono, y un reloj que retrocede no produce un ULID
menor. `[V]` El desbordamiento de los 80 bits dentro de un ms avanza el reloj lógico en vez de repetir.

**Pero** (última línea): dentro del mismo milisegundo el sucesor es **exactamente el anterior + 1**. Es la
monotonía que `02 §7.4` exige literalmente, y es lo que dice la spec de ULID — pero convierte `public_token`, que
es una **URL-capacidad sin autenticación** (`03 §7`), en adivinable a partir de un token vecino. Ver O-21-02.

---

## 4. Objeciones

| ID | Gravedad | Objeción | Evidencia | Remedio | Estado |
|---|---|---|---|---|---|
| **O-21-01** | **ALTA (de fase, no del bloque)** | `InvitationGuestEntity` mapea `graduates_name`, columna que **ninguna** migración crea. Con `ddl-auto: validate` tumba **cualquier** contexto Spring que escanee las entidades del módulo antiguo. Bloquea al bloque **2-5** si intenta `@SpringBootTest`+MockMvc sin acotar | Reproducido dos veces: `Schema-validation: missing column [graduates_name] in table [invitation_guest]`. `InvitationGuestEntity.kt:28`; `grep graduates` sobre `db/migration/*.sql` → 0; `information_schema` de un clúster con `V1`-`V37`: la columna **no existe**. **Y lo decisivo:** con un solo `ALTER TABLE invitation_guest ADD COLUMN graduates_name varchar(255)` un `@DataJpaTest` **sin acotar** (todas las entidades y repositorios de la aplicación, incluido `InvitationFlagRow`) **arranca limpio** → es el **único** desajuste esquema/entidad de todo el proyecto | Una migración de una línea (`ADD COLUMN IF NOT EXISTS`, por si producción ya la tiene fuera de Flyway). **No puede ser `V38`/`V39`** (reservadas, `contratos.md §5`): el orquestador debe asignar número y dueño — no es competencia de `templates2` | **abierta — decisión del orquestador** |
| **O-21-02** | MEDIA | La monotonía del ULID hace que dos `public_token` acuñados en el mismo milisegundo difieran en **exactamente 1**. `contratos.md §5` afirma "entropía imprevisible de 80 bits"; eso solo vale para el primer ULID de cada ms. Quien posea un token puede enumerar ±N y encontrar al vecino | `delta=1` medido (§3). `02 §7.4` exige "monótono" y "la única fuente de `assetId`, `itemId` y `public_token`" — el bloque implementó el contrato al pie de la letra: **el defecto es del diseño, no del bloque** | Sortear los 80 bits **de nuevo** para `public_token` (no incrementar), conservando la monotonía donde el orden sí importa (`itemId`). Exige ADR y enmienda de `02 §7.4` + `contratos.md §5` | **abierta — no la toco: es cambio de diseño** |
| **O-21-03** | MEDIA | Dos de los `CHECK` que `contratos.md §5` nombra **explícitamente** como innegociables no tenían **ninguna** prueba: `ck_tpl_document_public_token` y `ck_tpl_document_doc_bytes` (esta última cierra la objeción **B-05, severidad ALTA** de la ronda 1R). Tampoco `ck_tpl_asset_owner` ni `ck_tpl_release_unpublished`. `HashCheckConstraintsTest` solo cubre `package_hash` | `grep` de `doc_bytes`/`1048576`/`ck_tpl_document_public_token`/`ck_tpl_asset_owner` en `src/test/**` → 0 resultados | **CORREGIDO:** `SchemaCheckConstraintsTest.kt` nuevo — 5 pruebas que ejercen el **borde exacto** (1 048 576 pasa, 1 048 577 viola), los 5 tokens inválidos incluidos `I`/`U` (fuera de Crockford), el dueño doble y el dueño ausente, el release activo con `unpublished_at`, y que **solo** `invitation.uses_templates2` vive fuera de las tablas `tpl_*` | **cerrada** |
| **O-21-04** | MEDIA | **16 de los métodos de repositorio no tenían ninguna prueba directa**, entre ellos `existsOwned` (la comprobación de pertenencia de **ADR-030**, es decir un control de **autorización**) y `findActiveByPublicToken` (la consulta del **render público**). Ambos son JPQL escrito a mano; Spring Data solo valida al arrancar que *parsean*. `existsOwned` recibe además **dos parámetros nulables**, patrón que en PostgreSQL puede reventar con "could not determine data type of parameter" | Barrido de los 24 métodos públicos contra `src/test/**`. La bitácora del bloque §5 lo reconoce como "cobertura indirecta" pero no nombra `existsOwned` ni `findActiveByPublicToken` | **CORREGIDO:** `TplAssetRepositoryTest.kt` (6), `TplReleaseRepositoryTest.kt` (4), `TplDocumentSnapshotRepositoryTest.kt` (3) nuevos + 2 pruebas en `TplTemplateVersionRepositoryTest`. Verificado que `existsOwned` **niega** un asset de otra invitación, que el caso "los dos parámetros nulos" no lanza, que `findActiveByPublicToken` no cruza invitaciones ni sirve un release despublicado, que `findLatestPublished` ordena por `(major,minor,patch)` y no por la cadena (`1.10.0` antes que `1.9.0`), y que `findByDocumentIdAndClientBatchId` (objeción **B-03**, ALTA de la ronda 1R) resuelve el lote reenviado | **cerrada** |
| **O-21-05** | BAJA | Las pruebas de `lockByInvitationId`/`lockBySlug` solo comprobaban que devuelven la fila — **nada verificaba que se emitiera `FOR UPDATE`**, que es lo único que `02 §11.2`/`§11.4` piden de esos métodos | `TplDocumentRepositoryTest`/`TplTemplateRepositoryTest` originales, sin aserción de bloqueo | **CORREGIDO:** aserción `entityManager.getLockMode(fila) == PESSIMISTIC_WRITE` en ambas, más el caso "sin documento → null". Pasan: el bloqueo es real | **cerrada** |
| **O-21-06** | BAJA | El KDoc de `DdlValidateTest` afirmaba que un `nullable` que no coincide tumbaría el contexto. **Es falso** (sabotaje C) | §2 de esta bitácora | **CORREGIDO:** KDoc reescrito con el alcance medido de `validate` y la advertencia de que la nulabilidad hay que cubrirla aparte | **cerrada** |
| **O-21-07** | BAJA | `handoffs/2-1.md` publica como "firma exacta que vais a llamar" `TplReleaseRepository.findActiveByInvitationId`, **que no existe**: el método se llama `findByInvitationIdAndIsActiveTrue` | `TplReleaseRepository.kt:61` | **CORREGIDO** en el handoff | **cerrada** |
| **O-21-08** | BAJA | Ningún repositorio declara `@Transactional`; llamar a cualquiera de los 8 métodos `@Modifying` fuera de transacción lanza `InvalidDataAccessApiUsageException`. El handoff no lo advertía y 2-2/2-3 los van a llamar | Ausencia de `@Transactional` en los 9 repositorios | **CORREGIDO:** párrafo añadido al handoff nombrando los 8 métodos | **cerrada** |
| **O-21-09** | BAJA | La bitácora del bloque §3 llama "87 % **líneas** — 2 324 líneas sin cubrir de 18 839" a lo que en realidad es el contador **INSTRUCTION** de JaCoCo. La cobertura de líneas real es **95,3 %** (1 884/1 977) | `build/reports/jacoco/test/jacocoTestReport.xml` | Corregir la etiqueta al consolidar; no afecta al umbral (BUNDLE ≥ 80 % se cumple con cualquiera de los dos contadores) | abierta (documental) |
| **O-21-10** | BAJA | La bitácora §4 cita el fallo histórico como `expecting [varchar(64) (Types#VARCHAR)]` mientras ADR-2-1-03 lo cita como `char(64)`. Mi reproducción da **`char(64)`** (la variante de la ADR): las dos son mensajes reales de Hibernate según si `columnDefinition` estaba presente, pero solo una corresponde al sabotaje que la bitácora describe | §2, sabotaje A | Unificar la cita al consolidar. No cambia ninguna conclusión | abierta (documental) |
| **O-21-11** | BAJA | En `tpl_asset_gc`, el `CHECK (attempts >= 0)` se llama `uq_tpl_asset_gc_key` — nombre de índice único para una restricción de comprobación, y **no existe** ninguna unicidad sobre `(bucket, s3_key)` pese al nombre | `pg_constraint`: `tpl_asset_gc | uq_tpl_asset_gc_key | CHECK ((attempts >= 0))`. Es **transcripción fiel** de `02 §2` V37, que arrastra el error de copia | Corregir el nombre en `02 §2` y en una migración futura. Ojo: una unicidad real sobre `(bucket, s3_key)` sería **incorrecta** — la misma clave puede reencolarse legítimamente. Solo es el nombre | abierta (defecto del diseño, no del bloque) |
| **O-21-12** | BAJA | `contratos.md §5` dice categóricamente "`ON DELETE RESTRICT` hacia `tpl_template_version`", pero `tpl_template_registration.template_version_id` es **`SET NULL`** | `pg_constraint` (§1.2). Es lo que fija `02 §2` V35 literalmente, y es lo correcto (la auditoría debe sobrevivir al borrado de la versión): el bloque transcribió bien | Enmendar la redacción de `contratos.md §5` para exceptuar la tabla de auditoría | abierta (precisión de `contratos.md`) |
| **O-21-13** | BAJA | `BusinessSnapshotReader.mapEventKind` empareja por **subcadena** (`normalizado.contains(clave)`): un `event_type.name` como "Bodas de plata" contiene "boda" y mapearía a `WEDDING` | `BusinessSnapshotReader.kt:84` | Igualdad exacta sobre el nombre normalizado con lista explícita de alias. Impacto real acotado: `eventKind` solo filtra el catálogo que ve el cliente | abierta (enmienda a ADR-2-1-04) |
| **O-21-14** | BAJA | `BusinessSnapshotReader.read()` devuelve `null` tanto si la invitación **no existe** como si su catálogo antiguo está incompleto (los tres `JOIN` son `INNER`). Quien llama no puede distinguir 404 de "dato roto" | `BusinessSnapshotReader.kt:43-48`; documentado en su KDoc, pero sin señal distinguible | Que 2-2/2-4 decidan si necesitan separar los dos casos (`LEFT JOIN` + campo de diagnóstico). No lo cambio: es decisión de la capa de servicio | abierta |
| **O-21-15** | BAJA | `rotatePublicToken` no toca `updated_at` (es nativa, `@UpdateTimestamp` no interviene): revocar un enlace filtrado no deja rastro en la fila | `TplDocumentRepository.kt:81` | Añadir `updated_at = now(), updated_by = :userId` cuando 2-3 escriba `DocumentStore`, o registrar la rotación en `tpl_document_snapshot` | abierta |

**Ninguna objeción ALTA imputable al bloque 2-1.** La única ALTA (O-21-01) es un defecto **preexistente y ajeno**
que el bloque detectó correctamente, documentó y sorteó sin tocar el módulo antiguo — lo que el brief le pedía.

---

## 5. Qué corregí y con qué resultado

Correcciones aplicadas (pequeñas, locales y objetivas; ninguna de diseño):

1. `src/test/.../SchemaCheckConstraintsTest.kt` **(nuevo, 5 pruebas)** — O-21-03.
2. `src/test/.../TplAssetRepositoryTest.kt` **(nuevo, 6 pruebas)** — O-21-04, incluida la negación de pertenencia de ADR-030.
3. `src/test/.../TplReleaseRepositoryTest.kt` **(nuevo, 4 pruebas)** — O-21-04, incluido el render público por token.
4. `src/test/.../TplDocumentSnapshotRepositoryTest.kt` **(nuevo, 3 pruebas)** — O-21-04, idempotencia B-03 por la vía Spring Data.
5. `TplTemplateVersionRepositoryTest.kt` **(+2 pruebas)** — claves de idempotencia del registro y orden semántico de `findLatestPublished`.
6. `TplDocumentRepositoryTest.kt` / `TplTemplateRepositoryTest.kt` — aserción real del `PESSIMISTIC_WRITE` (+1 prueba de borde) — O-21-05.
7. `DdlValidateTest.kt` — KDoc con el alcance medido de `ddl-auto: validate` — O-21-06.
8. `handoffs/2-1.md` — firma corregida y aviso de `@Transactional` — O-21-07, O-21-08.

**No se tocó** ni una línea de `src/main`, ni una migración, ni el DDL, ni ninguna ADR.

Salida real tras las correcciones (clúster propio, desde cero):
```
$ TPL_TEST_STATE_DIR=/tmp/templates2-pg-rev21d ./gradlew clean test check --console=plain
> Task :verifyJsonSchemaEmitted
> Task :test
> Task :jacocoTestReport
> Task :jacocoTestCoverageVerification
> Task :check
BUILD SUCCESSFUL in 1m 42s
10 actionable tasks: 10 executed

total tests 557   skipped 0   failures/errors 0   clases 33
  INSTRUCTION  87.8%
  BRANCH       82.9%
  LINE         95.3%
```
(536 del bloque + 21 de esta revisión.)

---

## 6. Recomendación por ADR

| ADR | Recomendación | Motivo |
|---|---|---|
| **ADR-2-1-01** — `PgTestCluster` en Kotlin sobre `pg-ephemeral.sh`, crea el rol `evolution` | **ACEPTAR** | Verificado: `./gradlew test` arranca el clúster, aplica `V1`-`V37` y lo para, sin ningún paso manual. Coherente con `06 §6`/`contratos.md §6` (`TPL_TEST_JDBC_URL` sigue siendo el contrato y tiene prioridad). No contradice nada |
| **ADR-2-1-02** — `SpringPersistenceTestSupport` acota el slice a `templates2.persistence` | **ACEPTAR CON ENMIENDA** | La decisión es correcta y estaba forzada (el bloque no podía tocar el módulo antiguo). La enmienda es de redacción: debe decir explícitamente que **acotar oculta O-21-01 a CI**, y que la ampliación a un `@EntityScan` sin acotar queda **condicionada** a la migración de `graduates_name`. Sin esa nota, el bloque 2-5 puede creer que el patrón escala a un contexto completo, y no escala |
| **ADR-2-1-03** — `@JdbcTypeCode(SqlTypes.CHAR)` en `tpl_asset.sha256` | **ACEPTAR** | Reproducido con sabotaje: sin la anotación, `validate` falla con el mensaje exacto que la ADR cita. `grep CHAR(` en el DDL da 1 columna y `@JdbcTypeCode(SqlTypes.CHAR)` da 1 atributo: cuadran |
| **ADR-2-1-04** — mapeo `eventKind`/`planTier` conservador | **ACEPTAR CON ENMIENDA** | El supuesto **es** el conservador: `GENERIC` es un valor de dominio legítimo, no un descarte silencioso, y `planTier` binario no inventa un tercer plan. La enmienda es O-21-13: el emparejamiento por subcadena puede clasificar "Bodas de plata" como `WEDDING`; debe ser igualdad exacta sobre el nombre normalizado con alias explícitos. La pregunta abierta (¿tabla en base de datos?) sigue siendo del dueño de producto |
| **ADR-2-1-05** — `InvitationFlagRow` + `Repository<>` sin CRUD genérico | **ACEPTAR** | Es más estricta que lo que `contratos.md §5` exige y elimina la clase de fallo que ADR-1R-B-08 teme (un `save()` accidental que pise 20 columnas). **Verificado además el riesgo que la ADR no menciona:** dos `@Entity` sobre la misma tabla `invitation` (`InvitationEntity` del módulo antiguo + `InvitationFlagRow`) **coexisten sin problema** en un contexto con escaneo completo — probado durante esta revisión |
| **ADR-2-1-06** — `clearAutomatically = true` en los 8 `@Modifying` | **ACEPTAR** | Correcta y con la consecuencia (desprender entidades no relacionadas) explicitada. Ningún caso de uso de `02`/`03` la sufre. Complementarla con el aviso de `@Transactional` que añadí al handoff (O-21-08) |

Ninguna de las 6 ADR contradice `contratos.md`.

---

## 7. Veredicto

### **INTEGRABLE CON RESERVAS**

El bloque 2-1 entrega lo que se le pidió y lo entrega **bien**: el DDL es transcripción literal del diseño ya
revisado, el esquema real cumple los trece puntos innegociables de `contratos.md §5`, el mapeo JSONB es el de
`02 §8.2` sin una sola dependencia nueva, no hay superficie de inyección SQL, el bloqueo optimista y el `FOR UPDATE`
funcionan de verdad, `ddl-auto: validate` es una red de seguridad real (probado rompiéndola), el ULID es
criptográficamente sólido y seguro bajo concurrencia, y el diff **no toca nada** fuera de su alcance. Las 536
pruebas existen, pasan y prueban cosas reales.

Las dos reservas **no son del bloque**:

1. **O-21-01 (ALTA, de fase).** `InvitationGuestEntity.graduates_name` sin migración bloquea hoy cualquier contexto
   Spring sin acotar. **El bloque 2-5 no podrá escribir `@SpringBootTest`+MockMvc contra el contexto completo hasta
   que se cree esa columna.** Está medido que es el **único** desajuste del proyecto: una migración de una línea lo
   desbloquea todo. El orquestador debe asignarle número (no `V38`/`V39`) y dueño **antes** de que arranque 2-5.
2. **O-21-02 (MEDIA).** La monotonía del ULID hace adivinable el `public_token` acuñado en el mismo milisegundo que
   otro conocido. El bloque implementó exactamente lo que `02 §7.4` exige; **la corrección es de diseño** y necesita
   ADR antes de que 2-3/2-4 empiecen a emitir tokens en producción.

Las objeciones MEDIA imputables al bloque (O-21-03 y O-21-04 — pruebas ausentes sobre `CHECK` innegociables y sobre
la comprobación de autorización de ADR-030) **quedan cerradas en esta misma revisión**: 21 pruebas nuevas, 557 en
total, 0 fallos, `check` en verde.

Con esas dos reservas escaladas al orquestador, **el bloque 2-1 puede fusionarse a la rama de la fase.**
