package mx.evolutiondev.invitaciones.modules.master.phrases.repository

import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOptionEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface PhraseOptionRepository : JpaRepository<PhraseOptionEntity, Long> {
    fun findAllByCustomPhraseIdIn(ids: List<Long>): List<PhraseOptionEntity>
    
    fun findAllByCustomPhraseIdInAndIsEnabledTrue(ids: List<Long>): List<PhraseOptionEntity>
    
    fun findAllByCustomPhraseId(customPhraseId: Long): List<PhraseOptionEntity>
    
    @Modifying
    @Query("UPDATE PhraseOptionEntity po SET po.isEnabled = false WHERE po.customPhrase.id = :customPhraseId")
    fun deactivateAllByCustomPhraseId(@Param("customPhraseId") customPhraseId: Long)
}


