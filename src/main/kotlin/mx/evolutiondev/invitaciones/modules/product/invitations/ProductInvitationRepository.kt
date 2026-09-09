package mx.evolutiondev.invitaciones.modules.product.invitations

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant

/** Lo que el alta necesita saber de una invitación ya escrita. */
data class InvitacionCreada(val id: Long, val creadaEn: Instant)

/**
 * La fila **tal como está en la base**. La devuelve el camino del doble clic para que la respuesta
 * no invente nada (R1-11): antes se devolvía el id y la fecha de creación de la fila previa pero el
 * `hashtag`, `childrenAllowed` y `youngAllowed` de la petición nueva, que no se escribían en ninguna
 * parte — la respuesta afirmaba que se había guardado algo que no se guardó.
 */
data class InvitacionExistente(
    val id: Long,
    val fecha: String,
    val hora: String,
    val hashtag: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val isPaid: Boolean,
    val isEnabled: Boolean,
    val isFinished: Boolean,
    val creadaEn: Instant,
)

/**
 * Estado de una invitación **suya** que se quiere borrar. Lo que decide si se puede borrar, no un
 * volcado de la fila: nada de esto sale nunca en una respuesta (ver [ProductInvitationService.eliminar]).
 */
data class BorradorPropio(
    val id: Long,
    val isPaid: Boolean,
    val usaTemplates2: Boolean,
    /** Tiene o tuvo alguna publicación en `tpl_release`, activa o no. */
    val publicadaAlgunaVez: Boolean,
)

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
    /**
     * Toma el bloqueo de fila de la clienta (`SELECT … FOR UPDATE`) para que el conteo de borradores
     * y la inserción de **esa** clienta no puedan solaparse (R1-05). Devuelve `false` si la fila no
     * existe. Ver el KDoc de [ProductInvitationJpaRepository.bloquearCliente].
     */
    fun bloquearCliente(customerId: Long): Boolean

    /** Id de la fila puente de `V42` para ese `eventKind`, o `null` si el entorno no está migrado. */
    fun plantillaPuente(eventKind: String): Long?

    /** Borradores de **esa** clienta. Consulta acotada por `customer_id`; nunca cuenta la tabla. */
    fun contarBorradores(customerId: Long): Int

    /** Borrador idéntico y reciente del mismo dueño, para la red del doble clic (§3 del contrato). */
    fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        hashtag: String,
        childrenAllowed: Boolean,
        youngAllowed: Boolean,
        desde: Instant,
    ): InvitacionExistente?

    fun insertar(nueva: NuevaInvitacion): InvitacionCreada

    /** Estado de una invitación **suya**, o `null` si no existe o no es suya (no distingue: §5). */
    fun buscarPropia(customerId: Long, invitationId: Long): BorradorPropio?

    /**
     * Borra la invitación **suya**. Devuelve las filas borradas (0 o 1). Todo lo que cuelga de la
     * invitación cae por `ON DELETE CASCADE`; ver el KDoc de la implementación.
     */
    fun borrar(customerId: Long, invitationId: Long): Int
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

    /**
     * **El cierre de la carrera del tope de borradores (R1-05).**
     *
     * `contarBorradores` e `insertar` iban en la misma transacción pero sin bloqueo: con
     * `READ COMMITTED` (el defecto de PostgreSQL) cada transacción concurrente veía la foto anterior,
     * contaba lo mismo y todas insertaban — el techo no era 3, era el número de peticiones en vuelo.
     *
     * Se bloquea la fila de `customer` y no se añade una restricción de tabla porque **la restricción
     * no se puede escribir**: "borrador" no es una propiedad de la fila de `invitation`, es la
     * ausencia de un release activo en otra tabla (`tpl_release`), así que ni un índice único parcial
     * ni un `CHECK` pueden expresar «como mucho tres». Un índice único sobre `(customer_id, hueco)`
     * exigiría además liberar el hueco al publicar, y publicar es código de `templates2` que este
     * módulo no puede tocar.
     *
     * El bloqueo es **por clienta**, dura lo que dura la transacción (un `INSERT`) y toma el mismo
     * orden de bloqueos que ya toma cualquier alta: el `INSERT` en `invitation` pide de todas formas
     * un `FOR KEY SHARE` sobre esta misma fila por la clave ajena `invitation.customer_id`. Al pedir
     * antes el modo más fuerte sobre la misma fila no se introduce ningún orden nuevo, así que no
     * abre interbloqueos.
     */
    override fun bloquearCliente(customerId: Long): Boolean {
        val filas = entityManager
            .createNativeQuery("SELECT id FROM customer WHERE id = :customerId FOR UPDATE")
            .setParameter("customerId", customerId)
            .resultList
        return filas.isNotEmpty()
    }

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
     *
     * **La igualdad incluye los seis campos del cuerpo, no tres** (R1-11): un doble clic manda el
     * mismo cuerpo entero, así que exigir que `hashtag`, `children_allowed` y `young_allowed`
     * coincidan no deja fuera ningún doble clic real y sí deja fuera dos altas legítimas del mismo
     * evento con hashtag distinto, que antes colapsaban en una sola fila.
     */
    override fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        hashtag: String,
        childrenAllowed: Boolean,
        youngAllowed: Boolean,
        desde: Instant,
    ): InvitacionExistente? {
        val filas = entityManager.createNativeQuery(
            """
            SELECT i.id, i.date, i."time", i.hashtag, i.children_allowed, i.young_allowed,
                   i.is_paid, i.is_enabled, i.is_finished, i.created_at
              FROM invitation i
             WHERE i.customer_id = :customerId
               AND i.template_id = :templateId
               AND i.uses_templates2 IS TRUE
               AND i.is_enabled IS TRUE
               AND i.date = :fecha
               AND i."time" = :hora
               AND coalesce(i.hashtag, '') = :hashtag
               AND i.children_allowed = :children
               AND i.young_allowed = :young
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
            .setParameter("hashtag", hashtag)
            .setParameter("children", childrenAllowed)
            .setParameter("young", youngAllowed)
            .setParameter("desde", Timestamp.from(desde))
            .resultList
        @Suppress("UNCHECKED_CAST")
        val fila = (filas as List<Array<Any?>>).firstOrNull() ?: return null
        return InvitacionExistente(
            id = (fila[0] as Number).toLong(),
            fecha = fila[1] as? String ?: fecha,
            hora = fila[2] as? String ?: hora,
            hashtag = fila[3] as? String ?: "",
            childrenAllowed = fila[4] as? Boolean ?: false,
            youngAllowed = fila[5] as? Boolean ?: false,
            isPaid = fila[6] as? Boolean ?: false,
            isEnabled = fila[7] as? Boolean ?: false,
            isFinished = fila[8] as? Boolean ?: false,
            creadaEn = instante(fila[9]),
        )
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

    /**
     * Acotada por `customer_id` **en el `WHERE`**: una invitación ajena no se distingue de una que no
     * existe, ni por el cuerpo ni por el tiempo (misma consulta, mismo plan).
     */
    override fun buscarPropia(customerId: Long, invitationId: Long): BorradorPropio? {
        val filas = entityManager.createNativeQuery(
            """
            SELECT i.id, i.is_paid, i.uses_templates2,
                   EXISTS (SELECT 1 FROM tpl_release r WHERE r.invitation_id = i.id)
              FROM invitation i
             WHERE i.id = :invitationId
               AND i.customer_id = :customerId
            """.trimIndent(),
        )
            .setParameter("invitationId", invitationId)
            .setParameter("customerId", customerId)
            .resultList
        @Suppress("UNCHECKED_CAST")
        val fila = (filas as List<Array<Any?>>).firstOrNull() ?: return null
        return BorradorPropio(
            id = (fila[0] as Number).toLong(),
            isPaid = fila[1] as? Boolean ?: false,
            usaTemplates2 = fila[2] as? Boolean ?: false,
            publicadaAlgunaVez = fila[3] as? Boolean ?: false,
        )
    }

    /**
     * **Qué cae con la invitación.** Todo lo que cuelga de ella tiene `ON DELETE CASCADE`: las trece
     * tablas del módulo antiguo (`V9__add_cascade_delete_to_invitation_relations.sql`),
     * `invitation_guest` (`V9:85-87`), y las tres de `templates2` —`tpl_document` (`V32:7`), que
     * arrastra `tpl_document_snapshot` (`V33:8`); `tpl_release` (`V34:7`); y `tpl_asset` (`V31:9`),
     * cuyo `AFTER DELETE` encola cada objeto de S3 en `tpl_asset_gc` para que el barrendero los borre
     * (`V37:23-33`) — o sea que borrar aquí **no** deja imágenes huérfanas en el bucket.
     *
     * La única excepción es `invitation_guest_notification`, cuya clave ajena se creó en `V10` —
     * **después** de `V9`— y se quedó sin cascada (`V10:11-14`): sin este borrado previo, un
     * `DELETE` sobre una invitación con avisos enviados fallaría con violación de clave ajena. Se
     * borra aquí, en la misma transacción, y no se le cambia la cascada a la tabla compartida para no
     * alterar el comportamiento del borrado del módulo antiguo, que no es de este encargo.
     */
    override fun borrar(customerId: Long, invitationId: Long): Int {
        entityManager.createNativeQuery(
            """
            DELETE FROM invitation_guest_notification n
             WHERE n.invitation_id IN (
                 SELECT i.id FROM invitation i WHERE i.id = :invitationId AND i.customer_id = :customerId
             )
            """.trimIndent(),
        )
            .setParameter("invitationId", invitationId)
            .setParameter("customerId", customerId)
            .executeUpdate()
        return entityManager.createNativeQuery(
            "DELETE FROM invitation WHERE id = :invitationId AND customer_id = :customerId",
        )
            .setParameter("invitationId", invitationId)
            .setParameter("customerId", customerId)
            .executeUpdate()
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
