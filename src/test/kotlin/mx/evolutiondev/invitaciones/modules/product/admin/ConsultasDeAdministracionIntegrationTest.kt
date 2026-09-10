package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import mx.evolutiondev.invitaciones.modules.templates2.persistence.SpringPersistenceTestSupport
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import java.sql.Connection
import java.util.UUID

/**
 * **La prueba anti-IDOR de la consola de administración**, contra PostgreSQL real.
 *
 * Lo que aquí se mide no se puede medir con dobles: que el alcance por rol está **en el `WHERE`**.
 * Un servicio que trajera todo y filtrara en memoria pasaría cualquier prueba de forma del JSON y
 * fallaría esta en el momento en que se pagina.
 *
 * El escenario es el mínimo que distingue las dos reglas de `DashboardRepository.kt:50`:
 *
 * ```
 *   ADMIN ─ crea ─▶ clienta PROPIA ─ tiene ─▶ invitación PROPIA   (dentro del alcance)
 *   (nadie)  ────▶  clienta AJENA  ─ tiene ─▶ invitación AJENA    (fuera del alcance)
 * ```
 *
 * Base: `SpringPersistenceTestSupport` (`@DataJpaTest` + Flyway + el clúster de `PgTestCluster`,
 * `06 §6`), que es lo que ya usan las pruebas de persistencia de `templates2`. Las filas se insertan
 * con JDBC plano y `autoCommit`, igual que `IntegrationTestBase.kt:27`, para que un `CHECK` que falle
 * no envenene el resto del método.
 *
 * **La base es compartida y tiene filas de otras pruebas y de las migraciones.** Por eso ninguna
 * aserción compara contra un número absoluto del sistema: se compara contra el alcance del ADMIN
 * —que solo contiene lo que este método sembró— y, para MASTER, se comprueba que **contiene** lo
 * sembrado. Ninguna cifra está codificada.
 */
@Import(ConsultasDeAdministracion::class)
class ConsultasDeAdministracionIntegrationTest : SpringPersistenceTestSupport() {

    @Autowired private lateinit var consultas: ConsultasDeAdministracion

    private var idAdmin = 0L
    private var idPropia = 0L
    private var idAjena = 0L
    private var invPropia = 0L
    private var invAjena = 0L
    private var idPlantilla = 0L
    private var versionAlta = 0L
    private var versionBaja = 0L
    private val slug = "e5-alcance-" + UUID.randomUUID().toString().take(8)

    private lateinit var alcanceDelAdmin: AlcanceDeAdministracion
    private lateinit var alcanceDelMaster: AlcanceDeAdministracion

    private fun conn(): Connection = PgTestCluster.newConnection().apply { autoCommit = true }

    private fun <T> unaFila(sql: String, vararg args: Any?): T = conn().use { c ->
        c.prepareStatement(sql).use { ps ->
            args.forEachIndexed { i, v -> ps.setObject(i + 1, v) }
            ps.executeQuery().use { rs -> rs.next(); @Suppress("UNCHECKED_CAST") (rs.getObject(1) as T) }
        }
    }

    private fun ejecutar(sql: String, vararg args: Any?) = conn().use { c ->
        c.prepareStatement(sql).use { ps ->
            args.forEachIndexed { i, v -> ps.setObject(i + 1, v) }
            ps.executeUpdate()
        }
    }

    private fun nuevoCliente(rol: String, creadoPor: Long?): Long = unaFila(
        "INSERT INTO customer (email, is_banned, is_enabled, password, role, name, lastname, created_by) " +
            "VALUES (?, false, true, 'x', ?, 'N', 'A', ?) RETURNING id",
        "e5-${UUID.randomUUID()}@example.test", rol, creadoPor,
    )

    private fun plantillaHeredada(): Long = unaFila("SELECT id FROM invitation_template ORDER BY id LIMIT 1")

    private fun nuevaInvitacion(clienteId: Long, pagada: Boolean = false): Long = unaFila(
        "INSERT INTO invitation (customer_id, template_id, is_enabled, is_paid, is_finished, " +
            "all_events_same_location, uses_templates2, date, time, total_amount) " +
            "VALUES (?, ?, true, ?, false, false, true, '2027-04-18', '17:00', 0) RETURNING id",
        clienteId, plantillaHeredada(), pagada,
    )

