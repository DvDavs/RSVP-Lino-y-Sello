package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.persistence.BusinessSnapshotReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.DocumentStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAvailabilityReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LegacyConfigProbe
import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import mx.evolutiondev.invitaciones.modules.templates2.persistence.PublicTokenGenerator
import mx.evolutiondev.invitaciones.modules.templates2.persistence.ReleaseStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.SnapshotRetention
import mx.evolutiondev.invitaciones.modules.templates2.persistence.SnapshotRetentionJob
import mx.evolutiondev.invitaciones.modules.templates2.persistence.SpringPersistenceTestSupport
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateVersionLoader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetEditorRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentEditorRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentSnapshotQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentSnapshotRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2FlagRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Cliente de revalidación falso (ADR-2-6-01): registra cada llamada y permite forzar el fallo o un
 * código de estado ajeno, que son los dos casos que **no pueden** tumbar la publicación.
 */
class ClienteRevalidacionFalso : RevalidationClient {

    data class Llamada(val url: String, val token: String, val cuerpo: String)

    val llamadas = java.util.Collections.synchronizedList(mutableListOf<Llamada>())

    @Volatile var falla: Boolean = false

    @Volatile var estado: Int = 200

    override fun post(url: String, token: String, cuerpo: String, timeout: java.time.Duration): Int {
        llamadas.add(Llamada(url, token, cuerpo))
        if (falla) throw IllegalStateException("frontend caído (simulado)")
        return estado
    }

    fun limpiar() {
        llamadas.clear()
        falla = false
        estado = 200
    }
}

/** Sonda de `invitation_configs` controlable por prueba (ADR-2-4-02). `null` = "no lo sé". */
class SondaFalsa : LegacyConfigProbe {
    @Volatile
    var respuesta: Boolean? = null

    override fun hasLegacyConfig(invitationId: Long): Boolean? = respuesta
}

/**
 * Beans del editor para el *slice* `@DataJpaTest`. Se construyen a mano, igual que en
 * `RegistroTestSupport` (2-3), para no depender de la resolución de `@Value` dentro del slice.
 *
 * `HierarchyValidationService` es un **mock**: su implementación real (`core/auth`) arrastraría
 * `CustomerRepository` e `InvitationRepository` del módulo antiguo y con ellos `InvitationGuestEntity`,
 * que mapea `graduates_name`, una columna que **ninguna migración crea** — el defecto ajeno y
 * preexistente que documenta `handoffs/2-1.md` (ADR-2-ORQ-02). La autorización real se prueba
 * aparte, en las pruebas de controlador, que sí verifican que el servicio la consulta.
 */
@TestConfiguration
class EditorTestConfig {

    @Bean
    fun hierarchyValidationService(): HierarchyValidationService = mock<HierarchyValidationService>().also {
        whenever(it.validateInvitationAccess(any(), any())).thenReturn(true)
    }

    /** Un solo bean para las dos vistas: la prueba lo inyecta como [SondaFalsa] para manipularlo y el
     *  servicio como [LegacyConfigProbe]. Dos beans distintos harían ambigua la inyección por tipo. */
    @Bean
    fun sondaFalsa(): SondaFalsa = SondaFalsa()

    @Bean
    fun jsonSchemaRegistry() = JsonSchemaRegistry()

    @Bean
    fun jsonSchemaValidatorService(registro: JsonSchemaRegistry) = JsonSchemaValidatorService(registro)

    @Bean
    fun publicTokenGenerator() = PublicTokenGenerator()

    @Bean
    fun ulidGenerator() = UlidGenerator()

    @Bean
    fun documentStore(
        documentos: TplDocumentRepository,
        editor: TplDocumentEditorRepository,
        snapshots: TplDocumentSnapshotRepository,
        consultas: TplDocumentSnapshotQueryRepository,
        tokens: PublicTokenGenerator,
    ) = DocumentStore(documentos, editor, snapshots, consultas, tokens)

    @Bean
    fun releaseStore(documentos: TplDocumentRepository, releases: TplReleaseRepository) =
        ReleaseStore(documentos, releases)

