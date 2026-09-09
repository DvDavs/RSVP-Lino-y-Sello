package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * El analizador del pegado, con una tabla de renglones buenos y malos.
 *
 * Lo que de verdad se comprueba aquí no es que el renglón se rechace, sino **qué se le dice a la
 * clienta**: cada problema tiene que traer una pista que sugiera la corrección. «Formato inválido» a
 * secas la deja mirando el renglón sin saber qué tocar, y eso es lo que el contrato §1 prohíbe.
 */
class GuestPasteReaderTest {

    private val lector = GuestPasteReader()

    // =============================================================================================
    // Renglones buenos
    // =============================================================================================

    @Test
    fun `un renglon completo se entiende entero`() {
        val leido = lector.leer("María Fernanda Cruz, 2, 1, 0, +52 55 1234 5678, maria@correo.test")

        assertEquals(0, leido.problemas.size)
        val draft = leido.listos.single().draft
        assertEquals("María Fernanda Cruz", draft.fullName)
        assertEquals(2, draft.adults)
        assertEquals(1, draft.children)
        assertEquals(0, draft.young)
        assertEquals("+52 55 1234 5678", draft.phone)
        assertEquals("maria@correo.test", draft.email)
    }

    @Test
    fun `solo el nombre basta y vale por una persona`() {
        val draft = lector.leer("Ana Ruiz").listos.single().draft

        assertEquals("Ana Ruiz", draft.fullName)
        assertEquals(1, draft.adults, "un nombre suelto es una persona, no cero")
        assertEquals(0, draft.children)
        assertNull(draft.email)
        assertNull(draft.phone)
    }

    @Test
    fun `los renglones vacios no cuentan como problema`() {
        val leido = lector.leer("Ana Ruiz\n\n\nLuis Pérez\n")

        assertEquals(2, leido.listos.size)
        assertEquals(0, leido.problemas.size)
    }

    @Test
    fun `si falta el telefono pero hay correo se entiende igual`() {
        val draft = lector.leer("Ana Ruiz, 1, 0, 0, ana@correo.test").listos.single().draft

        assertEquals("ana@correo.test", draft.email)
        assertNull(draft.phone, "el campo con arroba es el correo, no el teléfono")
    }

    @Test
    fun `un texto vacio no es un error, simplemente no trae nada`() {
        val leido = lector.leer("   ")

        assertEquals(0, leido.listos.size)
        assertEquals(0, leido.problemas.size)
    }

    // =============================================================================================
    // Renglones malos: cada uno con su pista
    // =============================================================================================

    @Test
    fun `sin nombre dice donde escribirlo`() {
        val problema = lector.leer(", 2, 0, 0").problemas.single()

        assertEquals(1, problema.line)
        assertEquals("GUEST_INVALID", problema.code)
        assertEquals("Falta el nombre.", problema.message)
        assertEquals("Escríbelo antes de la primera coma.", problema.hint)
    }

    @Test
    fun `una cifra que no es numero dice que se escriban digitos`() {
        val problema = lector.leer("Ana Ruiz, dos, 0, 0").problemas.single()

        assertEquals("El número de adultos no se entiende.", problema.message)
        assertTrue(problema.hint.contains("solo dígitos"), "la pista dice qué escribir: ${problema.hint}")
    }

    @Test
    fun `una cifra negativa se rechaza como el resto`() {
        val problema = lector.leer("Ana Ruiz, 1, -3, 0").problemas.single()

        assertEquals("El número de niños no se entiende.", problema.message)
        assertTrue(problema.hint.isNotBlank())
    }

    @Test
    fun `cero personas en los tres cupos dice que hace falta al menos una`() {
        val problema = lector.leer("Ana Ruiz, 0, 0, 0").problemas.single()

        assertEquals("Este renglón no incluye a ninguna persona.", problema.message)
        assertEquals(
            "Escribe al menos un adulto, un niño o un joven después del nombre.",
            problema.hint,
        )
    }

    @Test
    fun `un correo sin dominio dice que se revise la arroba`() {
        val problema = lector.leer("Ana Ruiz, 1, 0, 0, 5512345678, ana@correo").problemas.single()

        assertEquals("El correo no se entiende.", problema.message)
        assertTrue(problema.hint.contains("nombre@correo.com"), "la pista trae un ejemplo: ${problema.hint}")
    }

