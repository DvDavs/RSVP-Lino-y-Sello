package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * El CSV que descarga la clienta, mirado como lo que es: **un archivo que se abre en Excel**.
 *
 * La prueba que manda en esta clase es la de inyección de fórmulas. Se reprodujo contra el backend
 * vivo antes del arreglo, y por el camino que menos se espera: un invitado **anónimo**, sin cuenta,
 * escribió `=HYPERLINK("http://…","Felicidades")` en el `message` de `PUT /public/` + `r/{token}` y
 * ese texto salió tal cual en la columna «Mensaje» del CSV. Es decir, la superficie más expuesta del
 * producto llegaba hasta la hoja de cálculo de la clienta, que es donde una fórmula se ejecuta.
 */
class GuestCsvWriterTest {

    private val escritor = GuestCsvWriter()

    @Test
    fun `un nombre que empieza por igual no sale como formula`() {
        val csv = escribir(item(fullName = "=cmd|'/c calc'!A1"))

        assertTrue(csv.contains("'=cmd|'/c calc'!A1"), "se antepone el apostrofo que la marca como texto")
        assertFalse(
            csv.lines().any { it.startsWith("=") },
            "ninguna celda puede empezar la línea con = : Excel la evaluaría",
        )
    }

    /**
     * Los cuatro preámbulos que evalúan Excel, LibreOffice y Google Sheets, más el tabulador. El
     * retorno de carro no hace falta probarlo: la celda ya lo convierte en espacio antes.
     */
    @Test
    fun `los cuatro prefijos de formula quedan neutralizados`() {
        listOf("=1+1", "+1+1", "-1+1", "@SUM(A1)", "\tA").forEach { payload ->
            val csv = escribir(item(fullName = payload))
            val celda = csv.lines()[1].substringBefore(',')
            assertTrue(
                celda.startsWith("'") || celda.startsWith("\"'"),
                "«$payload» tendría que salir neutralizado, y salió «$celda»",
            )
        }
    }

    /**
     * El vector real: el texto lo escribe el **invitado** desde la ruta pública y viaja a la columna
     * «Mensaje». El entrecomillado del RFC 4180 no protege de nada aquí —es sintaxis del CSV, no del
     * evaluador de fórmulas—, así que la comilla tiene que estar **dentro** de las comillas.
     */
    @Test
    fun `el mensaje que escribe el invitado tampoco puede ser una formula`() {
        val csv = escribir(item(message = "=HYPERLINK(\"http://evil.example/x\",\"Felicidades\")"))

        assertTrue(csv.contains("\"'=HYPERLINK("), "la celda entrecomillada empieza por apostrofo")
    }

    /** Lo de siempre sigue igual: sin tocar el texto normal y sin tokens en ninguna columna. */
    @Test
    fun `un nombre normal no se toca y el csv no lleva tokens`() {
        val csv = escribir(item(fullName = "María Fernanda Cruz", message = "Nos vemos"))

        assertTrue(csv.contains("María Fernanda Cruz,"))
        assertTrue(csv.contains("Nos vemos"))
        assertFalse(csv.contains("'María"), "no se ensucia lo que no es peligroso")
        assertEquals(1, csv.lines().count { it.startsWith(GuestCsvWriter.BOM) }, "el BOM va una sola vez")
    }

    private fun escribir(vararg items: GuestItem) = String(escritor.escribir(items.toList()))

    private fun item(
        fullName: String = "Invitada",
        message: String? = null,
    ) = GuestItem(
        id = 1,
        fullName = fullName,
        email = null,
        phone = null,
        tableNumber = null,
        adults = 1,
        children = 0,
        young = 0,
        adultsConfirmed = 0,
        childrenConfirmed = 0,
        youngConfirmed = 0,
        status = "PENDING",
        message = message,
        updatedAt = null,
    )
}
