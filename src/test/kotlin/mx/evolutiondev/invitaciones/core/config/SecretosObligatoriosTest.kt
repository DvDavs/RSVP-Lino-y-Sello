package mx.evolutiondev.invitaciones.core.config

import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.mock.env.MockEnvironment

/**
 * La compuerta de secretos y su interruptor explicito.
 *
 * Fase 5, E3-C3 · ADR-5-E3-C3-01 · **R1-13** de `bitacora/5-E3-R1-seguridad.md`: la compuerta se
 * retiraba sola por la **presencia de una clase** (`spring-boot-test` en el classpath), condicion
 * que el operador no controla. Estas pruebas fijan el comportamiento del interruptor que se anadio
 * para que si la controle, y de paso dejan escrito lo que se espera del mensaje de fallo.
 *
 * Estas pruebas corren, por definicion, con `spring-boot-test` en el classpath: el defecto aqui es
 * "no exigir". Por eso el caso que exige se escribe con la propiedad puesta a `true`.
 */
@DisplayName("SecretosObligatorios: interruptor explicito (ADR-5-E3-C3-01, R1-13)")
class SecretosObligatoriosTest {

    private val compuerta = SecretosObligatorios()
    private val aplicacion = SpringApplication()

    @Test
    fun `por defecto en pruebas la compuerta no corre`() {
        // Sin la propiedad y con spring-boot-test en el classpath: no revienta aunque falte todo.
        compuerta.postProcessEnvironment(MockEnvironment(), aplicacion)
    }

