package mx.evolutiondev.invitaciones.modules.product.payments

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EntityManager
import jakarta.persistence.Id
import jakarta.persistence.PersistenceContext
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.Repository
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository as SpringRepository

/** Catálogo (V42). Solo lectura desde la aplicación: las filas las siembra y actualiza Flyway. */
@SpringRepository
interface ProductPlanRepository : JpaRepository<ProductPlanEntity, Long> {

    /** `GET /public/plans`: solo los activos, en el orden del catálogo. */
    fun findByActivoTrueOrderByOrdenAscIdAsc(): List<ProductPlanEntity>

    fun findByCodigoAndActivoTrue(codigo: String): ProductPlanEntity?
}

/** Cobros (V43). */
@SpringRepository
interface ProductPaymentRepository : JpaRepository<ProductPaymentEntity, Long> {

    /** Historial de una invitación, más reciente primero (contrato §2.2). */
    fun findByInvitationIdOrderByIdDesc(invitationId: Long): List<ProductPaymentEntity>

    /** Historial de la clienta (contrato §2.3). Filtrado por propiedad **en la consulta**. */
    fun findByCustomerIdOrderByIdDesc(customerId: Long): List<ProductPaymentEntity>

    fun findByStripeCheckoutSessionId(sessionId: String): ProductPaymentEntity?

    fun findByStripePaymentIntentId(paymentIntentId: String): ProductPaymentEntity?

    /**
     * Cuantos cobros de esa invitacion estan en ese estado. Lo usa el webhook (revision 5-4-ADV)
     * para detectar el **cobro doble**: dos sesiones de Checkout abiertas sobre la misma invitacion
     * y las dos pagadas. El dinero ya esta tomado y negarlo no lo devuelve, asi que el segundo cobro
     * se registra igual, pero el evento queda anotado como `PAGO_DUPLICADO` en lugar de `PROCESADO`.
     */
    fun countByInvitationIdAndEstado(invitationId: Long, estado: EstadoDePago): Long
}

/**
 * Eventos ya vistos (V44). El `save` de un id existente **actualizaría** la fila en vez de chocar
 * (Hibernate hace `merge` cuando el id ya existe), así que la idempotencia se apoya en un `INSERT`
 * nativo con `ON CONFLICT DO NOTHING` que devuelve el número de filas escritas: `0` = duplicado.
 */
@SpringRepository
interface ProductStripeEventRepository : JpaRepository<ProductStripeEventEntity, String> {

    /**
     * Devuelve `1` si este `event.id` es nuevo y `0` si ya estaba. Es el punto exacto de la
     * idempotencia (ADR-5-4-03): se llama **antes** de procesar y dentro de la misma transacción,
     * para que un fallo posterior deshaga también esta marca y el reintento de Stripe sirva.
     */
    @Modifying
    @Query(
        value = "INSERT INTO product_stripe_event (event_id, tipo) VALUES (:eventId, :tipo) " +
            "ON CONFLICT (event_id) DO NOTHING",
        nativeQuery = true,
    )
    fun insertarSiEsNuevo(@Param("eventId") eventId: String, @Param("tipo") tipo: String): Int

    @Modifying
    @Query(
        value = "UPDATE product_stripe_event SET procesado_en = now(), resultado = :resultado " +
            "WHERE event_id = :eventId",
        nativeQuery = true,
    )
    fun marcarProcesado(@Param("eventId") eventId: String, @Param("resultado") resultado: String): Int
}

/**
 * Mapeo mínimo de `invitation`, **solo** para dar tipo a [InvitationPaymentFlagRepository]. Spring
 * Data exige un `@Entity` por interfaz de repositorio y esta clase **no** es `InvitationEntity`: esa
 * es del módulo antiguo y no se toca (mismo motivo y mismo patrón que `InvitationFlagRow`,
 * `templates2/persistence/Templates2FlagRepository.kt:24-33`). Mapea las tres columnas que este
 * módulo necesita; el resto de `invitation` es invisible aquí a propósito.
 */
@Entity
@Table(name = "invitation")
class InvitationPaymentRow(
    @Id
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "is_paid")
    var isPaid: Boolean? = null,

    @Column(name = "total_amount")
    var totalAmount: Double? = null,
)

/**
 * **Único escritor** de `invitation.is_paid` y `invitation.total_amount` del módulo de pagos, y lo
 * llama **solo el webhook** (contrato §4). Consultas nativas acotadas, nunca `InvitationEntity`.
 *
 * Por qué `total_amount` se sigue escribiendo aunque el importe de verdad viva en
 * `product_payment.importe_centavos`: el panel heredado lo lee (`DashboardRepository.kt:17-20`) y
 * dejarlo en `0` mientras la invitación está pagada haría mentir a una pantalla que sigue en
 * producción. Es un dato heredado, no la fuente (`12-producto-completo.md §A5.3`).
 */
@SpringRepository
interface InvitationPaymentFlagRepository : Repository<InvitationPaymentRow, Long> {

    /** `null` si la invitación no existe; `null` en la columna se interpreta como "no pagada". */
    @Query(value = "SELECT is_paid FROM invitation WHERE id = :invitationId", nativeQuery = true)
    fun isPaid(@Param("invitationId") invitationId: Long): Boolean?

    /** Dueño de la invitación: la comprobación de propiedad de `03 §9.1` sin cargar el grafo antiguo. */
    @Query(value = "SELECT customer_id FROM invitation WHERE id = :invitationId", nativeQuery = true)
    fun customerId(@Param("invitationId") invitationId: Long): Long?

