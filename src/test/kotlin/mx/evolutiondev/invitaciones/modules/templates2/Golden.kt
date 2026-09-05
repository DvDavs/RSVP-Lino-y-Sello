package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import java.io.File

/**
 * Acceso a los golden files. **Ruta única compartida con TypeScript** (ADR-1R-C-09): la carpeta
 * `frontend/packages/schema/golden` se monta como recurso de prueba con
 * `sourceSets.test.resources.srcDir(...)` en `build.gradle.kts`, sin copia ni symlink. Dos rutas con
 * copia es exactamente el mecanismo por el que dos representaciones divergen (H-35).
 */
object Golden {

    private val resolver = PathMatchingResourcePatternResolver(Golden::class.java.classLoader)

    /** Lee un fichero del classpath de golden, p. ej. `("invariants", "I-01-range-end-before-start.json")`. */
    fun leer(sub: String, fichero: String): JsonNode {
        val ruta = "/$sub/$fichero"
        val stream = Golden::class.java.getResourceAsStream(ruta)
            ?: error("golden ausente del classpath: $ruta (sourceSets.test.resources.srcDir en build.gradle.kts)")
        return stream.use { Templates2Json.mapper.readTree(it) }
    }

    /** Enumera los `.json` de una subcarpeta de golden, ordenados. */
    fun listar(sub: String): List<String> =
        resolver.getResources("classpath:/" + sub + "/" + "*" + ".json").mapNotNull { it.filename }.sorted()

    /**
     * Carpetas de `golden/templates/`. **No** coincide con [Ejemplos.plantillas]: son las dos que
     * salen de `diseno/ejemplos/` MÁS `richtext-marcas-1.0.0`, que el generador SINTETIZA porque
     * `diseno/ejemplos/` es la referencia inmutable de la ronda 1R y ninguno de sus dos documentos
     * lleva un solo `marks` (I-01 / H-ADV-01: por eso escribir negrita devolvía `500 TPL_INTERNAL`
     * con 2 390 pruebas en verde). Quien lee de `golden/` usa esta lista; quien lee de
     * `diseno/ejemplos/` usa [Ejemplos.plantillas].
     */
    val plantillas: List<String> = listOf("boda-clasica-1.0.0", "richtext-marcas-1.0.0", "xv-jardin-1.0.0")

    /** Los 10 ejemplos completos de la fase 1. No van al classpath: llegan por propiedad del sistema. */
    object Ejemplos {
        private val dir: File = File(
            System.getProperty("templates2.ejemplos.dir")
                ?: error("falta -Dtemplates2.ejemplos.dir (lo fija tasks.test en build.gradle.kts)"),
        )

        val plantillas: List<String> = listOf("boda-clasica-1.0.0", "xv-jardin-1.0.0")

        /** `template`, `theme`, `defaults`, `documento`, `compuesto` — 5 por plantilla, 10 en total. */
        val ficheros: List<String> = listOf("template", "theme", "defaults", "documento", "compuesto")

        fun leer(plantilla: String, fichero: String): JsonNode {
            val f = File(File(dir, plantilla), "$fichero.json")
            check(f.isFile) { "ejemplo ausente: ${f.absolutePath}" }
            return Templates2Json.mapper.readTree(f)
        }

        /** El esquema con el que se valida cada uno de los 5 ficheros de un ejemplo. */
        val esquemaDe: Map<String, String> = mapOf(
            "template" to "template-manifest",
            "theme" to "theme",
            "defaults" to "defaults",
            "documento" to "invitation-document",
            "compuesto" to "composed-document",
        )
    }
}
