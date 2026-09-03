package mx.evolutiondev.invitaciones.modules.master.templates.presentation.model

/**
 * Respuesta al crear una plantilla completa
 */
data class CompleteTemplateResponse(
        /**
         * ID de la plantilla creada en PostgreSQL
         */
        val templateId: Long,

        /**
         * Nombre de la plantilla
         */
        val name: String,

        /**
         * Nombre del tipo de evento
         */
        val eventType: String,

        /**
         * Nombre del plan
         */
        val plan: String,

        /**
         * Precio de la plantilla
         */
        val price: Double,

        /**
         * URL de la imagen
         */
        val image: String,

        /**
         * URL de demo
         */
        val url: String,

        /**
         * ID del documento de configuración visual creado en MongoDB
         */
        val visualConfigId: String,

        /**
         * ID del documento de configuración de contenido en MongoDB (puede ser null si se reutilizó existente)
         */
        val contentConfigId: String?,

        /**
         * Indica si se reutilizó una configuración de contenido existente
         */
        val contentReused: Boolean,

        /**
         * Mensaje informativo
         */
        val message: String
)
