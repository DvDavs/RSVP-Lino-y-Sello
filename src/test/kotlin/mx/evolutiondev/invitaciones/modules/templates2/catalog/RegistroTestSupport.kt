package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import mx.evolutiondev.invitaciones.modules.templates2.persistence.SpringPersistenceTestSupport
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrationAuditor
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2AssetBucket

/**
 * Almacén de assets falso: sustituye a S3, que no participa de la transacción (`02 §10`). Permite
 * forzar el fallo de la *n*-ésima subida para comprobar el caso "S3 cae a mitad" de `02 §10.5`.
 */
class AlmacenFalso : TemplateAssetStorage {

    val subidos = ConcurrentHashMap<String, ByteArray>()

    @Volatile
    var fallarEnLaSubida: Int? = null

    @Volatile
    var llamadas: Int = 0

    override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) {
        val n = synchronized(this) { ++llamadas }
        if (n == fallarEnLaSubida) throw AssetStorageUnavailableException("S3 simulado: caída en la subida $n")
        subidos[key] = bytes
    }

    fun reiniciar() {
        subidos.clear()
        llamadas = 0
        fallarEnLaSubida = null
    }
}

/**
 * Beans del registro para el *slice* `@DataJpaTest`. Se construyen a mano en vez de importar las
 * clases anotadas para no depender de la resolución de `@Value` dentro del slice: en producción esos
 * valores salen de `templates2.assets.*` y aquí se pasan explícitos.
 */
@TestConfiguration
class RegistroTestConfig {

    @Bean
    fun jsonSchemaRegistry() = JsonSchemaRegistry()

    @Bean
    fun jsonSchemaValidatorService(registry: JsonSchemaRegistry) = JsonSchemaValidatorService(registry)

    @Bean
    fun templatePackageParser(validator: JsonSchemaValidatorService) = TemplatePackageParser(validator)

    @Bean
    fun templates2S3KeyService() = Templates2S3KeyService()

    @Bean
    fun ulidGenerator() = UlidGenerator()

    @Bean
    fun almacenFalso() = AlmacenFalso()

    @Bean
    fun templateRegistrationAuditor(repo: mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationRepository) =
        TemplateRegistrationAuditor(repo)

    @Bean
    fun templateRegistrar(
        templates: TplTemplateRepository,
        versions: TplTemplateVersionRepository,
        assets: TplAssetRepository,
        auditor: TemplateRegistrationAuditor,
    ) = TemplateRegistrar(templates, versions, assets, auditor)

    @Bean
    fun templateRegistrationService(
        parser: TemplatePackageParser,
        almacen: AlmacenFalso,
        keys: Templates2S3KeyService,
        ulid: UlidGenerator,
        registrar: TemplateRegistrar,
        auditor: TemplateRegistrationAuditor,
    ) = TemplateRegistrationService(parser, almacen, keys, ulid, registrar, auditor, BUCKET_BEAN)

    @Bean
    fun templateCatalogService(
        templates: TplTemplateRepository,
        versions: TplTemplateVersionRepository,
        consultas: TplTemplateVersionQueryRepository,
        registrations: TplTemplateRegistrationQueryRepository,
        assets: TplAssetRepository,
    ) = TemplateCatalogService(templates, versions, consultas, registrations, assets, BASE_URL, BUCKET_BEAN, "us-east-2")

    companion object {
        const val BUCKET = "bucket-de-pruebas"

        /** El bucket ya no es un `String` suelto: lo resuelve [Templates2AssetBucket] (ADR-2-ORQ-03). */
        val BUCKET_BEAN = Templates2AssetBucket(BUCKET, false)
        const val BASE_URL = "https://cdn.pruebas.local"
    }
}

/**
 * Base de las pruebas de registro contra **PostgreSQL real** (`06 §6`, ADR-025 + ADR-1R-C-10; Docker
 * no está disponible y H2/Testcontainers están descartados).
 *
 * `@Transactional(NOT_SUPPORTED)` es imprescindible y no es cosmético: `@DataJpaTest` envuelve cada
 * prueba en una transacción que revierte al final, y con ella (1) el `REQUIRES_NEW` del auditor
 * competiría con los bloqueos de la prueba, (2) nada se **commitearía**, así que "la fila de auditoría
 * sobrevive al rollback" sería imposible de observar, y (3) el segundo hilo de la prueba de
 * concurrencia no vería nada de lo que hace el primero. A cambio hay que limpiar a mano: lo hace
 * [limpiarCatalogo].
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Import(RegistroTestConfig::class)
@DirtiesContext
abstract class RegistroTestSupport : SpringPersistenceTestSupport() {

    /** Borra todo rastro de un slug: assets → versiones → auditoría → plantilla (orden de las FK). */
    protected fun limpiarCatalogo(vararg slugs: String) {
        PgTestCluster.newConnection().use { c ->
            c.autoCommit = true
            for (slug in slugs) {
                c.prepareStatement(
                    """
                    DELETE FROM tpl_asset WHERE template_version_id IN (
                        SELECT v.id FROM tpl_template_version v JOIN tpl_template t ON t.id = v.template_id
                        WHERE t.slug = ?)
                    """.trimIndent(),
                ).use { it.setString(1, slug); it.executeUpdate() }
                c.prepareStatement("DELETE FROM tpl_template_registration WHERE template_slug = ?")
                    .use { it.setString(1, slug); it.executeUpdate() }
                c.prepareStatement(
                    "DELETE FROM tpl_template_version WHERE template_id IN (SELECT id FROM tpl_template WHERE slug = ?)",
                ).use { it.setString(1, slug); it.executeUpdate() }
                c.prepareStatement("DELETE FROM tpl_template WHERE slug = ?")
                    .use { it.setString(1, slug); it.executeUpdate() }
            }
        }
    }

    protected fun contar(sql: String, vararg params: Any?): Long = PgTestCluster.newConnection().use { c ->
        c.prepareStatement(sql).use { ps ->
            params.forEachIndexed { i, p -> ps.setObject(i + 1, p) }
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    /** `customer` real para `published_by`/`requested_by` (FK de `02 §2` V30/V35). */
    protected fun nuevoCliente(): Long = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (?, false, true, 'x', 'MASTER') RETURNING id",
        ).use { ps ->
            ps.setString(1, "t2-3-${UUID.randomUUID()}@example.test")
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    protected fun borrarCliente(id: Long) = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement("DELETE FROM customer WHERE id = ?").use { it.setLong(1, id); it.executeUpdate() }
        Unit
    }
}
