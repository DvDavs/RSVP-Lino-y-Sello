package mx.evolutiondev.invitaciones.modules.admin.dashboard.service

import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.DashboardResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.MetricsResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.RecentInvitationResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.TrafficSourceStats
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.TrafficStatsResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.UpcomingEventResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.DashboardRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Service
class DashboardService(
    private val dashboardRepository: DashboardRepository,
    private val customerRepository: CustomerRepository
) {

    companion object {
        private val MAIN_SOURCES = setOf("facebook", "instagram", "tiktok", "referencias")
    }

    fun getAdminDashboardData(adminId: Long, role: String): DashboardResponse {
        val currentDate = LocalDate.now().toString()
        val isMaster = role == "MASTER"
        
        val total = if (isMaster) dashboardRepository.countTotalInvitations() else dashboardRepository.countAdminTotalInvitations(adminId)
        val active = if (isMaster) dashboardRepository.countActiveInvitations() else dashboardRepository.countAdminActiveInvitations(adminId)
        val pending = if (isMaster) dashboardRepository.countPendingInvitations() else dashboardRepository.countAdminPendingInvitations(adminId)
        val past = if (isMaster) dashboardRepository.countPastEvents(currentDate) else dashboardRepository.countAdminPastEvents(adminId, currentDate)
        val upcomingCount = if (isMaster) dashboardRepository.countUpcomingEvents(currentDate) else dashboardRepository.countAdminUpcomingEvents(adminId, currentDate)
        
        val metrics = MetricsResponse(
            totalInvitations = total.toInt(),
            activeInvitations = active.toInt(),
            pendingInvitations = pending.toInt(),
            pastEvents = past.toInt(),
            upcomingEvents = upcomingCount.toInt()
        )
        
        val recentRaw = if (isMaster) dashboardRepository.findRecentInvitations(PageRequest.of(0, 5)) else dashboardRepository.findAdminRecentInvitations(adminId, PageRequest.of(0, 5))
        val recent = recentRaw.map { 
            RecentInvitationResponse(
                id = it.id,
                usuario = "${it.customerName} ${it.customerLastName}",
                estatus = if (it.isPaid) "Pagado" else "Pendiente",
                fecha = DateTimeFormatter.ISO_INSTANT.format(it.createdAt)
            )
        }
        
        val upcomingRaw = if (isMaster) dashboardRepository.findUpcomingEvents(currentDate, PageRequest.of(0, 10)) else dashboardRepository.findAdminUpcomingEvents(adminId, currentDate, PageRequest.of(0, 10))
        val upcoming = upcomingRaw.map {
            val customerFullName = if (it.customerName != null && it.customerLastName != null) {
                "${it.customerName} ${it.customerLastName}".trim()
            } else null
            val title = it.eventTypeName.takeIf { name -> name.isNotBlank() } ?: "Evento"
            UpcomingEventResponse(
                id = it.id.toString(),
                title = title,
                date = it.eventDate,
                customerName = customerFullName
            )
        }
        
        val trafficStats = if (isMaster) {
            getTrafficStats()
        } else null
        
        return DashboardResponse(
            role = "ADMIN",
            metrics = metrics,
            recentInvitations = recent,
            upcomingEvents = upcoming,
            trafficStats = trafficStats
        )
    }
    
    private fun getTrafficStats(): TrafficStatsResponse {
        val rawStats = customerRepository.countByTrafficSource()
        
        val mainSourcesMap = mutableMapOf<String, Int>()
        val otherSourcesMap = mutableMapOf<String, Int>()
        var othersTotal = 0
        
        rawStats.forEach { row ->
            val source = row[0] as String
            val count = (row[1] as Long).toInt()
            val sourceLower = source.lowercase()
            
            when {
                MAIN_SOURCES.contains(sourceLower) -> {
                    mainSourcesMap[sourceLower] = count
                }
                sourceLower.startsWith("otros:") -> {
                    val customSource = source.removePrefix("Otros: ").removePrefix("otros: ").trim()
                    if (customSource.isNotBlank()) {
                        otherSourcesMap[customSource] = (otherSourcesMap[customSource] ?: 0) + count
                    }
                    othersTotal += count
                }
                sourceLower == "otros" -> {
                    othersTotal += count
                }
                else -> {
                    otherSourcesMap[source] = (otherSourcesMap[source] ?: 0) + count
                    othersTotal += count
                }
            }
        }
        
        val mainTotal = mainSourcesMap.values.sum() + othersTotal
        val otherTotal = otherSourcesMap.values.sum()
        
        val mainSources = mutableListOf<TrafficSourceStats>()
        MAIN_SOURCES.forEach { source ->
            val count = mainSourcesMap[source] ?: 0
            if (count > 0) {
                val percentage = if (mainTotal > 0) (count.toDouble() / mainTotal * 100) else 0.0
                mainSources.add(TrafficSourceStats(
                    source = source,
                    count = count,
                    percentage = kotlin.math.round(percentage * 100) / 100
                ))
            }
        }
        
        if (othersTotal > 0) {
            val percentage = if (mainTotal > 0) (othersTotal.toDouble() / mainTotal * 100) else 0.0
            mainSources.add(TrafficSourceStats(
                source = "otros",
                count = othersTotal,
                percentage = kotlin.math.round(percentage * 100) / 100
            ))
        }
        
        val otherSources = otherSourcesMap.map { (source, count) ->
            val percentage = if (otherTotal > 0) (count.toDouble() / otherTotal * 100) else 0.0
            TrafficSourceStats(
                source = source,
                count = count,
                percentage = kotlin.math.round(percentage * 100) / 100
            )
        }.sortedByDescending { it.count }
        
        return TrafficStatsResponse(
            mainSources = mainSources.sortedByDescending { it.count },
            otherSources = otherSources
        )
    }

    fun getUserDashboardData(customerId: Long): DashboardResponse {
        val currentDate = LocalDate.now().toString()
        
        val total = dashboardRepository.countUserTotalInvitations(customerId)
        val pending = dashboardRepository.countUserPendingInvitations(customerId)
        val paid = dashboardRepository.countUserPaidInvitations(customerId)
        val upcomingCount = dashboardRepository.countUserUpcomingEvents(customerId, currentDate)
        
        val metrics = MetricsResponse(
            totalInvitations = total.toInt(),
            pendingInvitations = pending.toInt(),
            paidInvitations = paid.toInt(),
            upcomingEvents = upcomingCount.toInt()
        )
        
        val recent = dashboardRepository.findUserRecentInvitations(customerId, PageRequest.of(0, 2)).map {
            RecentInvitationResponse(
                id = it.id,
                status = if (it.isPaid) "active" else "pending",
                eventId = it.id,
                event = it.eventTypeName,
                planId = it.planId,
                plan = it.planName,
                price = it.totalAmount,
                currency = "MXN",
                date = it.eventDate
            )
        }
        
        val upcoming = dashboardRepository.findUserUpcomingEvents(customerId, currentDate, PageRequest.of(0, 10)).map {
            val title = it.eventTypeName.takeIf { name -> name.isNotBlank() } ?: "Evento"
            UpcomingEventResponse(
                id = it.id.toString(),
                title = title,
                date = it.eventDate,
                customerName = null
            )
        }
        
        return DashboardResponse(
            role = "USER",
            metrics = metrics,
            recentInvitations = recent,
            upcomingEvents = upcoming
        )
    }
}
