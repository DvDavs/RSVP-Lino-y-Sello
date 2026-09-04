package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.modules.templates2.composition.AssetUrlResolver
import mx.evolutiondev.invitaciones.modules.templates2.domain.Capability
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionRepository
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Base64

/** Una plantilla publicada tal como la ve el cliente (`03 §3.1`). */
data class CatalogEntry(
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val name: LocalizedText,
    val eventKinds: List<EventKind>,
    val minPlanTier: Int,
    val previewUrl: String?,
    val capabilities: List<Capability>,
    val status: String,
)

/** Una versión registrada tal como la ve MASTER (`03 §3.18`). */
data class VersionEntry(
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val status: String,
    val packageHash: String,
    val publishedAt: Instant?,
    val documentsUsing: Long,
)

/** Una fila de auditoría de `tpl_template_registration` (`03 §3.18`, `recentRegistrations`). */
data class RegistrationEntry(
    val slug: String,
    val version: String,
    val result: String,
    val errorCode: String?,
    val createdAt: Instant?,
)

data class Pagina<T>(val items: List<T>, val nextCursor: String?)

/**
 * Lecturas del catálogo (`03 §3.1`) y de la administración de versiones (`03 §3.18`, `§3.19`).
 *
 * **Una entrada por plantilla, la versión publicada más alta.** `searchCatalog` devuelve todas las
 * versiones `published`; ofrecer tres versiones de la misma plantilla en el selector no es un catálogo,
 * es ruido, y `:choose-template` sobre una versión vieja no aporta nada al cliente. El colapso se hace
 * aquí y **se anuncia** (ADR-2-3-04): las versiones antiguas siguen visibles en `GET
 * /master/templates2/versions`, que no colapsa nada.
 *
 * **Paginación por cursor de desplazamiento** (`"o:<offset>"` en base64url): el catálogo es de decenas
 * de plantillas (supuesto ya registrado en `preguntas-abiertas.md` por 1-persistencia), no de miles.
 */