    /** Marca pagada. Devuelve las filas afectadas. Solo lo llama el webhook, tras verificar la firma. */
    @Modifying(clearAutomatically = true)
    @Query(
        value = "UPDATE invitation SET is_paid = true, total_amount = :total, updated_at = now() " +
            "WHERE id = :invitationId",
        nativeQuery = true,
    )
    fun marcarPagada(@Param("invitationId") invitationId: Long, @Param("total") total: Double): Int

    /** Reembolso o contracargo: la invitación deja de estar pagada y la puerta se vuelve a cerrar. */
    @Modifying(clearAutomatically = true)
    @Query(
        value = "UPDATE invitation SET is_paid = false, updated_at = now() WHERE id = :invitationId",
        nativeQuery = true,
    )
    fun marcarNoPagada(@Param("invitationId") invitationId: Long): Int

    /**
     * Retira el release activo (ADR-5-0B-01: un reembolso apaga el enlace público de inmediato).
     *
     * Es una consulta nativa y no una llamada a `ReleaseService.unpublish` porque ese método exige un
     * `requesterId` con acceso y **autoriza**: el webhook no actúa en nombre de nadie. Escribe las dos
     * columnas que `ck_tpl_release_unpublished` exige a la vez (`V34__create_tpl_release.sql:21`).
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = "UPDATE tpl_release SET is_active = false, unpublished_at = now() " +
            "WHERE invitation_id = :invitationId AND is_active",
        nativeQuery = true,
    )
    fun retirarReleaseActivo(@Param("invitationId") invitationId: Long): Int

    /**
     * El `public_token` del documento de esa invitacion, o `null` si no tiene documento.
     *
     * Lo necesita el reembolso (revision 5-4-ADV): retirar la fila de `tpl_release` apaga el enlace
     * **en origen**, pero lo que el borde tiene cacheado sigue sirviendose hasta que caduque. Es
     * exactamente el caso que ADR-2-6-01 describe para despublicar, y un reembolso o un contracargo
     * no puede dejar la invitacion visible unos minutos mas. Consulta nativa acotada a una columna,
     * mismo criterio que el resto de este fichero: este modulo no monta las entidades de `templates2`.
     */
    @Query(value = "SELECT public_token FROM tpl_document WHERE invitation_id = :invitationId", nativeQuery = true)
    fun publicTokenDe(@Param("invitationId") invitationId: Long): String?
}

/** Lo que la pantalla de plan necesita saber de la invitación, sin cargar el módulo antiguo. */
data class DatosDeInvitacion(val invitationId: Long, val customerId: Long, val pagada: Boolean, val nombreEvento: String?)

/**
 * Lee de `invitation` lo justo para pintar la pantalla de plan: dueño, si está pagada y un nombre
 * legible del evento.
 *
 * El nombre sale del negocio existente y de nada más: `event_type.name` a través de
 * `invitation_template` (la misma cadena que usa `BusinessSnapshotReader.kt:32-37`) y los nombres de
 * `invitation_people`, que es donde el módulo antiguo guarda a los festejados. Sin gente registrada
 * queda solo el tipo de evento; sin nada, `null` — y entonces el frontend pinta el tipo (contrato
 * §2.2). No se inventa ningún texto en el backend (P3).
 */
@SpringRepository
class InvitationPaymentInfoReader(
    @PersistenceContext private val entityManager: EntityManager,
) {

    private val sql = """
        SELECT i.id,
               i.customer_id,
               COALESCE(i.is_paid, false),
               et.name,
               (SELECT string_agg(p.name, ' y ' ORDER BY p.id)
                  FROM invitation_people p
                 WHERE p.invitation_id = i.id AND p.name IS NOT NULL AND p.name <> '')
        FROM invitation i
        LEFT JOIN invitation_template it2 ON it2.id = i.template_id
        LEFT JOIN event_type et ON et.id = it2.event_type_id
        WHERE i.id = :invitationId
    """.trimIndent()

    /** `null` si la invitación no existe. Nunca lanza: quien orquesta decide el código `PAY_*`. */
    fun leer(invitationId: Long): DatosDeInvitacion? {
        @Suppress("UNCHECKED_CAST")
        val filas = entityManager.createNativeQuery(sql)
            .setParameter("invitationId", invitationId)
            .resultList as List<Array<Any?>>
        val fila = filas.firstOrNull() ?: return null
        val tipo = (fila[3] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        val gente = (fila[4] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        return DatosDeInvitacion(
            invitationId = (fila[0] as Number).toLong(),
            customerId = (fila[1] as Number).toLong(),
            pagada = fila[2] as? Boolean ?: false,
            nombreEvento = when {
                tipo != null && gente != null -> "$tipo de $gente"
                tipo != null -> tipo
                else -> gente
            },
        )
    }

    /** Los nombres de evento de varias invitaciones a la vez, para el historial de `…/pagos`. */
    fun nombresDeEvento(invitationIds: Collection<Long>): Map<Long, String?> =
        invitationIds.distinct().associateWith { leer(it)?.nombreEvento }

    /**
     * Correo de la clienta, para `customer_email` de la sesión de Checkout: sin él, Stripe lo pide
     * otra vez a alguien que ya lo dio. Se lee aquí y no desde `CustomerEntity` por el mismo motivo
     * que todo lo demás de este fichero: cargar esa entidad arrastra el grafo del módulo antiguo.
     */
    fun correoDelCliente(customerId: Long): String? {
        @Suppress("UNCHECKED_CAST")
        val filas = entityManager.createNativeQuery("SELECT email FROM customer WHERE id = :id")
            .setParameter("id", customerId)
            .resultList as List<Any?>
        return (filas.firstOrNull() as? String)?.trim()?.takeIf { it.isNotEmpty() }
    }
}
