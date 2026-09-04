package mx.evolutiondev.invitaciones.modules.templates2.catalog

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.test.context.runner.ApplicationContextRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.AnnotatedElementUtils
import java.io.File
import java.nio.file.Files

/**
 * El comando de línea de P4 ("sin reiniciar, sin token") **no debe correr en el arranque normal**.
 * `@ConditionalOnProperty` sin `matchIfMissing` es lo que lo garantiza; estas pruebas comprueban las
 * dos ramas con un contexto real y, además, que el comando recorre el mismo servicio que la ruta HTTP
 * (no hay una segunda vía de alta, `02 §4` cierre).
 */
class TemplateRegisterCommandTest {

    @Configuration(proxyBeanMethods = false)
    class ConfigDePrueba {
        @Bean
        fun servicio(): TemplateRegistrationService = mock()
    }

    /**
     * `TemplateRegisterCommand` se registra **como componente**, no con un `@Bean`: `@Conditional` solo
     * se evalúa al registrar la clase (escaneo o `register(...)`), que es como llega en producción. Con
     * un `@Bean` la condición se ignoraría y la prueba pasaría siempre, midiendo nada.
     */
    private val runner = ApplicationContextRunner()
        .withUserConfiguration(ConfigDePrueba::class.java, TemplateRegisterCommand::class.java)

    @Test
    fun `con la configuracion por defecto el comando NO existe`() {
        runner.run { contexto ->
            assertTrue(
                contexto.getBeanNamesForType(TemplateRegisterCommand::class.java).isEmpty(),
                "sin --templates2.register.enabled=true no puede haber ningún ApplicationRunner de registro",
            )
        }
    }

    @Test
    fun `solo con templates2_register_enabled a true aparece el bean`() {
        runner.withPropertyValues("${TemplateRegisterCommand.ENABLED}=true").run { contexto ->
            assertEquals(1, contexto.getBeanNamesForType(TemplateRegisterCommand::class.java).size)
        }
    }

    @Test
    fun `con la propiedad a false tampoco aparece`() {
        runner.withPropertyValues("${TemplateRegisterCommand.ENABLED}=false").run { contexto ->
            assertTrue(contexto.getBeanNamesForType(TemplateRegisterCommand::class.java).isEmpty())
        }
    }

    @Test
    fun `la condicion es exactamente la propiedad documentada, sin matchIfMissing`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            TemplateRegisterCommand::class.java, ConditionalOnProperty::class.java,
        )!!
        assertEquals(listOf(TemplateRegisterCommand.ENABLED), anotacion.name.toList())
        assertEquals("true", anotacion.havingValue)
        assertEquals(false, anotacion.matchIfMissing)
    }

    @Test
    fun `registra un paquete desde un directorio del disco`() {
        val servicio: TemplateRegistrationService = mock()
        whenever(servicio.register(any(), anyOrNull())).doReturn(salidaFalsa())
        val tmp = Files.createTempDirectory("t2-3-cli").toFile()
        try {
            val dir = PaqueteFixture.directorio(
                PaqueteFixture.ejemplo("xv-jardin-1.0.0"), tmp, "xv-jardin", "1.0.0",
            )
            TemplateRegisterCommand(servicio).registrar(dir, 7L)
            verify(servicio).register(any(), org.mockito.kotlin.eq(7L))
        } finally {
            tmp.deleteRecursively()
        }
    }

    @Test
    fun `registra un paquete desde un ZIP`() {
        val servicio: TemplateRegistrationService = mock()
        whenever(servicio.register(any(), anyOrNull())).doReturn(salidaFalsa())
        val zip = File.createTempFile("t2-3-cli", ".zip")
        try {
            zip.writeBytes(PaqueteFixture.zip(PaqueteFixture.ejemplo("xv-jardin-1.0.0"), "xv-jardin", "1.0.0"))
            TemplateRegisterCommand(servicio).registrar(zip)
            verify(servicio).register(any(), anyOrNull())
        } finally {
            zip.delete()
        }
    }

    @Test
    fun `sin la ruta del paquete no registra nada y no revienta`() {
        val servicio: TemplateRegistrationService = mock()
        TemplateRegisterCommand(servicio).run(DefaultApplicationArguments("--${TemplateRegisterCommand.ENABLED}=true"))
        verify(servicio, never()).register(any(), anyOrNull())
    }

    private fun salidaFalsa() = TemplateRegistrationOutcome(
        result = mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult.Created(
            mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug("xv-jardin"),
            mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion(1, 0, 0),
            "sha256:" + "cd".repeat(32),
        ),
        templateVersionId = 1,
        slug = "xv-jardin",
        version = "1.0.0",
        packageHash = "sha256:" + "cd".repeat(32),
        assetsRegistered = 1,
    )
}
