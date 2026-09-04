package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Resultado del registro de una versión de plantilla (`02 §4`), idempotente por `package_hash`
 * (ADR-008 con la fórmula corregida de ADR-1R-D-03).
 */
sealed interface RegistrationResult {
    /** alta nueva: se creó `tpl_template_version` */
    data class Created(val slug: TemplateSlug, val version: SemverVersion, val packageHash: String) : RegistrationResult
    /** mismo `package_hash` ya registrado: no-op explícito, nunca un descarte silencioso */
    data class NoopSameHash(val slug: TemplateSlug, val version: SemverVersion, val packageHash: String) : RegistrationResult
    /** rechazo tipado; `code` sale del catálogo cerrado de `03 §5` */
    data class Rejected(val code: TplErrorCode, val detail: String) : RegistrationResult
}
