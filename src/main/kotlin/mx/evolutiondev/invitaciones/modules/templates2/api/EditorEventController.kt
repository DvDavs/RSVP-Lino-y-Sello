package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Ruta 20 de `03 §2`: `PUT /editor/invitations/{invitationId}/event` (I-06, `ADR-3B-I06-01`).
 *
 * **Por qué un controlador propio y no un método más en [EditorDocumentController]**, que ya tiene
 * este mismo `@RequestMapping` de clase:
 *
 * - [EditorDocumentController] es el ciclo de vida de `tpl_document` (rutas 2-6 de `03 §2`), y su
 *   propio KDoc lo dice. Esta ruta **no toca `tpl_document`**: escribe dos columnas de `invitation`,
 *   que es la capa de negocio de la que el documento sólo *lee* (R4, `BusinessSnapshotReader`).
 *   Meterla ahí obligaría a que la clase mintiera sobre lo que hace y borraría en el código la
 *   frontera documento/negocio que todo el módulo mantiene.
 * - El servicio también queda aparte, y eso tiene un efecto práctico: `EditorDocumentService` tiene
 *   835 líneas y varias issues abiertas encima; añadirle un verbo de negocio habría convertido cada
 *   cambio de esta ruta en un conflicto con quien esté tocando la composición.
 *
 * Lo que **no** cambia por ir aparte: mismo prefijo de ruta, mismo `@PreAuthorize` de clase
 * (ADR-1R-B-10 — `/editor/` + `**` no tiene regla en `SecurityConfig` y cae en
 * `anyRequest().authenticated()`, así que sin la anotación la ruta quedaría abierta a cualquier rol
 * autenticado), mismo `requesterId` sacado **siempre** de `authentication.userId()`, mismo
 * `invitationId` sacado **siempre** de la ruta, y mismo cuerpo `JsonNode` decodificado por el lector
 * estricto de `templates2` (el `ObjectMapper` del módulo no es `@Primary`, ADR-1R-B-06: vincular a un
 * DTO con el del núcleo descartaría en silencio una clave desconocida).
 *
 * `PUT` y no `PATCH`: es una sustitución completa del par fecha/hora del evento, idempotente —
 * repetir la misma llamada deja exactamente el mismo estado.
 */
@RestController
@RequestMapping("/editor/invitations/{invitationId}")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class EditorEventController(private val servicio: EditorEventService) {

    /** `03 §3.20`. `200` con lo que quedó guardado; `422 TPL_EVENT_DATE_INVALID` si el formato no encaja. */
    @PutMapping("/event")
    fun event(
        authentication: Authentication,
        @PathVariable invitationId: Long,
        @RequestBody body: JsonNode,
    ): EventResponse = servicio.setEvent(authentication.userId(), invitationId, body)
}
