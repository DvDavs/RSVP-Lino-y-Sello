package mx.evolutiondev.invitaciones.modules.templates2.api

import jakarta.servlet.http.HttpServletRequest
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * Rutas 7-9 de `03 §2`: subir, listar y borrar los assets de una invitación.
 *
 * **Cuerpo binario crudo, no `multipart/form-data`** (ADR-1R-B-12, objeción A-06). Verificado que el
 * repositorio no configuraba `spring.servlet.multipart.*` en ningún sitio antes de este módulo, luego
 * regían los valores por defecto de Spring Boot: `max-file-size = 1MB`. Aceptar 15 MiB por multipart
 * habría exigido **elevar un límite global** que hoy protege también al módulo antiguo, cuyo propio
 * control de tamaño (`core/validation/FileValidationService.kt:11,34-37`) solo cubre imágenes y solo
 * hasta 5 MB, y ni siquiera se alcanza porque el servlet corta antes. El cuerpo crudo consigue el
 * mismo resultado con control exacto y sin relajar nada de fuera.
 *
 * Por eso el cuerpo llega como `HttpServletRequest` y **no** como `@RequestBody ByteArray`: vinculado
 * a un `ByteArray`, Spring habría leído el cuerpo entero en memoria **antes** de que ningún límite
 * pudiera aplicarse, que es exactamente lo que este diseño evita. El servicio lo lee contando.
 *
 * `Templates2BodyLimitFilter` **no** se aplica a esta ruta (`03 §8`): su tope no son los 8 KiB de las
 * rutas JSON sino los 15 MiB de un asset, y su código no es `TPL_BODY_TOO_LARGE` sino
 * `TPL_ASSET_TOO_LARGE` (`03 §5`).
 *
 * Mismo `@PreAuthorize` de clase que el resto de `/editor/` + `**` y por el mismo motivo (ADR-1R-B-10):
 * esas rutas **no tienen regla** en `SecurityConfig` y caen en `anyRequest().authenticated()`
 * (`SecurityConfig.kt:47`).
 */
@RestController
@RequestMapping("/editor/invitations/{invitationId}/assets")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class EditorAssetController(private val servicio: EditorAssetService) {

    /**
     * `03 §3.7`. `201` en una subida nueva, `200` cuando el mismo `sha256` ya existía en esta
     * invitación (`reused = true`): la idempotencia es **por contenido**, no por reintento.
     *
     * `X-Asset-Filename` se acepta y se ignora deliberadamente: `03 §3.7` solo lo prevé "para derivar
     * la extensión", y la extensión real la fija el `contentType` verificado contra el número mágico.
     * Un nombre de archivo del cliente nunca decide dónde se escribe en S3.
     */
    @PostMapping
    fun upload(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        request: HttpServletRequest,
    ): ResponseEntity<AssetUploadResponse> {
        val respuesta = servicio.subir(
            requesterId = authentication.userId(),
            invitationId = invitationId,
            contentTypeDeclarado = request.contentType,
            contentLengthDeclarado = request.contentLengthLong,
            cuerpo = request.inputStream,
        )
        val estado = if (respuesta.reused) HttpStatus.OK else HttpStatus.CREATED
        return ResponseEntity.status(estado).body(respuesta)
    }

    /** `03 §3.8`. `referenced` dice si el asset lo usa el documento vigente o algún release. */
    @GetMapping
    fun list(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestParam(required = false) limit: Int?,
        @RequestParam(required = false) cursor: String?,
    ): AssetListResponse = servicio.listar(authentication.userId(), invitationId, limit, cursor)

    /**
     * `03 §3.9`. `204`. Un `assetId` ajeno responde `404 TPL_ASSET_NOT_FOUND`, **nunca** `403`: un
     * `403` confirmaría que el recurso existe (`03 §9.2`).
     */
    @DeleteMapping("/{assetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @PathVariable assetId: String,
    ) {
        servicio.borrar(authentication.userId(), invitationId, assetId)
    }
}
