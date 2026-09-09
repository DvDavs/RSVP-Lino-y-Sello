package mx.evolutiondev.invitaciones.core.auth.model

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.FilterDef
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "customer")
@SQLDelete(sql = "UPDATE customer SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@FilterDef(name = "enabledFilter", defaultCondition = "is_enabled = true")
@Filter(name = "enabledFilter")
data class CustomerEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        var id: Long = 0,

        var name: String = "",
        var lastName: String = "",

        @Column(unique = true, nullable = false)
        var email: String = "",

        @Column(nullable = false)
        var password: String = "",

        @Enumerated(EnumType.STRING)
        @Column(nullable = false)
        var role: Role = Role.USER,

        @Column(name = "is_enabled", nullable = false)
        var isEnabled: Boolean = true,

        @Column(name = "is_banned", nullable = false)
        var isBanned: Boolean = false,

        var resetToken: String? = null,
        var resetTokenExpiry: Instant? = null,

        /**
         * Verificación del correo de acceso (fase 5, E3; `12-producto-completo.md §A6.4`, migración
         * `V41`). Nace en `true` para no invalidar las cuentas que ya existían; las altas nuevas se
         * guardan con `false`. **Hoy no bloquea el acceso**: la decisión de bloquear es de producto y
         * todavía no se toma (§A2.1).
         */
        @Column(name = "email_verified", nullable = false)
        var emailVerified: Boolean = true,

        /** Mismo patrón que [resetToken]: token de un solo uso, acuñado con `JwtUtil.generateSecureToken()`. */
        @Column(name = "email_verification_token")
        var emailVerificationToken: String? = null,

        @Column(name = "email_verification_expiry")
        var emailVerificationExpiry: Instant? = null,

        /**
         * Correo al que la persona pidió mudarse y que todavía no ha confirmado. Mientras esté puesto,
         * [email] —el correo con el que se entra— **no cambia**.
         */
        @Column(name = "email_pending")
        var emailPending: String? = null,

        @Column(name = "created_by")
        var createdBy: Long? = null,

        @Column(name = "updated_by")
        var updatedBy: Long? = null,

        @Column(name = "deleted_by")
        var deletedBy: Long? = null,

        var phone: String? = null,
        var birthdate: String? = null,
        var address: String? = null,
        var city: String? = null,

        @Column(name = "postal_code")
        var postalCode: String? = null,

        var state: String? = null,

        @Column(name = "how_know")
        var howKnow: String? = null,

        @Column(name = "is_survey_answered", nullable = false)
        var isSurveyAnswered: Boolean = false,

        @Column(name = "avatar_id")
        var avatarId: Long? = null,

        @OneToMany(mappedBy = "customer", cascade = [CascadeType.ALL], orphanRemoval = true)
        val refreshTokens: MutableList<RefreshTokenEntity> = mutableListOf(),

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)