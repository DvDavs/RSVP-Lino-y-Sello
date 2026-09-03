package mx.evolutiondev.invitaciones.modules.shared.guests.service.model

data class GuestFileLoadedResponse(
        val message: String,
        val hasDuplicated: Boolean,
        val duplicatedRecords: List<String>,
        val hasRejected: Boolean = false,
        val rejectedRecords: List<RejectedRecord> = emptyList(),
        val loadedCount: Int = 0,
        val rejectedCount: Int = 0
)

data class RejectedRecord(
        val rowNumber: Int,
        val fullName: String?,
        val reason: String
)
