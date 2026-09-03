package mx.evolutiondev.invitaciones.modules.master.extramodules.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.math.BigDecimal
import java.time.Instant

@Entity
@Table(name = "extra_module_config")
@SQLDelete(sql = "UPDATE extra_module_config SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class ExtraModuleConfigEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,

    @Enumerated(EnumType.STRING)
    @Column(unique = true, nullable = false)
    var module: ExtraModuleType,

    var price: BigDecimal = BigDecimal.ZERO,

    @Column(name = "is_enabled")
    var isEnabled: Boolean = true,

    @Column(name = "created_by")
    var createdBy: Long? = null,

    @Column(name = "updated_by")
    var updatedBy: Long? = null,

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    var createdAt: Instant? = null,

    @UpdateTimestamp
    @Column(name = "updated_at")
    var updatedAt: Instant? = null,
    
    @Column(name = "deleted_by")
    var deletedBy: Long? = null
)

