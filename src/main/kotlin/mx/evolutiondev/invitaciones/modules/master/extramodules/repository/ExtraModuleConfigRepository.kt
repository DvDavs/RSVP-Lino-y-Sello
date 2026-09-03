package mx.evolutiondev.invitaciones.modules.master.extramodules.repository

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import mx.evolutiondev.invitaciones.modules.master.extramodules.repository.model.ExtraModuleConfigEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface ExtraModuleConfigRepository : JpaRepository<ExtraModuleConfigEntity, Long> {
    fun findByModule(module: ExtraModuleType): Optional<ExtraModuleConfigEntity>
    
    @Query("SELECT * FROM extra_module_config WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): ExtraModuleConfigEntity?
    
    @Query("SELECT * FROM extra_module_config", 
           countQuery = "SELECT COUNT(*) FROM extra_module_config",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<ExtraModuleConfigEntity>
}

