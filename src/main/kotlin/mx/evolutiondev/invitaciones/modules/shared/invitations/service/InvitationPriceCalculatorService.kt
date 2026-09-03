package mx.evolutiondev.invitaciones.modules.shared.invitations.service

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import mx.evolutiondev.invitaciones.modules.master.extramodules.repository.ExtraModuleConfigRepository
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import org.springframework.stereotype.Service
import java.math.BigDecimal

data class PriceBreakdown(
    val basePrice: Double,
    val extraModules: Map<String, Double>,
    val totalPrice: Double
)

@Service
class InvitationPriceCalculatorService(
    private val extraModuleConfigRepository: ExtraModuleConfigRepository
) {

    fun calculateTotalPrice(
        template: InvitationTemplateEntity,
        extraModules: List<ExtraModuleType>
    ): Double {
        val basePrice = template.price
        val extraModulesPrice = calculateExtraModulesPrice(extraModules)
        return basePrice + extraModulesPrice
    }

    fun calculatePriceBreakdown(
        template: InvitationTemplateEntity,
        extraModules: List<ExtraModuleType>
    ): PriceBreakdown {
        val basePrice = template.price
        val extraModulesMap = mutableMapOf<String, Double>()
        
        extraModules.forEach { moduleType ->
            val config = extraModuleConfigRepository.findByModule(moduleType).orElse(null)
            if (config != null) {
                if (!config.isEnabled) {
                    throw IllegalArgumentException("El módulo extra ${getModuleDisplayName(moduleType)} está deshabilitado y no puede ser seleccionado")
                }
                extraModulesMap[getModuleDisplayName(moduleType)] = config.price.toDouble()
            }
        }
        
        val extraModulesTotal = extraModulesMap.values.sum()
        val totalPrice = basePrice + extraModulesTotal
        
        return PriceBreakdown(
            basePrice = basePrice,
            extraModules = extraModulesMap,
            totalPrice = totalPrice
        )
    }

    private fun calculateExtraModulesPrice(extraModules: List<ExtraModuleType>): Double {
        return extraModules.sumOf { moduleType ->
            val config = extraModuleConfigRepository.findByModule(moduleType).orElse(null)
            if (config != null && !config.isEnabled) {
                throw IllegalArgumentException("El módulo extra ${getModuleDisplayName(moduleType)} está deshabilitado y no puede ser seleccionado")
            }
            config?.price?.toDouble() ?: 0.0
        }
    }

    private fun getModuleDisplayName(moduleType: ExtraModuleType): String {
        return when (moduleType) {
            ExtraModuleType.DRESS_CODE -> "Código de vestimenta"
            ExtraModuleType.RECOMMENDATIONS -> "Recomendaciones"
            ExtraModuleType.OUR_STORY -> "Nuestra historia"
            ExtraModuleType.AMENITIES_AND_ACTIVITIES -> "Amenidades y actividades"
            ExtraModuleType.PARENTS_AND_GODPARENTS -> "Padres y padrinos"
        }
    }
}

