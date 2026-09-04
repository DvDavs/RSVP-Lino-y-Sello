# Bitácora 2-ADV — revisión adversarial global de cierre de la fase 2

Fecha: 2026-09-04 · Rama: `claude/fase-2-backend-orchestration-ksyuzi` · Base: `b242453` · Revisor: 2-ADV (Opus).
Sin push, sin cambio de rama. Clúster propio: `TPL_TEST_STATE_DIR=/tmp/templates2-pg-adv`.

Marcas: **[V]** verificado ejecutándolo aquí · **[I]** inferido · **[ND]** no determinable.

---

## 0. Veredicto

### **CERRABLE CON RESERVAS** — cuatro, todas de decisión del orquestador, ninguna de reescritura de bloque.

Lo entregado es sólido y, en lo que afirma, es cierto: las 19 rutas existen y ninguna de las 13 de
invitación se salta `HierarchyValidationService`; H-13, H-14, H-45 y H-48 están muertos en el módulo
nuevo y lo comprobé atacándolos, no leyéndolos; el render público no compone nada, no escribe nada y
respeta las tres banderas; `public_token` es azar criptográfico fresco de verdad tras ADR-2-ORQ-01,
también al rotar; el MIME de los assets se verifica por **bytes mágicos**, no por la cabecera; el
límite de cuerpo resiste `Transfer-Encoding: chunked` y un `Content-Length` mentiroso porque la
lectura vuelve a contar; y la búsqueda mecánica de presentación en el backend da **0**.

Encontré **un defecto vivo de integración de gravedad ALTA** —cuatro sitios que resuelven el bucket de
S3 y no coinciden, invisible para las 1 100 pruebas porque todas inyectan el bucket— que **corregí**
aquí, y tres reservas que no puedo cerrar yo:

1. **ADV-02** — `POST {frontend}/api/revalidate` (ADR-1R-F-09): `contratos.md §8` lo declara
   literalmente **"Tarea nueva para la fase 2"** y ningún bloque lo implementó. 2-4 lo dejó a 2-5 y
   2-5 lo listó como "sin implementar". Es un hueco *entre* bloques sobre una cláusula del contrato.
2. **ADV-03** — **43 de las 45 ADR de la fase 2 siguen en estado "propuesta"**, y varias de ellas
   enmiendan `contratos.md`/`03`/`02` en cláusulas que el código ya implementa según la enmienda.
   Mientras no se acepten y se enmiende `contratos.md`, contrato y código discrepan por escrito.
3. **ADV-04** — `invitation_guest.graduates_name` (ajena y preexistente, ADR-2-ORQ-02): **ningún
   entorno nuevo levanta la aplicación completa**, así que las 19 rutas **nunca han respondido sobre
   un Tomcat real**. La fase se cierra sin esa evidencia.

Con esas cuatro decisiones tomadas, la fase es cerrable. Sin ellas, se cierra sabiendo que el módulo
no arranca en un entorno nuevo y que una cláusula del contrato queda sin implementar.

---

## 1. Tabla de objeciones

