package mx.evolutiondev.invitaciones.modules.product.invitations

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows

/**
 * El freno de caudal de las rutas de escritura del alta (R1-05, tercera pata del hallazgo: «no hay
 * freno de caudal»). Sin contexto de Spring ni peticion HTTP: sin `RequestContextHolder` el cubo de
 * IP es uno solo (`sin-peticion`), que es justo lo que hace falta para probarlo aparte del de cuenta.
 */
class ProductInvitationThrottleTest {

    @Test
    fun `la clienta se queda sin cupo al pasar de su tope`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 5, maxPorIp = 1000)

        repeat(5) { assertDoesNotThrow { freno.comprobarYRegistrar(1L) } }

        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(1L) }
    }

    @Test
    fun `el cupo de una clienta no gasta el de otra`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 2, maxPorIp = 1000)

        repeat(2) { freno.comprobarYRegistrar(1L) }
        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(1L) }

        assertDoesNotThrow { freno.comprobarYRegistrar(2L) }
    }

    /** La otra mitad: un guion que rote de cuenta sigue topando por IP. */
    @Test
    fun `rotar de cuenta no esquiva el cubo de la IP`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 1000, maxPorIp = 4)

        repeat(4) { i -> freno.comprobarYRegistrar(i.toLong()) }

        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(99L) }
    }

    @Test
    fun `la ventana caduca y devuelve el cupo`() {
        var ahora = 0L
        val freno = ProductInvitationThrottle(maxPorCuenta = 2, maxPorIp = 1000, ventanaMinutos = 15)
            .apply { reloj = { ahora } }

        repeat(2) { freno.comprobarYRegistrar(1L) }
        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(1L) }

        ahora += 15 * 60_000L
        assertDoesNotThrow { freno.comprobarYRegistrar(1L) }
    }

    @Test
    fun `el cuerpo del 429 es constante y no dice por que cubo se bloqueo`() {
        val porCuenta = ProductInvitationThrottle(maxPorCuenta = 0, maxPorIp = 1000)
        val porIp = ProductInvitationThrottle(maxPorCuenta = 1000, maxPorIp = 0)

        val a = assertThrows<DemasiadasInvitacionesException> { porCuenta.comprobarYRegistrar(1L) }
        val b = assertThrows<DemasiadasInvitacionesException> { porIp.comprobarYRegistrar(1L) }

        assertEquals(a.message, b.message)
        assertEquals(a.details, b.details)
        assertEquals("PRD_TOO_MANY_REQUESTS", a.code)
    }
}
