package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode

/**
 * Las excepciones tipadas que faltaban para cerrar el catálogo de `03 §5`: las seis de los assets del
 * editor (rutas 7-9) y la del render público (ruta 15).
 *
 * Heredan de [EditorException] (2-4) y no de `domain.Templates2Exception` por el motivo ya dirimido en
 * ADR-2-3-01: `Templates2Exception` es `sealed` y sus subclases directas tienen que vivir en
 * `templates2.domain`, que está congelado. El advice las trata igual que a las otras dos jerarquías,
 * porque las tres exponen `code`, `status` y `details`.
 *
 * **No se reutilizan las homónimas de `catalog`** (`AssetTooLargeException`, `AssetTypeUnsupportedException`,
 * `AssetStorageUnavailableException`): aquéllas son del **registro de plantillas**
 * (`TemplateRegistryException`), y mezclar las dos superficies haría imposible distinguir en un log un
 * fallo de un cliente subiendo su foto de un fallo del kit de autor subiendo un paquete. El `code` y el
 * HTTP son los mismos; el `03 §5` es uno solo.
 */

/**
 * `404` — `DELETE /assets/{id}` con un `assetId` inexistente **o ajeno**.
 *
 * La misma respuesta para los dos casos es deliberada (`03 §3.9`, `§9.2` fila 4): un `403` confirmaría
 * la existencia de un recurso de otra invitación, que es exactamente el oráculo que H-13 explotaba.
 */
class AssetNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_ASSET_NOT_FOUND, message, details)

/**
 * `409` — el asset lo referencia el documento vigente **o algún release** (`03 §3.9`).
 *
 * Un release es inmutable y tiene que seguir renderizando: borrar el objeto que sirve dejaría una
 * invitación publicada con una imagen rota, que es peor que negar el borrado.
 */
class AssetInUseException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_ASSET_IN_USE, message, details)

/** `409` — más de 200 assets en la invitación; cuota **blanda** (`02 §10.1` paso 6). */
class AssetQuotaExceededException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_ASSET_QUOTA_EXCEEDED, message, details)

/** `413` — asset por encima de 15 MiB, por `Content-Length` o por lectura contada (`03 §3.7`). */
class AssetTooLargeException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_ASSET_TOO_LARGE, message, details)

/**
 * `415` — tipo declarado fuera del catálogo **o** incoherente con el número mágico (`02 §10.1` paso 4).
 *
 * Mirar solo la cabecera no basta: el módulo antiguo lo hace así (`FileValidationService.kt:21-24`) y
 * quien declara el tipo es exactamente quien sube el archivo.
 */
class AssetTypeUnsupportedException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_ASSET_TYPE_UNSUPPORTED, message, details)

/** `502` — S3 rechaza o no responde al subir o al borrar; **nunca** un 500 opaco (ADR-016). */
class AssetStorageUnavailableException(message: String, cause: Throwable? = null) :
    EditorException(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE, message, emptyMap(), cause)

/**
 * `404` del render público (`03 §3.15`). **La misma respuesta** para "token inexistente", "documento
 * sin release activo", "release despublicado", "token rotado" y "`uses_templates2 = false`": el
 * invitado no tiene por qué distinguirlos y distinguirlos sería un oráculo de enumeración de tokens.
 */
class ReleaseNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_RELEASE_NOT_FOUND, message, details)
