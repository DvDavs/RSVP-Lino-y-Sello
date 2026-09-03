package mx.evolutiondev.invitaciones.core.error.model

data class ErrorMessage(
        var timestamp: String,
        var statusCode: Int,
        var errorsListed: Map<String, List<Map<String, Any?>>>? = null,
        var errors: Map<String, String?>? = null
)
