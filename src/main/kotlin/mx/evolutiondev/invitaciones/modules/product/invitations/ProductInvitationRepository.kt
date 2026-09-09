package mx.evolutiondev.invitaciones.modules.product.invitations

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant

/** Lo que el alta necesita saber de una invitación ya escrita. */
data class InvitacionCreada(val id: Long, val creadaEn: Instant)

/** Datos de la fila que se va a insertar; el dueño **no** viaja aquí desde el cuerpo HTTP. */
data class NuevaInvitacion(
    val customerId: Long,
    val templateId: Long,
    val fecha: String,
    val hora: String,
    val hashtag: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val creadaEn: Instant,
)

/**
 * Puerto de persistencia del alta. Es una interfaz para que [ProductInvitationService] se pueda
 * probar sin base de datos ni contexto de Spring, igual que hacen las pruebas de `templates2`
 * (`CatalogControllerTest.kt:28-32`).
 */
interface ProductInvitationRepository {
    /** Id de la fila puente de `V42` para ese `eventKind`, o `null` si el entorno no está migrado. */
    fun plantillaPuente(eventKind: String): Long?

    /** Borradores de **esa** clienta. Consulta acotada por `customer_id`; nunca cuenta la tabla. */
    fun contarBorradores(customerId: Long): Int

    /** Borrador idéntico y reciente del mismo dueño, para la red del doble clic (§6 del contrato). */
    fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        desde: Instant,
    ): InvitacionCreada?

    fun insertar(nueva: NuevaInvitacion): InvitacionCreada
}

/**
 * Implementación con SQL nativo sobre el `EntityManager` de la petición.
 *
 * **Por qué SQL nativo y no `InvitationEntity`.** Escribir con la entidad obligaría a construir un
 * `InvitationTemplateEntity` de `modules/master/templates`, que es **módulo prohibido** toda la fase 5
 * (ADR-5-0C-01), y a arrastrar el grafo de veinte colecciones `@OneToMany` de `InvitationEntity`
 * (`InvitationEntity.kt:18-160`) para insertar una fila. Es la misma decisión, con el mismo motivo,
 * que ya tomaron `Templates2FlagRepository.kt:13-21` y `BusinessSnapshotReader.kt:9-14`; y como ellos,
 * usa el `EntityManager` (participa de la transacción en curso) y **no** `JdbcTemplate`, que en este
 * proyecto no comparte conexión.
 *
 * Ninguna consulta de este fichero importa nada de `modules/user/invitations`,
 * `modules/master/templates` ni `MongoDataInitializer`.
 */