    @Test
    fun `con el interruptor a true la compuerta corre aunque estemos en pruebas`() {
        val entorno = MockEnvironment().withProperty(SecretosObligatorios.PROPIEDAD_EXIGIR, "true")
        val error = assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entorno, aplicacion)
        }
        val mensaje = error.message!!
        assertTrue(mensaje.contains("JWT_SECRET"), "tiene que nombrar la variable que falta: $mensaje")
        assertTrue(mensaje.contains("MAIL_PASSWORD"), "y todas las demas: $mensaje")
        assertTrue(mensaje.contains("Falta 5 de 5"), "y cuantas son: $mensaje")
        // Lo que NO puede pasar: que la compuerta empiece a exigir los de WhatsApp (ADR-5-E3-C3-01).
        assertTrue(!mensaje.contains("WHATSAPP"), "WhatsApp NO impide el arranque: $mensaje")
    }

    @Test
    fun `con el interruptor a true y las cinco puestas no revienta`() {
        val entorno = MockEnvironment()
            .withProperty(SecretosObligatorios.PROPIEDAD_EXIGIR, "true")
            .withProperty("JWT_SECRET", "clave-de-prueba-larga-de-mas-de-32-caracteres")
            .withProperty("AWS_ACCESS_KEY_ID", "inservible")
            .withProperty("AWS_SECRET_ACCESS_KEY", "inservible")
            .withProperty("MAIL_USERNAME", "correo@ejemplo.invalido")
            .withProperty("MAIL_PASSWORD", "inservible")
        compuerta.postProcessEnvironment(entorno, aplicacion)
    }

    @Test
    fun `una cadena en blanco cuenta como ausente`() {
        val entorno = MockEnvironment()
            .withProperty(SecretosObligatorios.PROPIEDAD_EXIGIR, "true")
            .withProperty("JWT_SECRET", "   ")
        val error = assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entorno, aplicacion)
        }
        assertTrue(error.message!!.contains("JWT_SECRET"))
    }

    @Test
    fun `con el interruptor a false la compuerta no corre`() {
        val entorno = MockEnvironment().withProperty(SecretosObligatorios.PROPIEDAD_EXIGIR, "false")
        compuerta.postProcessEnvironment(entorno, aplicacion)
    }

    // -------------------------------------------------------------------------------------
    // R1-14 · la entropia de JWT_SECRET
    // -------------------------------------------------------------------------------------

    private fun entornoCon(clave: String) = MockEnvironment()
        .withProperty(SecretosObligatorios.PROPIEDAD_EXIGIR, "true")
        .withProperty("JWT_SECRET", clave)
        .withProperty("AWS_ACCESS_KEY_ID", "inservible")
        .withProperty("AWS_SECRET_ACCESS_KEY", "inservible")
        .withProperty("MAIL_USERNAME", "correo@ejemplo.invalido")
        .withProperty("MAIL_PASSWORD", "inservible")

    /**
     * **R1-14, la mitad que faltaba.** jjwt rechaza las claves de menos de 256 bits y la compuerta
     * rechazaba las vacias: 32 caracteres IGUALES pasaban las dos puertas. Miden 256 bits de material
     * y cero de secreto.
     */
    @Test
    @DisplayName("R1-14: 32 caracteres iguales NO son una clave de firma")
    fun laClaveDeUnSoloCaracterNoPasa() {
        val error = assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entornoCon("a".repeat(32)), aplicacion)
        }
        val mensaje = error.message!!
        assertTrue(mensaje.contains("JWT_SECRET"), "tiene que nombrar la variable: $mensaje")
        assertTrue(mensaje.contains("openssl rand"), "y decir COMO generar una buena: $mensaje")
        // Y no puede sugerir ningun valor concreto: aqui no se inventan claves.
        assertTrue(mensaje.contains("NO se genera ninguna clave"), mensaje)
    }

    @Test
    @DisplayName("R1-14: un patron corto repetido tampoco pasa")
    fun elPatronRepetidoNoPasa() {
        assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entornoCon("abcdefgh".repeat(8)), aplicacion)
        }
        assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entornoCon("ab".repeat(24)), aplicacion)
        }
    }

    @Test
    @DisplayName("R1-14: una clave corta se rechaza aqui, con nombre y remedio")
    fun laClaveCortaNoPasa() {
        val error = assertFailsWith<IllegalStateException> {
            compuerta.postProcessEnvironment(entornoCon("k7Qw2ZpL9xTn"), aplicacion)
        }
        assertTrue(error.message!!.contains("32"), "tiene que decir cuantos caracteres faltan: ${error.message}")
    }

    /**
     * La otra cara: lo que la comprobacion NO puede hacer es suspender a una clave aleatoria de la
     * longitud recomendada, que es lo que sale de `openssl rand`. Las tres de aqui son cadenas
     * aleatorias inservibles (no son secretos de nadie: se generaron para esta prueba y solo viven
     * aqui), en los tres alfabetos tipicos: base64, hexadecimal y minusculas.
     */
    @Test
    @DisplayName("R1-14: una clave aleatoria de la longitud recomendada pasa")
    fun laClaveAleatoriaPasa() {
        listOf(
            "9Kq3vZ7pR2mN8xJ4wL6tY1bH5sG0dF3cA7eU9iO2kP4",
            "3f8b1d9c04a7e2650b3d8f1a9c4e7b2058d1f3a6c9e0b4d7",
            "wzmqbtxrknhdgvfpjycslaeuozqbmxtwkrndhgvfpjys",
        ).forEach { clave ->
            compuerta.postProcessEnvironment(entornoCon(clave), aplicacion)
        }
    }

    /**
     * Y no puede romper el arranque de desarrollo: el valor que define `scripts/dev-backend.sh` es
     * evidentemente falso, pero no es degenerado, y tiene que seguir sirviendo.
     */
    @Test
    @DisplayName("R1-14: la clave de desarrollo de dev-backend.sh sigue arrancando")
    fun laClaveDeDesarrolloSigueValiendo() {
        compuerta.postProcessEnvironment(
            entornoCon("clave-jwt-solo-de-desarrollo-no-sirve-en-ningun-otro-sitio-0000"),
            aplicacion,
        )
    }
}
