package mx.evolutiondev.invitaciones.modules.admin.dashboard.model

import com.fasterxml.jackson.annotation.JsonInclude

data class DashboardResponse(
    val role: String,
    val metrics: MetricsResponse,
    val recentInvitations: List<RecentInvitationResponse>,
    val upcomingEvents: List<UpcomingEventResponse>,
    val trafficStats: TrafficStatsResponse? = null  // Solo MASTER
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class MetricsResponse(
    val totalInvitations: Int,
    val activeInvitations: Int? = null,      // Admin only
    val pendingInvitations: Int,
    val pastEvents: Int? = null,             // Admin only
    val paidInvitations: Int? = null,        // User only
    val upcomingEvents: Int
)

@JsonInclude(JsonInclude.Include.NON_NULL)
data class RecentInvitationResponse(
    val id: Long,
    val usuario: String? = null,             // Admin format
    val estatus: String? = null,             // Admin format
    val fecha: String? = null,               // Admin format
    val status: String? = null,              // User format
    val eventId: Long? = null,               // User format
    val event: String? = null,               // User format
    val planId: Long? = null,                // User format
    val plan: String? = null,                // User format
    val price: Double? = null,               // User format
    val currency: String? = null,            // User format
    val date: String? = null                 // User format (ISO)
)

data class UpcomingEventResponse(
    val id: String,
    val title: String,
    val date: String,                        // YYYY-MM-DD format
    val customerName: String? = null         // Nombre del cliente (solo para admin)
)

data class TrafficSourceStats(
    val source: String,
    val count: Int,
    val percentage: Double
)

data class TrafficStatsResponse(
    val mainSources: List<TrafficSourceStats>,      // facebook, instagram, tiktok, referencias + "otros" consolidado
    val otherSources: List<TrafficSourceStats>      // Desglose de "otros" (Google, Evento, etc.)
)
