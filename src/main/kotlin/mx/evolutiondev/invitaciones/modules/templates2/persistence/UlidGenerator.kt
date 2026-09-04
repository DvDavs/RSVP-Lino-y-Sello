package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.stereotype.Component
import java.math.BigInteger
import java.security.SecureRandom

/**
 * ULID (Crockford base32, [Patterns.ULID][mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns])
 * **monótono**: dos llamadas dentro del mismo milisegundo producen ULIDs que ordenan lexicográficamente
 * en el orden en que se generaron (parte aleatoria de 80 bits incrementada en 1, spec "Monotonicity" de
 * ulid/spec). Es la **única** fuente de `assetId`, `itemId` y `public_token` (P8, `02 §7.4`): el
 * servidor genera todos los identificadores expuestos, el cliente nunca los aporta.
 *
 * Instancia con estado (`lastTimestamp`/`lastRandom`), sincronizada: un `@Component` singleton de
 * Spring, no un `object`, para que las pruebas puedan construir instancias aisladas con reloj/random
 * inyectados.
 */
@Component
class UlidGenerator(
    private val random: SecureRandom = SecureRandom(),
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val lock = Any()
    private var lastTimestamp: Long = -1L
    private var lastRandom: BigInteger = BigInteger.ZERO

    /** Genera el siguiente ULID, 26 caracteres. */
    fun next(): String = synchronized(lock) {
        var ts = clock() and TIMESTAMP_MASK
        if (ts < lastTimestamp) ts = lastTimestamp // el reloj nunca retrocede la salida (P8)

        var rnd: BigInteger
        if (ts == lastTimestamp) {
            rnd = lastRandom.add(BigInteger.ONE)
            if (rnd.bitLength() > 80) {
                // Desbordamiento de los 80 bits aleatorios dentro del mismo milisegundo: 2^80 ULIDs en
                // 1 ms es preocupación teórica, no práctica; se resuelve avanzando el reloj lógico 1 ms
                // en vez de repetir un ULID o lanzar (P1: nunca fallar en silencio, nunca colisionar).
                ts += 1
                rnd = randomBits()
            }
        } else {
            rnd = randomBits()
        }
        lastTimestamp = ts
        lastRandom = rnd
        encode(ts, rnd)
    }

    private fun randomBits(): BigInteger {
        val bytes = ByteArray(10) // 80 bits
        random.nextBytes(bytes)
        return BigInteger(1, bytes)
    }

    companion object {
        private const val ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
        private val BASE = BigInteger.valueOf(32)
        private const val TIMESTAMP_MASK = 0xFFFFFFFFFFFFL // 48 bits

        internal fun encode(timestampMs: Long, random80: BigInteger): String {
            var value = BigInteger.valueOf(timestampMs).shiftLeft(80).or(random80)
            val chars = CharArray(26)
            for (i in 25 downTo 0) {
                val divRem = value.divideAndRemainder(BASE)
                chars[i] = ALPHABET[divRem[1].toInt()]
                value = divRem[0]
            }
            return String(chars)
        }
    }
}
