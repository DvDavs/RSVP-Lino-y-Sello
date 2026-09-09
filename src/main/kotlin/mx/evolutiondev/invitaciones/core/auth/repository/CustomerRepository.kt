package mx.evolutiondev.invitaciones.core.auth.repository

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface CustomerRepository : JpaRepository<CustomerEntity, Long>, JpaSpecificationExecutor<CustomerEntity> {
    fun findByEmail(email: String): CustomerEntity?
    fun findByResetToken(resetToken: String): CustomerEntity?

    /** Verificación de correo (fase 5, E3). Mismo patrón que [findByResetToken]. */
    fun findByEmailVerificationToken(emailVerificationToken: String): CustomerEntity?
    fun findByRoleIn(roles: List<Role>): List<CustomerEntity>
    fun findByPhone(phone: String): CustomerEntity?
    fun existsByPhone(phone: String): Boolean
    fun findAllByCreatedBy(createdBy: Long): List<CustomerEntity>
    fun findAllByCreatedBy(createdBy: Long, pageable: Pageable): Page<CustomerEntity>
    override fun findAll(pageable: Pageable): Page<CustomerEntity>
    
    @Query("SELECT * FROM customer WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): CustomerEntity?

    @Query("SELECT * FROM customer WHERE email = :email", nativeQuery = true)
    fun findByEmailEvenIfDisabled(@Param("email") email: String): CustomerEntity?

    @Query("SELECT COUNT(*) > 0 FROM customer WHERE phone = :phone", nativeQuery = true)
    fun existsByPhoneEvenIfDisabled(@Param("phone") phone: String): Boolean

    
    @Query("SELECT * FROM customer", nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<CustomerEntity>
    
    @Query("SELECT * FROM customer WHERE created_by = :adminId", nativeQuery = true)
    fun findAllByCreatedByWithAnyStatus(@Param("adminId") adminId: Long, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE is_enabled = :status",
        countQuery = "SELECT count(*) FROM customer WHERE is_enabled = :status",
        nativeQuery = true
    )
    fun findAllByIsEnabledWithAnyStatus(@Param("status") status: Boolean, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE created_by = :adminId AND is_enabled = :status",
        countQuery = "SELECT count(*) FROM customer WHERE created_by = :adminId AND is_enabled = :status",
        nativeQuery = true
    )
    fun findAllByCreatedByAndIsEnabledWithAnyStatus(@Param("adminId") adminId: Long, @Param("status") status: Boolean, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE role = CAST(:role AS text)",
        countQuery = "SELECT count(*) FROM customer WHERE role = CAST(:role AS text)",
        nativeQuery = true
    )
    fun findAllByRoleWithAnyStatus(@Param("role") role: String, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE role = CAST(:role AS text) AND is_enabled = :status",
        countQuery = "SELECT count(*) FROM customer WHERE role = CAST(:role AS text) AND is_enabled = :status",
        nativeQuery = true
    )
    fun findAllByRoleAndIsEnabledWithAnyStatus(@Param("role") role: String, @Param("status") status: Boolean, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE created_by = :adminId AND role = CAST(:role AS text)",
        countQuery = "SELECT count(*) FROM customer WHERE created_by = :adminId AND role = CAST(:role AS text)",
        nativeQuery = true
    )
    fun findAllByCreatedByAndRoleWithAnyStatus(@Param("adminId") adminId: Long, @Param("role") role: String, pageable: Pageable): Page<CustomerEntity>

    @Query(
        value = "SELECT * FROM customer WHERE created_by = :adminId AND role = CAST(:role AS text) AND is_enabled = :status",
        countQuery = "SELECT count(*) FROM customer WHERE created_by = :adminId AND role = CAST(:role AS text) AND is_enabled = :status",
        nativeQuery = true
    )
    fun findAllByCreatedByAndRoleAndIsEnabledWithAnyStatus(@Param("adminId") adminId: Long, @Param("role") role: String, @Param("status") status: Boolean, pageable: Pageable): Page<CustomerEntity>

    @Modifying
    @Query(value = "DELETE FROM customer WHERE id = :id", nativeQuery = true)
    fun hardDeleteById(@Param("id") id: Long)

    @Query("""
        SELECT c.howKnow as source, COUNT(c) as count 
        FROM CustomerEntity c 
        WHERE c.howKnow IS NOT NULL AND c.howKnow <> '' 
        GROUP BY c.howKnow
    """)
    fun countByTrafficSource(): List<Array<Any>>

    @Modifying(clearAutomatically = true)
    @Query(value = """
        -- Limpiar referencias en invitados
        UPDATE invitation_guest SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        -- Limpiar referencias en catalogos
        UPDATE dress_code SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE event_type SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE invitation_plan SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE invitation_template SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE custom_phrase SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE phrase_options SET created_by = NULL WHERE created_by = :id;
        UPDATE gift_message SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE gift_image SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE invitation_song SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
        UPDATE extra_module_config SET created_by = NULL, updated_by = NULL, deleted_by = NULL WHERE created_by = :id OR updated_by = :id OR deleted_by = :id;
    """, nativeQuery = true)
    fun nullifyAuditFields(@Param("id") id: Long)
}