    @Bean
    fun templateVersionLoader(versiones: TplTemplateVersionRepository, plantillas: TplTemplateRepository) =
        TemplateVersionLoader(versiones, plantillas)

    @Bean
    @Suppress("LongParameterList")
    fun editorDocumentService(
        hierarchy: HierarchyValidationService,
        store: DocumentStore,
        versiones: TemplateVersionLoader,
        negocio: BusinessSnapshotReader,
        assets: TplAssetEditorRepository,
        releases: TplReleaseRepository,
        flags: Templates2FlagRepository,
        sonda: SondaFalsa,
        esquemas: JsonSchemaValidatorService,
        ulids: UlidGenerator,
    ) = EditorDocumentService(
        hierarchy, store, versiones, negocio, assets, releases, flags, sonda, esquemas, ulids,
        BASE_URL, "bucket-de-pruebas", "us-east-2", FRONTEND,
    )

    @Bean
    fun releaseService(
        editor: EditorDocumentService,
        releases: ReleaseStore,
        disponibilidad: InvitationAvailabilityReader,
        versiones: TemplateVersionLoader,
        eventos: ApplicationEventPublisher,
    ) = ReleaseService(editor, releases, disponibilidad, versiones, eventos)

    /**
     * Cliente de revalidación **falso**, con memoria (ADR-2-6-01, objeción ADV-02). Igual que
     * `SondaFalsa` y `S3Falso`: **un solo bean para las dos vistas**, para que la prueba lo manipule
     * como [ClienteRevalidacionFalso] y el notificador lo reciba como `RevalidationClient`.
     */
    @Bean
    fun clienteRevalidacionFalso() = ClienteRevalidacionFalso()

    /**
     * El notificador real, con URL y token de prueba: lo que se sustituye es la red, no la lógica.
     * Sin este bean el `@TransactionalEventListener` no existiría en el contexto del slice y las
     * pruebas de "se llama tras publicar" no probarían nada.
     */
    @Bean
    fun revalidationNotifier(cliente: ClienteRevalidacionFalso) =
        RevalidationNotifier(cliente, REVALIDATE_URL, REVALIDATE_TOKEN, 1000L)

    @Bean
    fun snapshotRetention(consultas: TplDocumentSnapshotQueryRepository) = SnapshotRetention(consultas)

    @Bean
    fun snapshotRetentionJob(retencion: SnapshotRetention) = SnapshotRetentionJob(retencion)

    companion object {
        const val BASE_URL = "https://cdn.pruebas.local"
        const val FRONTEND = "https://app.pruebas.local"
        const val REVALIDATE_URL = "https://app.pruebas.local/api/revalidate"
        const val REVALIDATE_TOKEN = "token-de-pruebas"
    }
}

