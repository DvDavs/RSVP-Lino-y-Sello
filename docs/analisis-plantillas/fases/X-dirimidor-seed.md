# X — Dirimidor: ¿funciona la siembra de `default_visual_*` con `invitationId` ausente?

## 1. Veredicto (≤5 líneas: quién tenía razón, A o B, y con qué matiz)

**Tiene razón el Informe B: la siembra visual SÍ deserializa.** Verificado empíricamente con las clases reales del proyecto (compiladas por el propio `gradlew`) y las versiones reales (jackson-databind 2.18.2 / jackson-module-kotlin 2.18.2): los **9** `default_visual_*.json` se deserializan **sin excepción** a `DefaultVisualConfig` y `config.invitationId` queda en **`0`** (valor por defecto de la primitiva `long`). El **Hallazgo #1 del Informe A es falso**: no hay `MissingKotlinParameterException`, el `catch` silencioso no se activa por esta causa, y las 8 plantillas visuales sí se escriben en Mongo.
**Matiz que salva parcialmente a A:** el mecanismo que A describe es real, pero está *desactivado por defecto*; basta activar `FAIL_ON_NULL_FOR_PRIMITIVES` (o `KotlinFeature.StrictNullChecks`) para que los 9 archivos fallen exactamente como A predijo — es una bomba de relojería latente, no un fallo actual.

---

## 2. Método empírico

### 2.1 Compilación

- `bash gradlew --no-daemon compileKotlin` **falla** en este contenedor por un motivo ajeno al caso: `build.gradle.kts:19-23` exige `JavaLanguageVersion.of(17)` y aquí solo hay **OpenJDK 21.0.10**.
  ```
  > Failed to calculate the value of task ':compileJava' property 'javaCompiler'.
     > Cannot find a Java installation on your machine matching this tasks requirements:
       {languageVersion=17, vendor=any vendor, implementation=vendor-specific} for LINUX on x86_64.
  ```
- Resuelto **sin tocar ningún archivo versionado**, con un *init script* de Gradle alojado **fuera** del repo (`x-tools/init-jdk21.gradle`) que fuerza el toolchain a 21, más `-Pkotlin.jvm.target.validation.mode=warning`. Comando final:
  ```
  bash gradlew --no-daemon --max-workers=1 \
    -I <scratchpad>/x-tools/init-jdk21.gradle \
    -Pkotlin.jvm.target.validation.mode=warning compileKotlin
  → BUILD SUCCESSFUL in 1m 6s
  ```
  (hicieron falta reintentos: Maven Central devolvió **HTTP 429 Too Many Requests** dos veces; el proxy en sí estaba sano — `recentRelayFailures: []`).
- Resultado: `/home/user/RSVP---Lino-Sello/build/classes/kotlin/main/mx/.../defaults/DefaultVisualConfig.class` (**clases reales del proyecto, producidas por su propio build**, con los plugins `kotlin-spring`, `noarg` y `-Xjsr305=strict` aplicados). `build/` está en `.gitignore`.
- En paralelo compilé las mismas dos fuentes reales (`EditorModels.kt` + `DefaultVisualConfig.kt`) con **kotlinc 1.9.25 embeddable** extraído del caché de Gradle (`x-tools/kotlinc.sh`). **La prueba se ejecutó contra los dos juegos de clases y dio resultados idénticos**, lo que descarta un artefacto del toolchain 21.

### 2.2 Versiones exactas resueltas por el proyecto (del caché de Gradle y del propio runtime)

| Artefacto | Versión | Origen |
|---|---|---|
| `com.fasterxml.jackson.core:jackson-databind` | **2.18.2** | impresa por `new ObjectMapper().version()` |
| `com.fasterxml.jackson.module:jackson-module-kotlin` | **2.18.2** | impresa por `KotlinModule.version()` |
| `com.fasterxml.jackson.core:jackson-core` / `jackson-annotations` | 2.18.2 | caché Gradle |
| `org.jetbrains.kotlin:kotlin-stdlib` / `kotlin-reflect` | 1.9.25 | caché Gradle |
| `org.springframework:spring-web` (para `Jackson2ObjectMapperBuilder`) | 6.2.1 | caché Gradle |
| JDK de ejecución | OpenJDK 21.0.10 | `java -version` |

