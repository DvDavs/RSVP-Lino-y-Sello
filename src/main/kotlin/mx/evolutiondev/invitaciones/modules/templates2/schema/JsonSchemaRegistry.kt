package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.networknt.schema.AbsoluteIri
import com.networknt.schema.JsonSchema
import com.networknt.schema.JsonSchemaFactory
import com.networknt.schema.SchemaLocation
import com.networknt.schema.SpecVersion
import com.networknt.schema.resource.InputStreamSource
import com.networknt.schema.resource.SchemaLoader
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Carga el **bundle** `templates2.schema.json` (15 `$defs`, ADR-1R-D-08) y los 10 archivos-puntero del
 * classpath **una sola vez** y los cachea por nombre.
 *
 * Los 11 esquemas se **preinstalan por su `$id` absoluto** en el `JsonSchemaFactory` (draft 2020-12),
 * de modo que el `$ref` de cada puntero
 * (`https://invitaciones.evolutiondev.mx/schema/templates2.schema.json#/$defs/<Id>`) resuelve contra
 * memoria y **nunca sale a la red** (dirimida X-11, contratos.md §5). Sin esa preinstalación,
 * `com.networknt:json-schema-validator` intentaría descargar el `$id`.
 *
 * El cargador [SinRed] cierra el hueco de forma comprobable: cualquier IRI que no esté preinstalada
 * **lanza** en vez de descargarse, y [descargasIntentadas] deja constancia numérica para las pruebas.
 *
 * Los `.schema.json` llegan al classpath desde `frontend/packages/schema/json-schema` vía
 * `sourceSets.main.resources.srcDir(...)`: ruta única, sin copia ni symlink (contratos.md §5).
 */
@Component
class JsonSchemaRegistry {

    companion object {
        /** Base de todos los `$id` emitidos por `scripts/emit-json-schema.ts`. */
        const val BASE_IRI = "https://invitaciones.evolutiondev.mx/schema/"

        /** `$id` del bundle. Es el que resuelven los `$ref` de los 10 punteros. */
        const val BUNDLE_ID = BASE_IRI + "templates2.schema.json"

        const val BUNDLE = "templates2"

        /**
         * Los 10 esquemas raíz de `emit-json-schema.ts` (constante `RAICES`). Cada uno es un
         * archivo-puntero de tres claves que referencia `#/\$defs/<Id>` dentro del bundle.
         */
        val PUNTEROS = listOf(
            "template-manifest", "theme", "defaults", "migration-plan", "invitation-document",
            "operation-batch", "edit-proposal", "composed-document", "business-snapshot", "composition-report",
        )

        /** Los 11 recursos que este registro exige en el classpath (`JsonSchemaPresenceTest`). */
        val NOMBRES: List<String> = listOf(BUNDLE) + PUNTEROS

        fun recurso(nombre: String): String = "/$nombre.schema.json"
        fun iri(nombre: String): String = BASE_IRI + nombre + ".schema.json"
    }

    /** Cargador que **prohíbe** cualquier descarga: si algo no está preinstalado, se ve, no se baja. */
    class SinRed(private val contador: AtomicInteger) : SchemaLoader {
        override fun getSchema(iri: AbsoluteIri): InputStreamSource {
            contador.incrementAndGet()
            throw Templates2Exception.Internal(
                "JsonSchemaRegistry: el validador intentó resolver \"$iri\" fuera de los esquemas " +
                    "preinstalados. Eso sería una descarga por red y contratos.md §5 lo prohíbe.",
            )
        }
    }

    private val intentos = AtomicInteger(0)

    /** Texto crudo de cada `.schema.json`, leído del classpath. */
    val fuentes: Map<String, String> = NOMBRES.associateWith { nombre ->
        val ruta = recurso(nombre)
        (javaClass.getResourceAsStream(ruta)
            ?: throw Templates2Exception.Internal(
                "JsonSchemaRegistry: falta \"$ruta\" en el classpath. Se monta desde " +
                    "frontend/packages/schema/json-schema con sourceSets.main.resources.srcDir (contratos.md §5).",
            )).use { it.readBytes().toString(Charsets.UTF_8) }
    }

    /** Los 11 esquemas indexados por su `$id` absoluto: esto es la preinstalación de la dirimida X-11. */
    private val porIri: Map<String, String> = fuentes.entries.associate { (nombre, texto) -> iri(nombre) to texto }

    val factory: JsonSchemaFactory =
        JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012) { builder ->
            builder.schemaLoaders { cargadores ->
                cargadores.schemas(porIri)      // 1) memoria: bundle + 10 punteros por su $id
                cargadores.add(SinRed(intentos)) // 2) cualquier otra cosa lanza, nunca se descarga
            }
        }

    private val cache = ConcurrentHashMap<String, JsonSchema>()

    /** Esquema compilado por nombre (`"invitation-document"`, `"templates2"`, …). */
    fun schema(nombre: String): JsonSchema = cache.computeIfAbsent(nombre) {
        if (!NOMBRES.contains(it)) {
            throw Templates2Exception.Internal("JsonSchemaRegistry: \"$it\" no es uno de los 11 esquemas del módulo")
        }
        factory.getSchema(SchemaLocation.of(iri(it)))
    }

    /** Cuántas veces el validador pidió una IRI **no** preinstalada. Debe ser 0 siempre (prueba de red). */
    fun descargasIntentadas(): Int = intentos.get()

    /** Compila los 11 esquemas de golpe; útil al arrancar para que el primer request no pague la compilación. */
    fun precalentar(): Map<String, JsonSchema> = NOMBRES.associateWith { schema(it) }
}