    @Test
    fun `un telefono con letras dice que se escriban numeros`() {
        val problema = lector.leer("Ana Ruiz, 1, 0, 0, cinco cinco, ana@correo.test").problemas.single()

        assertEquals("El teléfono no se entiende.", problema.message)
        assertTrue(problema.hint.contains("solo números"), "la pista dice qué escribir: ${problema.hint}")
    }

    @Test
    fun `mas columnas de las esperadas recuerda el orden correcto`() {
        val problema = lector.leer("Ana Ruiz, 1, 0, 0, 5512345678, ana@correo.test, sobra").problemas.single()

        assertEquals("Este renglón trae más datos de los que esperamos.", problema.message)
        assertEquals(
            "El orden es: nombre, adultos, niños, jóvenes, teléfono, correo.",
            problema.hint,
        )
    }

    @Test
    fun `un correo repetido en el pegado se marca con el renglon donde ya estaba`() {
        val leido = lector.leer(
            "Ana Ruiz, 1, 0, 0, , ana@correo.test\n" +
                "Ana R., 1, 0, 0, , ANA@correo.test",
        )

        assertEquals(1, leido.listos.size, "solo entra la primera")
        val problema = leido.problemas.single()
        assertEquals(2, problema.line)
        assertEquals("GUEST_DUPLICATE", problema.code)
        assertTrue(problema.message.contains("renglón 1"), "dice dónde estaba: ${problema.message}")
    }

    // =============================================================================================
    // Lo bueno y lo malo mezclado: es el caso real de un pegado
    // =============================================================================================

    @Test
    fun `un pegado mezclado devuelve los buenos y numera bien los malos`() {
        val leido = lector.leer(
            """
            Ana Ruiz, 2, 0, 0, 5512345678, ana@correo.test
            , 1, 0, 0
            Luis Pérez, uno, 0, 0
            Sofía Gómez
            """.trimIndent(),
        )

        assertEquals(listOf("Ana Ruiz", "Sofía Gómez"), leido.listos.map { it.draft.fullName })
        assertEquals(listOf(2, 3), leido.problemas.map { it.line })
        assertTrue(leido.problemas.all { it.hint.isNotBlank() }, "todo problema trae su corrección sugerida")
    }

    /** El `raw` sirve para localizar el renglón; no se devuelve un pegado entero de vuelta. */
    @Test
    fun `el renglon devuelto se recorta`() {
        val largo = ", " + "x".repeat(500)
        val problema = lector.leer(largo).problemas.single()

        assertTrue(problema.raw.length <= GuestPasteReader.MAX_RAW)
    }

    // =============================================================================================
    // Topes de tamaño (hallazgo de la revisión adversarial de E2)
    // =============================================================================================

    /**
     * Sin tope, `:preview` con 200 000 renglones devolvía 12,9 MB de JSON y `:import` de 1 500
     * ocupaba 26,6 segundos de un hilo de petición —medido contra el backend vivo—, porque el panel
     * relee todos los invitados de la invitación por cada alta. Con cuerpos de pocos megas eso es una
     * denegación de servicio al alcance de cualquier cuenta registrada.
     */
    @Test
    fun `un pegado con mas renglones de la cuenta se corta y lo dice`() {
        val enorme = (1..GuestPasteReader.MAX_RENGLONES + 250).joinToString("\n") { "Invitada $it, 1" }

        val leido = lector.leer(enorme)

        assertEquals(GuestPasteReader.MAX_RENGLONES, leido.listos.size, "no se analiza más allá del tope")
        assertTrue(
            leido.problemas.any { it.message.contains("demasiado larga") },
            "y la clienta se entera de que su lista se cortó, en vez de perder renglones en silencio",
        )
    }

    /** El tope de longitud acota el trabajo aunque el pegado venga en un solo renglón gigantesco. */
    @Test
    fun `un texto larguisimo en un solo renglon tambien se corta`() {
        val leido = lector.leer("Ana Ruiz, 1\n" + "x".repeat(GuestPasteReader.MAX_TEXTO + 5_000))

        assertTrue(leido.problemas.any { it.message.contains("demasiado larga") })
    }

    /** Y una lista de boda de verdad —cientos de renglones— sigue entrando entera. */
    @Test
    fun `una lista real cabe de sobra`() {
        val real = (1..300).joinToString("\n") { "Invitada $it, 2, 0, 0" }

        val leido = lector.leer(real)

        assertEquals(300, leido.listos.size)
        assertTrue(leido.problemas.isEmpty())
    }
}
