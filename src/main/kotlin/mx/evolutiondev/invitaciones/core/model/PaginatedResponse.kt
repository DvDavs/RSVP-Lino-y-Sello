package mx.evolutiondev.invitaciones.core.model

data class PaginatedResponse<T>(
        val content: List<T>,
        val totalPages: Int,
        val pageNumber: Int
)