### 2.3 Variantes de ObjectMapper probadas

- **(i)** `com.fasterxml.jackson.module.kotlin.ExtensionsKt.jacksonObjectMapper()` — **la misma función exacta** que invoca `MongoDataInitializer.kt:27`, llamada desde Java para no introducir ninguna diferencia.
- **(ii)** `Jackson2ObjectMapperBuilder.json().build()` — equivalente a los defaults de Spring Boot para el `ObjectMapper` inyectado (`spring-web` sí estaba en el classpath).
- **(iii)** control: `jacksonObjectMapper()` + `enable(FAIL_ON_NULL_FOR_PRIMITIVES)` — para *demostrar* el mecanismo que A postulaba, en vez de asumirlo.

Programa: `x-tools/SeedProbe.java`. Ejecución:
```
java -cp "probe-only:/home/user/RSVP---Lino-Sello/build/classes/kotlin/main:<jars>" \
     SeedProbe /home/user/RSVP---Lino-Sello/src/main/resources/data/mongo
```

### 2.4 Estado real de los flags (salida literal)

```
### FLAGS del mapper (i) jacksonObjectMapper():
  FAIL_ON_UNKNOWN_PROPERTIES = true
  FAIL_ON_NULL_FOR_PRIMITIVES = false
### FLAGS del mapper (ii) Spring:
  FAIL_ON_UNKNOWN_PROPERTIES = false
  FAIL_ON_NULL_FOR_PRIMITIVES = false
  KotlinModule registrado = true  -> [com.fasterxml.jackson.module.kotlin.KotlinModule]

### jackson-databind version = 2.18.2
### jackson-module-kotlin version = 2.18.2
```

Esto confirma **por ejecución** (no por documentación) los dos puntos clave:
1. `jacksonObjectMapper()` **NO** activa `FAIL_ON_NULL_FOR_PRIMITIVES` → una primitiva `Long` ausente recibe el valor por defecto de la JVM (`0L`) en lugar de lanzar excepción.
2. `jacksonObjectMapper()` **SÍ** deja `FAIL_ON_UNKNOWN_PROPERTIES = true` (a diferencia del mapper de Spring Boot) → la asimetría que señala B en su §5 es real y está verificada.

---

## 3. Resultado por archivo

Los 9 archivos, en las 3 variantes. Salida literal en el Anexo.

| Archivo | Variante ObjectMapper | ¿Deserializa? | `invitationId` resultante | Excepción (clase, campo, mensaje) |
|---|---|---|---|---|
| `default_visual_boda_premium.json` (templateId=5) | (i) `jacksonObjectMapper()` — **la de producción** | **SÍ** | **0** | — |
| `default_visual_boda_basico.json` (4) | (i) | **SÍ** | **0** | — |
| `default_visual_xv_premium.json` (6) | (i) | **SÍ** | **0** | — |
| `default_visual_bautizo.json` (7) | (i) | **SÍ** | **0** | — |
| `default_visual_comunion.json` (8) | (i) | **SÍ** | **0** | — |
| `default_visual_confirmacion.json` (9) | (i) | **SÍ** | **0** | — |
| `default_visual_cumpleanos.json` (10) | (i) | **SÍ** | **0** | — |
| `default_visual_evento.json` (13) | (i) | **SÍ** | **0** | — |
| `default_visual_boda_premium_2.json` (11, comentado en el seeder) | (i) | **SÍ** | **0** | — |
| **los 9** | (ii) `Jackson2ObjectMapperBuilder.json().build()` | **SÍ** | **0** | — |
| **los 9** | (iii) (i) + `FAIL_ON_NULL_FOR_PRIMITIVES` | **NO** | — | `com.fasterxml.jackson.databind.exc.MismatchedInputException` — campo `invitationId` — `Missing required creator property 'invitationId' (index 1) … (through reference chain: DefaultVisualConfig["config"]->InvitationConfig["invitationId"])` |

