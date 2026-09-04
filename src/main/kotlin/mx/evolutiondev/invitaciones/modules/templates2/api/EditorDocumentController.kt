package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Rutas 2-6 de `03 §2`: `:choose-template`, `GET /document`, `POST /document/operations`,
 * `GET /document/history` y `POST /document/restore`.
 *
 * **`@PreAuthorize` a nivel de clase** (ADR-1R-B-10, objeción A-02): `/editor/` + `**` no tiene regla
 * en `SecurityConfig` —cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`)—, así que sin
 * esta anotación la única barrera sería `HierarchyValidationService`. Es defensa en profundidad y se
 * puede añadir sin tocar el núcleo porque `@EnableMethodSecurity` ya está activo (`SecurityConfig.kt:17`).
 *
 * `requesterId` sale **siempre** de `authentication.userId()` (`_AuthenticationExt.kt:7-8`) y
 * `invitationId` **siempre** de la ruta: ningún cuerpo de este módulo acepta un id de documento,
 * snapshot, release o plantilla ajeno (mata H-13 por construcción, `03 §9.2`).
 *
 * Los cuerpos llegan como `JsonNode` y los decodifica el servicio con el lector estricto de 2-0b: el
 * `ObjectMapper` con `FAIL_ON_UNKNOWN_PROPERTIES` de `templates2` **no es `@Primary`** (ADR-1R-B-06),
 * así que vincular a un DTO con el mapper del núcleo descartaría en silencio `{"invitationId": 200}`
 * —el ataque de `03 §9.2` fila 2— en vez de responder `400 TPL_MALFORMED_JSON`.
 */
@RestController
@RequestMapping("/editor/invitations/{invitationId}")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class EditorDocumentController(private val servicio: EditorDocumentService) {

    /** `03 §3.2`. `201` la primera vez (documento creado), `200` si ya existía. */
    @PostMapping("/document:choose-template")
    fun chooseTemplate(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestBody body: JsonNode,
    ): ResponseEntity<ChooseTemplateResponse> {
        val respuesta = servicio.chooseTemplate(authentication.userId(), invitationId, body)
        val estado = if (respuesta.created) HttpStatus.CREATED else HttpStatus.OK
        return ResponseEntity.status(estado).body(respuesta)
    }

    /** `03 §3.3`. **No** crea el documento: sin él, `404 TPL_DOCUMENT_NOT_STARTED` (X-07). */
    @GetMapping("/document")
    fun document(authentication: Authentication, @PathVariable invitationId: Long): DocumentResponse =
        servicio.getDocument(authentication.userId(), invitationId)

    /** `03 §3.4`. Todo o nada; idempotente por `(document_id, clientBatchId)` (ADR-1R-B-03). */
    @PostMapping("/document/operations")
    fun operations(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestBody body: JsonNode,
    ): OperationBatchResponse = servicio.applyOperations(authentication.userId(), invitationId, body)

    /** `03 §3.5`. Nunca devuelve el `doc` de cada snapshot: para eso está `restore`. */
    @GetMapping("/document/history")
    fun history(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestParam(required = false) limit: Int?,
        @RequestParam(required = false) cursor: String?,
        @RequestParam(required = false) clientBatchId: String?,
    ): HistoryPageResponse = servicio.history(authentication.userId(), invitationId, limit, cursor, clientBatchId)

    /** `03 §3.6`. Crea una revisión **nueva** con el contenido de la vieja (ADR-029). */
    @PostMapping("/document/restore")
    fun restore(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestBody body: JsonNode,
    ): RestoreResponse = servicio.restore(authentication.userId(), invitationId, body)
}
