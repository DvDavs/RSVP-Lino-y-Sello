package mx.evolutiondev.invitaciones.modules.admin.invitations.repository

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.*
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface InvitationRepository : JpaRepository<InvitationEntity, Long>, JpaSpecificationExecutor<InvitationEntity> {
    
    @Query("""
        SELECT DISTINCT i FROM InvitationEntity i 
        LEFT JOIN FETCH i.people 
        LEFT JOIN FETCH i.template t
        LEFT JOIN FETCH t.eventType
        WHERE i.id = :id
    """)
    fun findByIdWithPeopleAndTemplate(@Param("id") id: Long): Optional<InvitationEntity>
    
    fun findAllByCustomerId(customerId: Long): List<InvitationEntity>

    fun findByIdAndCustomerId(id: Long, customerId: Long): InvitationEntity?
    
    fun findAllByCreatedBy(createdBy: Long): List<InvitationEntity>
    
    @Query("SELECT i FROM InvitationEntity i WHERE i.customer.id = :customerId AND i.isEnabled = false")
    fun findAllDisabledByCustomerId(@Param("customerId") customerId: Long): List<InvitationEntity>
    
    @Query("SELECT * FROM invitation WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): InvitationEntity?
    
    @Query("SELECT * FROM invitation WHERE customer_id = :customerId AND is_enabled = false", nativeQuery = true)
    fun findAllDisabledByCustomerIdNative(@Param("customerId") customerId: Long): List<InvitationEntity>

    @Modifying
    @Query(value = "DELETE FROM invitation WHERE id = :id", nativeQuery = true)
    fun hardDeleteById(@Param("id") id: Long)

    @Query(
        value = "SELECT * FROM invitation",
        countQuery = "SELECT count(*) FROM invitation",
        nativeQuery = true
    )
    fun findAllWithAnyStatus(pageable: Pageable): Page<InvitationEntity>

    @Query(
        value = "SELECT * FROM invitation WHERE created_by = :userId",
        countQuery = "SELECT count(*) FROM invitation WHERE created_by = :userId",
        nativeQuery = true
    )
    fun findAllByCreatedByWithAnyStatus(@Param("userId") userId: Long, pageable: Pageable): Page<InvitationEntity>

    @Query(
        value = "SELECT * FROM invitation WHERE created_by IN :creatorIds",
        countQuery = "SELECT count(*) FROM invitation WHERE created_by IN :creatorIds",
        nativeQuery = true
    )
    fun findAllByCreatorIdsWithAnyStatus(@Param("creatorIds") creatorIds: List<Long>, pageable: Pageable): Page<InvitationEntity>
}

@Repository
interface InvitationPersonRepository : JpaRepository<InvitationPersonEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationPersonEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationPhraseRepository : JpaRepository<InvitationPhraseEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationPhraseEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationItineraryRepository : JpaRepository<InvitationItineraryEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationItineraryEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationGalleryRepository : JpaRepository<InvitationGalleryEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationGalleryEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationGiftRegistryRepository : JpaRepository<InvitationGiftRegistryEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationGiftRegistryEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationMusicRepository : JpaRepository<InvitationMusicEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationMusicEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationRecommendationRepository : JpaRepository<InvitationRecommendationEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationRecommendationEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationStoryRepository : JpaRepository<InvitationStoryEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationStoryEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationActivityRepository : JpaRepository<InvitationActivityEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationActivityEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationParentRepository : JpaRepository<InvitationParentEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationParentEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationGodparentRepository : JpaRepository<InvitationGodparentEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationGodparentEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

@Repository
interface InvitationDressCodeRepository : JpaRepository<InvitationDressCodeEntity, Long> {
    fun findAllByInvitationId(invitationId: Long): List<InvitationDressCodeEntity>
    fun deleteAllInBatchByInvitationId(invitationId: Long)
}