| id | grav. | objeción | evidencia | remedio | estado |
|---|---|---|---|---|---|
| **ADV-01** | **ALTA** | **Cuatro puntos del módulo resuelven el bucket de S3 por defecto y no coinciden.** `catalog` (2-3) usaba `S3Buckets.ASSETS` = `"invitacionesdigitalesassets"`; `api` (2-4 y 2-5) un literal propio, `"invitaciones-assets"`. `templates2.assets.bucket` **no existe en `application.yml`** y no puede existir (`contratos.md §4`: la única modificación permitida es `spring.servlet.multipart`), así que **el valor de producción es siempre el defecto**. Consecuencias con la configuración real: el editor sube todo asset de cliente a un bucket que no existe en la cuenta (→ `502` en **cada** subida), y la URL de **todo** asset de plantilla dentro del `composed` —el que se congela en `tpl_release` y sirve el render público— apunta a un bucket distinto de aquel donde el registro los subió. `02 §10.1` paso 8 nombra literalmente `S3Service.uploadPublicFile(S3Buckets.ASSETS, …)`: no es opinable. **Ninguna de las 1 100 pruebas lo veía porque todas inyectan `bucket-de-pruebas`** | `EditorAssetService.kt:299` y `EditorDocumentService.kt:87` (versión `b242453`) vs `TemplateRegistrationService.kt:47` y `TemplateCatalogService.kt:86`; `core/s3/S3Buckets.kt:5`; `grep -rn "templates2.assets" src/main/resources/application.yml` → 0; `RegistroTestConfig.kt:110` y `EditorTestSupport.kt:126` (`bucket-de-pruebas`); `02 §10.1` paso 8 | Un solo defecto para los cuatro | **CORREGIDA** (§3.1) |
| **ADV-02** | **ALTA** | **`POST {frontend}/api/revalidate` tras publicar no está implementado**, y `contratos.md §8` lo declara "**Tarea nueva para la fase 2**" (ADR-1R-F-09). Hueco *entre* bloques: `handoffs/2-4.md` lo pasa a 2-5 ("el punto exacto es el final de `ReleaseService.publish`, **después** del commit") y `handoffs/2-5.md` lo lista en "Sin implementar" | `grep -rn "revalidate" src/main/kotlin` → solo `Cache-Control: …stale-while-revalidate` en `PublicRenderController.kt:37,39,80`; `grep -rn "TransactionalEventListener\|AFTER_COMMIT" src/main/kotlin` → 0 resultados [V] | O lo escribe un bloque de cierre (`@TransactionalEventListener(AFTER_COMMIT)` en `ReleaseService.publish`, token en propiedad, fallo que no tumba la publicación), o se enmienda `contratos.md §8` por ADR pasándolo a la fase 3. **Decisión del orquestador** | abierta |
| **ADV-03** | **ALTA** | **43 de las 45 ADR de la fase 2 están en estado "propuesta"** (solo las dos `ADR-2-ORQ-*` aceptadas). Varias no son detalles: ADR-2-5-04 cambia la lista de tipos aceptados frente a `03 §3.7`; ADR-2-4-02 quita el `409` que `03 §3.3` enumera; ADR-2-3-01 declara `02 §7.5` no implementable; ADR-2-5-02 añade cinco handlers a la "lista cerrada" de `03 §10.3`; ADR-2-3-05 decide que el catálogo enseña plantillas fuera del plan. El código ya está escrito según esas enmiendas | `awk` sobre `decisiones.md`: `2 aceptada`, `43 propuesta` [V] | Aceptar/rechazar las 43 y enmendar `contratos.md` §3/§4/§5/§6 en consecuencia, antes de declarar la fase cerrada. **Solo el orquestador edita `contratos.md`** | abierta |
| **ADV-04** | **ALTA (de fase, ajena)** | `InvitationGuestEntity` mapea `graduates_name`, que ninguna migración crea, y `ddl-auto: validate` tumba cualquier contexto Spring sin acotar. Consecuencia que hay que decir con todas las letras al cerrar: **ningún entorno nuevo arranca la aplicación**, y por tanto **nadie ha visto las 19 rutas responder sobre Tomcat real** — ni en local ni en el job `backend` del CI, que solo corre `test` sobre contextos acotados | O-21-01 de `2-1-REV`; ADR-2-ORQ-02; `preguntas-abiertas.md`, última entrada de 2-5 | No es de `templates2` (invitados es área prohibida). El orquestador asigna número de migración (no `V38`/`V39`) y dueño. **No la toco** | abierta (ajena) |
| **ADV-05** | MEDIA | **`MagicBytes` llegaba al cierre con tres de sus seis ramas a cobertura 0**: las de `IMAGE_SVG`, `AUDIO_MPEG` y `FONT_WOFF2`, y con ellas los cuerpos completos de `esSvg` y `esMp3`. `audio/mpeg` **está** en `EditorAssetService.TIPOS_ACEPTADOS`: era la puerta de entrada de un archivo de cliente, y es un control de seguridad (`02 §10.1` paso 4), sin una sola prueba detrás. La cobertura llegaba de rebote desde el registro de paquetes, que solo usa WebP y PNG | JaCoCo del cierre, `MagicBytes.kt`: `15(2/6)`, `44(0/6)`, `49(0/2)`, `50(0/2)`, `53(0/4)` [V]. `grep -rn "audio/mpeg" src/test` → solo fixtures del paquete y `ImageDimensionsTest` | 17 pruebas nuevas, incluidas las cruzadas "la firma de un tipo no vale para otro" | **CORREGIDA** (§3.2) |
| **ADV-06** | MEDIA | **El fallo de S3 *ajeno al módulo* en el registro de plantillas no estaba probado.** La prueba existente fuerza el fallo con `AssetStorageUnavailableException`, que es una `TemplateRegistryException` y la atrapa el **primer** `catch`; el fallo realista (un `SdkException`, un socket cortado) cae en `catch (e: Exception)`, la rama que traduce a `502` **y** deja la fila de auditoría. Sin ella, un corte de red habría salido como `500 TPL_INTERNAL` sin rastro del intento (P1). Es la ruta de alta de contenido | JaCoCo: `TemplateRegistrationService.kt:71` → `0/2` (la línea no se ejecutó nunca) [V]; `RegistroTestSupport.kt:41` (`AlmacenFalso` lanza la excepción tipada) | 2 pruebas nuevas: con mensaje y sin mensaje (las dos ramas del `?:`) | **CORREGIDA** (§3.3) |
| **ADV-07** | MEDIA | **Compuerta de "0 huecos" (`06 §4.1`) que declaraba huecos inexistentes y no podía ponerse en rojo.** Los tres `it.todo` de `invariant-gaps.contract.test.ts` se dejaron "hasta que 2-0b escriba `operations-reducer.ts`". El reductor existe desde 2-2 y dos de las tres restricciones ya tenían caso golden, pero los tres `todo` seguían ahí: la compuerta habría seguido diciendo `todo` —no rojo— si alguien retirase esas comprobaciones del reductor. Y **`audio.maxBytes` sí era un hueco real**: `contratos.md §6` exige que "las tres restricciones de asset se prueban como casos del reductor" y solo había dos | `test/invariant-gaps.contract.test.ts:63-69`; `golden/operations/setBlock.cases.json` (11 casos, ninguno de audio) vs `src/operations-reducer.ts:108` (`audio.maxBytes` implementado) [V] | Caso golden de `audio.maxBytes` añadido al generador y los tres `todo` sustituidos por pruebas que ejecutan el reductor real | **CORREGIDA** (§3.4) |
| **ADV-08** | MEDIA | **`templates2.retention.enabled=false` apaga también el recolector de assets de S3.** `Templates2SchedulingConfig` (2-4) es el único `@EnableScheduling` del repositorio y está condicionado a una propiedad cuyo nombre solo habla de la purga de snapshots; 2-5 añadió después un segundo `@Scheduled`, `AssetGcJob`, que es el mecanismo del **derecho al olvido** (`02 §5.3`, `§10.3`). Apagar la retención deja de drenar `tpl_asset_gc` en silencio. El KDoc además seguía afirmando que `SnapshotRetentionJob` es "el **único** `@Scheduled` del repositorio", que dejó de ser cierto con el merge de 2-5 | `SnapshotRetentionJob.kt:91-94` vs `AssetGcJob.kt:69`; `grep -rn "@Scheduled" src/main/kotlin` → 2 resultados, los dos en `templates2` [V] | KDoc corregido aquí. El remedio real —propiedad neutra del planificador + una por tarea— cambia el contrato de configuración y necesita ADR | KDoc **CORREGIDO**; remedio abierto |
| **ADV-09** | MEDIA | **`image.aspect` queda sin validador para todo documento que referencie un asset de plantilla.** 2-5 vio el problema y lo resolvió para los assets de invitación (`ImageDimensions`, con un KDoc que cita `contratos.md §3`, "cero restricciones del esquema sin validador"); 2-3 dejó los de plantilla con `width`/`height` a `NULL` (ADR-2-3-07). El reductor, por diseño, **no comprueba nada si faltan las dimensiones**, así que un `setBlock` con un `assetId` de plantilla pasa `aspect` siempre | `TemplateRegistrar.kt` (`grep -n "width\|height"` → 0 resultados) [V]; `OperationReducer.kt:376-388`; `EditorAssetService.kt:322-331` (el KDoc que lo declara imprescindible) | Mover `ImageDimensions` a un paquete que `catalog` pueda usar y llamarlo en `TemplateRegistrationService.subirAssets`, o añadir `width`/`height` opcionales a `AssetEntry` (ya está como pregunta abierta de 2-3). Es refactor entre paquetes: **no lo toco** | abierta |
| **ADV-10** | MEDIA | **`AssetUrlResolver.url` ignora `StoredAsset.bucket`.** El campo se carga desde `tpl_asset.bucket`, se transporta y no se usa: la URL se construye siempre desde un único `publicBaseUrl` global. Es la raíz que hizo posible ADV-01, y significa que una fila de `tpl_asset` con un `bucket` distinto del configurado produce una URL rota **en silencio** — justo lo que P1 prohíbe | `AssetUrlResolver.kt:32-33` (`publicBaseUrl.trimEnd('/') + "/" + asset.s3Key`), `StoredAsset` declara `bucket` y nunca se lee [V] | O se quita `bucket` de `StoredAsset` (y se documenta que el módulo asume un bucket único), o `url()` lo usa. Cambia una firma pública de `composition`: **no lo toco** | abierta |
| **ADV-11** | BAJA | `TemplateRegisterCommand` prometía en su KDoc terminar "con código 0 (alta o no-op) o 1 (rechazo), para que un script de despliegue pueda encadenarlo". `run` captura el fallo con `runCatching` y **siempre** sale con 0: un despliegue que encadene por `$?` verá éxito en un rechazo | `TemplateRegisterCommand.kt:46-57` [V] | KDoc corregido aquí para que diga la verdad. Convertirlo en código 1 es cambio de comportamiento y necesita ADR | KDoc **CORREGIDO** |
| **ADV-12** | BAJA | `Templates2Exception.Internal` devuelve su mensaje **al cliente** en el `500`, y algunos llevan nombres de tabla e ids internos (`"tpl_document.id=… apunta a template_version_id=…, que no existe"`). El handler final de `Exception` sí es opaco ("error interno del servidor"): los dos caminos al mismo `500` no se comportan igual. No es fuga a un anónimo (la ruta exige autenticación y pertenencia) y `03 §5` solo exige "sin traza", así que no incumple el contrato | `Templates2ExceptionHandler.kt:80-82` vs `:308-318`; `EditorDocumentService.kt:757` | Mensaje fijo para `Internal` y diagnóstico solo al log, como ya hace el handler final | abierta |
| **ADV-13** | BAJA | `Violation.detail` divergía entre TypeScript (`≠`, U+2260) y Kotlin (`!=`) en I-15 desde el bloque 2-2 (objeción **O-11**, seguía abierta tras cinco merges) y ninguna prueba lo detecta porque `detail` no entra en ningún golden | `frontend/packages/schema/src/invariants.ts:183` vs `Invariants.kt:306-312` [V] | Igualadas en ASCII moviendo el lado de TypeScript (`templates2/schema` estaba congelado para quien lo encontró). **Sigue sin haber compuerta mecánica**: cerrarlo del todo exige llevar `detail` a los golden | **CORREGIDA** (sin compuerta) |
| **ADV-14** | BAJA | `testRuntimeOnly("com.h2database:h2")` sigue en `build.gradle.kts` pese a que `contratos.md §6` da H2 por descartado. **Ninguna prueba de `templates2` lo usa** —las de integración corren contra PostgreSQL real, verificado— pero la dependencia en el classpath de pruebas es la trampa exacta que hace posible que una futura se cuele con H2 sin que nadie lo note | `build.gradle.kts:90`; `git log -L 90,90` → viene del commit inicial, es **preexistente**; `grep -rIn "h2\|jdbc:h2" src/test` → 0 resultados [V] | Retirarla, o dejarla y añadir una prueba de arquitectura que falle si algún `@DataJpaTest` no apunta a `TPL_TEST_JDBC_URL`. Es del módulo antiguo: **no la toco** | abierta (ajena) |
| **ADV-15** | BAJA | **sha256-hex implementado dos veces**: `Templates2Json.sha256`/`hex` (2-0b, usado por el registro) y `EditorAssetService.sha256` (2-5, `MessageDigest` + `"%02x".format`). Verificado que hoy las dos producen minúsculas y casan `ck_tpl_asset_sha256`, así que no hay defecto vivo; es duplicación de integración | `Templates2Json.kt:53-58` vs `EditorAssetService.kt:266-267` [V] | Usar `Templates2Json.hex(Templates2Json.sha256(...))` también en `EditorAssetService` (es `internal`, mismo módulo) | abierta |
| **ADV-16** | BAJA | El job `backend` del CI corre `test jacocoTestReport jacocoTestCoverageVerification`, **no `check`**, así que `verifyJsonSchemaEmitted` —la compuerta de deriva del lado Kotlin, `contratos.md §5`— nunca se ejecuta en CI. La deriva sí la cubre el job `frontend` por otra vía (`schema:emit` + `git diff`), así que el riesgo real es bajo | `.github/workflows/ci.yml`, paso "Pruebas + cobertura"; `contratos.md §6` fija ese comando literal | Añadir `check` al job, o dejarlo y anotar que la compuerta vive en `frontend` | abierta |
| **ADV-17** | BAJA | `DateFormatting` es el **único** punto del backend que produce texto que un invitado lee: nombres de mes en español e inglés, `am`/`pm` y el guion largo del rango. Está **mandado por el contrato** (`01 §5.2` R6 prohíbe `java.time.format` porque ICU difiere entre JVM y Node y daría dos `contentHash` para el mismo documento), es espejo literal de `compose.ts` y no es presentación (no hay color, tamaño, icono ni tipografía). Se anota para que el recuento de la §2 sea honesto, no como incumplimiento | `DateFormatting.kt:17-19,57,77-78` [V] | Ninguno. Si algún día molesta, la salida tendría que llevar la fecha en ISO y formatearse en el cliente — y eso rompe el determinismo del `contentHash` | no es defecto |