**Dato adicional observado:** en los 9 casos que sí deserializan, `config.templateId` queda en **`null`** (los JSON no traen `config.templateId`, solo el `templateId` de la raíz de `DefaultVisualConfig`). Esto corrobora la observación de B en su §5 ("pierde de paso `config.templateId/eventId/planId`"), ahora **verificada empíricamente**.

### 3.1 Pregunta 2 — ¿falla alguno por OTRA causa?

**No. Ninguno de los nueve falla por ninguna otra causa** — ni clave desconocida, ni tipo incompatible, ni enum no reconocido. Y esto es un resultado **fuerte**, porque la variante (i) es precisamente la que tiene `FAIL_ON_UNKNOWN_PROPERTIES = true`: si hubiera una sola clave desconocida en cualquiera de las clases sin `@JsonIgnoreProperties`, habría reventado.

Es cierto por lectura (verificado con `awk` sobre `EditorModels.kt`) que **10 clases carecen de la anotación** — exactamente las que lista A: `InvitationConfig` (13), `ModelSettings` (44), `ModelPropertiesIcon` (113), `ModelEditIcon` (125), `ModelPropertiesItem` (135), `ModelEditItem` (147), `BackgroundColor` (161), `DateItem` (183), `EventSinglePlaceCard` (255), `SmallText` (492). Pero **hoy ningún JSON del repo las viola**. Comprobación cruzada por lectura:
- `jq '.config|keys'` en los 9: solo claves que existen en `InvitationConfig` (`sectionDresscode`/`sectionGifttable` mapeados por `@JsonProperty` en `EditorModels.kt:29` y `:36`).
- `jq '.config.settings|keys'` en los 9: `["child_friendly","music","name","primaryColor","secondaryColor","young_friendly"]` — coincidencia exacta con `ModelSettings` (`EditorModels.kt:44-51`).

**Conclusión matizada:** la falta de `@JsonIgnoreProperties` en esas 10 clases es una **fragilidad real** (cualquier clave nueva que el frontend añada a un JSON de plantilla rompería el seeder de ese archivo, en silencio, por el `catch` de `MongoDataInitializer.kt:91-93`), pero **no un fallo activo**.

---

## 4. Qué ObjectMapper usa `MongoDataInitializer` en producción

**Usa una instancia creada a mano, NO la inyectada por Spring.** Verificado por lectura:

- `src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:27`
  ```kotlin
  private val objectMapper = jacksonObjectMapper()
  ```
  Es un inicializador de propiedad, no un parámetro de constructor: el constructor (`:19-24`) recibe únicamente `visualConfigRepo`, `contentConfigRepo`, `resourceLoader` y `mongoTemplate`. Import en `:4` (`com.fasterxml.jackson.module.kotlin.jacksonObjectMapper`).
- Contraste dentro del mismo repo: `modules/master/templates/service/MasterTemplatesService.kt:32` sí recibe `private val objectMapper: ObjectMapper` **inyectado**. La asimetría es real.

**Configuración Jackson en `application.yml`: ninguna.**
- `src/main/resources/application.yml` (único `application*` del proyecto, 80+ líneas leídas) **no contiene ninguna clave `spring.jackson.*`**; `grep -rn "jackson" src/main/resources/` → **cero coincidencias**.
- Tampoco hay ningún `@Bean ObjectMapper` ni `Jackson2ObjectMapperBuilderCustomizer` en `src/main/kotlin/` (grep → cero coincidencias). Las otras cuatro instancias manuales (`InvitationsAccessDeniedHandler.kt:44`, `JwtTokenFilter.kt:89` y `:104`, `AuthEntryPointJwt.kt:36`) son `ObjectMapper()` planos para serializar respuestas de error, irrelevantes aquí.

**Por tanto la variante que corre en producción es la (i)**, y su comportamiento medido es: `FAIL_ON_UNKNOWN_PROPERTIES = true`, `FAIL_ON_NULL_FOR_PRIMITIVES = false` → **deserializa los 9 archivos con `invitationId = 0`**.

