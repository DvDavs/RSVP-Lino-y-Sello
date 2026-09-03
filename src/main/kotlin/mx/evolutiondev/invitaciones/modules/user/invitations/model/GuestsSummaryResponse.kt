package mx.evolutiondev.invitaciones.modules.user.invitations.model



data class GuestsSummaryResponse(
    // Totales generales
    val totalInvitados: Int,
    val totalConfirmados: Int,
    val totalPendientes: Int,
    val totalCancelados: Int,

    // Adultos
    val totalAdultosInvitados: Int,
    val totalAdultosPendientes: Int,
    val totalAdultosConfirmados: Int,
    val totalAdultosCancelados: Int,

    // Niños
    val totalNinosInvitados: Int,
    val totalNinosPendientes: Int,
    val totalNinosConfirmados: Int,
    val totalNinosCancelados: Int,

    // Jóvenes
    val totalJovenesInvitados: Int,
    val totalJovenesPendientes: Int,
    val totalJovenesConfirmados: Int,
    val totalJovenesCancelados: Int,
)