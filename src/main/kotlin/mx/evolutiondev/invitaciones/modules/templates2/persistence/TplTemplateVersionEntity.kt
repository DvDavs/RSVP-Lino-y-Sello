package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.NullNode
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
 * `tpl_template_version` (`02 §2` V30). **Inmutable una vez insertada** (ADR-001, ADR-008): ninguna
 * ruta de la API hace `UPDATE` sobre `manifest`/`theme`/`defaults`/`migrationPlans`/`packageHash`/
 * `version`. El único `UPDATE` admitido es `status: 'published' → 'deprecated'`.
 *
 * `eventKinds` es `JsonNode` (array JSON), **no** `List<String>` sobre `TEXT[]` — `event_kinds` es
 * `JSONB` en la base (ADR-1R-B-09, `02 §8.3`: `TEXT[]` está prohibido en `templates2`).
 */
@Entity
@Table(name = "tpl_template_version")
class TplTemplateVersionEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "template_id", nullable = false, updatable = false)
    var templateId: Long = 0,

    @Column(name = "version", nullable = false, length = 20, updatable = false)
    var version: String = "",

    @Column(name = "version_major", nullable = false, updatable = false)
    var versionMajor: Int = 0,

    @Column(name = "version_minor", nullable = false, updatable = false)
    var versionMinor: Int = 0,

    @Column(name = "version_patch", nullable = false, updatable = false)
    var versionPatch: Int = 0,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "manifest", columnDefinition = "jsonb", nullable = false, updatable = false)
    var manifest: JsonNode = NullNode.instance,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "theme", columnDefinition = "jsonb", nullable = false, updatable = false)
    var theme: JsonNode = NullNode.instance,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "defaults", columnDefinition = "jsonb", nullable = false, updatable = false)
    var defaults: JsonNode = NullNode.instance,

    /** Mapa `{"<from>": MigrationPlan}` (`02 §2` V30, ADR-1R-B-02). `'{}'::jsonb` por defecto en la base. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "migration_plans", columnDefinition = "jsonb", nullable = false, updatable = false)
    var migrationPlans: JsonNode = NullNode.instance,

    /** `"sha256:" + 64 hex` (`Patterns.PREFIXED_SHA256`). Clave real de idempotencia del registro. */
    @Column(name = "package_hash", nullable = false, length = 71, updatable = false)
    var packageHash: String = "",

    /** `'published'` o `'deprecated'` — el único `UPDATE` admitido sobre esta entidad. */
    @Column(name = "status", nullable = false, length = 20)
    var status: String = "published",

    @Column(name = "min_plan_tier", nullable = false)
    var minPlanTier: Short = 1,

    /** Array JSON de `EventKind.wire`, `JSONB` con índice GIN `jsonb_path_ops` (ADR-1R-B-09). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_kinds", columnDefinition = "jsonb", nullable = false, updatable = false)
    var eventKinds: JsonNode = NullNode.instance,

    @Column(name = "published_at", nullable = false, updatable = false)
    var publishedAt: Instant = Instant.now(),

    @Column(name = "published_by", updatable = false)
    var publishedBy: Long? = null,
)