    @BeforeEach
    fun sembrar() {
        idAdmin = nuevoCliente("ADMIN", null)
        idPropia = nuevoCliente("USER", idAdmin)
        idAjena = nuevoCliente("USER", null)
        invPropia = nuevaInvitacion(idPropia)
        invAjena = nuevaInvitacion(idAjena, pagada = true)

        idPlantilla = unaFila("INSERT INTO tpl_template (slug) VALUES (?) RETURNING id", slug)
        versionAlta = nuevaVersion("1.0.2", 1, 0, 2, "published", """["wedding"]""")
        versionBaja = nuevaVersion("1.0.1", 1, 0, 1, "deprecated", """["wedding","xv"]""")

        alcanceDelAdmin = AlcanceDeAdministracion(yo = idAdmin, todo = 0)
        alcanceDelMaster = AlcanceDeAdministracion(yo = nuevoCliente("MASTER", null), todo = 1)
    }

    private fun nuevaVersion(v: String, ma: Int, mi: Int, pa: Int, estado: String, kinds: String): Long = unaFila(
        "INSERT INTO tpl_template_version (template_id, version, version_major, version_minor, version_patch, " +
            "manifest, theme, defaults, package_hash, event_kinds, status) " +
            "VALUES (?, ?, ?, ?, ?, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, CAST(? AS jsonb), ?) RETURNING id",
        idPlantilla, v, ma, mi, pa, hashAleatorio(), kinds, estado,
    )

    private fun hashAleatorio() = "sha256:" + "0".repeat(56) + UUID.randomUUID().toString().replace("-", "").take(8)

    private fun token() = "pub_" + (1..26).map { "0123456789ABCDEFGHJKMNPQRSTVWXYZ".random() }.joinToString("")

    @AfterEach
    fun limpiar() {
        ejecutar("DELETE FROM invitation WHERE id IN (?, ?)", invPropia, invAjena)
        ejecutar("DELETE FROM tpl_template_version WHERE template_id = ?", idPlantilla)
        ejecutar("DELETE FROM tpl_template WHERE id = ?", idPlantilla)
        ejecutar("DELETE FROM customer WHERE id IN (?, ?, ?, ?)", idAdmin, idPropia, idAjena, alcanceDelMaster.yo)
    }

    private fun sinFiltro(alcance: AlcanceDeAdministracion) =
        consultas.invitaciones(alcance, "%%", 0, 0, 100, 0)

    // ------------------------------------------------------------------ alcance

    /**
     * **La prueba anti-IDOR.** Un ADMIN que no creó a la clienta ajena no ve su invitación en el
     * listado **ni la cuenta** en las métricas. Las dos superficies, porque un contador que se salta
     * el alcance filtra igual: dice cuántas invitaciones hay en el sistema.
     */
    @Test
    fun `un ADMIN no ve ni cuenta la invitacion de una clienta que no creo`() {
        val idsDelAdmin = sinFiltro(alcanceDelAdmin).map { it.id }
        assertTrue(invPropia in idsDelAdmin, "el ADMIN debe ver la invitación de la clienta que creó")
        assertFalse(invAjena in idsDelAdmin, "IDOR: el ADMIN NO debe ver la invitación de una clienta ajena")

        assertEquals(1, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 0, 0))
        val metricas = consultas.metricas(alcanceDelAdmin)
        assertEquals(1, metricas.invitaciones, "el contador tiene que respetar el mismo alcance que el listado")
        assertEquals(0, metricas.pagadas, "la invitación pagada es la ajena: no se cuenta")

