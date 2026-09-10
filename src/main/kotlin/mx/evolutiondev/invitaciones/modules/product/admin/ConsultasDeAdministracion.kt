package mx.evolutiondev.invitaciones.modules.product.admin

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager
import jakarta.persistence.Query
import jakarta.persistence.Tuple
import mx.evolutiondev.invitaciones.modules.product.admin.AlcanceDeAdministracion.Companion.PREDICADO
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant
import java.time.OffsetDateTime

/**
 * **Las siete lecturas de la consola de administración del producto nuevo, todas en SQL nativo.**
 *
 * ### Por qué SQL nativo y no JPQL sobre las entidades
 * 1. **El alcance por rol tiene que ir en la consulta, nunca filtrando en memoria** (contrato §0).
 *    Filtrar después de traer es un IDOR esperando a que alguien pagine mal.
 * 2. Las tablas de `templates2` (`tpl_document`, `tpl_release`, `tpl_template_version`) **no tienen
 *    asociación JPA con `InvitationEntity`**: `TplDocumentEntity.kt:37` y `TplReleaseEntity.kt:31`
 *    guardan `invitation_id` como columna suelta, a propósito. Cruzarlas desde JPQL obliga a *entity
 *    joins* con `ON`, que resuelven distinto según versión de Hibernate.
 * 3. `InvitationEntity`, `CustomerEntity`, `InvitationGuestEntity` y `InvitationPlanEntity` llevan
 *    `@Filter(name = "enabledFilter")` (`InvitationEntity.kt:16`, `CustomerEntity.kt:15`,
 *    `InvitationGuestEntity.kt:16`, `InvitationPlanEntity.kt:13`) y un aspecto lo enciende o lo apaga
 *    **según el rol de quien pide** (`core/hibernate/aspect/HibernateFilterAspect.kt:26-36`). Una
 *    consulta de administración que tiene que **ver** lo deshabilitado (el estado `deshabilitada` del
 *    contrato §3 es precisamente `is_enabled = false`) no puede depender de que un aspecto haya pasado
 *    antes por ahí. Los filtros de Hibernate **no se aplican a SQL nativo**: lo que se lee es lo que
 *    dice el `WHERE`, y nada más.
 *
 * ### Qué NO hay aquí
 * Ni un `INSERT`, ni un `UPDATE`, ni un `DELETE`. Las siete rutas son de lectura y **no se crea
 * ninguna migración**: todo sale de tablas que ya existen (`V1__initial_schema.sql` para `invitation`,
 * `customer`, `invitation_template`, `invitation_plan`, `event_type`; `V8`/`V16`/`V40` para
 * `invitation_guest`; `V29`, `V30`, `V32` y `V34` para las cuatro de `templates2`).
 *
 * ### Aviso sobre los nombres de columna de `customer`
 * `PhysicalNamingStrategyStandardImpl` está activo (`application.yml:34`), así que Hibernate **no** convierte `camelCase` a `snake_case`: la
 * columna de `CustomerEntity.lastName` (`core/auth/model/CustomerEntity.kt:21`) se llama `lastname`,
 * en una sola palabra (`V1__initial_schema.sql`, tabla `public.customer`), no `last_name`. Verificado
 * contra la base real: escribir `c.last_name` da `ERROR: column c.last_name does not exist`.
 *
 * ### Cómo se leen las columnas
 * Por **índice**, no por nombre: PostgreSQL pasa a minúsculas cualquier alias sin comillas, así que
 * `AS rsvpUltimos7Dias` llegaría como `rsvpultimos7dias` y una proyección por nombre casaría o no
 * según el motor. El índice es exacto y el orden está escrito al lado de cada consulta.
 */