@Repository
class ProductInvitationJpaRepository(
    @PersistenceContext private val entityManager: EntityManager,
) : ProductInvitationRepository {

    override fun plantillaPuente(eventKind: String): Long? {
        val filas = entityManager
            .createNativeQuery("SELECT id FROM invitation_template WHERE url = :marcador")
            .setParameter("marcador", "$PREFIJO_PUENTE$eventKind")
            .resultList
        return (filas.firstOrNull() as? Number)?.toLong()
    }

    /**
     * Borrador = invitación suya, de `templates2`, viva y **sin release activo**. El `NOT EXISTS`
     * sobre `tpl_release` es la definición literal de "sin publicar" (`V34__create_tpl_release.sql`:
     * `ux_tpl_release_active_per_invitation` garantiza como mucho un activo por invitación).
     * `is_enabled IS TRUE` y no `is_enabled`: la columna admite `NULL` en el esquema heredado
     * (`V1__initial_schema.sql:275`) y un `NULL` no debe contar como borrador vivo.
     */
    override fun contarBorradores(customerId: Long): Int {
        val total = entityManager.createNativeQuery(
            """
            SELECT count(*) FROM invitation i
             WHERE i.customer_id = :customerId
               AND i.uses_templates2 IS TRUE
               AND i.is_enabled IS TRUE
               AND NOT EXISTS (
                   SELECT 1 FROM tpl_release r WHERE r.invitation_id = i.id AND r.is_active IS TRUE
               )
            """.trimIndent(),
        ).setParameter("customerId", customerId).singleResult
        return (total as Number).toInt()
    }

    /**
     * `tpl_document` es la señal de "ya empezó a trabajar en ella": si ya eligió plantilla, un alta
     * con los mismos datos es una invitación nueva de verdad, no un doble clic.
     * `i."time"` va entrecomillado porque `time` es palabra reservada en Postgres.
     */
    override fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        desde: Instant,
    ): InvitacionCreada? {
        val filas = entityManager.createNativeQuery(
            """
            SELECT i.id, i.created_at FROM invitation i
             WHERE i.customer_id = :customerId
               AND i.template_id = :templateId
               AND i.uses_templates2 IS TRUE
               AND i.is_enabled IS TRUE
               AND i.date = :fecha
               AND i."time" = :hora
               AND i.created_at >= :desde
               AND NOT EXISTS (SELECT 1 FROM tpl_document d WHERE d.invitation_id = i.id)
             ORDER BY i.id DESC
             LIMIT 1
            """.trimIndent(),
        )
            .setParameter("customerId", customerId)
            .setParameter("templateId", templateId)
            .setParameter("fecha", fecha)
            .setParameter("hora", hora)
            .setParameter("desde", Timestamp.from(desde))
            .resultList
        @Suppress("UNCHECKED_CAST")
        val fila = (filas as List<Array<Any?>>).firstOrNull() ?: return null
        return InvitacionCreada((fila[0] as Number).toLong(), instante(fila[1]))
    }

    /**
     * Una sola sentencia con **todas** las columnas que `InvitationEntity` mapea a primitivos de
     * Kotlin: dejar cualquiera de ellas en `NULL` convierte en `500` cualquier lectura posterior del
     * módulo antiguo (defecto preexistente documentado en `bitacora/3-0a.md` y en
     * `scripts/seed/comun.sh:105-110`).
     *
     * `uses_templates2 = true` se escribe **aquí**, no con `Templates2FlagRepository`: así la
     * invitación nace del lado nuevo y `:choose-template` corta por `comprobarCorte`
     * (`EditorDocumentService.kt:317-318`: bandera ya activa → devuelve `false` sin consultar Mongo),
     * en vez de arriesgar un `NotMigratedException` si Mongo no responde.
     *
     * El id se toma de la secuencia antes de insertar en lugar de usar `INSERT … RETURNING`, que
     * Hibernate trata como sentencia de actualización y no devuelve filas.
     */
    override fun insertar(nueva: NuevaInvitacion): InvitacionCreada {
        val id = (entityManager.createNativeQuery("SELECT nextval('public.invitation_id_seq')")
            .singleResult as Number).toLong()
        entityManager.createNativeQuery(
            """
            INSERT INTO invitation (
                id, customer_id, template_id, is_enabled, is_paid, is_finished,
                all_events_same_location, uses_templates2, date, "time", hashtag, cover_photo_url,
                children_allowed, young_allowed, has_music, has_gallery, has_extra_modules,
                total_amount, created_by, updated_by, created_at, updated_at
            ) VALUES (
                :id, :customerId, :templateId, true, false, false,
                false, true, :fecha, :hora, :hashtag, '',
                :children, :young, false, false, false,
                0, :customerId, :customerId, :creadaEn, :creadaEn
            )
            """.trimIndent(),
        )
            .setParameter("id", id)
            .setParameter("customerId", nueva.customerId)
            .setParameter("templateId", nueva.templateId)
            .setParameter("fecha", nueva.fecha)
            .setParameter("hora", nueva.hora)
            .setParameter("hashtag", nueva.hashtag)
            .setParameter("children", nueva.childrenAllowed)
            .setParameter("young", nueva.youngAllowed)
            .setParameter("creadaEn", Timestamp.from(nueva.creadaEn))
            .executeUpdate()
        return InvitacionCreada(id, nueva.creadaEn)
    }

    private fun instante(valor: Any?): Instant = when (valor) {
        is Timestamp -> valor.toInstant()
        is Instant -> valor
        else -> Instant.now()
    }

    companion object {
        /** Marcador estable de las ocho filas puente de `V42`; nunca un id codificado en Kotlin. */
        const val PREFIJO_PUENTE = "templates2:"
    }
}
