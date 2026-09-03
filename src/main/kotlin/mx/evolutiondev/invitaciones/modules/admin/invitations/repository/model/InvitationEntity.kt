package mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "invitation")
@SQLDelete(sql = "UPDATE invitation SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class InvitationEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        var id: Long = 0,

        @ManyToOne
        @JoinColumn(name = "template_id", nullable = false)
        var template: InvitationTemplateEntity,

        @ManyToOne
        @JoinColumn(name = "customer_id", nullable = false)
        var customer: CustomerEntity,

        var date: String = "",

        var time: String = "",

        @Column(name = "children_allowed")
        var childrenAllowed: Boolean = false,

        @Column(name = "young_allowed")
        var youngAllowed: Boolean = false,

        var hashtag: String = "",

        @Column(name = "cover_photo_url")
        var coverPhotoUrl: String = "",

        @Column(name = "is_enabled")
        var isEnabled: Boolean = true,

        @Column(name = "is_paid")
        var isPaid: Boolean = false,

        @Column(name = "total_amount")
        var totalAmount: Double = 0.0,

        @Column(name = "created_by")
        var createdBy: Long? = null,

        @Column(name = "updated_by")
        var updatedBy: Long? = null,

        @Column(name = "deleted_by")
        var deletedBy: Long? = null,

        @Column(name = "has_music")
        var hasMusic: Boolean = false,

        @Column(name = "has_gallery")
        var hasGallery: Boolean = false,

        @Column(name = "has_extra_modules")
        var hasExtraModules: Boolean = false,

        @Column(name = "is_finished")
        var isFinished: Boolean = false,

        @Column(name = "all_events_same_location")
        var allEventsSameLocation: Boolean = false,

        @ElementCollection(
                targetClass = ExtraModuleType::class,
                fetch = FetchType.EAGER
        )
        @CollectionTable(
                name = "invitation_template_extra_modules",
                joinColumns = [JoinColumn(name = "template_id")]
        )
        @Enumerated(EnumType.STRING)
        @Column(name = "module")
        var extraModulesIncluded: MutableList<ExtraModuleType> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
        val people: MutableList<InvitationPersonEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val phrases: MutableList<InvitationPhraseEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val itinerary: MutableList<InvitationItineraryEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val gallery: MutableList<InvitationGalleryEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val giftRegistry: MutableList<InvitationGiftRegistryEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val music: MutableList<InvitationMusicEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val recommendations: MutableList<InvitationRecommendationEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val story: MutableList<InvitationStoryEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val activities: MutableList<InvitationActivityEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val parents: MutableList<InvitationParentEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val godparents: MutableList<InvitationGodparentEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val dressCodes: MutableList<InvitationDressCodeEntity> = mutableListOf(),

        @OneToMany(
                mappedBy = "invitation", 
                cascade = [CascadeType.ALL],
                orphanRemoval = true)
                val guests: MutableList<InvitationGuestEntity> = mutableListOf(),
        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_people")
data class InvitationPersonEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val gender: String = "",
        val name: String = "",
        val photoUrl: String = "",

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_phrase")
data class InvitationPhraseEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val gender: String = "",
        val text: String = "",

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_itinerary")
data class InvitationItineraryEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val eventName: String = "",
        val eventLocation: String = "",
        val eventMapsUrl: String = "",
        val startTime: String = "",
        val endTime: String = "",

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_gallery")
data class InvitationGalleryEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val photoUrl: String = "",

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_gift_registry")
data class InvitationGiftRegistryEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val type: String = "",
        @Column(name = "custom_name")
        val customName: String? = null,
        val name: String? = null,
        val accountHolder: String? = null,
        val accountNumber: String? = null,
        val bank: String? = null,
        var message: String = "",
        val photo: String? = null,
        val giftRegistryUrl: String? = null,
        val urlText: String? = null,
        var title: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_music")
data class InvitationMusicEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val type: String = "",
        val url: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)


@Entity(name = "invitation_recommendation")
data class InvitationRecommendationEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val name: String = "",
        val address: String = "",
        val phone: String? = null,
        val url: String? = null,
        val description: String? = null,
        val photoUrl: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_story")
data class InvitationStoryEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val title: String = "",
        val date: String = "",
        val description: String? = null,
        val photoUrl: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_activity")
data class InvitationActivityEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val name: String = "",
        val address: String = "",
        val phone: String? = null,
        val url: String? = null,
        val description: String? = null,
        val photoUrl: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_parent")
data class InvitationParentEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val type: String = "",
        val name: String = "",
        val photoUrl: String = "",

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

@Entity(name = "invitation_godparent")
data class InvitationGodparentEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val type: String = "",
        val isCouple: Boolean = false,
        val gender: String = "",
        val names: String = "",
        val photoUrl: String? = null,
        val isPrimary: Boolean = false,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)


@Entity(name = "invitation_dress_code")
data class InvitationDressCodeEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        val type: String = "",
        val womanId: Long? = null,
        val manId: Long? = null,
        val name: String? = null,
        val womanDescription: String? = null,
        val womanPhotoUrl: String? = null,
        val manDescription: String? = null,
        val manPhotoUrl: String? = null,
        val url: String? = null,
        val description: String? = null,

        @ManyToOne(fetch = FetchType.LAZY)
        val invitation: InvitationEntity,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)
