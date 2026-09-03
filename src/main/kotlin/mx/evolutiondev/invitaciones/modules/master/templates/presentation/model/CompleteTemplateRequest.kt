package mx.evolutiondev.invitaciones.modules.master.templates.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultContentConfig

/**
 * Request completo para crear una plantilla con todas sus configuraciones
 */
data class CompleteTemplateRequest(
        /**
         * Nombre de la plantilla
         */
        @field:NotBlank(message = "El nombre es obligatorio")
        val name: String,

        /**
         * Precio de la plantilla
         */
        @field:NotNull(message = "El precio es obligatorio")
        @field:Positive(message = "El precio debe ser un número positivo")
        val price: Double,

        /**
         * URL de la imagen/captura de la plantilla
         */
        @field:NotBlank(message = "La imagen es obligatoria")
        val image: String,

        /**
         * URL de demo de la plantilla
         */
        @field:NotBlank(message = "La URL es obligatoria")
        val url: String,

        /**
         * ID del tipo de evento (event_type)
         */
        @field:NotNull(message = "El ID del evento es obligatorio")
        @field:Positive(message = "El ID del evento debe ser un número")
        val eventId: Long,

        /**
         * ID del plan (invitation_plan)
         */
        @field:NotNull(message = "El ID del plan es obligatorio")
        @field:Positive(message = "El ID del plan debe ser un número")
        val planId: Long,

        /**
         * Configuración visual completa de la plantilla (secciones, colores, responsive, etc.)
         */
        @field:NotNull(message = "La configuración visual es obligatoria")
        val visualConfig: Map<String, Any>,

        /**
         * Configuración de contenido por defecto (imágenes, frases, itinerarios, etc.)
         * Opcional: si no se proporciona, se intentará reutilizar una existente con la misma combinación (eventId, planId)
         */
        val contentConfig: DefaultContentConfig? = null,

        /**
         * Si true, reutiliza la configuración de contenido existente para (eventId, planId)
         * Si false y no se proporciona contentConfig, lanza error
         */
        val reuseExistingContent: Boolean = true
)
