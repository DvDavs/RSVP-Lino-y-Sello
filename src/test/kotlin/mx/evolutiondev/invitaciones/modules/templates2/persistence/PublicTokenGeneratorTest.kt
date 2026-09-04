package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.math.BigInteger
import java.security.SecureRandom

/**
 * ADR-2-ORQ-01 en forma de prueba: el `public_token` es una **URL-capacidad** que el render público
 * sirve sin autenticación (`03 §2` fila 15), así que adivinarlo *es* el acceso. No basta con que dos
 * tokens sean distintos: hay que comprobar que **no guardan relación**, porque el `UlidGenerator`
 * monótono produce tokens distintos y aun así triviales de adivinar (el siguiente es el anterior + 1
 * dentro del mismo milisegundo).
 */
class PublicTokenGeneratorTest {

    private val generador = PublicTokenGenerator()

    @Test
    fun `el token casa el CHECK de V32 y el patron del dominio`() {
        repeat(200) {
            val token = generador.next()
            assertTrue(
                Patterns.PUBLIC_TOKEN.matches(token.value),
                "token \"$token\" no casa ck_tpl_document_public_token",
            )
            assertEquals(30, token.value.length, "public_token es VARCHAR(30): pub_ + 26 (02 §2 V32)")
        }
    }

    @Test
    fun `dos tokens consecutivos no guardan relacion, ni siquiera con el reloj congelado`() {
        // 2 000 tokens seguidos, todos "en el mismo instante" desde el punto de vista del atacante.
        val valores = (1..2_000).map { decodificar(generador.sufijo()) }

        // 1. Todos distintos.
        assertEquals(valores.size, valores.toSet().size, "hubo tokens repetidos")

        // 2. La distancia entre consecutivos NO es constante (un contador la haría constante).
        val distancias = valores.zipWithNext { a, b -> b.subtract(a).abs() }
        assertTrue(distancias.toSet().size > distancias.size * 9 / 10, "las distancias se repiten: hay estructura")

        // 3. Ninguna distancia es pequeña. Con 130 bits uniformes, que dos tokens de una muestra de
        //    2 000 disten menos de 2^100 tiene probabilidad ~2·10^-3 por par acumulado; un generador
        //    monótono da distancia 1 y falla aquí de inmediato.
        val umbral = BigInteger.TWO.pow(100)
        val cercanas = distancias.count { it < umbral }
        assertEquals(0, cercanas, "hay $cercanas pares de tokens consecutivos separados por menos de 2^100")
    }

    @Test
    fun `el ULID monotono SI es adivinable, por eso no se usa para el token publico`() {
        // Reloj congelado: es el caso real de dos invitaciones creadas en el mismo milisegundo.
        val ulids = UlidGenerator(SecureRandom(), { 1_700_000_000_000L })
        val a = decodificar(ulids.next())
        val b = decodificar(ulids.next())
        val c = decodificar(ulids.next())

        // Esto es lo que hace inaceptable al ULID monótono como capacidad: el sucesor es exactamente
        // el anterior + 1. Si esta aserción dejara de cumplirse, `UlidGenerator` habría perdido su
        // monotonicidad (que sí necesitan `assetId`/`itemId`), no que el token sea seguro.
        assertEquals(BigInteger.ONE, b.subtract(a), "el ULID monótono debe incrementar en 1 (spec Monotonicity)")
        assertEquals(BigInteger.ONE, c.subtract(b))

        // Y el contraste: el generador del token público, con la misma muestra, no lo hace.
        val t1 = decodificar(generador.sufijo())
        val t2 = decodificar(generador.sufijo())
        assertTrue(
            t2.subtract(t1).abs() > BigInteger.TWO.pow(100),
            "el PublicTokenGenerator produjo dos tokens contiguos: sería adivinable (ADR-2-ORQ-01)",
        )
    }

    @Test
    fun `usa el SecureRandom que se le inyecta y solo el alfabeto Crockford`() {
        val fijo = object : SecureRandom() {
            override fun nextInt(bound: Int): Int = 7
        }
        val token = PublicTokenGenerator(fijo).sufijo()
        assertEquals("7".repeat(26), token)
        assertTrue(token.all { PublicTokenGenerator.ALFABETO.contains(it) })
    }

    /** Crockford base32 → entero, para poder medir distancias entre tokens. */
    private fun decodificar(sufijo: String): BigInteger {
        var valor = BigInteger.ZERO
        for (c in sufijo) {
            val i = PublicTokenGenerator.ALFABETO.indexOf(c)
            check(i >= 0) { "carácter fuera del alfabeto Crockford: $c" }
            valor = valor.multiply(BigInteger.valueOf(32)).add(BigInteger.valueOf(i.toLong()))
        }
        return valor
    }
}