/**
 * Base de las pruebas del ciclo de vida del documento contra **PostgreSQL real** (`06 §6`, ADR-025 +
 * ADR-1R-C-10; Docker no está disponible y H2/Testcontainers están descartados).
 *
 * `@Transactional(NOT_SUPPORTED)` es imprescindible, por las tres mismas razones que en 2-3 y una
 * cuarta propia de este bloque: sin él nada se commitea, y entonces (1) el reintento de un lote no
 * podría chocar con `ux_tpl_document_snapshot_batch`, (2) el `FOR UPDATE` de la publicación no
 * serializaría nada porque no habría dos transacciones, (3) el segundo hilo de las pruebas de
 * concurrencia no vería lo que hace el primero y (4) la escritura optimista `WHERE revision = ?` se
 * evaluaría siempre sobre la misma imagen. A cambio hay que limpiar a mano: [limpiarInvitacion].
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import(EditorTestConfig::class, InvitationAvailabilityReader::class)
@DirtiesContext
abstract class EditorTestSupport : SpringPersistenceTestSupport() {

    // ---------------------------------------------------------------------------------------------
    // Paquete de plantilla de las pruebas
    // ---------------------------------------------------------------------------------------------

    /**
     * Manifiesto mínimo pero completo: una sección obligatoria con un bloque **obligatorio con
     * valor por defecto** (el que dispara `stillDefault` y, con él, el bloqueo de publicación de
     * `03 §6` que mata H-03), un bloque opcional y un grupo con dos `itemBlocks`.
     */
    protected fun paqueteBase(
        slug: String,
        version: String = "1.0.0",
        tituloMaxLength: Int = 200,
    ): TemplatePackage {
        val manifiesto = Fx.manifiesto(
            listOf(
                Fx.seccion(
                    "cover", SectionType.COVER,
                    listOf(
                        Fx.texto("cover.title", BlockRole.COVER_TITLE, required = true, maxLength = tituloMaxLength),
                        Fx.texto("cover.subtitle", BlockRole.COVER_SUBTITLE),
                        Fx.imagen("cover.photo", BlockRole.COVER_IMAGE),
                        // `source = business`: el valor lo pone Postgres y **no** es editable (I-21).
                        Fx.fecha(
                            "cover.date", BlockRole.COVER_DATE,
                            source = BlockSource.BUSINESS, businessField = BusinessField.INVITATION_DATE,
                        ),
                    ),
                    required = true,
                ),
                Fx.seccion(
                    "gallery", SectionType.GALLERY,
                    listOf(
                        Fx.grupo(
                            "gallery.photos", BlockRole.GALLERY_PHOTOS,
                            itemBlocks = listOf(Fx.texto("caption", BlockRole.GALLERY_INTRO)),
                            min = 0, max = 4,
                        ),
                    ),
                ),
            ),
            slug = slug, version = version,
        )
        return TemplatePackage(
            manifest = manifiesto,
            theme = Fx.tema(paletas = listOf("olive", "blush"), fuentes = listOf("clasica", "moderna")),
            // `cover.title` es obligatorio y arranca con el texto de demostración de la plantilla:
            // eso es exactamente lo que el preflight tiene que impedir publicar (H-03).
            defaults = Fx.defaults(manifiesto, mapOf("cover.title" to TextValue(TEXTO_DEMO))),
        )
    }

    /**
     * Variante con un `richText` de tope altísimo, para poder rebasar el 1 MiB de `tpl_document` con
     * un lote **individualmente válido** (caso 25 de `03 §12`). No sirve un `text`: el JSON Schema lo
     * corta en 2 000 caracteres, mientras que un `RichDoc` admite 40 párrafos × 50 tramos × 2 000
     * caracteres — que es justo el motivo por el que `02 §2` V32 exige el tope de documento como
     * defensa en profundidad.
     */
    protected fun paqueteEnorme(slug: String): TemplatePackage {
        val relato = RichTextSpec(
            Fx.base("cover.story", BlockRole.STORY_BODY),
            RichTextConstraints(maxLength = 4_000_000),
        )
        val manifiesto = Fx.manifiesto(
            listOf(Fx.seccion("cover", SectionType.COVER, listOf(relato), required = true)),
            slug = slug,
        )
        return TemplatePackage(manifiesto, Fx.tema(), Fx.defaults(manifiesto))
    }

    // ---------------------------------------------------------------------------------------------
    // Fixtures JDBC (autoCommit: cada sentencia es su propia transacción)
    // ---------------------------------------------------------------------------------------------

    protected fun nuevoCliente(): Long = ejecutar(
        "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (?, false, true, 'x', 'USER') RETURNING id",
        "t2-4-${UUID.randomUUID()}@example.test",
    )

    protected fun nuevaInvitacion(customerId: Long, usaTemplates2: Boolean = true): Long = ejecutar(
        "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location, uses_templates2) " +
            "VALUES (?, ?, true, false, false, ?) RETURNING id",
        customerId, plantillaLegacy(), usaTemplates2,
    )

    protected fun registrarVersion(
        pkg: TemplatePackage,
        status: String = "published",
        minPlanTier: Int = 1,
        planes: JsonNode? = null,
    ): Long {
        val slug = pkg.slug.value
        val plantillaId = PgTestCluster.newConnection().use { c ->
            c.autoCommit = true
            c.prepareStatement("INSERT INTO tpl_template (slug) VALUES (?) ON CONFLICT (slug) DO NOTHING")
                .use { it.setString(1, slug); it.executeUpdate() }
            c.prepareStatement("SELECT id FROM tpl_template WHERE slug = ?").use { ps ->
                ps.setString(1, slug)
                ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
            }
        }
        val v = pkg.version
        return ejecutar(
            """
            INSERT INTO tpl_template_version
                (template_id, version, version_major, version_minor, version_patch, manifest, theme, defaults,
                 migration_plans, package_hash, status, min_plan_tier, event_kinds)
            VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), CAST(? AS jsonb), CAST(? AS jsonb), ?, ?, ?, CAST(? AS jsonb))
            RETURNING id
            """.trimIndent(),
            plantillaId, v.toString(), v.major, v.minor, v.patch,
            Templates2Json.canonical(DomainJson.encode(pkg.manifest)),
            Templates2Json.canonical(DomainJson.encode(pkg.theme)),
            Templates2Json.canonical(DomainJson.encode(pkg.defaults)),
            Templates2Json.canonical(planes ?: Templates2Json.mapper.createObjectNode()),
            hashDePrueba(), status, minPlanTier, "[\"generic\"]",
        )
    }

    /** Cuerpo JSON de una petición, ya como `JsonNode` (es lo que reciben los servicios). */
    protected fun json(texto: String): JsonNode = Templates2Json.readTree(texto)

    protected fun contenidoDelDocumento(invitationId: Long): Map<String, BlockValue> {
        val doc = consultar("SELECT doc::text FROM tpl_document WHERE invitation_id = ?", invitationId)
        return DomainJson.document(Templates2Json.readTree(doc as String)).content.mapKeys { it.key.value }
    }

    protected fun revisionDe(invitationId: Long): Long =
        (consultar("SELECT revision FROM tpl_document WHERE invitation_id = ?", invitationId) as Number).toLong()

    protected fun contar(sql: String, vararg params: Any?): Long =
        (consultar(sql, *params) as? Number)?.toLong() ?: 0L

    protected fun consultar(sql: String, vararg params: Any?): Any? = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement(sql).use { ps ->
            params.forEachIndexed { i, p -> ps.setObject(i + 1, p) }
            ps.executeQuery().use { rs -> if (rs.next()) rs.getObject(1) else null }
        }
    }

    protected fun actualizar(sql: String, vararg params: Any?): Int = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement(sql).use { ps ->
            params.forEachIndexed { i, p -> ps.setObject(i + 1, p) }
            ps.executeUpdate()
        }
    }

    /** `ON DELETE CASCADE` desde `invitation` se lleva documento, snapshots, releases y assets. */
    protected fun limpiarInvitacion(invitationId: Long) {
        actualizar("DELETE FROM invitation WHERE id = ?", invitationId)
    }

    protected fun limpiarCliente(customerId: Long) {
        actualizar("DELETE FROM customer WHERE id = ?", customerId)
    }

    protected fun limpiarPlantilla(slug: String) {
        actualizar(
            "DELETE FROM tpl_asset WHERE template_version_id IN (SELECT v.id FROM tpl_template_version v " +
                "JOIN tpl_template t ON t.id = v.template_id WHERE t.slug = ?)",
            slug,
        )
        actualizar(
            "DELETE FROM tpl_template_version WHERE template_id IN (SELECT id FROM tpl_template WHERE slug = ?)",
            slug,
        )
        actualizar("DELETE FROM tpl_template WHERE slug = ?", slug)
    }

    private fun ejecutar(sql: String, vararg params: Any?): Long = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement(sql).use { ps ->
            params.forEachIndexed { i, p -> ps.setObject(i + 1, p) }
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    /** `invitation.template_id` es `NOT NULL` hacia el catálogo **antiguo**, que no toca este módulo. */
    private fun plantillaLegacy(): Long =
        (consultar("SELECT id FROM invitation_template ORDER BY id LIMIT 1") as Number).toLong()

    private fun hashDePrueba(): String =
        "sha256:" + UUID.randomUUID().toString().replace("-", "").repeat(2).take(64)

    companion object {
        /** El texto de demostración que trae `defaults.json`; publicarlo como real sería H-03. */
        const val TEXTO_DEMO = "Nombre de la pareja"
    }
}
