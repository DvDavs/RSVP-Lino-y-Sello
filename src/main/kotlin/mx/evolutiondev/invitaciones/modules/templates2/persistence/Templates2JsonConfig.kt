package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.ObjectMapper
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.hibernate.cfg.AvailableSettings
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * El único punto de configuración de JSON del módulo (`02 §8.1`, ADR-1R-B-06). Así muere H-35 en el
 * módulo nuevo **sin alterar el antiguo**.
 *
 * - **`templates2ObjectMapper` NO es `@Primary`.** Cambiar el `ObjectMapper` de la aplicación
 *   activaría `FAIL_ON_UNKNOWN_PROPERTIES` para el módulo antiguo, que depende explícitamente de lo
 *   contrario (H-35: diez clases de `EditorModels.kt` no llevan `@JsonIgnoreProperties`). Sería romper
 *   el módulo antiguo desde el nuevo, justo lo que P10 prohíbe.
 * - **`HibernatePropertiesCustomizer`** es la única forma limpia de que la serialización que Hibernate
 *   hace al escribir `jsonb` use *ese* mapper y no uno por defecto. Efecto colateral acotado y
 *   verificado en la fase 1: ninguna entidad del repositorio usa hoy tipos JSON, así que el
 *   `FormatMapper` global solo lo consume `templates2`.
 * - **Sin dependencias nuevas**: Hibernate 6.6 (que arrastra Spring Boot 3.4.1) trae `SqlTypes.JSON` y
 *   `JacksonJsonFormatMapper` en el núcleo, y `jackson-module-kotlin` ya estaba. No hace falta
 *   `hypersistence-utils`.
 *
 * Este es el **único** archivo de `templates2.persistence` que escribe el bloque 2-0b: las entidades
 * JPA y los repositorios son del bloque 2-1.
 */
@Configuration
class Templates2JsonConfig {

    /** Ver `02 §8.1`. La construcción vive en `Templates2Json` para que las pruebas usen el mismo mapper. */
    @Bean("templates2ObjectMapper")
    fun templates2ObjectMapper(): ObjectMapper = Templates2Json.mapper

    /** Fija el `FormatMapper` de Hibernate al mapper del módulo (ADR-1R-B-06). */
    @Bean
    fun templates2HibernateJsonMapper(
        @Qualifier("templates2ObjectMapper") mapper: ObjectMapper,
    ): HibernatePropertiesCustomizer = HibernatePropertiesCustomizer { props ->
        props[AvailableSettings.JSON_FORMAT_MAPPER] = JacksonJsonFormatMapper(mapper)
    }
}