---

## 2. Cero presentación en el backend (P3) — búsqueda mecánica

Alcance: `src/main/kotlin/**/templates2/**` (105 ficheros `.kt`). Comandos y **salida literal**:

```
$ T=src/main/kotlin/mx/evolutiondev/invitaciones/modules/templates2/

$ grep -rInE "#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?\b" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE "rgba?\(|hsla?\(" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE "[0-9](px|rem|em|vh|vw|pt|ch|ex)\b" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE "fontSize|font-size|lineHeight|line-height|letterSpacing|letter-spacing|fontWeight|font-weight|fontFamily|font-family" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE -i "\"(Playfair|Montserrat|Lato|Roboto|Georgia|Arial|Helvetica|Times|Inter|Poppins|serif|sans-serif|monospace|cursive)\"" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE "<div|<span|<p>|class=|style=|</|text/html|text/css|\.css|\bcss\b|@media" $T ; echo "EXIT=$?"
EXIT=1

$ grep -rInE "\bfa-|font-?awesome|material-icons|\bicon\b|Icono|iconName|lucide|heroicon" $T ; echo "EXIT=$?"
EXIT=1
```

**Colores, tamaños, tipografías, iconos, HTML y CSS: 0 en las siete búsquedas.** [V]

Las tres búsquedas que **sí** devuelven líneas y por qué ninguna es presentación:

```
$ grep -rInE "\b(red|green|blue|…|rojo|verde|azul|…|blanco|…)\b" $T
schema/JsonSchemaRegistry.kt:22:  * memoria y **nunca sale a la red** (dirimida X-11, contratos.md §5). …
schema/JsonSchemaRegistry.kt:65:  "preinstalados. Eso sería una descarga por red y contratos.md §5 lo prohíbe.",
schema/JsonSchemaRegistry.kt:103: /** Cuántas veces el validador pidió una IRI **no** preinstalada. … (prueba de red). */
schema/CanonicalJson.kt:14:      * 1. Sin espacios en blanco entre tokens.
persistence/DocumentStore.kt:43:  *    red de seguridad, no el mensaje de error. …
persistence/ReleaseStore.kt:19:   * … `ux_tpl_release_active_per_invitation` … es la red de
api/EditorAssetService.kt:44:     * … una espera de red mantendría abierta una conexión de la base.
api/Templates2ExceptionHandler.kt:284: * … Es la red de seguridad — las
EXIT=0
```
Las ocho son la palabra española **«red»** (network) y **«en blanco»** (whitespace), todas en KDoc.
Cero nombres de color.

```
$ grep -rInE "\bsvg\b" $T          (reducido a lo pertinente)
catalog/MagicBytes.kt:41,44        · comprobación del número mágico de `image/svg+xml`
persistence/Templates2S3KeyService.kt:34 · extensión de archivo por `contentType`
api/EditorAssetService.kt:307      · KDoc: por qué SVG se rechaza en la ruta del editor
domain/Catalogos.kt:85             · `IMAGE_SVG("image/svg+xml")` — tipo MIME del catálogo cerrado
```
Son **tipos MIME** y comprobación de bytes, no iconografía.

```
$ grep -rInE "\"(enero|febrero|…|diciembre)\"|\"(am|pm)\"|\"[^\"]*–[^\"]*\"" $T
composition/DateFormatting.kt:17,18  tablas de meses es-MX / es-ES
composition/DateFormatting.kt:57     "$h:$mm " + if (h24 < 12) "am" else "pm"
composition/DateFormatting.kt:77,78  "$cabeza – " (guion largo del rango)
EXIT=0
```
Único texto del backend que un invitado lee. **Mandado por `01 §5.2` R6** ("prohibido
`java.time.format` con locale del sistema": ICU difiere entre la JVM y Node y el mismo documento
daría dos `contentHash`), espejo literal de `compose.ts`. Objeción **ADV-17**, clasificada *no es
defecto*.

**Recuento final: 0 colores, 0 tamaños, 0 iconos, 0 tipografías, 0 HTML/CSS. 1 categoría de texto
visible (fechas), obligatoria por contrato y ya congelada en golden.**

Mensajes de error técnicos en español (99 literales con acentos, todos en `TplErrorResponse.message`,
en `details` o en el log) y comentarios/KDoc quedan fuera del recuento por la definición del encargo.

---

## 3. Qué corregí

Todas las correcciones son pequeñas, locales y objetivas. Ninguna reescribe un bloque, ninguna cambia
una firma pública, ninguna toca `contratos.md`, ninguna toca una ADR, ninguna toca una migración,
ninguna toca el módulo antiguo ni `application.yml`.

### 3.1 ADV-01 — el bucket por defecto (código de producción, 2 ficheros)

- `api/EditorAssetService.kt`: `BUCKET_POR_DEFECTO` pasa del literal `"invitaciones-assets"` a
  `S3Buckets.ASSETS`, que es lo que fija `02 §10.1` paso 8 y lo que ya usaban las dos clases de
  `catalog`.
- `api/EditorDocumentService.kt`: el defecto del bucket pasa a referenciar
  `EditorAssetService.BUCKET_POR_DEFECTO` en vez de repetir el literal, para que la subida y la URL
  compuesta no puedan volver a separarse.
