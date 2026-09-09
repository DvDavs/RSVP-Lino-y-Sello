package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock

/**
 * El puente de §A4.4 en forma de prueba: que las condiciones de los **seis** motivos de fallo sigan
 * dentro de la misma consulta.
 *
 * No toca la base de datos (no hay ninguna en las pruebas de este módulo), así que lo que se afirma
 * es la forma de la consulta. Parece poco y no lo es: el día en que alguien saque una de estas
 * condiciones a Kotlin —«para dar un mensaje más útil», que es siempre el motivo— la respuesta
 * dejará de ser un `null` indistinguible y volverá a haber un oráculo de enumeración. Esta prueba lo
 * caza en el momento.
 */
class RsvpPuenteSqlTest {

    private val sql = RsvpGuestReader(mock()).sql

    @Test
    fun `la consulta es una sola y une invitado, invitacion, anfitrion, documento y release`() {
        assertEquals(1, contar("SELECT"), "el puente resuelve todo con una sola consulta")
        assertTrue(sql.contains("FROM invitation_guest g"), "parte del invitado")
        assertTrue(sql.contains("JOIN invitation i"), "sube a la invitacion, que es la tabla comun")
        assertTrue(sql.contains("JOIN customer c"), "y al anfitrion, para sus dos banderas")
        assertTrue(sql.contains("JOIN tpl_document d"), "de ahi baja al documento de templates2")
        assertTrue(sql.contains("JOIN tpl_release r"), "y al release, que es lo que dice si esta publicada")
    }

    /**
     * `d.invitation_id = i.id` y `r.invitation_id = i.id` son la traducción de §A4.4 y, a la vez, la
     * comprobación de propiedad de §0.3 razón 2: con un solo token la unión **es** la comprobación,
     * así que no existe un cruce que alguien pueda olvidarse de hacer. Ese olvido es exactamente el
     * origen del hallazgo S-04 en la superficie heredada.
     */
    @Test
    fun `la union es la comprobacion de propiedad, no una comprobacion aparte`() {
        assertTrue(sql.contains("JOIN tpl_document d ON d.invitation_id = i.id"))
        assertTrue(sql.contains("JOIN tpl_release r ON r.invitation_id = i.id AND r.is_active"))
        assertTrue(sql.contains("d.public_token"), "el publicToken sale de aqui, no de otra consulta")
    }

    /**
     * Los seis motivos, uno por uno, y todos dentro de la consulta. Cinco son condiciones; el sexto
     * —token mal formado— se descarta antes, en [PublicRsvpService].
     */
    @Test
    fun `los cinco motivos de fallo consultables son condiciones de la misma consulta`() {
        assertTrue(sql.contains("WHERE g.confirmation_token = :confirmationToken"), "1. token inexistente")
        assertTrue(sql.contains("AND COALESCE(g.is_enabled, TRUE)"), "2. invitado deshabilitado")
        assertTrue(sql.contains("AND COALESCE(i.is_enabled, TRUE)"), "3. invitacion deshabilitada")
        assertTrue(sql.contains("AND COALESCE(c.is_enabled, TRUE)"), "4. anfitrion deshabilitado")
        assertTrue(sql.contains("AND NOT COALESCE(c.is_banned, FALSE)"), "5. anfitrion bloqueado")
        // El release inactivo es el JOIN de arriba: sin fila activa no hay resultado.
        assertTrue(sql.contains("AND r.is_active"), "6. invitacion sin release activo")
    }

    /**
     * Ninguna columna con datos personales que el contrato no pida entra siquiera en la proyección.
     * Del correo solo sale un booleano calculado en SQL, así que **la dirección no llega a viajar**
     * desde la base de datos al proceso.
     */
    @Test
    fun `la proyeccion no trae correo, telefono, mesa ni tokens`() {
        listOf(
            "g.email," to "la direccion de correo no se selecciona",
            "g.phone" to "el telefono no se selecciona",
            "g.table_number" to "la mesa es dato del anfitrion",
            "g.cancellation_token" to "el cancellationToken no se expone nunca (§0.4)",
            "g.confirmation_token," to "el token no vuelve en la proyeccion",
            "SELECT g.*" to "nunca se trae la fila entera del invitado",
            "SELECT *" to "nunca se trae todo",
        ).forEach { (prohibido, motivo) ->
            assertTrue(!sql.contains(prohibido), "$motivo — pero la consulta contiene \"$prohibido\"")
        }
        assertTrue(
            sql.contains("(g.email IS NOT NULL AND btrim(g.email) <> '') AS has_email"),
            "del correo solo sale un booleano",
        )
    }

    /** El parámetro va enlazado, nunca concatenado: un token es entrada de un desconocido. */
    @Test
    fun `el token viaja como parametro enlazado`() {
        assertTrue(sql.contains(":confirmationToken"))
        assertTrue(!sql.contains("'\$"), "nada de interpolar el token en el SQL")
        assertTrue(!sql.contains("\${"), "nada de plantillas de cadena en el SQL")
    }

    private fun contar(palabra: String) = Regex(palabra).findAll(sql).count()
}
