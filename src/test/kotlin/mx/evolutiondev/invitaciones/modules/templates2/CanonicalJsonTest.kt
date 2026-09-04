package mx.evolutiondev.invitaciones.modules.templates2

import mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Las cinco reglas de `canonicalJson` de `01 §5.5` (ADR-1R-D-02), una prueba por regla. */
class CanonicalJsonTest {

    private fun canon(texto: String) = CanonicalJson.canonical(Templates2Json.readTree(texto))

    @Test
    fun `regla 2 - las claves de objeto se ordenan y el resultado no depende del orden de entrada`() {
        val a = canon("""{"b":1,"a":2,"C":3}""")
        val b = canon("""{"C":3,"a":2,"b":1}""")
        assertEquals(a, b)
        // Orden por unidades de código UTF-16: las mayúsculas van antes que las minúsculas.
        assertEquals("""{"C":3,"a":2,"b":1}""", a)
    }

    @Test
    fun `regla 1 - sin espacios en blanco entre tokens`() {
        assertEquals("""{"a":[1,2],"b":{"c":true}}""", canon(""" { "a" : [ 1 , 2 ] , "b" : { "c" : true } } """))
    }

    @Test
    fun `regla 5 - los arrays nunca se reordenan`() {
        assertEquals("""["c","a","b"]""", canon("""["c","a","b"]"""))
        assertNotEquals(canon("""["a","b"]"""), canon("""["b","a"]"""))
    }

    @Test
    fun `regla 4 - enteros sin punto decimal y dobles con la representacion mas corta`() {
        assertEquals("1", canon("1"))
        assertEquals("1", canon("1.0"), "JSON.stringify(1.0) === \"1\": Kotlin no puede emitir \"1.0\"")
        assertEquals("0.5", canon("0.5"))
        assertEquals("-0.25", canon("-0.25"))
        assertEquals("0", canon("0"))
        assertEquals("12345678901234567890", canon("12345678901234567890"))
    }

    @Test
    fun `regla 3 - escape minimo y los no ASCII van literales`() {
        assertEquals("\"árbol\"", canon("\"\\u00e1rbol\""))
        assertEquals("\"a\\\"b\"", canon("\"a\\\"b\""))
        assertEquals("\"a\\\\b\"", canon("\"a\\\\b\""))
        assertEquals("\"a\\nb\"", canon("\"a\\nb\""))
        assertEquals("\"a\\tb\"", canon("\"a\\tb\""))
        assertEquals("\"a\\rb\"", canon("\"a\\rb\""))
        assertEquals("\"a\\bb\"", canon("\"a\\bb\""))
        assertEquals("\"a\\fb\"", canon("\"a\\u000cb\""))
        assertEquals("\"a\\u0001b\"", canon("\"a\\u0001b\""))
    }

    @Test
    fun `el null se emite y los booleanos tambien`() {
        assertEquals("""{"a":null,"b":false,"c":true}""", canon("""{"c":true,"b":false,"a":null}"""))
    }

    @Test
    fun `es determinista sobre los golden reales`() {
        for (plantilla in Golden.Ejemplos.plantillas) {
            for (fichero in listOf("template", "theme", "defaults", "documento", "compuesto")) {
                val node = Golden.Ejemplos.leer(plantilla, fichero)
                val uno = CanonicalJson.canonical(node)
                val dos = CanonicalJson.canonical(node)
                assertEquals(uno, dos, "$plantilla/$fichero")
                assertTrue(uno.isNotEmpty())
            }
        }
    }

    @Test
    fun `sha256Canonical lleva prefijo de algoritmo y 64 hex`() {
        val h = Templates2Json.sha256Canonical(Templates2Json.readTree("""{"a":1}"""))
        assertTrue(Regex("^sha256:[0-9a-f]{64}$").matches(h), h)
        // El mismo documento con las claves al revés produce el mismo hash (ADR-1R-B-07).
        assertEquals(
            Templates2Json.sha256Canonical(Templates2Json.readTree("""{"a":1,"b":2}""")),
            Templates2Json.sha256Canonical(Templates2Json.readTree("""{"b":2,"a":1}""")),
        )
    }
}
