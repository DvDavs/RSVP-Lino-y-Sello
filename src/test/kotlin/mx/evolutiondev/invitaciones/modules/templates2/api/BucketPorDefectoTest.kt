package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2AssetBucket
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2AssetBucketNoConfigurado
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * **Objeción ADV-01 de `bitacora/2-adv.md` y ADR-2-ORQ-03, cerradas aquí.**
 *
 * Historia en dos actos, porque la segunda mitad importa más que la primera:
 *
 * 1. Cuatro puntos del módulo resolvían el bucket de S3 por su cuenta y **no coincidían** (`catalog`
 *    usaba `S3Buckets.ASSETS`; `api`, el literal `"invitaciones-assets"`), así que el editor subía a
 *    un bucket y la URL compuesta y publicada apuntaba a otro. Ninguna de las 1 100 pruebas lo veía,
 *    porque **todas** inyectan el bucket explícitamente: el defecto sólo existe con la configuración
 *    real.
 * 2. Unificarlo no bastaba: el valor unificado era `S3Buckets.ASSETS`, **el bucket de producción**.
 *    Arrancar sin configurar nada bastaba para subir objetos de cliente ahí. Un bucket de producción
 *    no puede ser el valor que se aplica precisamente cuando nadie ha pensado en el asunto.
 *
 * Hoy el bucket lo resuelve **[Templates2AssetBucket] y nadie más**: propiedad obligatoria, sin
 * defecto, con rechazo explícito del bucket de producción salvo declaración expresa.
 *
 * La prueba mira el **código fuente** además del comportamiento porque el defecto se reintroduce
 * escribiendo un literal nuevo en cualquiera de los cuatro sitios, y eso no rompe ninguna prueba
 * funcional.
 */
class BucketPorDefectoTest {

    // --- comportamiento de la resolución -------------------------------------------------

    @Test
    fun `sin bucket configurado la aplicacion no arranca, en vez de caer en el de produccion`() {
        val e = assertThrows(Templates2AssetBucketNoConfigurado::class.java) {
            Templates2AssetBucket(configurado = "", permitirProduccion = false)
        }
        assertTrue(
            e.message!!.contains("templates2.assets.bucket"),
            "el mensaje debe decir qué propiedad falta; decía: ${e.message}",
        )
        assertTrue(
            e.message!!.contains(S3Buckets.ASSETS),
            "el mensaje debe explicar por qué no hay defecto (sería el de producción)",
        )
    }

    @Test
    fun `apuntar al bucket de produccion exige declararlo explicitamente`() {
        assertThrows(Templates2AssetBucketNoConfigurado::class.java) {
            Templates2AssetBucket(configurado = S3Buckets.ASSETS, permitirProduccion = false)
        }
        // Con la declaración expresa sí se permite: el objetivo es que nadie lo haga sin querer.
        assertEquals(
            S3Buckets.ASSETS,
            Templates2AssetBucket(configurado = S3Buckets.ASSETS, permitirProduccion = true).nombre,
        )
    }

    @Test
    fun `un bucket de pruebas se acepta tal cual`() {
        assertEquals(
            "mi-bucket-de-pruebas",
            Templates2AssetBucket(configurado = "  mi-bucket-de-pruebas  ", permitirProduccion = false).nombre,
        )
    }

    // --- compuertas sobre el código fuente -----------------------------------------------

    @Test
    fun `ningun fuente de templates2 escribe un nombre de bucket a mano`() {
        val hallazgos = ficheros().flatMap { fichero ->
            fichero.readLines().withIndex()
                .filter { (_, linea) -> LITERAL_ABANDONADO.containsMatchIn(linea) }
                .filterNot { (_, linea) -> linea.trimStart().startsWith("*") || linea.trimStart().startsWith("//") }
                .map { (i, linea) -> "${fichero.name}:${i + 1}: ${linea.trim()}" }
        }
        assertEquals(
            emptyList<String>(), hallazgos,
            "un nombre de bucket escrito a mano vuelve a separar dónde se sube del sitio del que se compone la URL",
        )
    }

    @Test
    fun `nadie vuelve a inventarse un bucket por defecto con ifBlank`() {
        val hallazgos = ficheros().flatMap { fichero ->
            fichero.readLines().withIndex()
                .filter { (_, linea) -> DEFECTO_DE_BUCKET.containsMatchIn(linea) }
                .map { (i, linea) -> "${fichero.name}:${i + 1}: ${linea.trim()}" }
        }
        assertEquals(
            emptyList<String>(), hallazgos,
            "el bucket lo resuelve Templates2AssetBucket y nadie más; un ifBlank aquí reintroduce un " +
                "defecto silencioso, que fue exactamente el defecto ADV-01",
        )
    }

    private fun ficheros(): List<File> = raizDeTemplates2()
        .walkTopDown().filter { it.isFile && it.extension == "kt" }
        // El único fichero que puede nombrar el bucket de producción es el que lo rechaza.
        .filterNot { it.name == "Templates2AssetBucket.kt" }
        .toList()

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
        /** `…ifBlank { <expresión> }` sobre un parámetro de bucket, sea cual sea el nombre. */
        private val DEFECTO_DE_BUCKET = Regex("""bucket\w*\s*\.ifBlank\s*\{""", RegexOption.IGNORE_CASE)

        /** El literal que introdujeron 2-4 y 2-5; y cualquier otro nombre de bucket suelto. */
        private val LITERAL_ABANDONADO = Regex(""""invitaciones-assets"|"invitacionesdigitales(assets|editor)"""")
    }
}