- **Prueba nueva** `api/BucketPorDefectoTest.kt` (3 pruebas): la constante es `S3Buckets.ASSETS`;
  ningún fuente de `templates2` escribe un nombre de bucket a mano; y los **cuatro**
  `bucketConfigurado.ifBlank { … }` del módulo resuelven a un valor de la lista admisible. La prueba
  mira el árbol de fuentes porque el defecto se reintroduce escribiendo un literal nuevo, y eso no
  rompe ninguna prueba funcional.

### 3.2 ADV-05 — `MagicBytes` (prueba nueva)

`catalog/MagicBytesTest.kt`, 17 pruebas: los seis tipos reconocen su firma; **ningún tipo acepta la
firma de otro** (matriz 6×5); `audio/mpeg` con `ID3` y con cabecera de trama, y el rechazo de un byte
suelto, de `FF` sin los tres bits de sincronía y de un HTML renombrado; SVG con sus tres aperturas y
con espacios delante, y el rechazo de un `<svg>` más allá de los 512 bytes de cabecera; `woff2` frente
a `wOFF`; y los bordes de longitud de las tres funciones auxiliares.

### 3.3 ADV-06 — fallo de S3 ajeno en el registro (2 pruebas)

`catalog/TemplateRegistrarIntegrationTest.kt`: se construye el **mismo** `TemplateRegistrationService`
de producción con un `TemplateAssetStorage` que lanza una excepción ajena al módulo (no se toca
`AlmacenFalso`, del que dependen las pruebas ya existentes) y se comprueba el `502`, que el
diagnóstico ajeno no se pierde, que no queda nada en el catálogo y que **queda fila de auditoría**.
Segunda prueba con una excepción **sin mensaje**, para la otra rama del `?:`.

### 3.4 ADV-07 — la compuerta de "0 huecos" (frontend)

- `frontend/packages/schema/scripts/gen-golden-operations.ts`: dos assets de audio en el fixture
  (`ASSET_SONIDO` 40 KB, `ASSET_SONIDO_GRANDE` 900 KB, sin `width`/`height` porque un MP3 no las
  tiene y el lector Kotlin ya trata la ausencia como nula) y dos casos nuevos en `setBlock` — uno que
  excede `audio.maxBytes` y uno que no.
- `golden/operations/setBlock.cases.json` y `golden/fixtures/operations-base.json` regenerados con
  `pnpm run gen:golden` (**nunca a mano**, ADR-1R-D-09). `golden/operations/` pasa de 51 a 53 casos;
  los otros 10 ficheros y `json-schema/` **no cambian** [V].
- `test/invariant-gaps.contract.test.ts`: los tres `it.todo` sustituidos por tres pruebas reales que
  localizan el caso golden de cada restricción y **vuelven a ejecutar `applyOperation`** sobre el
  fixture emitido. La suite pasa de `453 passed | 3 todo` a **458 passed, 0 todo**.
- El caso nuevo lo ejecuta también `OperationReducerGoldenTest` de Kotlin sin tocarlo: la paridad
  TS↔Kotlin de `audio.maxBytes` queda comprobada en los dos lados.

### 3.5 ADV-13 — `Violation.detail` (un carácter)

`frontend/packages/schema/src/invariants.ts:183`: `≠` (U+2260) → `!=`, que es lo que emite
`Invariants.kt:310`. Se mueve el lado de TypeScript porque `templates2/schema` estaba congelado para
el bloque que encontró la divergencia. Verificado que `≠` no aparece en ningún golden ni en el bundle,
así que `gen:golden` y `schema:emit` siguen dando los mismos bytes [V].

### 3.6 ADV-08 y ADV-11 — dos KDoc que afirmaban algo falso

- `persistence/SnapshotRetentionJob.kt`: el KDoc decía que `SnapshotRetentionJob` es "el **único**
  `@Scheduled` del repositorio" — cierto cuando 2-4 lo escribió, falso desde el merge de 2-5. Ahora
  dice qué tareas gobierna la propiedad y **avisa de que apagarla apaga también el drenaje de
  `tpl_asset_gc`**, que es el derecho al olvido.
- `catalog/TemplateRegisterCommand.kt`: el KDoc prometía código de salida 1 en un rechazo; el código
  siempre sale con 0. Corregido, con el remedio y su condición (ADR) escritos al lado.

---

## 4. Verificación tras las correcciones

```
$ TPL_TEST_STATE_DIR=/tmp/templates2-pg-adv sh ./gradlew clean check --console=plain
> Task :clean
> Task :checkKotlinGradlePluginConfigurationErrors
> Task :processResources
> Task :processTestResources
> Task :verifyJsonSchemaEmitted
verifyJsonSchemaEmitted: 11 esquemas identicos a los versionados.
> Task :compileKotlin
> Task :compileJava NO-SOURCE
> Task :classes
> Task :compileTestKotlin
> Task :compileTestJava NO-SOURCE
> Task :testClasses
> Task :test
> Task :jacocoTestReport
> Task :jacocoTestCoverageVerification
> Task :check

BUILD SUCCESSFUL in 3m 43s
10 actionable tasks: 9 executed, 1 up-to-date
```

Recuento leído de `build/test-results/test/*.xml`:
```
clases=75 tests=1152 failures=0 errors=0 skipped=0
```

