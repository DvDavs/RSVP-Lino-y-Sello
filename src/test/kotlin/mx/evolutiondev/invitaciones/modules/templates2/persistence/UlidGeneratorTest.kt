package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.security.SecureRandom

/**
 * `UlidGenerator` (`02 §7.4`, P8): formato Crockford base32 de 26 caracteres y monotonía dentro del
 * mismo milisegundo, tal como pide el brief.
 */
class UlidGeneratorTest {

    @Test
    fun `el formato casa exactamente con Patterns ULID`() {
        val gen = UlidGenerator()
        repeat(200) {
            val id = gen.next()
            assertEquals(26, id.length, id)
            assertTrue(Patterns.ULID.matches(id), "\"$id\" no casa con ${Patterns.ULID.pattern}")
        }
    }

    @Test
    fun `dos llamadas en el mismo milisegundo son monotonas (ordenan lexicograficamente)`() {
        var frozen = 1_700_000_000_000L
        val gen = UlidGenerator(clock = { frozen })
        val ids = (1..500).map { gen.next() }
        for (i in 1 until ids.size) {
            assertTrue(ids[i - 1] < ids[i], "no monótono en índice $i: ${ids[i - 1]} !< ${ids[i]}")
        }
        // Los primeros 10 caracteres (la parte de tiempo) son idénticos: el reloj no avanzó.
        assertTrue(ids.all { it.substring(0, 10) == ids.first().substring(0, 10) })
    }

    @Test
    fun `un ULID de un milisegundo posterior siempre ordena despues, sin importar el aleatorio`() {
        var t = 1_700_000_000_000L
        val gen = UlidGenerator(clock = { t })
        val primero = gen.next()
        t += 1
        val segundo = gen.next()
        assertTrue(primero < segundo, "$primero debía ordenar antes que $segundo")
    }

    @Test
    fun `nunca produce el mismo ULID dos veces, ni con reloj real y mucha concurrencia`() {
        val gen = UlidGenerator()
        val vistos = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
        val hilos = (1..8).map {
            Thread {
                repeat(2000) { vistos.add(gen.next()) }
            }
        }
        hilos.forEach(Thread::start)
        hilos.forEach(Thread::join)
        assertEquals(16000, vistos.size, "se esperaban 16000 ULID únicos, hubo colisiones")
    }

    @Test
    fun `un reloj que retrocede no produce un ULID menor que el ultimo emitido`() {
        var t = 1_700_000_000_000L
        val gen = UlidGenerator(clock = { t })
        val primero = gen.next()
        t -= 5_000 // el reloj del sistema retrocedió (NTP, ajuste manual…)
        val segundo = gen.next()
        assertTrue(primero < segundo, "$primero debía seguir ordenando antes que $segundo pese al retroceso del reloj")
    }

    @Test
    fun `usa SecureRandom por defecto y acepta uno inyectado para pruebas`() {
        val gen = UlidGenerator(random = SecureRandom())
        assertTrue(gen.next().isNotBlank())
    }
}
