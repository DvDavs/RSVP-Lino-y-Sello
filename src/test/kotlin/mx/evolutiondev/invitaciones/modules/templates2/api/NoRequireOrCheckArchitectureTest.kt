package mx.evolutiondev.invitaciones.modules.templates2.api

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.io.File

/**
 * Caso 39 de `03 §12` y `contratos.md §4`: **`require`, `check`, `error()`, `requireNotNull` y
 * `checkNotNull` están prohibidos en todo el código de producción de `templates2`**.
 *
 * El motivo es concreto y verificado, no estilístico: `require(...)` lanza `IllegalArgumentException`
 * y `GeneralExceptionHandler` (`core/error/GeneralExceptionHandler.kt:42-52`) la convierte en un `400`
 * **sin `code`**. Aunque el advice de este módulo tenga `@Order(HIGHEST_PRECEDENCE)`, una excepción
 * lanzada fuera de la ventana del advice —o cualquier futuro cambio de acotado— saldría por ahí, y con
 * ella volvería H-14: errores del módulo nuevo indistinguibles de los del viejo, sin código tipado.
 * `check(...)` es peor: `IllegalStateException` **no tiene handler** en el núcleo y cae en el `500`
 * genérico de Spring, sin `code` y con la ruta `/error` de por medio.
 *
 * La regla se comprueba sobre el árbol de fuentes, no sobre el bytecode: es donde se escribe y donde
 * hay que impedirlo.
 */
class NoRequireOrCheckArchitectureTest {

    private val prohibidas = listOf("require", "requireNotNull", "check", "checkNotNull", "error")

    private val patron = Regex(
        "(^|[^A-Za-z0-9_.`])(" + prohibidas.joinToString("|") + ")\\s*\\(",
        RegexOption.MULTILINE,
    )

    @Test
    fun `ningun fuente de produccion de templates2 usa require, check o error`() {
        val raiz = raizDeTemplates2()
        val ficheros = raiz.walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
        assertTrue(ficheros.size >= 90, "esperaba el módulo completo y encontré ${ficheros.size} ficheros")

        val hallazgos = mutableListOf<String>()
        for (fichero in ficheros) {
            val limpio = sinComentariosNiCadenas(fichero.readText())
            for (linea in limpio.lines().withIndex()) {
                if (patron.containsMatchIn(linea.value)) {
                    hallazgos.add("${fichero.relativeTo(raiz)}:${linea.index + 1}: ${linea.value.trim()}")
                }
            }
        }

        assertEquals(
            emptyList<String>(), hallazgos,
            "estas líneas usan require/check/error en templates2 y saldrían como 4xx/5xx sin `code` " +
                "(contratos.md §4, 03 §10.1, H-14)",
        )
    }

    /** La prueba tiene que poder fallar: si el detector no ve un `require`, no está midiendo nada. */
    @Test
    fun `el detector reconoce las cinco formas y no se confunde con nombres parecidos`() {
        val positivo = """
            fun f(x: Int) {
                require(x > 0)
                checkNotNull(x)
                error("boom")
            }
        """.trimIndent()
        assertEquals(3, patron.findAll(sinComentariosNiCadenas(positivo)).count())

        val negativo = """
            // require(false) en un comentario no cuenta
            /* ni check(false) en uno de bloque */
            fun g(r: Repo) {
                val sql = "require(x) dentro de una cadena"
                r.check(1)
                val e = miError.error(2)
                requerirAlgo(3)
                checkeo(4)
            }
        """.trimIndent()
        assertEquals(
            0, patron.findAll(sinComentariosNiCadenas(negativo)).count(),
            "el detector produce falsos positivos: sería imposible mantener la regla",
        )
    }

    /**
     * Quita comentarios y literales de cadena antes de buscar. Sin esto, un KDoc que **documenta** la
     * prohibición —los hay— contaría como una violación, y la prueba se volvería inmantenible o, peor,
     * se relajaría hasta no detectar nada.
     */
    private fun sinComentariosNiCadenas(texto: String): String {
        var salida = texto.replace(Regex("\"\"\"[\\s\\S]*?\"\"\""), "\"\"")
        salida = salida.replace(Regex("\"(\\\\.|[^\"\\\\])*\""), "\"\"")
        salida = salida.replace(Regex("/\\*[\\s\\S]*?\\*/"), "")
        salida = salida.replace(Regex("//[^\\n]*"), "")
        return salida
    }

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
}