**Una corrida intermedia falló y se reporta tal cual**, porque el encargo pide la salida real de todo
comando aunque falle. No es del código: es el daemon de Kotlin, por haber lanzado dos builds
solapados en esta sesión.
```
> Task :compileKotlin FAILED
w: Detected multiple Kotlin daemon sessions at kotlin/sessions
FAILURE: Build failed with an exception.
* What went wrong:
Execution failed for task ':compileKotlin'.
> A failure occurred while executing …GradleKotlinCompilerWorkAction
   > Could not delete '/home/user/RSVP---Lino-Sello/build/kotlin/compileKotlin/cacheable/caches-jvm'
BUILD FAILED in 1m 50s
```
Tras `./gradlew --stop` y borrar `build/kotlin`, la corrida siguiente es la de arriba, en verde. La
corrida anterior a esa (mismo árbol salvo cambios de comentario) dio idénticos
`BUILD SUCCESSFUL in 3m 1s` / `10 actionable tasks: 10 executed` y el mismo recuento de 1 152/0/0/0.
(1 100 del cierre + 52 de esta revisión. **`skipped=0` confirmado leyendo los XML, no la consola.**)

Cobertura JaCoCo, antes → después de esta revisión:

| paquete | LINE antes | LINE después | BRANCH antes | BRANCH después |
|---|---|---|---|---|
| `catalog` | 84,92 | **87,63** | 62,17 | **68,52** |
| `schema` | 97,53 | 97,53 | 86,98 | **87,14** |
| `api` | 93,83 | 93,83 | 74,91 | 74,91 |
| `composition` | 99,18 | 99,18 | 88,09 | 88,09 |
| `migration` | 99,67 | 99,67 | 87,42 | 87,42 |
| `persistence` | 91,04 | 91,04 | 71,08 | 71,08 |
| `domain` | 94,77 | 94,77 | 100,00 | 100,00 |
| **BUNDLE** | 94,22 | **94,54** | 80,05 | **81,03** |

Frontend:
```
$ pnpm --filter @invitaciones/schema run typecheck     → tsc --noEmit --strict, 0 errores
$ pnpm --filter @invitaciones/schema test
 Test Files  13 passed (13)
      Tests  458 passed (458)
Statements 99.92 % · Branches 87.6 % · Functions 100 % · Lines 99.92 %   (umbral 90/85/95/90)
$ pnpm --filter @invitaciones/schema run gen:golden ; git status --short -- packages/schema/golden
 (sin cambios: los golden regenerados son idénticos a los versionados)
```

---

## 5. Lo que verifiqué y está bien (no son objeciones)

### 5.1 Seguridad — se atacó, no se leyó

- **H-13 (inyección de ids), muerto [V].** Recorrí **las 19 rutas**, no una muestra. En las 13 de
  invitación, `requesterId` sale **siempre** de `authentication.userId()` y `invitationId`
  **siempre** de la ruta; ningún cuerpo del módulo acepta un id de documento, snapshot, release o
  plantilla ajeno. `restore` resuelve la snapshot por `(documentId ya autorizado, revision)`; el
  historial y los assets, por `invitationId`. `RouteAuthorizationMatrixTest` ejecuta la matriz
  completa ruta×rol (13 rutas × 5 columnas) y además prueba que un `invitationId` ajeno en la ruta no
  da acceso, que colar `{"invitationId":200}` en el cuerpo es `400` y no un descarte silencioso, que
  restaurar una revisión que existe **en otro documento** es `404`, y que un `publicToken` ajeno no
  sirve otra invitación.
- **Las 13 rutas de invitación llaman a `HierarchyValidationService` [V].** Contadas una a una:
  `EditorDocumentService` 5, `ReleaseService` 5, `EditorAssetService` 3. No hay ninguna que se lo
  salte. Además `@PreAuthorize` de clase en los cuatro controladores de `/editor/**`, con prueba que
  falla si alguien borra la anotación.
- **H-14 (excepciones sin código tipado), muerto [V].** `grep` de `require`/`check`/`error()`/
  `requireNotNull`/`checkNotNull` sobre los 105 fuentes de producción, **quitando antes comentarios y
  literales**: **0 resultados**. `NoRequireOrCheckArchitectureTest` lo comprueba en cada build y
  —esto es lo importante— **tiene una prueba de que su propio detector puede fallar** (tres positivos
  y seis negativos que no debe confundir). Es una compuerta real, no un adorno.
- **H-45 (cuerpo sin límite), muerto [V].** `Templates2BodyLimitFilter` aplica 768 KiB en
  `operations` y 8 KiB en el resto por **dos vías**: `Content-Length` primero y una **lectura
  contada** que aborta al rebasar. Por eso `Transfer-Encoding: chunked` (sin `Content-Length`) y un
  `Content-Length` mentiroso **no lo saltan**. Va detrás de Spring Security a propósito, para que un
  anónimo con un cuerpo grande reciba `401` y no un `413` que le confirmaría que la ruta existe.
- **Render público [V].** Lee **solo** `tpl_release` (`@Transactional(readOnly = true)`), nunca
  compone, nunca escribe. Comprueba `invitation.is_enabled` + `customer.is_enabled` +
  `!customer.is_banned` con una consulta y `uses_templates2` con otra, y **un solo `404`** para token
  inexistente, mal formado, rotado, sin release, despublicado o con la bandera apagada — sin oráculo
  de enumeración. No puede filtrar datos de otro invitado ni de otra invitación: el cuerpo es
  `release.composed` de **esa** fila, y hay una comprobación redundante de que el release pertenece a
  la invitación resuelta. El único distinguible es el `403 TPL_INVITATION_UNAVAILABLE`, que es
  deliberado, contractual (`03 §3.15`) y ya está anotado como pregunta abierta por 2-5.
- **`public_token` imprevisible [V].** `PublicTokenGenerator` sortea los 26 símbolos Crockford uno a
  uno con `SecureRandom.nextInt(32)` (potencia de dos: sin sesgo del módulo), 130 bits, sin
  componente temporal ni monótono. **Y el rotado también**: `ReleaseService.rotatePublicToken` →
  `DocumentStore.rotatePublicToken` → el mismo generador. `UlidGenerator` monótono queda solo para
  `assetId`/`itemId`, donde la adivinación la mata la comprobación de pertenencia. ADR-2-ORQ-01
  aplicada de verdad.
