package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.annotation.JsonInclude
import mx.evolutiondev.invitaciones.modules.templates2.catalog.CatalogEntry
import mx.evolutiondev.invitaciones.modules.templates2.catalog.RegistrationEntry
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistrationOutcome
import mx.evolutiondev.invitaciones.modules.templates2.catalog.VersionEntry
import java.time.Instant

/**
 * DTO de respuesta de `POST /master/templates2/versions` (`03 §3.17`).
 *
 * `result` es el literal de `ck_tpl_template_registration_result` (`created` | `noop_same_hash`) y
 * `alreadyRegistered` lo dice sin obligar a comparar cadenas. **Los dos van siempre**, incluso en el
 * `200`: el punto de ADR-1R-D-03 es que un paquete cuyo `package_hash` ya está registrado se conteste
 * de forma **visible**, nunca con un descarte mudo ni con un `409` opaco (`contratos.md §4`).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RegisterTemplateResponse(
    val result: String,
    val alreadyRegistered: Boolean,
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val packageHash: String,
    val assetsRegistered: Int,
    /** diff estructural contra la versión publicada anterior; ausente si es la primera versión */
    val structuralDiff: Map<String, Any?>? = null,
) {
    companion object {
        fun de(outcome: TemplateRegistrationOutcome): RegisterTemplateResponse =
            RegisterTemplateResponse(
                result = outcome.wire,
                alreadyRegistered = outcome.alreadyRegistered,
                templateVersionId = outcome.templateVersionId,
                slug = outcome.slug,
                version = outcome.version,
                packageHash = outcome.packageHash,
                assetsRegistered = outcome.assetsRegistered,
                structuralDiff = outcome.structuralDiffWire,
            )
    }
}

/** Un ítem del catálogo del cliente (`03 §3.1`). */
data class CatalogItemResponse(
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val name: Map<String, String>,
    val eventKinds: List<String>,
    val minPlanTier: Int,
    val previewUrl: String?,
    val capabilities: List<String>,
    val status: String,
) {
    companion object {
        fun de(e: CatalogEntry) = CatalogItemResponse(
            templateVersionId = e.templateVersionId,
            slug = e.slug,
            version = e.version,
            name = e.name.byLocale.entries.associate { (k, v) -> k.wire to v },
            eventKinds = e.eventKinds.map { it.wire },
            minPlanTier = e.minPlanTier,
            previewUrl = e.previewUrl,
            capabilities = e.capabilities.map { it.wire },
            status = e.status,
        )
    }
}

/** `GET /editor/templates2/catalog` (`03 §3.1`). */
data class CatalogResponse(val items: List<CatalogItemResponse>, val nextCursor: String?)

/** Una versión registrada (`03 §3.18`). */
data class TemplateVersionItemResponse(
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val status: String,
    val packageHash: String,
    val publishedAt: Instant?,
    val documentsUsing: Long,
) {
    companion object {
        fun de(e: VersionEntry) = TemplateVersionItemResponse(
            e.templateVersionId, e.slug, e.version, e.status, e.packageHash, e.publishedAt, e.documentsUsing,
        )
    }
}

/** Una fila de auditoría (`03 §3.18`, `recentRegistrations`); incluye los intentos **rechazados**. */
data class RegistrationItemResponse(
    val slug: String,
    val version: String,
    val result: String,
    val errorCode: String?,
    val createdAt: Instant?,
) {
    companion object {
        fun de(e: RegistrationEntry) = RegistrationItemResponse(e.slug, e.version, e.result, e.errorCode, e.createdAt)
    }
}

/** `GET /master/templates2/versions` (`03 §3.18`). */
data class TemplateVersionListResponse(
    val items: List<TemplateVersionItemResponse>,
    val recentRegistrations: List<RegistrationItemResponse>,
    val nextCursor: String?,
)
