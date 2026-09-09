package mx.evolutiondev.invitaciones.core.email

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.JavaMailSenderImpl
import java.io.File

/**
 * El transporte de correo real tiene que salir de `application.yml`, no del codigo (ADR-5-E3-A4-01,
 * mitad sin cerrar del hallazgo S-01 de `diseno/12-producto-completo.md A3`).
 *
 * Hasta este bloque, `core/email/MailConfig.kt` declaraba un `@Bean @Primary JavaMailSender` con el
 * servidor, el puerto, la cuenta y la contrasena de aplicacion escritos a mano. Al ser `@Primary`
 * apagaba `MailSenderAutoConfiguration` —que es `@ConditionalOnMissingBean(MailSender)`—, de modo
 * que `spring.mail.*` no lo leia nadie: sacar esas dos propiedades del `yml` fue cosmetico mientras
 * ese bean existio. Ese fichero se ha borrado y estas pruebas son la guardia de que no vuelve.
 *
 * Las pruebas cargan el `application.yml` **de verdad** (`ConfigDataApplicationContextInitializer`),
 * no una copia: si alguien edita ese fichero y rompe el transporte, esto se pone rojo. Las dos
 * credenciales se inyectan aqui con valores evidentemente falsos; en este repositorio no hay, ni
 * puede haber, ninguna credencial buena.
 */
class MailSenderConfiguracionTest {

    private val cuentaFalsa = "cuenta-de-prueba@ejemplo.invalido"
    private val contrasenaFalsa = "contrasena-de-prueba-inservible"

