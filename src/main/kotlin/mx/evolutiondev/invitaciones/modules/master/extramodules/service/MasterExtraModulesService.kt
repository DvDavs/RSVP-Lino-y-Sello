package mx.evolutiondev.invitaciones.modules.master.extramodules.service

import mx.evolutiondev.invitaciones.modules.master.extramodules.repository.ExtraModuleConfigRepository
import mx.evolutiondev.invitaciones.modules.master.extramodules.repository.model.ExtraModuleConfigEntity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.math.BigDecimal

@Service
class MasterExtraModulesService(
    private val repository: ExtraModuleConfigRepository
) {
    fun getAllModuleConfigs(): List<ExtraModuleConfigEntity> {
        return repository.findAll()
    }

    @Transactional
    fun updateAllModulesPrices(price: BigDecimal, userId: Long): List<ExtraModuleConfigEntity> {
        val allConfigs = repository.findAll()
        
        allConfigs.forEach { config ->
            config.price = price
            config.updatedBy = userId
        }
        
        return repository.saveAll(allConfigs)
    }

    @Transactional
    fun updateSingleModulePrice(
        id: Long,
        price: BigDecimal,
        userId: Long
    ): ExtraModuleConfigEntity {
        val config = repository.findById(id)
            .orElseThrow { IllegalArgumentException("El módulo con id $id no existe en la configuración.") }

        config.price = price
        config.updatedBy = userId

        return repository.save(config)
    }
}

