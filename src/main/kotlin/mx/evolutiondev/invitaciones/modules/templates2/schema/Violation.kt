package mx.evolutiondev.invitaciones.modules.templates2.schema

/**
 * Espejo de `invariants.ts` `Violation`. `code` es un `InvariantCode` cuando la violación viene de
 * las 30 invariantes, y `schemaCode` (texto libre) cuando viene del JSON Schema, donde no hay catálogo
 * cerrado de códigos.
 *
 * `path` se emite **siempre** y con la misma cadena que produce TypeScript, aunque los golden solo
 * comparen `code` (objeción O-11 de `bitacora/2-0a-REV.md`): un `Invariants.kt` con los códigos
 * correctos y rutas equivocadas pasaría la tabla de casos igualmente, así que las rutas se prueban
 * aparte en `InvariantPathTest`.
 */
data class Violation(
    val code: InvariantCode?,
    val path: String,
    val detail: String? = null,
    /** código textual cuando la violación no es de invariante sino del JSON Schema */
    val schemaCode: String? = null,
) {
    /** Literal que aparece en `expect` de `golden/invariants/`. */
    val wire: String get() = code?.wire ?: (schemaCode ?: "SCHEMA")

    companion object {
        fun of(code: InvariantCode, path: String, detail: String? = null) = Violation(code, path, detail)
        fun schema(schemaCode: String, path: String, detail: String? = null) =
            Violation(null, path, detail, schemaCode)
    }
}
