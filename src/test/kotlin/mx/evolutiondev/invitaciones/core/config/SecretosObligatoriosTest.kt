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
}
