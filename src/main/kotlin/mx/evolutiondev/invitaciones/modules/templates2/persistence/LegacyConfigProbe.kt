package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * ¿Tiene esta invitación configuración en el módulo antiguo (`invitation_configs`)?
 *
 * `03 §3.2` condiciona `:choose-template` a `invitation.uses_templates2 = true` **o** a que la
 * invitación **no** tenga `invitation_configs` ("invitación nueva"). El problema verificado:
 * `invitation_configs` es una colección de **Mongo** (`02 §6`), y `contratos.md §5` / ADR-009
 * prohíben Mongo en `templates2`. Este módulo, por diseño, **no puede** responder esa pregunta.
 *
 * Se resuelve con esta costura en vez de con una dependencia prohibida o con una suposición muda
 * (ADR-2-4-02): tres respuestas posibles —`true`, `false` y `null` (no lo sé)— y una política
 * conservadora en [mx.evolutiondev.invitaciones.modules.templates2.api.EditorDocumentService]: solo un
 * `false` **verificado** autoriza empezar a editar en `templates2` una invitación cuya bandera de
 * corte está en `false`. La implementación por defecto responde `null`, así que en la fase 2 la
 * respuesta es `409 TPL_NOT_MIGRATED` y jamás el estado mixto de H-04/H-05.
 */
fun interface LegacyConfigProbe {

    /**
     * `true` = tiene configuración antigua · `false` = no la tiene (invitación nueva) ·
     * `null` = no se puede determinar desde este módulo.
     */
    fun hasLegacyConfig(invitationId: Long): Boolean?
}

/**
 * Implementación por defecto: **no lo sé**. No consulta Mongo (no puede) y no inventa una respuesta.
 *
 * La fase 5 (migración), que sí habla con Mongo, publicará un bean propio de [LegacyConfigProbe] y
 * `@ConditionalOnMissingBean` hará que este se retire solo, sin tocar una línea de `templates2`.
 */
class UnknownLegacyConfigProbe : LegacyConfigProbe {
    override fun hasLegacyConfig(invitationId: Long): Boolean? = null
}

@Configuration(proxyBeanMethods = false)
class LegacyConfigProbeConfig {

    @Bean
    @ConditionalOnMissingBean(LegacyConfigProbe::class)
    fun unknownLegacyConfigProbe(): LegacyConfigProbe = UnknownLegacyConfigProbe()
}