- **Assets [V].** MIME por **bytes mágicos** (`MagicBytes`), no por la cabecera declarada; SVG y
  woff2 rechazados en la ruta del cliente (ADR-2-5-04). No se puede subir a la invitación de otro:
  `autorizar` va antes de leer un solo byte del cuerpo. Un `assetId` ajeno en `DELETE` responde
  `404`, igual que uno inexistente. **ADR-030 se cumple por construcción**: el `assetMeta` del
  reductor se arma con una sola consulta acotada a *esta* invitación más la versión de plantilla
  vigente, de modo que un `assetId` de otra invitación **no está en el mapa** y sale
  `TPL_ASSET_NOT_OWNED`; hay caso golden y prueba de repositorio.
- **Sin secretos ni fugas [V].** `grep` de `password|secret|apikey|token=|Bearer|credential` en
  `templates2`: 0. `printStackTrace`/`System.out`/`System.err`/`println`: 0. Las 14 llamadas al log
  no escriben contenido de cliente (ids, claves S3, códigos y constraints).
- **Sin inyección SQL [V]** (reconfirmado tras cinco merges): todas las nativas y JPQL usan
  parámetros con nombre, incluida `searchCatalog`, que construye el literal JSON con
  `jsonb_build_array(CAST(:eventKind AS text))`.

### 5.2 Coherencia con `contratos.md` — cláusula por cláusula

| cláusula | comprobación |
|---|---|
| §3 · `contentHash` sobre `{composed, report}`, **con** el informe, con prefijo | `ContentHasher.nodo()` construye exactamente `{composed, report}`; `sha256Canonical` antepone `"sha256:"` [V] |
| §3 · **11** operaciones | `Operation.kt`: 11 `data class`, `ClearItemBlock` incluida; `OperationReducerGoldenTest` falla si el inventario no son 11 ficheros [V] |
| §3 · **30** invariantes, `I-31` **no** declarada | `InvariantCode.kt`: 30 constantes `I_01`…`I_30`; `I-31` solo en un comentario que dice que está reservada [V] |
| §3 · `CompositionReport` **sin** `fallbacks` | los 6 campos exactos de `composed.ts`; `fallbacks` no existe [V] |
| §3 · `TextSpec.constraints.pattern` no existe | 0 resultados en `BlockSpec.kt`; prueba TS que comprueba que Zod lo rechaza [V] |
| §3 · `package_hash` cubre el paquete entero, con prefijo | `PackageHasher.packageHash(manifest, theme, defaults, migraciones, assets)`; prueba de que cambiar **solo** `defaults.json` cambia el hash [V] |
| §4 · 19 rutas, ruta pública `/public/i/{publicToken}/render` | `Templates2RouteInventoryTest` compara las 19 contra las anotaciones de Spring, ni una más ni una menos [V] |
| §4 · `GET .../document` **no crea** nada | `getDocument` → `exigirDocumento` → `404 TPL_DOCUMENT_NOT_STARTED`; el único creador es `:choose-template` [V] |
| §4 · catálogo **autenticado** | `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` de clase, con prueba de la anotación [V] |
| §4 · `baseRevision` obligatorio también en `restore` y `:choose-template` | `EditorRequests.restore` lo exige; `cambiarPlantilla` lanza `400` sin él [V] |
| §4 · idempotencia real por `(document_id, clientBatchId)` | `snapshotOfBatch` antes de aplicar; responde `200 {applied:false}` [V] |
| §5 · hashes `VARCHAR(71)`, `event_kinds` **JSONB** con GIN | `V30`, `V34`, `V35` [V]; ya medido contra el catálogo de PostgreSQL en `2-1-REV` |
| §5 · `V29`–`V37`, `V38`/`V39` libres | `ls db/migration` [V] |
| §5 · un solo `ObjectMapper`, no `@Primary` | `Templates2JsonConfig`, sin tocar desde 2-0b [V] |
| §6 · golden en **una** ruta, generados | `gen:golden` es determinista y el CI tiene compuerta de deriva [V] |
| §6 · Postgres real, sin H2 ni Testcontainers | todas las de integración pasan por `PgTestCluster`; 0 usos de H2 en `src/test` [V] (ver ADV-14) |

**O-13 de `2-0a-REV` (referencias a `diseno/esquema/*.ts`) está cerrada [V]:** `contratos.md §3` ya
nombra `frontend/packages/schema/src/*.ts` y declara la equivalencia para `diseno/**`.
**O-02 sigue cerrada tras los cinco merges [V]:** `ManifestNormalizacionTest` compara el crudo de
`diseno/ejemplos/` con el normalizado por Zod pasándolo por `DomainJson`, y además comprueba que el
crudo y el normalizado **difieren** — sin esa segunda prueba, la primera no probaría nada.
**O-11 seguía abierta**; queda cerrada en el código por ADV-13, sin compuerta mecánica.

### 5.3 Huecos entre bloques (árbol de `02 §5`/`§7` contra lo que existe)

Recorrí las cinco tablas de `02 §7` clase por clase. **`domain` (23), `schema` (8), `composition`
(10), `persistence` (23) y `api` (15+DTO+excepciones) están completos**; las diferencias son de
disposición en fichero (`Ids.kt` agrupa los ocho *value class*; `OperationBatch`/`EditProposal` viven
en `Operation.kt`) o adiciones registradas por ADR (`DomainJson`, `JsonLector`, `PublicTokenGenerator`,
`LegacyConfigProbe`, `ImageDimensions`, `Templates2S3KeyService`).

Faltan **cuatro** cosas, y solo dos son de esta fase:

