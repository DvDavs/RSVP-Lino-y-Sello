package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.DeserializationFeature
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2JsonConfig
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.hibernate.cfg.AvailableSettings
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * `02 §8.1` / ADR-1R-B-06. Lo importante aquí no es que los beans existan sino **lo que garantizan**:
 * `FAIL_ON_UNKNOWN_PROPERTIES` activo (P1) y que el bean **no** sea `@Primary`, para no activar esa
 * opción en el módulo antiguo, que depende de lo contrario (H-35).
 */
class Templates2JsonConfigTest {

    private val config = Templates2JsonConfig()

    @Test
    fun `el mapper del modulo falla ante una clave desconocida`() {
        val mapper = config.templates2ObjectMapper()
        assertSame(Templates2Json.mapper, mapper)
        assertTrue(mapper.deserializationConfig.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
        assertTrue(mapper.deserializationConfig.isEnabled(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES))
    }

    @Test
    fun `el bean no esta anotado como Primary`() {
        val metodo = Templates2JsonConfig::class.java.getDeclaredMethod("templates2ObjectMapper")
        assertTrue(
            metodo.annotations.none { it.annotationClass.qualifiedName == "org.springframework.context.annotation.Primary" },
            "templates2ObjectMapper NO puede ser @Primary: rompería el módulo antiguo (H-35, ADR-1R-B-06)",
        )
        assertEquals(
            "templates2ObjectMapper",
            metodo.getAnnotation(org.springframework.context.annotation.Bean::class.java).value.single(),
        )
    }

    @Test
    fun `el customizer fija el FormatMapper de Hibernate al mapper del modulo`() {
        val customizer = config.templates2HibernateJsonMapper(config.templates2ObjectMapper())
        val props = HashMap<String, Any>()
        customizer.customize(props)
        val fm = props[AvailableSettings.JSON_FORMAT_MAPPER]
        assertNotNull(fm)
        assertTrue(fm is JacksonJsonFormatMapper, "se esperaba JacksonJsonFormatMapper y llegó $fm")
    }

    @Test
    fun `un JSON no parseable sale como TPL_MALFORMED_JSON, nunca como excepcion cruda`() {
        val e = runCatching { Templates2Json.readTree("{no es json") }.exceptionOrNull()
        assertTrue(e is Templates2Exception.MalformedJson, e.toString())
        assertEquals(400, (e as Templates2Exception).status)
    }

    @Test
    fun `buildMapper crea instancias independientes con la misma configuracion`() {
        val a = Templates2Json.buildMapper()
        assertTrue(a !== Templates2Json.mapper)
        assertTrue(a.deserializationConfig.isEnabled(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES))
    }
}
