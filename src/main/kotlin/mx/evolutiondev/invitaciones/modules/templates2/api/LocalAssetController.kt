package mx.evolutiondev.invitaciones.modules.templates2.api

import jakarta.servlet.http.HttpServletRequest
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LocalAssetStorage
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.Resource
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.HandlerMapping
import java.nio.file.Files
import java.util.concurrent.TimeUnit

/**
 * Sirve, **sólo en modo local** (`templates2.assets.mode=local`, ADR-3-0a-02), los bytes que
 * [LocalAssetStorage] escribió en disco en lugar de subirlos a S3.
 *
 * Cuelga del prefijo `/public/`, que ya es `permitAll` en `SecurityConfig.kt:37` — **no se toca
 * `SecurityConfig`**: los objetos que sustituye son públicos en S3 igualmente (`02 §10.4`), así que
 * no se relaja ningún control (P8). Es de **sólo lectura**: no hay `POST`, `PUT` ni `DELETE`; la
 * escritura sigue pasando por el mismo camino de siempre (`AssetStore` / `TemplateRegistrar`).
 *
 * Sin la propiedad, esta clase no existe como bean y la ruta devuelve `404` como cualquier otra
 * inexistente: el comportamiento por defecto queda intacto.
 */
@RestController
@ConditionalOnProperty(name = [LocalAssetStorage.MODE], havingValue = LocalAssetStorage.LOCAL)
class LocalAssetController(private val almacen: LocalAssetStorage) {

    @GetMapping(BASE + "/**")
    fun servir(request: HttpServletRequest): ResponseEntity<Resource> {
        val completa = request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE) as? String
            ?: request.requestURI
        val clave = completa.substringAfter(BASE).trimStart('/')
        // `resolver` es quien impide salir de la raíz; cualquier clave no admisible sale como 404 y
        // nunca como una excepción con detalle del sistema de archivos.
        val ruta = runCatching { almacen.resolver(clave) }.getOrNull()
        if (ruta == null || !Files.isRegularFile(ruta)) return ResponseEntity.notFound().build()

        val tipo = porExtension(ruta.fileName.toString())
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_TYPE, tipo)
            .header(HttpHeaders.CONTENT_LENGTH, Files.size(ruta).toString())
            .header("X-Content-Type-Options", "nosniff")
            // La clave lleva el `sha256` del contenido (`02 §10.1` paso 7): el objeto es inmutable.
            .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic())
            .body(FileSystemResource(ruta))
    }

    /** Sólo los tipos que el módulo admite (`03 §3.7`); cualquier otro se sirve como binario opaco. */
    private fun porExtension(nombre: String): String = when (nombre.substringAfterLast('.', "")) {
        "webp" -> "image/webp"
        "png" -> MediaType.IMAGE_PNG_VALUE
        "jpg", "jpeg" -> MediaType.IMAGE_JPEG_VALUE
        "mp3" -> "audio/mpeg"
        else -> MediaType.APPLICATION_OCTET_STREAM_VALUE
    }

    companion object {
        const val BASE = "/public/templates2-assets"
    }
}
