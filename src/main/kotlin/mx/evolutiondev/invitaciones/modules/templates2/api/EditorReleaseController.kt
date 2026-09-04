package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * Rutas 10-14 de `03 §2`: preflight, publicar, **despublicar**, historial de publicaciones y
 * **rotar el enlace público**.
 *
 * Despublicar y rotar son operaciones de **primera clase** (ADR-1R-B-05, objeción A-07): sin ellas un
 * `public_token` filtrado era irrevocable, porque el token es estable de por vida de la invitación.
 * La ventana de caché del CDN (300 s, `03 §7`) se documenta como consecuencia conocida: la revocación
 * es inmediata en origen, no necesariamente en el borde.
 *
 * Mismo `@PreAuthorize` de clase que [EditorDocumentController] y por el mismo motivo (ADR-1R-B-10).
 */
@RestController
@RequestMapping("/editor/invitations/{invitationId}")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class EditorReleaseController(private val servicio: ReleaseService) {

    /** `03 §3.11`. Lectura pura: dice qué bloquea la publicación **sin** publicar. */
    @GetMapping("/release/preflight")
    fun preflight(authentication: Authentication, @PathVariable invitationId: Long): PreflightResponse =
        servicio.preflight(authentication.userId(), invitationId)

    /** `03 §3.12`. `201` con release nuevo; `200` si el contenido no cambió (idempotencia por hash). */
    @PostMapping("/release")
    fun publish(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestBody body: JsonNode,
    ): ResponseEntity<ReleaseResponse> {
        val respuesta = servicio.publish(authentication.userId(), invitationId, body)
        val estado = if (respuesta.reusedActiveRelease) HttpStatus.OK else HttpStatus.CREATED
        return ResponseEntity.status(estado).body(respuesta)
    }

    /** `03 §3.13`. `204` siempre, también si no había release activo (idempotente por diseño). */
    @DeleteMapping("/release")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unpublish(authentication: Authentication, @PathVariable invitationId: Long) {
        servicio.unpublish(authentication.userId(), invitationId)
    }

    /** `03 §3.14`. Nunca devuelve `composed`: para verlo está el render público. */
    @GetMapping("/releases")
    fun releases(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestParam(required = false) limit: Int?,
        @RequestParam(required = false) cursor: String?,
    ): ReleaseListResponse = servicio.list(authentication.userId(), invitationId, limit, cursor)

    /** `03 §3.10`. Revoca el enlace anterior de inmediato en origen; no es idempotente. */
    @PostMapping("/public-token:rotate")
    fun rotate(authentication: Authentication, @PathVariable invitationId: Long): PublicTokenResponse =
        servicio.rotatePublicToken(authentication.userId(), invitationId)
}
