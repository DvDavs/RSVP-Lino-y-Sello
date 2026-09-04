package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.core.s3.S3Service
import org.springframework.stereotype.Service

/**
 * Puerta única a S3 para los assets de un **paquete de plantilla** (`02 §10.2`).
 *
 * Es una interfaz por dos razones, ninguna estética: (1) `R-S3-1` obliga a subir el objeto **antes**
 * de abrir la transacción, así que el registro tiene que poder ejercitarse con un almacén que falle a
 * mitad para comprobar que "nada persiste" (`02 §10.5`); (2) las pruebas de este bloque corren contra
 * PostgreSQL real pero **sin** credenciales de AWS.
 */
fun interface TemplateAssetStorage {

    /** Sube el objeto. Cualquier fallo debe salir como [AssetStorageUnavailableException] (502). */
    fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String)
}

/**
 * Implementación real sobre `core/s3/S3Service.uploadPublicFile` (`S3Service.kt:57-69`). Traduce
 * cualquier excepción del SDK a `502 TPL_ASSET_STORAGE_UNAVAILABLE` — nunca un 500 opaco (ADR-016).
 */
@Service
class S3TemplateAssetStorage(private val s3: S3Service) : TemplateAssetStorage {

    override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) {
        try {
            s3.uploadPublicFile(bucket, key, bytes, contentType)
        } catch (e: Exception) {
            throw AssetStorageUnavailableException("S3 no aceptó \"$key\": ${e.message}", e)
        }
    }
}