*(Nota: la variante (ii) da el mismo resultado para estos archivos, así que la conclusión sobre `invitationId` no depende de cuál mapper se use. La elección de mapper sí importa para el riesgo de claves desconocidas descrito en §3.1.)*

---

## 5. Consecuencias aguas abajo

Como la siembra **sí funciona**, la pregunta operativa es la segunda: **¿se filtra el `invitationId = 0`?**

**No: se sobrescribe.** `DefaultConfigGeneratorService.kt:98-99`:
```kotlin
return visualTemplate.copy(
    invitationId = invitation.id,
```
`mergeConfiguration` (`:90-180`) parte de `visualTemplate` (que es `DefaultVisualConfig.config`, es decir el objeto con `invitationId = 0`) y lo primero que hace en el `copy` es reemplazar `invitationId` por el id real de la invitación. El `0` de la plantilla **nunca llega** a la colección `invitation_configs`. **VERIFICADO por lectura.**

Complementariamente, `generateInitialConfig` (`:83-87`) repara también los otros tres campos que la deserialización dejó en `null`:
```kotlin
return mergedConfig.copy(
    templateId = templateId,
    eventId = eventTypeId,
    planId = planId
)
```
Es decir: el hecho verificado en §3 de que `config.templateId` quede `null` tras la siembra **tampoco tiene consecuencia funcional** en el camino de generación, porque se fija aquí. (Sí la tendría para cualquier consumidor que leyese `default_visual_configs.config.templateId` directamente.)

**Corolario importante:** el índice único `invitation_configs.invitationId` que `MongoDataInitializer.ensureUniqueIndexes()` recrea en cada arranque (`:65-72`) **no corre peligro** por el `0` de las plantillas: ese `0` vive en la colección `default_visual_configs`, no en `invitation_configs`, y se sustituye antes de guardarse.

### Y si aun así faltara el documento visual (caso de los `templateId` 11, 12, 14 que señalan A y B)

La cadena, verificada por lectura:
1. `DefaultConfigGeneratorService.kt:47-54` → `findByTemplateId(templateId).orElseThrow { DefaultVisualTemplateNotFoundException("No se encontró plantilla visual para templateId: $templateId") }`.
2. **Esa excepción no llega al handler HTTP por el camino normal.** Único llamador de `generateInitialConfig`: `InvitationConfigService.kt:154`, dentro de un `try`. El `catch (e: Exception)` de `:158-164` la traga, loguea, reintenta `findByInvitationId` y, al no haber nada, relanza `IllegalStateException("Failed to create or retrieve config for invitation $invitationId", e)` (`:161-163`).
3. `GeneralExceptionHandler.kt` **no tiene handler para `IllegalStateException`** (verificado: la lista completa de `@ExceptionHandler` va de la línea 30 a la 238 y no lo incluye; tampoco hay catch-all de `Exception`). → respuesta de error genérica de Spring, **HTTP 500**, sin el `ErrorMessage` estructurado del resto de la API.
4. El handler específico `GeneralExceptionHandler.kt:187-197` (`@ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)`, mensaje `"No se encontró la plantilla visual necesaria para generar la configuración"`) **es código efectivamente muerto para este camino**, porque el `catch` de `InvitationConfigService.kt:158` intercepta antes. **Matiz que ni A ni B recogen.** En ambos casos el cliente ve un 500, pero con cuerpo distinto del anunciado.

---

## 6. Correcciones que deben aplicarse a los informes A y B