@Service
class TemplateCatalogService(
    private val templates: TplTemplateRepository,
    private val versions: TplTemplateVersionRepository,
    private val consultas: TplTemplateVersionQueryRepository,
    private val registrations: TplTemplateRegistrationQueryRepository,
    private val assets: TplAssetRepository,
    @Value("\${templates2.assets.public-base-url:}") baseUrlConfigurada: String,
    @Value("\${templates2.assets.bucket:}") bucketConfigurado: String,
    @Value("\${aws.region:us-east-2}") region: String,
) {

    private val log = LoggerFactory.getLogger(TemplateCatalogService::class.java)

    private val bucket: String = bucketConfigurado.ifBlank { S3Buckets.ASSETS }

    /** `02 §10.4`: por patrón, sin llamar a S3, para que el catálogo no dependa de su disponibilidad. */
    val publicBaseUrl: String = baseUrlConfigurada.ifBlank { "https://$bucket.s3.$region.amazonaws.com" }

    @Transactional(readOnly = true)
    fun catalogo(eventKind: EventKind?, planTier: Int, limit: Int, cursor: String?): Pagina<CatalogEntry> {
        val filas = if (eventKind == null) {
            consultas.searchCatalogAll(planTier)
        } else {
            versions.searchCatalog(eventKind.wire, planTier)
        }
        // Las dos consultas vienen ordenadas por (template_id, versión DESC): la primera de cada
        // template_id es la más alta.
        val masAltaPorPlantilla = LinkedHashMap<Long, TplTemplateVersionEntity>()
        for (f in filas) masAltaPorPlantilla.putIfAbsent(f.templateId, f)

        val slugs = slugsDe(masAltaPorPlantilla.values.map { it.templateId })
        val todas = masAltaPorPlantilla.values
            .mapNotNull { fila -> aCatalogEntry(fila, slugs[fila.templateId] ?: DESCONOCIDO) }
            .sortedWith(compareBy({ it.slug }, { it.version }))
        return paginar(todas, limit, cursor)
    }

    @Transactional(readOnly = true)
    fun versiones(slug: String?, status: String?, limit: Int, cursor: String?): Pagina<VersionEntry> {
        val desplazamiento = descifrarCursor(cursor)
        val pagina = PageRequest.of(desplazamiento / limit, limit)
        val templateId = slug?.let { templates.findBySlug(it)?.id ?: return Pagina(emptyList(), null) }
        val filas = when {
            templateId != null && status != null ->
                consultas.findByTemplateIdAndStatusOrderByIdDesc(templateId, status, pagina)
            templateId != null -> consultas.findByTemplateIdOrderByIdDesc(templateId, pagina)
            status != null -> consultas.findByStatusOrderByIdDesc(status, pagina)
            else -> consultas.findAllByOrderByIdDesc(pagina)
        }
        val slugs = slugsDe(filas.map { it.templateId })
        val items = filas.map { f ->
            VersionEntry(
                templateVersionId = f.id,
                slug = slugs[f.templateId] ?: DESCONOCIDO,
                version = f.version,
                status = f.status,
                packageHash = f.packageHash,
                publishedAt = f.publishedAt,
                documentsUsing = consultas.countDocumentsUsing(f.id),
            )
        }
        val siguiente = if (filas.size < limit) null else cifrarCursor(desplazamiento + limit)
        return Pagina(items, siguiente)
    }

    @Transactional(readOnly = true)
    fun registrosRecientes(slug: String?, limit: Int): List<RegistrationEntry> {
        val pagina = PageRequest.of(0, limit)
        val filas = if (slug == null) {
            registrations.findAllByOrderByCreatedAtDescIdDesc(pagina)
        } else {
            registrations.findByTemplateSlugOrderByCreatedAtDescIdDesc(slug, pagina)
        }
        return filas.map(::aRegistrationEntry)
    }

    /**
     * `03 §3.19`. Idempotente: deprecar lo ya deprecado responde `200`. Rechaza con
     * `409 TPL_VERSION_LAST_PUBLISHED` si es la última publicada del slug **y** hay documentos usándola
     * — dejarlos sin ninguna versión publicada rompería `:choose-template` para ellos.
     */
    @Transactional
    fun deprecar(templateVersionId: Long): VersionEntry {
        val fila = consultas.findById(templateVersionId).orElse(null)
            ?: throw TemplateVersionNotFoundException(
                "no existe tpl_template_version.id = $templateVersionId",
                mapOf("templateVersionId" to templateVersionId),
            )
        val slug = slugsDe(listOf(fila.templateId))[fila.templateId] ?: DESCONOCIDO
        if (fila.status == TemplateRegistrar.PUBLICADA) {
            val publicadas = consultas.countByTemplateIdAndStatus(fila.templateId, TemplateRegistrar.PUBLICADA)
            val documentos = consultas.countDocumentsUsing(fila.id)
            if (publicadas <= 1 && documentos > 0) {
                throw VersionLastPublishedException(
                    "$slug@${fila.version} es la única versión publicada y $documentos documento(s) la usan",
                    mapOf(
                        "templateVersionId" to fila.id, "slug" to slug,
                        "version" to fila.version, "documentsUsing" to documentos,
                    ),
                )
            }
            consultas.deprecate(fila.id)
        }
        return VersionEntry(
            templateVersionId = fila.id,
            slug = slug,
            version = fila.version,
            status = TemplateRegistrar.DEPRECADA,
            packageHash = fila.packageHash,
            publishedAt = fila.publishedAt,
            documentsUsing = consultas.countDocumentsUsing(fila.id),
        )
    }

    /**
     * Devuelve `null` —y **lo registra a nivel ERROR con el id de la fila**— si el manifiesto guardado
     * no decodifica. En producción eso no puede pasar: el único escritor de `tpl_template_version` es
     * `TemplateRegistrar`, que valida contra el JSON Schema y contra las invariantes antes de insertar.
     * Si aparece, es una fila escrita por fuera (el escenario de H-16/H-17) y la salida correcta no es
     * dejar el catálogo entero fuera de servicio por una fila, sino omitirla **ruidosamente**: no es un
     * descarte silencioso, queda en el log con su `templateVersionId` (ADR-2-3-06, pregunta abierta).
     */
    private fun aCatalogEntry(fila: TplTemplateVersionEntity, slug: String): CatalogEntry? {
        val manifest = try {
            DomainJson.manifest(fila.manifest)
        } catch (e: RuntimeException) {
            log.error(
                "templates2: tpl_template_version.id={} (slug={}, version={}) tiene un manifiesto que no " +
                    "decodifica y queda FUERA del catálogo: {}",
                fila.id, slug, fila.version, e.message,
            )
            return null
        }
        return CatalogEntry(
            templateVersionId = fila.id,
            slug = slug,
            version = fila.version,
            name = manifest.name,
            eventKinds = manifest.eventKinds,
            minPlanTier = fila.minPlanTier.toInt(),
            previewUrl = previewUrl(fila, manifest.previewImage, manifest.assets.associate { it.path to it.sha256 }),
            capabilities = manifest.capabilities,
            status = fila.status,
        )
    }

    /**
     * `previewImage` es una **ruta dentro del paquete**, no una URL (ADR-021: en el documento y en el
     * manifiesto nunca viaja una URL). La URL sale de la fila de `tpl_asset` correspondiente a ese
     * `sha256` y de la plantilla de `02 §10.4`.
     */
    private fun previewUrl(fila: TplTemplateVersionEntity, previewImage: String?, shaPorRuta: Map<String, String>): String? {
        val sha = previewImage?.let { shaPorRuta[it] } ?: return null
        val asset = assets.findByTemplateVersionIdAndSha256(fila.id, sha) ?: return null
        return AssetUrlResolver.url(
            publicBaseUrl,
            AssetUrlResolver.almacenado(bucket, asset.publicId, asset.bucket, asset.s3Key, asset.width, asset.height),
        )
    }

    private fun aRegistrationEntry(f: TplTemplateRegistrationEntity) = RegistrationEntry(
        slug = f.templateSlug, version = f.version, result = f.result, errorCode = f.errorCode, createdAt = f.createdAt,
    )

    private fun slugsDe(templateIds: List<Long>): Map<Long, String> =
        if (templateIds.isEmpty()) emptyMap()
        else templates.findAllById(templateIds.distinct()).associate { it.id to it.slug }

    private fun <T> paginar(todas: List<T>, limit: Int, cursor: String?): Pagina<T> {
        val desde = descifrarCursor(cursor).coerceAtMost(todas.size)
        val hasta = (desde + limit).coerceAtMost(todas.size)
        return Pagina(todas.subList(desde, hasta), if (hasta < todas.size) cifrarCursor(hasta) else null)
    }

    private fun cifrarCursor(offset: Int): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString("o:$offset".toByteArray(Charsets.UTF_8))

    /** Un cursor ilegible se trata como "desde el principio", nunca como un 500. */
    private fun descifrarCursor(cursor: String?): Int {
        if (cursor.isNullOrBlank()) return 0
        return runCatching {
            String(Base64.getUrlDecoder().decode(cursor), Charsets.UTF_8).removePrefix("o:").toInt()
        }.getOrDefault(0).coerceAtLeast(0)
    }

    companion object {
        const val DESCONOCIDO = "?"
        const val LIMITE_MAXIMO = 50
        const val LIMITE_POR_DEFECTO = 20
    }
}