| falta | ¿de la fase 2? | referencia |
|---|---|---|
| `POST {frontend}/api/revalidate` tras publicar | **Sí** — `contratos.md §8`: "Tarea nueva para la fase 2" | **ADV-02**, ALTA |
| CORS de fuentes y del bucket S3 (ADR-1R-F-07) | **Sí, pero es infraestructura**, no código: `contratos.md §8` la sitúa en "fase 2/4" | anotar y pasar a despliegue |
| Barrido semanal de huérfanos de S3 (`02 §10.3`) | Parcial: la cola `tpl_asset_gc` sí está y captura los tres caminos de borrado; falta el listado del bucket, que exige tocar `core/s3` | ya en `preguntas-abiertas.md` (2-5) |
| `migration/LegacyConfigExtractor.kt` y `LegacyMigrationRunner.kt` | **No**: `02 §7.6` los marca "(fase 5; aquí solo el hueco)" | correcto que falten |

### 5.4 Duplicación entre bloques

Es el fallo típico de integrar worktrees y aquí produjo el defecto ALTA de la fase:

1. **El bucket por defecto, resuelto en cuatro sitios con dos valores distintos** → **ADV-01**,
   corregida. Su causa profunda es **ADV-10** (`AssetUrlResolver` ignora el `bucket` de la fila).
2. **`publicBaseUrl` calculado dos veces con la misma fórmula**, en `catalog.TemplateCatalogService`
   y en `api.EditorDocumentService`. Hoy coinciden (tras ADV-01); nada garantiza que sigan
   coincidiendo. Candidato claro a un único `@ConfigurationProperties` del módulo.
3. **sha256-hex implementado dos veces** → **ADV-15**.
4. **Dos generadores de identificadores**, `UlidGenerator` y `PublicTokenGenerator`: **no es
   duplicación**, es la separación que exige ADR-2-ORQ-01, y está justificada en el KDoc.
5. **`DocumentNormalizer` (composition) y `EditorDocumentService.revalidar` (api)**: **no es
   duplicación**, son los pasos 2 y 3 distintos de `03 §3.6` (ADR-2-4-04).
6. **`TemplateAssetStorage` (catalog) e `InvitationAssetStorage` (persistence)**: dos puertas a S3 con
   la misma forma. Están justificadas —permiten ejercitar el fallo parcial sin credenciales— y ambas
   delegan en `core/s3/S3Service`, así que no duplican lógica.

### 5.5 Calidad de las pruebas

- **`skipped=0` confirmado [V]** leyendo los 75 XML de `build/test-results/test/`, no la consola.
  `grep` de `@Disabled`/`@Ignore`/`Assumptions`/`assumeTrue`/`@EnabledIf`/`@DisabledIf` en `src/test`:
  **0 resultados**.
- **Pruebas que no pueden fallar: barrido de las 446 funciones `@Test`/`@ParameterizedTest`** con un
  analizador que aísla el cuerpo de cada una y busca cualquier forma de aserción (`assert*`,
  `andExpect`, `verify(`, `assertThrows`, …). Resultado: **1 candidato, y es un falso positivo** —
  `ResponseSchemaContractTest:78` asierta dentro de un método auxiliar privado. `grep` de
  `assertTrue(true)`, `assertFalse(false)`, comparaciones de algo consigo mismo y `try/catch` que se
  traga el fallo: **0 resultados**. La familia que 2-0a-REV encontró (O-03) no se ha reproducido.
- **PostgreSQL real, no H2 [V]**: todas las de integración extienden `IntegrationTestBase` /
  `SpringPersistenceTestSupport`, que arrancan el clúster efímero; ninguna referencia a H2 en
  `src/test`. La dependencia sigue en el classpath (**ADV-14**).
- **Las ramas que faltaban en `catalog` eran, en efecto, caminos de rechazo y de fallo parcial** —
  los dos peores sitios donde faltar, porque es la ruta de alta de contenido. Las dos serias
  (**ADV-05** y **ADV-06**) quedan cerradas; el resto de las 143 ramas descubiertas son
  `TemplatePackageReader` (99/142: combinaciones de ZIP/directorio/multipart mal formados, con los
  rechazos principales sí probados, incluido el salto de directorio),
  `RawTemplatePackage.PackagePart.equals/hashCode` (0/10, generados y nunca llamados) y
  `S3TemplateAssetStorage` (0/7, la implementación real de S3, sustituida en pruebas a propósito).
  Ninguno de esos tres es un camino de rechazo.
- **Las pruebas prueban lo correcto en los sitios que importan**: la matriz de autorización recorre
  las 13 rutas por las **cinco** columnas de `03 §9.1` y comprueba además que un `403` **no escribe**
  (revisión intacta y asset sin borrar); `NoRequireOrCheckArchitectureTest` se autocomprueba;
  `ManifestNormalizacionTest` comprueba que el crudo y el normalizado difieren.

---

## 6. Lo que le queda al orquestador antes de cerrar

1. **ADV-02** — decidir sobre `POST {frontend}/api/revalidate`: implementarlo en un bloque de cierre
   o enmendar `contratos.md §8` por ADR para pasarlo a la fase 3.
2. **ADV-03** — aceptar o rechazar las 43 ADR en estado "propuesta" y enmendar `contratos.md` §3, §4,
   §5 y §6 con lo que quede aceptado. Es la única forma de que el contrato deje de contradecir al
   código en las cláusulas que las ADR enmiendan.
3. **ADV-04** — asignar número de migración y dueño a `invitation_guest.graduates_name`. Hasta
   entonces, cerrar la fase sabiendo que ningún entorno nuevo arranca y que las 19 rutas nunca han
   respondido sobre Tomcat real.
4. **ADV-08, ADV-09, ADV-10** — tres decisiones MEDIA que necesitan ADR: separar el interruptor del
   planificador por tarea; dar dimensiones a los assets de plantilla (o aceptar por escrito que
   `image.aspect` no se valida para ellos); y resolver `StoredAsset.bucket`.
5. Anotar **ADV-12, ADV-14, ADV-15, ADV-16** como deuda menor de la fase 3.

---

*Ninguna corrección de esta revisión toca `contratos.md`, `decisiones.md`, las migraciones Flyway,
`application.yml`, `build.gradle.kts`, `settings.gradle.kts` ni el módulo antiguo.*