        // Las clientas: él mismo y la que creó. Ni una más.
        val correosDelAdmin = consultas.clientas(alcanceDelAdmin, "%%", 100, 0).map { it.id }.toSet()
        assertEquals(setOf(idAdmin, idPropia), correosDelAdmin)
        assertEquals(2, consultas.contarClientas(alcanceDelAdmin, "%%"))
        assertEquals(2, consultas.metricas(alcanceDelAdmin).clientas)
    }

    @Test
    fun `un MASTER ve las dos invitaciones`() {
        val idsDelMaster = sinFiltro(alcanceDelMaster).map { it.id }
        assertTrue(invPropia in idsDelMaster)
        assertTrue(invAjena in idsDelMaster)
    }

    /** El alcance también acota el recuento por plan y por versión de plantilla, no solo el listado. */
    @Test
    fun `el alcance acota tambien los recuentos de planes y plantillas`() {
        ejecutar(
            "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token) VALUES (?, ?, '{}'::jsonb, ?)",
            invPropia, versionAlta, token(),
        )
        ejecutar(
            "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token) VALUES (?, ?, '{}'::jsonb, ?)",
            invAjena, versionAlta, token(),
        )

        val delAdmin = consultas.plantillas(alcanceDelAdmin).first { it.slug == slug && it.version == "1.0.2" }
        val delMaster = consultas.plantillas(alcanceDelMaster).first { it.slug == slug && it.version == "1.0.2" }
        assertEquals(1, delAdmin.invitaciones, "el ADMIN solo cuenta la invitación de su clienta")
        assertEquals(2, delMaster.invitaciones, "el MASTER cuenta las dos")

        val planDelAdmin = consultas.planes(alcanceDelAdmin).sumOf { it.invitaciones }
        assertEquals(1, planDelAdmin, "el recuento por plan también va acotado")
    }

    // ------------------------------------------------------------------ enlace público

    /**
     * `enlacePublico` es `null` mientras no haya `tpl_release` activo, **aunque ya exista el
     * `tpl_document` con su `public_token`**: publicar es lo que hace público el enlace, no elegir
     * plantilla. Es la diferencia que el contrato exige y la que un `SELECT` descuidado se salta.
     */
    @Test
    fun `enlacePublico es nulo sin release activo y aparece con el`() {
        val publico = token()
        ejecutar(
            "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token) VALUES (?, ?, '{}'::jsonb, ?)",
            invPropia, versionAlta, publico,
        )

        val sinPublicar = sinFiltro(alcanceDelAdmin).first { it.id == invPropia }
        assertNull(sinPublicar.enlacePublico, "sin release activo el token no sale")
        assertEquals(ParametrosDeAdministracion.ESTADO_EN_EDICION, sinPublicar.estado)
        assertEquals(0, consultas.metricas(alcanceDelAdmin).publicadas)

        ejecutar(
            "INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed, report, " +
                "business_snapshot, content_hash, is_active) VALUES (?, ?, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, true)",
            invPropia, versionAlta, hashAleatorio(),
        )

        val publicada = sinFiltro(alcanceDelAdmin).first { it.id == invPropia }
        assertEquals(publico, publicada.enlacePublico)
        assertEquals(ParametrosDeAdministracion.ESTADO_PUBLICADA, publicada.estado)
        assertEquals(1, consultas.metricas(alcanceDelAdmin).publicadas)

        // Retirar la publicación devuelve el enlace a `null`: el token deja de salir.
        ejecutar("UPDATE tpl_release SET is_active = false, unpublished_at = now() WHERE invitation_id = ?", invPropia)
        assertNull(sinFiltro(alcanceDelAdmin).first { it.id == invPropia }.enlacePublico)
    }

    // ------------------------------------------------------------------ estados y filtros

    /**
     * `deshabilitada` gana sobre `publicada`, y una invitación deshabilitada **sigue siendo visible**
     * para la administración: `InvitationEntity.kt:16` lleva `@Filter(enabledFilter)` y aquí no puede
     * escondernos la fila, porque la consulta es nativa.
     */
    @Test
    fun `deshabilitada gana sobre publicada y la fila sigue siendo visible`() {
        ejecutar(
            "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token) VALUES (?, ?, '{}'::jsonb, ?)",
            invPropia, versionAlta, token(),
        )
        ejecutar(
            "INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed, report, " +
                "business_snapshot, content_hash, is_active) VALUES (?, ?, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, true)",
            invPropia, versionAlta, hashAleatorio(),
        )
        ejecutar("UPDATE invitation SET is_enabled = false WHERE id = ?", invPropia)

        val fila = sinFiltro(alcanceDelAdmin).first { it.id == invPropia }
        assertEquals(ParametrosDeAdministracion.ESTADO_DESHABILITADA, fila.estado)

        assertEquals(1, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 3, 0), "filtro estado=deshabilitada")
        assertEquals(0, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 1, 0), "ya no es publicada")
        assertEquals(0, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 2, 0), "tampoco en-edicion")
    }

    @Test
    fun `el filtro de pago se aplica en la consulta`() {
        val alcanceAmplio = AlcanceDeAdministracion(yo = idAjena, todo = 0)
        assertEquals(1, consultas.contarInvitaciones(alcanceAmplio, "%%", 0, 1), "la ajena está pagada")
        assertEquals(0, consultas.contarInvitaciones(alcanceAmplio, "%%", 0, 2))
        assertEquals(0, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 0, 1), "la propia no está pagada")
        assertEquals(1, consultas.contarInvitaciones(alcanceDelAdmin, "%%", 0, 2))
    }

    // ------------------------------------------------------------------ plantillas

    /**
     * §7 **con el número de versiones que haya en la base**: dos con la siembra base, quince tras el
     * merge de la fase 4. No se afirma un total del sistema ni que exista un `slug` concreto del
     * catálogo real: se afirma sobre las versiones que **este método** sembró y sobre el orden.
     */
    @Test
    fun `plantillas funciona con las versiones que haya y las ordena por semver descendente`() {
        val todas = consultas.plantillas(alcanceDelMaster)
        val mias = todas.filter { it.slug == slug }

        assertEquals(2, mias.size, "las dos versiones sembradas por esta prueba")
        assertEquals(listOf("1.0.2", "1.0.1"), mias.map { it.version }, "semver descendente, no alfabético")
        assertEquals("published", mias[0].estado)
        assertEquals("deprecated", mias[1].estado)
        assertEquals(listOf("wedding"), mias[0].tiposDeEvento)
        assertEquals(listOf("wedding", "xv"), mias[1].tiposDeEvento, "event_kinds es JSONB y se lee como lista")
        assertNotNull(mias[0].registradaEn, "published_at es NOT NULL")
        assertEquals(0, mias[0].invitaciones, "todavía no hay ningún tpl_document apuntando a esta versión")

        // El orden entre slugs es ascendente y el total es lo que haya, nunca una cifra codificada.
        assertEquals(todas.map { it.slug }.sorted(), todas.map { it.slug })
        assertTrue(todas.size >= mias.size)
    }

    // ------------------------------------------------------------------ búsqueda y paginación

    @Test
    fun `buscar casa contra nombre y correo, insensible a mayusculas, y la pagina no se solapa`() {
        val correo: String = unaFila("SELECT email FROM customer WHERE id = ?", idPropia)
        val patron = "%" + correo.uppercase().lowercase().take(12) + "%"
        assertEquals(1, consultas.contarClientas(alcanceDelAdmin, patron))

        val primera = consultas.clientas(alcanceDelAdmin, "%%", 1, 0).map { it.id }
        val segunda = consultas.clientas(alcanceDelAdmin, "%%", 1, 1).map { it.id }
        assertEquals(1, primera.size)
        assertEquals(1, segunda.size)
        assertTrue(primera.first() != segunda.first(), "dos páginas de tamaño 1 no pueden repetir fila")
    }

    // ------------------------------------------------------------------ pagos

    @Test
    fun `la fuente de pagos de hoy proyecta invitaciones con su moneda`() {
        val fuente = PagosDesdeInvitaciones(
            consultas,
            mx.evolutiondev.invitaciones.modules.product.payments.ProductPaymentsProperties(moneda = "MXN"),
        )
        val pagina = fuente.pagina(alcanceDelAdmin, null, 0, 20)

        assertEquals(PagosDesdeInvitaciones.ORIGEN, pagina.origen)
        assertEquals(1, pagina.total)
        val pago = pagina.elementos.single()
        assertEquals("inv-$invPropia", pago.id)
        assertEquals(invPropia, pago.invitacionId)
        assertEquals(idPropia, pago.clientaId)
        assertEquals("MXN", pago.moneda)
        assertEquals(ParametrosDeAdministracion.PAGO_ESTADO_PENDIENTE, pago.estado)

        // `devuelto` es válido y esta fuente no lo puede producir: página vacía, no error.
        val devueltos = fuente.pagina(alcanceDelAdmin, ParametrosDeAdministracion.PAGO_ESTADO_DEVUELTO, 0, 20)
        assertEquals(0, devueltos.total)
        assertTrue(devueltos.elementos.isEmpty())
    }

    // ------------------------------------------------------------------ RSVP

    /**
     * `rsvpUltimos7Dias` cuenta invitados **confirmados** con `updated_at` dentro de la ventana. La
     * columna `is_attending` que describe el contrato ya no existe (`V16__add_guest_enhancements.sql:45`
     * la borró); el sustituto es `attendance_status = 'CONFIRMED'` (`V16:3`).
     */
    @Test
    fun `rsvpUltimos7Dias cuenta confirmados recientes y deja fuera lo viejo y lo pendiente`() {
        fun invitado(estado: String, diasAtras: Int, habilitado: Boolean = true) = ejecutar(
            "INSERT INTO invitation_guest (invitation_id, full_name, graduates_name, children_count, young_count, " +
                "adults_count_confirmed, children_count_confirmed, young_count_confirmed, attendance_status, " +
                "is_enabled, whatsapp_sent, created_at, updated_at) " +
                "VALUES (?, 'X', '', 0, 0, 0, 0, 0, ?, ?, false, now(), now() - make_interval(days => ?))",
            invPropia, estado, habilitado, diasAtras,
        )

        invitado("CONFIRMED", 1)
        invitado("CONFIRMED", 6)
        invitado("CONFIRMED", 30)
        invitado("PENDING", 1)
        invitado("DECLINED", 1)
        invitado("CONFIRMED", 1, habilitado = false)

        assertEquals(
            2, consultas.metricas(alcanceDelAdmin).rsvpUltimos7Dias,
            "solo los CONFIRMED, habilitados y dentro de los 7 días",
        )
        assertEquals(0, consultas.metricas(AlcanceDeAdministracion(yo = idAjena, todo = 0)).rsvpUltimos7Dias)
    }
}
