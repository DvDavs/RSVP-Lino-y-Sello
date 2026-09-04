package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode

/**
 * Excepciones tipadas del registro de plantillas y del catálogo.
 *
 * **Por qué no heredan de `Templates2Exception`.** `domain.Templates2Exception` es una `sealed class`
 * (`domain/Templates2Exception.kt:12`) y Kotlin exige que las subclases directas de una `sealed class`
 * vivan **en el mismo paquete y módulo**; `templates2.domain` está congelado para este bloque, así que
 * `02 §7.5` ("todas heredan de `Templates2Exception`") no es implementable sin tocarlo. La alternativa
 * conservadora es esta jerarquía paralela con **la misma superficie** (`code`, `details`, `status`),
 * para que el `@RestControllerAdvice` de 2-5 la trate exactamente igual (ADR-2-3-01).
 *
 * `contratos.md §4` prohíbe `require`/`check`/`error()` en todo `templates2`: caerían en el 400
 * genérico del handler existente, sin código tipado. Todo fallo de este bloque sale por aquí o por
 * `Templates2Exception`.
 */
open class TemplateRegistryException(
    val code: TplErrorCode,
    message: String,
    val details: Map<String, Any?> = emptyMap(),
    cause: Throwable? = null,
) : RuntimeException(message, cause) {

    /** `code.httpStatus` (Int, no `HttpStatus`: el dominio no depende de Spring). */
    val status: Int get() = code.httpStatus
}

/** `422` — `sha256`/`bytes`/`contentType` de un asset no coincide con lo declarado en el manifiesto. */
class PackageAssetMismatchException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_PACKAGE_ASSET_MISMATCH, message, details)

/** `422` — diff estructural sin bump mayor, o mayor sin plan que lo cubra (ADR-028, `02 §4` paso 5). */
class BreakingChangeNotMajorException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR, message, details)

/** `409` — mismo `slug@version`, contenido distinto (mata H-09, `02 §4` paso 4). */
class VersionHashMismatchException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_VERSION_HASH_MISMATCH, message, details)

/** `404` — `templateVersionId` inexistente (`03 §3.19`). */
class TemplateVersionNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_TEMPLATE_VERSION_NOT_FOUND, message, details)

/** `409` — deprecar la única versión publicada de un slug con documentos que la usan (`03 §3.19`). */
class VersionLastPublishedException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_VERSION_LAST_PUBLISHED, message, details)

/** `413` — asset por encima de 15 MiB (`03 §8`). */
class AssetTooLargeException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_ASSET_TOO_LARGE, message, details)

/** `415` — tipo declarado fuera del catálogo o incoherente con el número mágico (`02 §10.1` paso 4). */
class AssetTypeUnsupportedException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_ASSET_TYPE_UNSUPPORTED, message, details)

/** `502` — S3 rechaza o no responde al subir; **nunca** un 500 opaco (`02 §10.1` paso 8). */
class AssetStorageUnavailableException(message: String, cause: Throwable? = null) :
    TemplateRegistryException(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE, message, emptyMap(), cause)

/** `413` — el conjunto de JSON del paquete supera 2 MiB (`03 §8`, fila "Paquete de plantilla"). */
class PackageTooLargeException(message: String, details: Map<String, Any?> = emptyMap()) :
    TemplateRegistryException(TplErrorCode.TPL_BODY_TOO_LARGE, message, details)
