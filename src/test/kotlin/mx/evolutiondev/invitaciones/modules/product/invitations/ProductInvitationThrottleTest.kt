package mx.evolutiondev.invitaciones.modules.product.invitations

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows

/**
 * El freno de caudal de las rutas de escritura del alta (R1-05, tercera pata del hallazgo: «no hay
 * freno de caudal»), ya corregido con lo que R2-01 objetó. Sin contexto de Spring ni peticion HTTP:
 * sin `RequestContextHolder` el cubo de IP es uno solo (`sin-peticion`), que es justo lo que hace
 * falta para probarlo aparte del de cuenta.
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

    /**
     * La otra mitad, y **solo con proxy de confianza declarado** (R2-01): un guion que rote de
     * cuenta sigue topando por IP cuando la IP que se ve es de verdad la del cliente.
     */
    @Test
    fun `rotar de cuenta no esquiva el cubo de la IP cuando hay proxy de confianza`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 1000, maxPorIp = 4, confiarEnXff = true)

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
        val porIp = ProductInvitationThrottle(maxPorCuenta = 1000, maxPorIp = 0, confiarEnXff = true)

        val a = assertThrows<DemasiadasInvitacionesException> { porCuenta.comprobarYRegistrar(1L) }
        val b = assertThrows<DemasiadasInvitacionesException> { porIp.comprobarYRegistrar(1L) }

        assertEquals(a.message, b.message)
        assertEquals(a.details, b.details)
        assertEquals("PRD_TOO_MANY_REQUESTS", a.code)
    }

    /**
     * R2-01, la mitad grave. `confiar-en-x-forwarded-for` es `false` por defecto y tiene que serlo,
     * así que detrás de un proxy `remoteAddr` es el del proxy **para todo el mundo**: con el cubo por
     * IP contando siempre, sesenta escrituras de cualquiera dejaban a la plataforma entera sin poder
     * crear ni borrar invitaciones. Aquí el tope por IP es 1 y pasan veinte clientas distintas: antes
     * del arreglo, la segunda recibía `429`.
     */
    @Test
    fun `sin proxy de confianza el cubo por IP no puede bloquear a toda la plataforma`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 1000, maxPorIp = 1)

        repeat(20) { i -> assertDoesNotThrow { freno.comprobarYRegistrar(i.toLong()) } }
    }

    /**
     * R2-01/R2-04: agotar el alta **no** puede quitarle a la clienta el borrado, que es la salida que
     * R1-05 construyó para que pudiera destrabarse del tope de tres borradores.
     */
    @Test
    fun `agotar el alta deja intacta la salida del borrado`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 2, maxBorradosPorCuenta = 30)

        repeat(2) { freno.comprobarYRegistrar(1L, OperacionInvitacion.ALTA) }
        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(1L, OperacionInvitacion.ALTA) }

        repeat(3) { assertDoesNotThrow { freno.comprobarYRegistrar(1L, OperacionInvitacion.BORRADO) } }
    }

    /** Y al revés: quien se pase borrando tampoco se queda sin poder crear. */
    @Test
    fun `agotar el borrado no gasta el cupo del alta`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 20, maxBorradosPorCuenta = 2)

        repeat(2) { freno.comprobarYRegistrar(1L, OperacionInvitacion.BORRADO) }
        assertThrows<DemasiadasInvitacionesException> { freno.comprobarYRegistrar(1L, OperacionInvitacion.BORRADO) }

        assertDoesNotThrow { freno.comprobarYRegistrar(1L, OperacionInvitacion.ALTA) }
    }
}
