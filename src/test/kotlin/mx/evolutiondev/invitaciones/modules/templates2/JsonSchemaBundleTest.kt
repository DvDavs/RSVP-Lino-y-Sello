package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.net.Proxy
import java.net.ProxySelector
import java.net.SocketAddress
import java.net.URI

/**
 * **La primera de las dos verificaciones que la fase 1 dejó pendientes por falta de JDK**
 * (contratos.md §7): que `com.networknt:json-schema-validator:1.5.4` acepte el bundle
 * `templates2.schema.json` con `$defs` y `$id` **preinstalado**, que los 10 punteros resuelvan su
 * `$ref` contra él **sin salir a la red** (dirimida X-11) y que dé el **mismo veredicto** que Zod y
 * ajv sobre los 10 ejemplos de la fase 1 (10/10 válidos).
 */
class JsonSchemaBundleTest {

    private val registry = JsonSchemaRegistry()
    private val validador = JsonSchemaValidatorService(registry)

    @Test
    fun `el bundle con dollar-defs se compila sin errores`() {
        val bundle = registry.schema(JsonSchemaRegistry.BUNDLE)
        assertNotNull(bundle)
        val node = Templates2Json.readTree(registry.fuentes.getValue(JsonSchemaRegistry.BUNDLE))
        assertEquals(JsonSchemaRegistry.BUNDLE_ID, node.get("\$id").textValue())
        assertEquals("https://json-schema.org/draft/2020-12/schema", node.get("\$schema").textValue())
        assertEquals(15, node.get("\$defs").size(), "ADR-1R-D-08: el bundle tiene 15 definiciones")
    }

    @Test
    fun `los 10 punteros resuelven su ref contra el bundle preinstalado`() {
        assertEquals(10, JsonSchemaRegistry.PUNTEROS.size)
        for (nombre in JsonSchemaRegistry.PUNTEROS) {
            val puntero = Templates2Json.readTree(registry.fuentes.getValue(nombre))
            assertEquals(JsonSchemaRegistry.iri(nombre), puntero.get("\$id").textValue(), nombre)
            val ref = puntero.get("\$ref").textValue()
            assertTrue(ref.startsWith(JsonSchemaRegistry.BUNDLE_ID + "#/\$defs/"), "$nombre -> $ref")
            // Compilar el esquema fuerza la resolución del `$ref`; si no resolviera, o la librería
            // intentase descargarlo, `SinRed` lanzaría.
            assertNotNull(registry.schema(nombre), nombre)
        }
        assertEquals(0, registry.descargasIntentadas(), "ningún `\$ref` puede salir a la red (X-11)")
    }

    /**
     * Prueba de red de verdad: durante toda la compilación y validación se instala un `ProxySelector`
     * que **lanza** si alguien abre una conexión HTTP(S), y se comprueba que el contador de
     * `SinRed` sigue en cero. Es la comprobación que `contratos.md §5` exige y que en la fase 1 no se
     * pudo ejecutar.
     */
    @Test
    fun `ninguna validacion abre una conexion de red`() {
        val anterior = ProxySelector.getDefault()
        val visitadas = mutableListOf<URI>()
        ProxySelector.setDefault(object : ProxySelector() {
            override fun select(uri: URI): MutableList<Proxy> {
                visitadas.add(uri)
                throw AssertionError("el validador intentó salir a la red: $uri")
            }
            override fun connectFailed(uri: URI, sa: SocketAddress, ioe: java.io.IOException) = Unit
        })
        try {
            val limpio = JsonSchemaRegistry()
            limpio.precalentar()
            val doc = Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento")
            assertTrue(JsonSchemaValidatorService(limpio).isValid("invitation-document", doc))
            assertEquals(0, limpio.descargasIntentadas())
        } finally {
            ProxySelector.setDefault(anterior)
        }
        assertTrue(visitadas.isEmpty(), "URIs contactadas: $visitadas")
    }

    /**
     * Los **10 ejemplos** de `diseno/ejemplos/`: la fase 1 los verificó válidos contra Zod y contra
     * ajv 2020-12 (contratos.md §3). Kotlin debe dar exactamente el mismo veredicto.
     */
    @TestFactory
    fun `los 10 ejemplos de la fase 1 son validos tambien en Kotlin`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.flatMap { plantilla ->
            Golden.Ejemplos.ficheros.map { fichero ->
                DynamicTest.dynamicTest("$plantilla/$fichero.json") {
                    val esquema = Golden.Ejemplos.esquemaDe.getValue(fichero)
                    val violaciones = validador.validate(esquema, Golden.Ejemplos.leer(plantilla, fichero))
                    assertTrue(violaciones.isEmpty(), "$plantilla/$fichero contra $esquema: $violaciones")
                }
            }
        }

    /** Los golden de composición también deben validar contra sus esquemas raíz. */
    @TestFactory
    fun `los golden de plantilla validan contra su esquema`(): List<DynamicTest> {
        val pares = listOf(
            "template.json" to "template-manifest",
            "theme.json" to "theme",
            "defaults.json" to "defaults",
            "documento.json" to "invitation-document",
            "business.json" to "business-snapshot",
            "compuesto.json" to "composed-document",
            "reporte.json" to "composition-report",
        )
        return Golden.Ejemplos.plantillas.flatMap { plantilla ->
            pares.map { (fichero, esquema) ->
                DynamicTest.dynamicTest("golden/templates/$plantilla/$fichero") {
                    val violaciones = validador.validate(esquema, Golden.leer("templates/$plantilla", fichero))
                    assertTrue(violaciones.isEmpty(), "$plantilla/$fichero contra $esquema: $violaciones")
                }
            }
        }
    }

    /** Un documento inválido tiene que ser rechazado: si nada falla nunca, la prueba anterior no prueba nada. */
    @Test
    fun `el esquema rechaza un documento roto`() {
        val doc = Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento") as ObjectNode
        doc.put("schemaVersion", 99)
        assertTrue(validador.validate("invitation-document", doc).isNotEmpty())

        val otro = Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento") as ObjectNode
        otro.put("claveInventada", true)
        assertTrue(
            validador.validate("invitation-document", otro).isNotEmpty(),
            "los esquemas son strictObject: una clave desconocida debe romper (P1)",
        )
    }
}