    private val runner = ApplicationContextRunner()
        .withInitializer(ConfigDataApplicationContextInitializer())
        .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration::class.java))
        .withPropertyValues(
            "MAIL_USERNAME=$cuentaFalsa",
            "MAIL_PASSWORD=$contrasenaFalsa",
        )

    @Test
    fun `el JavaMailSender lo construye Spring Boot desde application_yml y no un bean propio`() {
        runner.run { contexto ->
            val emisores = contexto.getBeanNamesForType(org.springframework.mail.MailSender::class.java)
            assertEquals(
                listOf("mailSender"),
                emisores.toList(),
                "el unico emisor tiene que ser el de MailSenderAutoConfiguration: un @Bean propio " +
                    "(sobre todo si es @Primary) volveria a dejar spring.mail.* sin leer",
            )
            val emisor = contexto.getBean(JavaMailSenderImpl::class.java)
            assertEquals("smtp.gmail.com", emisor.host)
            assertEquals(465, emisor.port)
            assertEquals("smtp", emisor.protocol)
        }
    }

    @Test
    fun `la cuenta y la contrasena salen del entorno, no de ningun valor escrito`() {
        runner.run { contexto ->
            val emisor = contexto.getBean(JavaMailSenderImpl::class.java)
            assertEquals(
                cuentaFalsa,
                emisor.username,
                "si esto no es lo que puso MAIL_USERNAME, hay una cuenta escrita en algun sitio",
            )
            assertEquals(
                contrasenaFalsa,
                emisor.password,
                "si esto no es lo que puso MAIL_PASSWORD, hay una contrasena escrita en algun sitio",
            )
        }
    }

    /**
     * Los nombres de las propiedades de JavaMail son SENSIBLES A MAYUSCULAS y `spring.mail.properties`
     * se enlaza a un `Map<String, String>`, cuyas claves Spring Boot canonicaliza a minusculas salvo
     * que vayan entre corchetes. En forma anidada, `socketFactory` llegaria como `socketfactory`,
     * JavaMail lo ignoraria **en silencio** y el envio quedaria sin fabrica de sockets explicita. Esta
     * prueba mide los nombres exactos que produce el fichero real, que es lo unico que lo demuestra.
     */
    @Test
    fun `las propiedades SMTP llegan a JavaMail con el nombre exacto`() {
        runner.run { contexto ->
            val props = contexto.getBean(JavaMailSenderImpl::class.java).javaMailProperties
            mapOf(
                "mail.transport.protocol" to "smtp",
                "mail.smtp.auth" to "true",
                "mail.smtp.starttls.enable" to "false",
                "mail.smtp.ssl.enable" to "true",
                "mail.smtp.socketFactory.port" to "465",
                "mail.smtp.socketFactory.class" to "javax.net.ssl.SSLSocketFactory",
                "mail.smtp.socketFactory.fallback" to "false",
            ).forEach { (clave, valor) ->
                assertEquals(valor, props.getProperty(clave), "propiedad JavaMail `$clave`")
            }
            assertNull(
                props.getProperty("mail.smtp.socketfactory.class"),
                "clave en minusculas: alguien quito los corchetes del yml y JavaMail no la va a mirar",
            )
        }
    }

    /**
     * `mail.smtp.debug` estaba en `true` en el `yml` y era inofensivo solo porque el `@Primary` lo
     * ignoraba todo. Ahora se aplica: con `true`, JavaMail vuelca la conversacion SMTP completa a la
     * salida estandar, **incluida la linea AUTH con la credencial en base64**.
     */
    @Test
    fun `el volcado de la conversacion SMTP esta apagado`() {
        runner.run { contexto ->
            val emisor = contexto.getBean(JavaMailSenderImpl::class.java)
            assertEquals("false", emisor.javaMailProperties.getProperty("mail.smtp.debug"))
        }
    }

    @Test
    fun `application_yml no trae la cuenta ni la contrasena escritas`() {
        val yml = File(raizDelProyecto(), "src/main/resources/application.yml").readText()
        val bloque = yml.substringAfter("\n  mail:\n").substringBefore("\nemail:\n")
        assertTrue(
            Regex("""^\s*username:\s*\$\{MAIL_USERNAME}\s*$""", RegexOption.MULTILINE).containsMatchIn(bloque),
            "spring.mail.username tiene que ser el marcador \${MAIL_USERNAME}, sin valor por defecto",
        )
        assertTrue(
            Regex("""^\s*password:\s*\$\{MAIL_PASSWORD}\s*$""", RegexOption.MULTILINE).containsMatchIn(bloque),
            "spring.mail.password tiene que ser el marcador \${MAIL_PASSWORD}, sin valor por defecto",
        )
    }

    /**
     * Guardia del resultado no negociable del bloque: en el codigo Kotlin no se configura ningun
     * emisor de correo a mano. Cualquier `JavaMailSenderImpl` construido en `src/main/kotlin` vuelve a
     * abrir la puerta a poner ahi el servidor y las credenciales.
     */
    @Test
    fun `ninguna clase Kotlin construye su propio JavaMailSender`() {
        val fuentes = File(raizDelProyecto(), "src/main/kotlin")
        assertTrue(fuentes.isDirectory, "no encuentro src/main/kotlin desde ${fuentes.absolutePath}")
        val culpables = fuentes.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.readText().contains("JavaMailSenderImpl") }
            .map { it.relativeTo(fuentes).path }
            .toList()
        assertEquals(
            emptyList<String>(),
            culpables,
            "el transporte se configura en application.yml (ADR-5-E3-A4-01), no en el codigo",
        )
    }

    @Test
    fun `el remitente y la autenticacion salen de la misma propiedad`() {
        val fuente = File(
            raizDelProyecto(),
            "src/main/kotlin/mx/evolutiondev/invitaciones/core/email/strategy/GoogleSmtpStrategy.kt",
        ).readText()
        assertTrue(
            fuente.contains("\${spring.mail.username}"),
            "la cabecera From tiene que seguir saliendo de spring.mail.username, que es ya la misma " +
                "cuenta con la que el transporte se autentica",
        )
        assertFalse(fuente.contains("@gmail.com"), "no puede haber ninguna cuenta escrita en la estrategia")
    }

    /**
     * Reproduccion de la forma que tenia el codigo ANTES de ADR-5-E3-A4-01, con valores inventados.
     * No es arqueologia: es la explicacion medida de por que sacar `MAIL_USERNAME`/`MAIL_PASSWORD` al
     * entorno (ADR-5-E3-A3-01) no cambiaba **nada** de lo que hacia la aplicacion, y por que un
     * `@Bean` propio no puede volver.
     */
    @Configuration(proxyBeanMethods = false)
    class ComoEraAntes {
        @Bean
        @Primary
        fun mailSenderEscritoAMano(): JavaMailSender = JavaMailSenderImpl().apply {
            host = "servidor.escrito.en.el.codigo.invalido"
            username = "cuenta-escrita-en-el-codigo@ejemplo.invalido"
        }
    }

    @Test
    fun `con un bean propio la configuracion del yml no la leia nadie (la forma anterior)`() {
        runner
            .withUserConfiguration(ComoEraAntes::class.java)
            // Un puerto que no es un numero: si `spring.mail.*` se enlazara, el contexto NO arrancaria
            // (es exactamente como falla hoy, medido en bitacora/5-E3-A4.md). Arranca, luego no se lee.
            .withPropertyValues("spring.mail.port=esto-no-es-un-puerto")
            .run { contexto ->
                assertNull(contexto.startupFailure, "el contexto arrancaba pese a un spring.mail.* invalido")
                val emisor = contexto.getBean(JavaMailSenderImpl::class.java)
                assertEquals(
                    "servidor.escrito.en.el.codigo.invalido",
                    emisor.host,
                    "el `@Primary` ganaba y `MailSenderAutoConfiguration` (@ConditionalOnMissingBean(MailSender)) " +
                        "ni se activaba: el servidor y las credenciales salian del codigo",
                )
                assertEquals(
                    "cuenta-escrita-en-el-codigo@ejemplo.invalido",
                    emisor.username,
                    "MAIL_USERNAME no llegaba al transporte: la externalizacion era cosmetica",
                )
                assertTrue(
                    emisor.javaMailProperties.isEmpty,
                    "ni siquiera las propiedades SMTP del yml se aplicaban",
                )
            }
    }

    /** Igual que `PgTestCluster`: subir desde el directorio de trabajo hasta la raiz del repositorio. */
    private fun raizDelProyecto(): File {
        var dir: File? = File(System.getProperty("user.dir")).absoluteFile
        while (dir != null) {
            if (File(dir, "settings.gradle.kts").isFile || File(dir, "settings.gradle").isFile) return dir
            dir = dir.parentFile
        }
        return File(System.getProperty("user.dir")).absoluteFile
    }
}
