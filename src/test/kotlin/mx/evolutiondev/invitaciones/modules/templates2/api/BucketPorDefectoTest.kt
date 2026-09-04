package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * **Objeción ADV-01 de `bitacora/2-adv.md`, cerrada aquí.**
 *
 * `templates2.assets.bucket` **no está en `application.yml`** y no puede estarlo: `contratos.md §4`
 * fija que la única modificación de ese fichero que pide el módulo es `spring.servlet.multipart`. Es
 * decir: el valor que se usa en producción es **siempre** el defecto del código. Los cuatro puntos
 * que lo resuelven vivían en bloques distintos y no coincidían — `catalog` (2-3) usaba
 * `S3Buckets.ASSETS` y `api` (2-4 y 2-5) un literal propio, `"invitaciones-assets"` —, así que el
 * editor subía a un bucket y la URL compuesta y publicada apuntaba a otro.
 *
 * Ninguna prueba lo detectaba porque **todas** inyectan el bucket explícitamente
 * (`bucket-de-pruebas`): el defecto solo existe con la configuración real. `02 §10.1` paso 8 nombra
 * literalmente `S3Service.uploadPublicFile(S3Buckets.ASSETS, …)`, así que el valor correcto no es
 * opinable.
 *
 * La prueba mira el **código fuente** además de la constante porque el defecto se reintroduce
 * escribiendo un literal nuevo en cualquiera de los cuatro sitios, y eso no rompe ninguna prueba
 * funcional.
 */
class BucketPorDefectoTest {

    /** Los nombres admisibles: la constante del núcleo o la del módulo, que es la misma. */
    private val admisibles = setOf("S3Buckets.ASSETS", "BUCKET_POR_DEFECTO", "EditorAssetService.BUCKET_POR_DEFECTO")

    @Test
    fun `el bucket por defecto del editor es el que fija 02 10-1 paso 8`() {
        assertEquals(S3Buckets.ASSETS, EditorAssetService.BUCKET_POR_DEFECTO)
    }

    @Test
    fun `ningun fuente de templates2 escribe un nombre de bucket a mano`() {
        val hallazgos = ficheros().flatMap { fichero ->
            fichero.readLines().withIndex()
                .filter { (_, linea) -> LITERAL_ABANDONADO.containsMatchIn(linea) }
                .map { (i, linea) -> "${fichero.name}:${i + 1}: ${linea.trim()}" }
        }
        assertEquals(
            emptyList<String>(), hallazgos,
            "un nombre de bucket escrito a mano vuelve a separar dónde se sube del sitio del que se compone la URL",
        )
    }

    @Test
    fun `los cuatro defectos de bucket del modulo resuelven al mismo valor`() {
        val encontrados = mutableListOf<Pair<String, String>>()
        for (fichero in ficheros()) {
            for ((i, linea) in fichero.readLines().withIndex()) {
                val m = DEFECTO_DE_BUCKET.find(linea) ?: continue
                encontrados.add("${fichero.name}:${i + 1}" to m.groupValues[1].trim())
            }
        }
        assertTrue(
            encontrados.size >= 4,
            "esperaba los cuatro puntos que resuelven el bucket y encontré ${encontrados.size}: $encontrados",
        )
        val fuera = encontrados.filterNot { it.second in admisibles }
        assertEquals(emptyList<Pair<String, String>>(), fuera, "estos defectos no son S3Buckets.ASSETS")
    }

    private fun ficheros(): List<File> = raizDeTemplates2()
        .walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()

    private fun raizDeTemplates2(): File {
        val ejemplos = File(
            System.getProperty("templates2.ejemplos.dir")
                ?: throw IllegalStateException("falta -Dtemplates2.ejemplos.dir (lo fija tasks.test)"),
        )
        // <repo>/docs/rediseno-plantillas/diseno/ejemplos → <repo>
        val repo = ejemplos.parentFile.parentFile.parentFile.parentFile
        val raiz = File(repo, "src/main/kotlin/mx/evolutiondev/invitaciones/modules/templates2")
        assertTrue(raiz.isDirectory, "no encuentro ${raiz.absolutePath}")
        return raiz
    }

    companion object {
        /** `…ifBlank { <expresión> }` sobre el parámetro del bucket, sea cual sea el nombre de la variable. */
        private val DEFECTO_DE_BUCKET = Regex("""bucketConfigurado\s*\.ifBlank\s*\{\s*([^}]+?)\s*\}""")

        /** El literal que introdujeron 2-4 y 2-5; y cualquier otro nombre de bucket suelto. */
        private val LITERAL_ABANDONADO = Regex(""""invitaciones-assets"|"invitacionesdigitales(assets|editor)"""")
    }
}
