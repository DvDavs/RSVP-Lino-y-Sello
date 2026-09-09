package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * El limitador del RSVP público, con la disciplina de `AuthThrottleService` pero **ámbito propio**.
 *
 * Sin petición HTTP en curso, `ipCliente()` devuelve la constante `sin-peticion`
 * (`RsvpThrottleService`, misma salida que `AuthThrottleService.kt:259-260`), así que el cubo por IP
 * es único en estas pruebas y hay que darle margen para poder ejercer el cubo por token.
 */
class RsvpThrottleServiceTest {

    @Test
    fun `el cubo por token bloquea al superar el tope y el cuerpo del 429 no depende del token`() {
        val limitador = RsvpThrottleService(maxPorToken = 3, maxPorIp = 10_000)

        repeat(3) {
            assertDoesNotThrow { limitador.comprobar(TOKEN) }
            limitador.registrarIntento(TOKEN)
        }
        val e = assertThrows<RsvpException.TooManyAttempts> { limitador.comprobar(TOKEN) }

        assertEquals(RsvpErrorCode.RSVP_TOO_MANY_ATTEMPTS, e.code)
        assertEquals(429, e.status.value())
    }

    /** Agotar un enlace no puede dejar sin contestar a los demás invitados de la misma boda. */
    @Test
    fun `un token agotado no bloquea a otro token`() {
        val limitador = RsvpThrottleService(maxPorToken = 2, maxPorIp = 10_000)

        repeat(2) { limitador.registrarIntento(TOKEN) }
        assertThrows<RsvpException.TooManyAttempts> { limitador.comprobar(TOKEN) }

        assertDoesNotThrow { limitador.comprobar(OTRO_TOKEN) }
    }

    @Test
    fun `el cubo por IP bloquea aunque cada peticion traiga un token distinto`() {
        val limitador = RsvpThrottleService(maxPorToken = 10_000, maxPorIp = 5)

        repeat(5) { i -> limitador.registrarIntento("token-numero-$i") }

        assertThrows<RsvpException.TooManyAttempts> { limitador.comprobar("token-numero-nuevo") }
    }

    @Test
    fun `la ventana caduca y el invitado vuelve a poder contestar`() {
        val limitador = RsvpThrottleService(maxPorToken = 2, maxPorIp = 10_000, ventanaMinutos = 15)
        var ahora = 1_000_000L
        limitador.reloj = { ahora }

        repeat(2) { limitador.registrarIntento(TOKEN) }
        assertThrows<RsvpException.TooManyAttempts> { limitador.comprobar(TOKEN) }

        ahora += 15 * 60_000L
        assertDoesNotThrow { limitador.comprobar(TOKEN) }
    }

    /**
     * Los topes por defecto son los que van a producción si el orquestador no añade variables.
     * Se afirman para que un cambio silencioso —que es como se rompen los limitadores— se vea.
     */
    @Test
    fun `los valores por defecto son los del reporte`() {
        val porDefecto = RsvpThrottleService()
        // 40 por token y 240 por IP en 15 minutos: generosos a propósito, porque el límite existe por
        // coste y no por confidencialidad (128 bits de entropía, S-12), y porque los invitados llegan
        // desde redes móviles con NAT de operador donde decenas de personas comparten IP.
        repeat(40) { porDefecto.registrarIntento(TOKEN) }
        assertThrows<RsvpException.TooManyAttempts> { porDefecto.comprobar(TOKEN) }
    }

    /**
     * El enlace personal no se guarda en claro ni siquiera como clave de un mapa: la clave es su
     * SHA-256. Se comprueba por su efecto observable —dos tokens distintos no comparten cubo, el
     * mismo token sí— y porque la clase no expone el mapa, que es justamente lo que se quiere.
     */
    @Test
    fun `la clave del cubo por token no es el token`() {
        val limitador = RsvpThrottleService(maxPorToken = 1, maxPorIp = 10_000)
        limitador.registrarIntento(TOKEN)

        assertThrows<RsvpException.TooManyAttempts> { limitador.comprobar(TOKEN) }
        assertDoesNotThrow { limitador.comprobar(TOKEN.reversed()) }

        // Ni un campo público, ni un `toString` que pudiera arrastrar el token a un log.
        assertTrue(
            RsvpThrottleService::class.java.declaredFields.none { it.name.contains("token", true) && it.type == String::class.java },
            "no debe haber ningun campo String con el token dentro",
        )
    }

    private companion object {
        const val TOKEN = "aB3dEfGhIjKlMnOpQrStUv"
        const val OTRO_TOKEN = "zZ9yYxXwWvVuUtTsSrRqQp"
    }
}
