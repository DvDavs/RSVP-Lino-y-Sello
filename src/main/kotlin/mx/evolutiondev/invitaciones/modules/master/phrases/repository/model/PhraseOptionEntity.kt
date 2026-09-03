package mx.evolutiondev.invitaciones.modules.master.phrases.repository.model

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "phrase_options")
data class PhraseOptionEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        @Column(nullable = false, columnDefinition = "TEXT")
        val text: String,

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "custom_phrase_id", nullable = false)
        val customPhrase: CustomPhraseEntity,

        @Column(name = "is_enabled")
        var isEnabled: Boolean = true,

        @Column(name = "created_by")
        var createdBy: Long? = null,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)