@Repository
class ConsultasDeAdministracion(
    private val em: EntityManager,
) {

    /** Solo lee arrays de cadenas de `tpl_template_version.event_kinds`. No necesita configuración. */
    private val json = ObjectMapper()

    // ------------------------------------------------------------------ §1 métricas

    /**
     * Contrato §1. Cinco enteros y ni uno más.
     *
     * - `publicadas` = invitaciones con `tpl_release.is_active = true`
     *   (`V34__create_tpl_release.sql:14`, `TplReleaseEntity.kt:57`).
     * - `pagadas` = `invitation.is_paid = true` (`InvitationEntity.kt:47-48`). Va con `coalesce`
     *   porque la columna es **NULLABLE** en la base (`V1__initial_schema.sql`, `invitation.is_paid
     *   boolean`) aunque Kotlin la mapee a un primitivo.
     * - `rsvpUltimos7Dias` es **un aproximado, y hay que decirlo**. El contrato lo describe sobre
     *   `invitation_guest.is_attending`, pero **esa columna ya no existe**:
     *   `V16__add_guest_enhancements.sql:45` la borró y la sustituyó por el enum `attendance_status`
     *   (`V16:3`, `InvitationGuestEntity.kt:54-56`). Se cuenta entonces `attendance_status =
     *   'CONFIRMED'`. Y sigue siendo aproximado por el motivo que el contrato ya anticipaba: **no hay
     *   columna de fecha de confirmación**, así que la ventana se mide sobre `updated_at`, que
     *   cualquier edición del invitado mueve (cambiar la mesa cuenta como RSVP reciente). Queda
     *   anotado en `preguntas-abiertas.md` para el dueño.
     *   Se excluyen los invitados borrados lógicamente (`is_enabled = false`, `SQLDelete` de
     *   `InvitationGuestEntity.kt:15`): un invitado eliminado no es un RSVP de esta semana.
     *
     * Orden de columnas: 0 clientas · 1 invitaciones · 2 publicadas · 3 pagadas · 4 rsvp.
     */
    fun metricas(alcance: AlcanceDeAdministracion): MetricasDeAdministracion {
        val sql = """
            SELECT
              (SELECT count(*) FROM customer c WHERE $PREDICADO),
              (SELECT count(*) FROM invitation i
                 JOIN customer c ON c.id = i.customer_id WHERE $PREDICADO),
              (SELECT count(*) FROM tpl_release r
                 JOIN invitation i ON i.id = r.invitation_id
                 JOIN customer c ON c.id = i.customer_id
                WHERE r.is_active = true AND $PREDICADO),
              (SELECT count(*) FROM invitation i
                 JOIN customer c ON c.id = i.customer_id
                WHERE coalesce(i.is_paid, false) = true AND $PREDICADO),
              (SELECT count(*) FROM invitation_guest g
                 JOIN invitation i ON i.id = g.invitation_id
                 JOIN customer c ON c.id = i.customer_id
                WHERE g.attendance_status = 'CONFIRMED'
                  AND coalesce(g.is_enabled, true) = true
                  AND g.updated_at >= now() - interval '7 days'
                  AND $PREDICADO)
        """.trimIndent()
        val f = consulta(sql, alcance).singleResult as Tuple
        return MetricasDeAdministracion(
            clientas = f.entero(0),
            invitaciones = f.entero(1),
            publicadas = f.entero(2),
            pagadas = f.entero(3),
            rsvpUltimos7Dias = f.entero(4),
        )
    }

    // ------------------------------------------------------------------ §2 clientas

    private val filtroDeClienta = """
        $PREDICADO
        AND (lower(coalesce(c.name, '') || ' ' || coalesce(c.lastname, '')) LIKE :patron
             OR lower(c.email) LIKE :patron)
    """.trimIndent()

    fun contarClientas(alcance: AlcanceDeAdministracion, patron: String): Long =
        (consulta("SELECT count(*) FROM customer c WHERE $filtroDeClienta", alcance)
            .setParameter("patron", patron)
            .singleResult as Tuple).entero(0)

    /**
     * Contrato §2. Orden de columnas: 0 id · 1 name · 2 lastname · 3 email · 4 role · 5 is_enabled ·
     * 6 nº de invitaciones · 7 created_at.
     *
     * `invitaciones` es una subconsulta correlacionada y **no lleva alcance propio**: son las
     * invitaciones de esa clienta, y la clienta ya pasó el filtro de alcance de la consulta exterior.
     *
     * El orden es `created_at DESC, id DESC`: `id` desempata para que dos altas del mismo instante no
     * salgan en orden distinto en dos páginas consecutivas (una paginación sin orden total repite y
     * salta filas).
     */
    fun clientas(
        alcance: AlcanceDeAdministracion,
        patron: String,
        tamano: Int,
        desplazamiento: Int,
    ): List<ClientaDeAdministracion> {
        val sql = """
            SELECT c.id, c.name, c.lastname, c.email, c.role, c.is_enabled,
                   (SELECT count(*) FROM invitation i WHERE i.customer_id = c.id),
                   c.created_at
              FROM customer c
             WHERE $filtroDeClienta
             ORDER BY c.created_at DESC, c.id DESC
             LIMIT :tamano OFFSET :desplazamiento
        """.trimIndent()
        return consulta(sql, alcance)
            .setParameter("patron", patron)
            .setParameter("tamano", tamano)
            .setParameter("desplazamiento", desplazamiento)
            .filas()
            .map {
                ClientaDeAdministracion(
                    id = it.entero(0),
                    nombre = listOfNotNull(it.texto(1), it.texto(2)).joinToString(" ").trim(),
                    correo = it.texto(3).orEmpty(),
                    rol = it.texto(4).orEmpty(),
                    habilitada = it.booleano(5),
                    invitaciones = it.entero(6),
                    altaEn = it.instante(7)?.toString(),
                )
            }
    }

    // ------------------------------------------------------------------ §3 invitaciones

    /**
     * Cuerpo común de §3: `invitation` con su clienta, su plantilla heredada (para el tipo de evento y
     * el plan) y las dos tablas de `templates2` que deciden si está publicada.
     *
     * El plan se alcanza **a través de la plantilla**, que es como está modelado hoy:
     * `invitation.template_id → invitation_template.invitation_plan_id → invitation_plan.id`
     * (`12-producto-completo.md §A5.1`; `DashboardRepository.kt:32` navega esa misma cadena).
     * Todos los saltos son `LEFT JOIN` menos el de `customer`, que es `NOT NULL`
     * (`V1__initial_schema.sql`, `invitation.customer_id bigint NOT NULL`): una invitación sin plan
     * tiene que salir con `plan: null`, no desaparecer del listado.
     *
     * `tpl_release` se une **solo por la fila activa** (`r.is_active = true`), y el índice único
     * parcial `ux_tpl_release_active_per_invitation` (`V34:23-24`) garantiza que como mucho hay una,
     * así que la unión no puede duplicar filas de invitación.
     */
    private val desdeInvitacion = """
        FROM invitation i
        JOIN customer c ON c.id = i.customer_id
        LEFT JOIN invitation_template t ON t.id = i.template_id
        LEFT JOIN event_type et ON et.id = t.event_type_id
        LEFT JOIN invitation_plan p ON p.id = t.invitation_plan_id
        LEFT JOIN tpl_document d ON d.invitation_id = i.id
        LEFT JOIN tpl_release r ON r.invitation_id = i.id AND r.is_active = true
    """.trimIndent()

    /**
     * Filtros de §3, **todos en SQL**.
     *
     * - `estado`: `1` publicada, `2` en-edición, `3` deshabilitada, `0` sin filtro. `deshabilitada`
     *   gana sobre las otras dos, tal como pide el contrato: por eso las tres ramas son excluyentes
     *   y las dos primeras exigen `is_enabled = true`.
     * - `pago`: `1` pagada, `2` pendiente, `0` sin filtro.
     * - `buscar` casa contra el nombre y el correo de la clienta y contra el nombre del tipo de evento.
     */
    private val filtroDeInvitacion = """
        $PREDICADO
        AND (:estado = 0
             OR (:estado = 1 AND coalesce(i.is_enabled, true) = true AND r.id IS NOT NULL)
             OR (:estado = 2 AND coalesce(i.is_enabled, true) = true AND r.id IS NULL)
             OR (:estado = 3 AND coalesce(i.is_enabled, true) = false))
        AND (:pago = 0
             OR (:pago = 1 AND coalesce(i.is_paid, false) = true)
             OR (:pago = 2 AND coalesce(i.is_paid, false) = false))
        AND (lower(coalesce(c.name, '') || ' ' || coalesce(c.lastname, '')) LIKE :patron
             OR lower(c.email) LIKE :patron
             OR lower(coalesce(et.name, '')) LIKE :patron)
    """.trimIndent()

    fun contarInvitaciones(
        alcance: AlcanceDeAdministracion,
        patron: String,
        estado: Int,
        pago: Int,
    ): Long = (
        consulta("SELECT count(*) $desdeInvitacion WHERE $filtroDeInvitacion", alcance)
            .setParameter("patron", patron)
            .setParameter("estado", estado)
            .setParameter("pago", pago)
            .singleResult as Tuple
        ).entero(0)

    /**
     * Contrato §3. Orden de columnas: 0 id · 1 evento · 2 fecha · 3 hora · 4 clienta id · 5 name ·
     * 6 last_name · 7 plan · 8 is_paid · 9 total_amount · 10 is_enabled · 11 hay release activo ·
     * 12 public_token (o `NULL`) · 13 uses_templates2 · 14 created_at.
     *
     * La columna 12 es la regla de confidencialidad del contrato escrita en SQL: el `CASE` devuelve
     * `NULL` cuando no hay release activo, así que **el `public_token` de una invitación no publicada
     * ni siquiera sale de la base**. No se filtra después en Kotlin, donde un `if` se puede borrar.
     *
     * `"time"` va entre comillas: es palabra reservada de SQL y la columna se llama así
     * (`V1__initial_schema.sql`, `"time" character varying(255)`).
     */
    fun invitaciones(
        alcance: AlcanceDeAdministracion,
        patron: String,
        estado: Int,
        pago: Int,
        tamano: Int,
        desplazamiento: Int,
    ): List<InvitacionDeAdministracion> {
        val sql = """
            SELECT i.id, et.name, i.date, i."time",
                   c.id, c.name, c.lastname,
                   p.name, coalesce(i.is_paid, false), coalesce(i.total_amount, 0),
                   coalesce(i.is_enabled, true),
                   (r.id IS NOT NULL),
                   CASE WHEN r.id IS NOT NULL THEN d.public_token ELSE NULL END,
                   coalesce(i.uses_templates2, false), i.created_at
            $desdeInvitacion
            WHERE $filtroDeInvitacion
            ORDER BY i.created_at DESC, i.id DESC
            LIMIT :tamano OFFSET :desplazamiento
        """.trimIndent()
        return consulta(sql, alcance)
            .setParameter("patron", patron)
            .setParameter("estado", estado)
            .setParameter("pago", pago)
            .setParameter("tamano", tamano)
            .setParameter("desplazamiento", desplazamiento)
            .filas()
            .map {
                val habilitada = it.booleano(10)
                val publicada = it.booleano(11)
                InvitacionDeAdministracion(
                    id = it.entero(0),
                    evento = it.texto(1),
                    fecha = it.texto(2),
                    hora = it.texto(3),
                    clientaId = it.entero(4),
                    clienta = listOfNotNull(it.texto(5), it.texto(6)).joinToString(" ").trim(),
                    plan = it.texto(7),
                    pagada = it.booleano(8),
                    importe = it.decimal(9),
                    estado = when {
                        !habilitada -> ParametrosDeAdministracion.ESTADO_DESHABILITADA
                        publicada -> ParametrosDeAdministracion.ESTADO_PUBLICADA
                        else -> ParametrosDeAdministracion.ESTADO_EN_EDICION
                    },
                    enlacePublico = it.texto(12),
                    usaTemplates2 = it.booleano(13),
                    creadaEn = it.instante(14)?.toString(),
                )
            }
    }

    // ------------------------------------------------------------------ §5 pagos (fuente de hoy)

    private val filtroDePago = """
        $PREDICADO
        AND (:pago = 0
             OR (:pago = 1 AND coalesce(i.is_paid, false) = true)
             OR (:pago = 2 AND coalesce(i.is_paid, false) = false))
    """.trimIndent()

    fun contarPagos(alcance: AlcanceDeAdministracion, pago: Int): Long = (
        consulta(
            """
            SELECT count(*) FROM invitation i
              JOIN customer c ON c.id = i.customer_id
             WHERE $filtroDePago
            """.trimIndent(),
            alcance,
        ).setParameter("pago", pago).singleResult as Tuple
        ).entero(0)

    /**
     * Contrato §5, proyección desde `invitation`. Orden de columnas: 0 id de invitación · 1 clienta id ·
     * 2 name · 3 lastname · 4 plan · 5 total_amount · 6 is_paid · 7 created_at.
     *
     * `fecha` es `invitation.created_at`, **no** la fecha del cobro: no existe.
     * `12-producto-completo.md §A5.2` lo dice con todas las letras — «no hay importe cobrado, ni
     * moneda, ni fecha de cobro, ni referencia externa; `is_paid` es un booleano y ahí acaba el modelo
     * de pago». Cuando E4 entregue `product_payment`, su implementación de
     * [FuenteDePagosDeAdministracion] devolverá la fecha de verdad sin que cambie el contrato.
     */
    fun pagos(
        alcance: AlcanceDeAdministracion,
        pago: Int,
        tamano: Int,
        desplazamiento: Int,
    ): List<Tuple> {
        val sql = """
            SELECT i.id, c.id, c.name, c.lastname, p.name,
                   coalesce(i.total_amount, 0), coalesce(i.is_paid, false), i.created_at
              FROM invitation i
              JOIN customer c ON c.id = i.customer_id
              LEFT JOIN invitation_template t ON t.id = i.template_id
              LEFT JOIN invitation_plan p ON p.id = t.invitation_plan_id
             WHERE $filtroDePago
             ORDER BY i.created_at DESC, i.id DESC
             LIMIT :tamano OFFSET :desplazamiento
        """.trimIndent()
        return consulta(sql, alcance)
            .setParameter("pago", pago)
            .setParameter("tamano", tamano)
            .setParameter("desplazamiento", desplazamiento)
            .filas()
    }

    // ------------------------------------------------------------------ §6 planes

    /**
     * Contrato §6. Orden de columnas: 0 id · 1 name · 2 nº de invitaciones **en el alcance de quien pide**.
     *
     * El alcance va dentro de la subconsulta correlacionada, no en la exterior: el catálogo de planes
     * es del sistema y se ve entero (son dos filas sembradas, `V1__initial_schema.sql:1091-1094`), pero
     * el recuento de cada uno es solo de lo que ese administrador puede ver. Con el alcance fuera, un
     * ADMIN vería el catálogo vacío en cuanto no tuviera invitaciones.
     *
     * No se filtra por `invitation_plan.is_enabled`: es una consola de administración y un plan
     * retirado con invitaciones vivas tiene que seguir viéndose para poder explicarlas.
     */
    fun planes(alcance: AlcanceDeAdministracion): List<PlanDeAdministracion> {
        val sql = """
            SELECT pl.id, pl.name,
                   (SELECT count(*) FROM invitation i
                      JOIN invitation_template t ON t.id = i.template_id
                      JOIN customer c ON c.id = i.customer_id
                     WHERE t.invitation_plan_id = pl.id AND $PREDICADO)
              FROM invitation_plan pl
             ORDER BY pl.id ASC
        """.trimIndent()
        return consulta(sql, alcance).filas().map {
            PlanDeAdministracion(id = it.entero(0), nombre = it.texto(1).orEmpty(), invitaciones = it.entero(2))
        }
    }

    // ------------------------------------------------------------------ §7 plantillas

    /**
     * Contrato §7. Orden de columnas: 0 slug · 1 version · 2 status · 3 event_kinds (texto JSON) ·
     * 4 published_at · 5 nº de invitaciones que usan esa versión, en el alcance de quien pide.
     *
     * Una fila **por versión**, ordenadas por `slug` ascendente y luego por semver descendente, con las
     * tres columnas enteras que `V30__create_tpl_template_version.sql` ya indexa para esto
     * (`ix_tpl_template_version_latest`, `V30:34-35`) — no por la cadena `version`, que ordenaría
     * `1.10.0` antes que `1.9.0`.
     *
     * `event_kinds` es **JSONB** y no `TEXT[]` (ADR-1R-B-09, `TplTemplateVersionEntity.kt:75-78`): se
     * pide con `CAST(... AS text)` —y no con el operador `::`, que Hibernate confundiría con el prefijo
     * de un parámetro con nombre— y se convierte a lista aquí.
     *
     * El recuento sale de `tpl_document.template_version_id` (`TplDocumentEntity.kt:40-41`,
     * `V32:8`), que es la fila que dice qué versión usa cada invitación.
     *
     * **Sin cifras codificadas**: la consulta devuelve las versiones que haya —dos con la siembra base,
     * quince tras el merge de la fase 4— y `total` es el tamaño de la lista.
     */
    fun plantillas(alcance: AlcanceDeAdministracion): List<PlantillaDeAdministracion> {
        val sql = """
            SELECT tt.slug, v.version, v.status, CAST(v.event_kinds AS text), v.published_at,
                   (SELECT count(*) FROM tpl_document d
                      JOIN invitation i ON i.id = d.invitation_id
                      JOIN customer c ON c.id = i.customer_id
                     WHERE d.template_version_id = v.id AND $PREDICADO)
              FROM tpl_template_version v
              JOIN tpl_template tt ON tt.id = v.template_id
             ORDER BY tt.slug ASC, v.version_major DESC, v.version_minor DESC, v.version_patch DESC
        """.trimIndent()
        return consulta(sql, alcance).filas().map {
            PlantillaDeAdministracion(
                slug = it.texto(0).orEmpty(),
                version = it.texto(1).orEmpty(),
                estado = it.texto(2).orEmpty(),
                tiposDeEvento = tiposDeEvento(it.texto(3)),
                registradaEn = it.instante(4)?.toString(),
                invitaciones = it.entero(5),
            )
        }
    }

    private fun tiposDeEvento(bruto: String?): List<String> {
        if (bruto.isNullOrBlank()) return emptyList()
        return runCatching {
            json.readTree(bruto).takeIf { it.isArray }?.mapNotNull { it.asText().takeIf(String::isNotBlank) }.orEmpty()
        }.getOrDefault(emptyList())
    }

    // ------------------------------------------------------------------ plomería

    private fun consulta(sql: String, alcance: AlcanceDeAdministracion): Query =
        em.createNativeQuery(sql, Tuple::class.java)
            .setParameter("todo", alcance.todo)
            .setParameter("yo", alcance.yo)

    @Suppress("UNCHECKED_CAST")
    private fun Query.filas(): List<Tuple> = resultList as List<Tuple>

    private fun Tuple.entero(i: Int): Long = (get(i) as Number).toLong()

    private fun Tuple.decimal(i: Int): Double = (get(i) as? Number)?.toDouble() ?: 0.0

    private fun Tuple.texto(i: Int): String? = get(i)?.toString()

    private fun Tuple.booleano(i: Int): Boolean = get(i) as? Boolean ?: false

    /**
     * `timestamptz` llega como `OffsetDateTime`, `Instant` o `java.sql.Timestamp` según el driver y la
     * versión de Hibernate. Se aceptan los tres y se normaliza a `Instant`, que es lo que se serializa.
     */
    private fun Tuple.instante(i: Int): Instant? = when (val v = get(i)) {
        null -> null
        is Instant -> v
        is OffsetDateTime -> v.toInstant()
        is Timestamp -> v.toInstant()
        is java.util.Date -> v.toInstant()
        else -> null
    }

    /** Expuesto para [PagosDesdeInvitaciones], que lee las mismas filas de [pagos]. */
    internal fun leerPago(t: Tuple, moneda: String): PagoDeAdministracion {
        val invitacionId = t.entero(0)
        val pagada = t.booleano(6)
        return PagoDeAdministracion(
            id = "inv-$invitacionId",
            invitacionId = invitacionId,
            clientaId = t.entero(1),
            clienta = listOfNotNull(t.texto(2), t.texto(3)).joinToString(" ").trim(),
            plan = t.texto(4),
            importe = t.decimal(5),
            moneda = moneda,
            estado = if (pagada) ParametrosDeAdministracion.PAGO_ESTADO_PAGADO
            else ParametrosDeAdministracion.PAGO_ESTADO_PENDIENTE,
            fecha = t.instante(7)?.toString(),
        )
    }
}
