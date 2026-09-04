package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Una fila de `tpl_template_version` ya decodificada a [TemplatePackage], que es lo que consumen
 * `compose`, el reductor y `switchTemplate`.
 */
data class LoadedTemplateVersion(
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val status: String,
    val minPlanTier: Int,
    val pkg: TemplatePackage,
) {
    val semver: SemverVersion get() = pkg.version
}

/**
 * Traduce `tpl_template_version` → [TemplatePackage] (`02 §2` V30 → `01 §2.1`). Vive en `persistence`
 * porque es una lectura de base de datos, no composición.
 *
 * El **único** escritor de esas filas es `TemplateRegistrar` (2-3), que valida contra el JSON Schema y
 * contra `I-01`…`I-30` antes de insertar: aquí no se revalida (sería recorrer el manifiesto entero en
 * cada petición del editor). Una fila que aun así no decodifique es una fila escrita por fuera del
 * módulo — el escenario de H-16/H-17 —, y se trata como fallo interno con el `templateVersionId`
 * exacto en el mensaje, nunca como un documento vacío (P1).
 */
@Service
class TemplateVersionLoader(
    private val versions: TplTemplateVersionRepository,
    private val templates: TplTemplateRepository,
) {

    @Transactional(readOnly = true)
    fun porId(templateVersionId: Long): LoadedTemplateVersion? {
        val fila = versions.findById(templateVersionId).orElse(null) ?: return null
        return cargar(fila)
    }

    /** `(slug, version)` es como el cliente nombra una plantilla; nunca acepta un id numérico (`03 §9.2`). */
    @Transactional(readOnly = true)
    fun porSlugYVersion(slug: String, version: String): LoadedTemplateVersion? {
        val plantilla = templates.findBySlug(slug) ?: return null
        val fila = versions.findByTemplateIdAndVersion(plantilla.id, version) ?: return null
        return cargar(fila, plantilla.slug)
    }

    fun cargar(fila: TplTemplateVersionEntity, slugConocido: String? = null): LoadedTemplateVersion {
        val slug = slugConocido
            ?: templates.findById(fila.templateId).orElse(null)?.slug
            ?: throw Templates2Exception.Internal(
                "tpl_template_version.id=${fila.id} apunta a template_id=${fila.templateId}, que no existe",
            )
        val pkg = try {
            TemplatePackage(
                manifest = DomainJson.manifest(fila.manifest),
                theme = DomainJson.theme(fila.theme),
                defaults = DomainJson.defaults(fila.defaults),
                migrationPlans = planes(fila),
            )
        } catch (e: Templates2Exception) {
            throw Templates2Exception.Internal(
                "tpl_template_version.id=${fila.id} ($slug@${fila.version}) no decodifica: ${e.message}", e,
            )
        }
        return LoadedTemplateVersion(fila.id, slug, fila.version, fila.status, fila.minPlanTier.toInt(), pkg)
    }

    /** `migration_plans` es `{"<versionOrigen>": MigrationPlan}` (`02 §2` V30, ADR-1R-B-02). */
    private fun planes(fila: TplTemplateVersionEntity): Map<SemverVersion, MigrationPlan> {
        val node = fila.migrationPlans
        if (node == null || !node.isObject) return emptyMap()
        val salida = LinkedHashMap<SemverVersion, MigrationPlan>()
        for (from in node.fieldNames()) {
            val plan = DomainJson.migrationPlan(node.get(from), "migration_plans.$from")
            salida[SemverVersion.parse(from)] = plan
        }
        return salida
    }
}
