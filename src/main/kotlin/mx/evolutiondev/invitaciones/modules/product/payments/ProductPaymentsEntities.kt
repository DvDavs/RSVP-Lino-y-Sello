package mx.evolutiondev.invitaciones.modules.product.payments

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * Fila de `product_plan` (V42): el catálogo que **se vende**.
 *
 * No sustituye a `invitation_plan` ni la toca (ADR-5-4-01): aquella no tiene precio, ni moneda, ni
 * identificador externo, y además sirve de clave foránea a seis catálogos del módulo antiguo
 * (`12-producto-completo.md §A5.3`). Este catálogo es nuevo y vive entero en `modules/product`.
 *
 * [incluye] se mapea como `String` con el JSON crudo, igual que `templates2` mapea sus `jsonb`
 * (`TplDocumentSnapshotEntity.kt:38-39`): la capa de API lo entrega ya parseado; el dominio no
 * necesita un tipo estructurado para una lista de frases que la pantalla pinta tal cual.
 */
@Entity
@Table(name = "product_plan")
class ProductPlanEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "codigo", nullable = false, length = 40)
    var codigo: String = "",

    @Column(name = "nombre", nullable = false, length = 80)
    var nombre: String = "",

    @Column(name = "descripcion", nullable = false, length = 240)
    var descripcion: String = "",

    /** Centavos. `Long`, nunca `Double`: `invitation.total_amount` ya arrastra ese error. */
    @Column(name = "precio_centavos", nullable = false)
    var precioCentavos: Long = 0,

    @Column(name = "moneda", nullable = false, length = 3)
    var moneda: String = ProductPaymentsProperties.MONEDA_POR_DEFECTO,

    /** `null` = sin límite de invitados. */
    @Column(name = "invitados_max")
    var invitadosMax: Int? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "incluye", columnDefinition = "jsonb", nullable = false)
    var incluye: String = "[]",

    @Column(name = "recomendado", nullable = false)
    var recomendado: Boolean = false,

    @Column(name = "activo", nullable = false)
    var activo: Boolean = true,

    @Column(name = "orden", nullable = false)
    var orden: Int = 0,

    /** `price_...` de Stripe. No es un secreto, pero nace `null`: lo pone quien configure la cuenta. */
    @Column(name = "stripe_price_id", length = 80)
    var stripePriceId: String? = null,

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant = Instant.EPOCH,

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    var updatedAt: Instant = Instant.EPOCH,
)

/** Los cinco estados del `CHECK` de `product_payment.estado` (V43), tipados. */
enum class EstadoDePago {
    /** Sesión de Checkout abierta; el dinero **no** está cobrado. */
    PENDIENTE,

    /** El webhook confirmó el cobro **y** el importe coincidía con el guardado. */
    PAGADO,

    /** Stripe rechazó el cobro, o la sesión no llegó a crearse. */
    FALLIDO,

    /** La sesión de Checkout expiró sin pagar. */
    CADUCADO,

    /** Reembolso o contracargo: `invitation.is_paid` vuelve a `false` y se retira el release. */
    REEMBOLSADO,
}

/**
 * Fila de `product_payment` (V43): un cobro por invitación.
 *
 * [importeCentavos] lo fija **el servidor** desde [ProductPlanEntity.precioCentavos]. La petición de
 * checkout lleva `invitationId` y `planCodigo` y nada más (contrato §0): un importe que viaje desde
 * el navegador es un descuento gratis para quien sepa abrir la consola.
 */
@Entity
@Table(name = "product_payment")
class ProductPaymentEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "invitation_id", nullable = false)
    var invitationId: Long = 0,

    @Column(name = "customer_id", nullable = false)
    var customerId: Long = 0,

    @Column(name = "product_plan_id", nullable = false)
    var productPlanId: Long = 0,

    @Column(name = "estado", nullable = false, length = 20)
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    var estado: EstadoDePago = EstadoDePago.PENDIENTE,

    @Column(name = "importe_centavos", nullable = false)
    var importeCentavos: Long = 0,

    @Column(name = "moneda", nullable = false, length = 3)
    var moneda: String = ProductPaymentsProperties.MONEDA_POR_DEFECTO,

    @Column(name = "stripe_checkout_session_id", length = 120)
    var stripeCheckoutSessionId: String? = null,

    @Column(name = "stripe_payment_intent_id", length = 120)
    var stripePaymentIntentId: String? = null,

    @Column(name = "comprobante_url", length = 500)
    var comprobanteUrl: String? = null,

    @Column(name = "pagado_en")
    var pagadoEn: Instant? = null,

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant = Instant.EPOCH,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
)

/**
 * Fila de `product_stripe_event` (V44): la idempotencia del webhook (ADR-5-4-03).
 *
 * La clave primaria es el `event.id` de Stripe. El webhook **inserta primero**; si la inserción
 * choca, el evento ya se procesó y se responde `200` sin repetir ni una escritura.
 * Aquí no se guarda ni un dato personal.
 */
@Entity
@Table(name = "product_stripe_event")
class ProductStripeEventEntity(
    @Id
    @Column(name = "event_id", length = 120)
    var eventId: String = "",

    @Column(name = "tipo", nullable = false, length = 80)
    var tipo: String = "",

    @Column(name = "recibido_en", nullable = false, insertable = false, updatable = false)
    var recibidoEn: Instant = Instant.EPOCH,

    @Column(name = "procesado_en")
    var procesadoEn: Instant? = null,

    @Column(name = "resultado", length = 40)
    var resultado: String? = null,
)
