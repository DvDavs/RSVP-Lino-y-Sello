package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Raíz de **todas** las excepciones del módulo (`02 §7.1`). Existe porque `contratos.md §4` prohíbe
 * `require`/`check`/`error()` dentro de `templates2`: caerían en el 400 genérico del handler existente,
 * sin código tipado, reintroduciendo H-14.
 *
 * `status` sale de `code.httpStatus` (Int, no `HttpStatus`: el dominio no depende de Spring).
 */
sealed class Templates2Exception(
    val code: TplErrorCode,
    message: String,
    val details: Map<String, Any?> = emptyMap(),
    cause: Throwable? = null,
) : RuntimeException(message, cause) {

    val status: Int get() = code.httpStatus

    /** Cuerpo JSON no parseable, con claves desconocidas o con un identificador que no casa su patrón. */
    class MalformedJson(message: String, details: Map<String, Any?> = emptyMap(), cause: Throwable? = null) :
        Templates2Exception(TplErrorCode.TPL_MALFORMED_JSON, message, details, cause)

    /** Paquete de plantilla que no supera `validateManifest` o el JSON Schema. */
    class ManifestInvalid(message: String, details: Map<String, Any?> = emptyMap()) :
        Templates2Exception(TplErrorCode.TPL_MANIFEST_INVALID, message, details)

    /** Cualquier fallo no previsto: nunca un 500 opaco (ADR-016). */
    class Internal(message: String, cause: Throwable? = null) :
        Templates2Exception(TplErrorCode.TPL_INTERNAL, message, emptyMap(), cause)
}