| Informe | Afirmación (cita textual breve) | Corrección | Evidencia |
|---|---|---|---|
| **A** (Hallazgo #1) | *"El comportamiento documentado de `jackson-module-kotlin` para un parámetro de constructor no-nulo y sin valor por defecto cuya clave está totalmente ausente del JSON es lanzar `MissingKotlinParameterException`"* | **FALSO para tipos primitivos.** `Long` mapea a `long`; con `FAIL_ON_NULL_FOR_PRIMITIVES = false` (el default, medido) el deserializador de la primitiva aporta `0L` como valor ausente y el constructor se invoca con éxito. Solo los tipos de *referencia* no nulos disparan el error de parámetro faltante. | Prueba empírica §3, variante (i): 9/9 `OK`, `invitationId=0`, con jackson 2.18.2 y las clases del propio build |
| **A** (Hallazgo #1) | *"por tanto la siembra automática de las 8 plantillas visuales nunca escribe nada en Mongo"* | **FALSO.** La deserialización — único paso que A cuestionaba — funciona en los 9 archivos. El `catch` de `MongoDataInitializer.kt:91-93` no se activa por esta causa. | §3 y Anexo |
| **A** (Hallazgo #1) | Clase de excepción esperada: `MissingKotlinParameterException` | **Desactualizado aun en el escenario en que sí falla.** Con `FAIL_ON_NULL_FOR_PRIMITIVES` activado, jackson-module-kotlin 2.18.2 lanza `com.fasterxml.jackson.databind.exc.MismatchedInputException` ("Missing required creator property"), no `MissingKotlinParameterException` (que sigue existiendo en el jar pero no se usa en este camino). | §3 variante (iii); `unzip -l jackson-module-kotlin-2.18.2.jar` confirma que la clase existe pero no es la lanzada |
| **A** (§9, "no pude responder") | *"no hay caché de Gradle/Maven en este entorno … y no hay `kotlinc` instalado para una prueba aislada"* | **Superable.** Maven Central es alcanzable por el proxy; el bloqueo real era la ausencia de un JDK 17 para el toolchain, resoluble con un init script externo al repo. Y `kotlin-compiler-embeddable-1.9.25.jar` queda en el caché de Gradle tras la primera resolución, lo que permite un `kotlinc` funcional sin instalar nada. | §2.1; `x-tools/kotlinc.sh` → `info: kotlinc-jvm 1.9.25 (JRE 21.0.10+7-Ubuntu-124.04)` |
| **A** (§7, Hallazgo #1) | Evidencia corroborante: *`MasterTemplatesService.kt:117` inyecta `put("invitationId", 0)`* → "indica que ese campo es obligatorio para esa conversión" | **La inferencia se sostiene pero prueba otra cosa.** Ese `put` es necesario para `objectMapper.convertValue(Map, InvitationConfig)` porque en `convertValue` desde un `Map` la ruta de deserialización es la misma y también daría `0`; el `put` explícito (y el `copy(invitationId = 0)` redundante de `:135`) es defensivo, no la prueba de que la ruta de los JSON falle. No es evidencia válida sobre la siembra. | `MasterTemplatesService.kt:116-137`; §3 demuestra que la ruta de los JSON no necesita ese `put` |
| **A** (§7, Hallazgo #1) | Lista de clases sin `@JsonIgnoreProperties` (13, 44, 113, 125, 135, 147, 161, 183, 255, 492) | **CORRECTA** — confirmada por lectura. Pero la consecuencia práctica hoy es **nula**: ningún JSON del repo introduce claves desconocidas en esas clases. Debe reclasificarse de "fallo" a "fragilidad latente". | §3.1; `awk` sobre `EditorModels.kt`; `jq '.config\|keys'` y `jq '.config.settings\|keys'` sobre los 9 |
| **B** (§5) | *"upsert destructivo por `templateId` en cada arranque"*; *"la siembra funciona"* | **CONFIRMADO** en su premisa deserializadora. | §3 |
| **B** (§5) | Pregunta abierta: *"si Jackson tolera el `invitationId` ausente"* | **RESUELTA: sí lo tolera**, dejando `invitationId = 0`. | §3, §4 |
| **B** (§5) | *"El `MongoDataInitializer` usa `jacksonObjectMapper()` propio (:27), **no** el `ObjectMapper` de Spring, así que aquí `FAIL_ON_UNKNOWN_PROPERTIES` sí está activo"* | **CORRECTO Y AHORA VERIFICADO POR EJECUCIÓN** (era una inferencia razonada; ya es un hecho medido: `true` vs `false`). | §2.4 |
| **B** (§5) | *"pierde de paso `config.templateId/eventId/planId`"* | **CORRECTO Y VERIFICADO EMPÍRICAMENTE** (`config.templateId=null` en los 9). Añadir el matiz de que **no tiene impacto funcional** en la generación, porque `DefaultConfigGeneratorService.kt:83-87` los refija. | §3, §5 |
| **B** (§5) | *"`DefaultConfigGeneratorService.kt:47-55` lanza `DefaultVisualTemplateNotFoundException`, que `GeneralExceptionHandler.kt:187-197` mapea a HTTP 500; el intermedio `InvitationConfigService.kt:154-164` lo captura … y relanza `IllegalStateException`"* | **Casi correcto, con una contradicción interna que conviene resolver:** como el `catch` intermedio *siempre* intercepta (es el único llamador), el handler de `:187-197` **nunca se ejecuta** por este camino; el 500 lo produce el `IllegalStateException` sin handler propio, con cuerpo de error genérico de Spring, no el `ErrorMessage` de la API. | §5, puntos 2-4; lista completa de `@ExceptionHandler` en `GeneralExceptionHandler.kt:30-238` |
| **A y B** (implícito) | Ambos tratan la ausencia de `invitationId` en los JSON como un defecto | **Sigue siendo un defecto, pero de otra naturaleza:** no rompe hoy; rompe el día que alguien active `FAIL_ON_NULL_FOR_PRIMITIVES`, `KotlinFeature.StrictNullChecks`, o cambie `invitationId` a un tipo de referencia. Debe reclasificarse como **riesgo latente de alta severidad**, no como fallo activo. | §3 variante (iii): 9/9 `FAIL` |

---

## 7. Lo que no pude determinar y por qué

- **Si el `save()` en Mongo tiene éxito.** Solo se probó la deserialización (el único paso que A cuestionaba). `visualConfigRepo.findByTemplateId(...)` / `save(...)` (`MongoDataInitializer.kt:83-90`) requieren un MongoDB real; no hay instancia disponible ni `src/test` con `de.flapdoodle.embed.mongo` (que sí está declarado en `build.gradle.kts:85` pero sin ningún test que lo use). **NO DETERMINADO por ejecución**; sin evidencia de que falle.
- **Si el mapeo Spring Data (`MappingMongoConverter`) del `DefaultVisualConfig` a documento BSON introduce algún fallo propio.** Mismo motivo. Es un paso distinto de Jackson y no fue probado.
- **Si `IncorrectResultSizeDataAccessException` llega a dispararse en `findByTemplateId`** (escenario que B plantea en su §6 ante documentos duplicados): depende del estado real de la base de datos, no del repositorio.
- **El estado real de producción**: si las 8 plantillas están hoy en Mongo, si el índice único `default_visual_configs.templateId` existe, si los `templateId` 11/12/14 tienen documento. Todo eso depende de la BD real, fuera de alcance.
- **Si algún perfil de Spring no versionado (`application-*.yml` externo, variables `SPRING_JACKSON_*`) altera el `ObjectMapper` inyectado.** No cambiaría la conclusión, porque `MongoDataInitializer` no usa el inyectado (§4), pero sí podría alterar el camino de `MasterTemplatesService`.
- **Comportamiento bajo JDK 17.** Todo se compiló y ejecutó sobre JDK 21 (único disponible). El resultado depende de la lógica de `KotlinValueInstantiator` y del deserializador de primitivas de Jackson, no de la versión de la JVM, así que el riesgo de divergencia es despreciable — pero no está verificado sobre 17.

---

## Anexo: código de la prueba

Todo bajo `<scratchpad>/x-tools/`. **Nada de esto se escribió dentro del repositorio.**

### A.1 `init-jdk21.gradle` (init script externo, sortea la ausencia de JDK 17)

```groovy
allprojects { proj ->
    proj.afterEvaluate {
        def javaExt = proj.extensions.findByName('java')
        if (javaExt != null) {
            javaExt.toolchain.languageVersion.set(org.gradle.jvm.toolchain.JavaLanguageVersion.of(21))
        }
        proj.tasks.matching { t -> t.class.name.contains('KotlinCompile') }.configureEach { t ->
            try { t.kotlinOptions.jvmTarget = '21' } catch (Throwable ignored) { }
        }
    }
}
```

### A.2 `kotlinc.sh` (compilador Kotlin 1.9.25 desde el caché de Gradle; camino de verificación redundante)

```bash
#!/bin/bash
C=/root/.gradle/caches/modules-2/files-2.1
KC=$(find $C/org.jetbrains.kotlin/kotlin-compiler-embeddable -name '*.jar' | head -1)
KS=$(find $C/org.jetbrains.kotlin/kotlin-stdlib/1.9.25 -name 'kotlin-stdlib-1.9.25.jar' | head -1)
KR=$(find $C/org.jetbrains.kotlin/kotlin-reflect/1.9.25 -name 'kotlin-reflect-1.9.25.jar' | head -1)
KSR=$(find $C/org.jetbrains.kotlin/kotlin-script-runtime -name '*.jar' | head -1)
KDE=$(find $C/org.jetbrains.kotlin/kotlin-daemon-embeddable -name '*.jar' | head -1)
TR=$(find $C/org.jetbrains.intellij.deps/trove4j -name '*.jar' | head -1)
AN=$(find $C/org.jetbrains/annotations -name '*.jar' | head -1)
exec java -cp "$KC:$KS:$KR:$KSR:$KDE:$TR:$AN" org.jetbrains.kotlin.cli.jvm.K2JVMCompiler "$@"
```

### A.3 `SeedProbe.java` (núcleo de la prueba)

```java
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.module.kotlin.ExtensionsKt;
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultVisualConfig;
import java.io.File; import java.util.*;

public class SeedProbe {
    static Map<String, ObjectMapper> mappers() {
        Map<String, ObjectMapper> m = new LinkedHashMap<>();
        // (i) EXACTAMENTE lo que hace MongoDataInitializer.kt:27
        m.put("i-jacksonObjectMapper()", ExtensionsKt.jacksonObjectMapper());
        // (ii) defaults de Spring Boot
        ObjectMapper spring;
        try {
            Class<?> b = Class.forName(
                "org.springframework.http.converter.json.Jackson2ObjectMapperBuilder");
            Object builder = b.getMethod("json").invoke(null);
            spring = (ObjectMapper) b.getMethod("build").invoke(builder);
        } catch (Throwable t) {
            spring = ExtensionsKt.jacksonObjectMapper()
                     .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        }
        m.put("ii-Jackson2ObjectMapperBuilder.json().build()", spring);
        // (iii) control: demuestra el mecanismo que postulaba el Informe A
        m.put("iii-jackson+FAIL_ON_NULL_FOR_PRIMITIVES",
              ExtensionsKt.jacksonObjectMapper()
                  .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES));
        return m;
    }

    public static void main(String[] args) throws Exception {
        File[] files = new File(args[0]).listFiles(
            (d, n) -> n.startsWith("default_visual_") && n.endsWith(".json"));
        Arrays.sort(files);
        for (Map.Entry<String, ObjectMapper> e : mappers().entrySet()) {
            System.out.println("========== VARIANTE " + e.getKey() + " ==========");
            for (File f : files) {
                try {
                    DefaultVisualConfig c = e.getValue().readValue(f, DefaultVisualConfig.class);
                    System.out.printf("OK   | %-38s | templateId=%s | config.invitationId=%s | config.templateId=%s%n",
                        f.getName(), c.getTemplateId(),
                        c.getConfig().getInvitationId(), c.getConfig().getTemplateId());
                } catch (Throwable t) {
                    System.out.printf("FAIL | %-38s | %s | %s%n",
                        f.getName(), t.getClass().getName(),
                        String.valueOf(t.getMessage()).replace('\n', ' '));
                }
            }
        }
    }
}
```

### A.4 Comandos ejecutados

```bash
# 1) build real del proyecto (init script FUERA del repo; build/ está en .gitignore)
bash gradlew --no-daemon --max-workers=1 \
  -I <scratchpad>/x-tools/init-jdk21.gradle \
  -Pkotlin.jvm.target.validation.mode=warning compileKotlin
# → BUILD SUCCESSFUL in 1m 6s

# 2) compilar la sonda
javac -cp "classes:$RCP" -d probe-only SeedProbe.java

# 3) ejecutarla CONTRA LAS CLASES DEL PROPIO BUILD DE GRADLE
java -cp "probe-only:/home/user/RSVP---Lino-Sello/build/classes/kotlin/main:$RCP" \
     SeedProbe /home/user/RSVP---Lino-Sello/src/main/resources/data/mongo
```

### A.5 Salida literal completa (contra `build/classes/kotlin/main`)

```
### FLAGS del mapper (i) jacksonObjectMapper():
  FAIL_ON_UNKNOWN_PROPERTIES = true
  FAIL_ON_NULL_FOR_PRIMITIVES = false
### FLAGS del mapper (ii) Spring:
  FAIL_ON_UNKNOWN_PROPERTIES = false
  FAIL_ON_NULL_FOR_PRIMITIVES = false
  KotlinModule registrado = true  -> [com.fasterxml.jackson.module.kotlin.KotlinModule]

### jackson-databind version = 2.18.2
### jackson-module-kotlin version = 2.18.2

========== VARIANTE i-jacksonObjectMapper() ==========
OK   | default_visual_bautizo.json            | templateId=7  | config.invitationId=0 | config.templateId=null
OK   | default_visual_boda_basico.json        | templateId=4  | config.invitationId=0 | config.templateId=null
OK   | default_visual_boda_premium.json       | templateId=5  | config.invitationId=0 | config.templateId=null
OK   | default_visual_boda_premium_2.json     | templateId=11 | config.invitationId=0 | config.templateId=null
OK   | default_visual_comunion.json           | templateId=8  | config.invitationId=0 | config.templateId=null
OK   | default_visual_confirmacion.json       | templateId=9  | config.invitationId=0 | config.templateId=null
OK   | default_visual_cumpleanos.json         | templateId=10 | config.invitationId=0 | config.templateId=null
OK   | default_visual_evento.json             | templateId=13 | config.invitationId=0 | config.templateId=null
OK   | default_visual_xv_premium.json         | templateId=6  | config.invitationId=0 | config.templateId=null

========== VARIANTE ii-Jackson2ObjectMapperBuilder.json().build() ==========
(idéntico: 9/9 OK, config.invitationId=0, config.templateId=null)

========== VARIANTE iii-jackson+FAIL_ON_NULL_FOR_PRIMITIVES ==========
FAIL | default_visual_bautizo.json            | com.fasterxml.jackson.databind.exc.MismatchedInputException | Missing required creator property 'invitationId' (index 1) …
FAIL | default_visual_boda_basico.json        | (idem)
FAIL | default_visual_boda_premium.json       | (idem)
FAIL | default_visual_boda_premium_2.json     | (idem)
FAIL | default_visual_comunion.json           | (idem)
FAIL | default_visual_confirmacion.json       | (idem)
FAIL | default_visual_cumpleanos.json         | (idem)
FAIL | default_visual_evento.json             | (idem)
FAIL | default_visual_xv_premium.json         | (idem)
```

Mensaje completo de la variante (iii) para `default_visual_boda_premium.json`:

```
com.fasterxml.jackson.databind.exc.MismatchedInputException
Missing required creator property 'invitationId' (index 1)
 at [Source: REDACTED (`StreamReadFeature.INCLUDE_SOURCE_IN_LOCATION` disabled); line: 4812, column: 3]
 (through reference chain:
   mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultVisualConfig["config"]
   ->mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig["invitationId"])
```

La misma sonda ejecutada contra las clases compiladas por separado con `kotlinc 1.9.25` (`x-tools/classes`) produce **exactamente la misma salida**.

---

### Estado del repositorio

`git status --short` → **vacío**. No se modificó ningún archivo versionado, no se cambiaron permisos de `gradlew` (se invocó siempre como `bash gradlew …`), y los únicos artefactos generados dentro del repo son `build/` y `.gradle/`, ambos ya ignorados por `.gitignore`.
