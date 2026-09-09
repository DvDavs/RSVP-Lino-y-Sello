package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * El panel de invitados de la clienta: las nueve rutas del contrato `5-2` §1, bajo
 * `/product/invitations/{invitationId}/guests`.
 *
 * **Por qué existe.** Hasta ahora la única superficie HTTP de invitados para un rol `USER` vivía en
 * `modules/user/invitations`, que está prohibido toda la fase 5 (ADR-DUENO-01, ADR-5-0C-01); su
 * gemela `AdminGuestsController` cuelga de `/admin/` + `**`, reservado a ADMIN y MASTER
 * (`SecurityConfig.kt:42`). El motor —`InvitationGuestsService`— sí es reutilizable y es el que se
 * usa aquí sin duplicarlo.
 *
 * **Autorización, en dos capas.**
 * 1. `@PreAuthorize` de clase. El prefijo `/product/` + `**` **no casa con ninguna regla** de
 *    `SecurityConfig.kt:36-47` y cae en `anyRequest().authenticated()` (`:47`), así que sin esta
 *    anotación bastaría con estar autenticado con cualquier rol. Es la defensa en profundidad que
 *    fijó ADR-5-0C-01 y que ya llevan las cuatro sondas de salud del módulo.
 * 2. **Propiedad por invitación**, que es la que de verdad protege los datos: la aplica
 *    `InvitationGuestsService.validateInvitation` a través de [GuestPanelService]. El rol solo dice
 *    «puedes entrar al panel»; quién es dueño de **esta** invitación lo dice la jerarquía.
 *
 * **Ningún token sale de aquí** salvo por [link], montado dentro de la URL que se va a compartir
 * (contrato §0.3, hallazgo S-13).
 *
 * **Nota de forma**: el `@RequestMapping` de clase llega hasta `{invitationId}` y no hasta `/guests`
 * porque dos rutas del contrato terminan en `:preview` y `:import`; Spring intercala un separador al
 * combinar patrones, así que un sufijo con dos puntos tiene que escribirse en el método completo,
 * igual que `EditorDocumentController.kt:41` (`"/document:choose-template"`). Las URLs resultantes
 * son exactamente las del contrato.
 */
@RestController
@RequestMapping("/product/invitations/{invitationId}")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class GuestPanelController(private val servicio: GuestPanelService) {

    /** Listado paginado, con búsqueda por nombre insensible a mayúsculas y acentos. */
    @GetMapping("/guests")
    fun list(
        @PathVariable invitationId: Long,
        @RequestParam(required = false) search: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) page: Int?,
        @RequestParam(required = false) size: Int?,
        authentication: Authentication,
    ): GuestPage = servicio.listar(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        search = search,
        status = status,
        page = page,
        size = size,
    )

    /** Contadores en vivo: personas, asientos y las reglas del evento. */
    @GetMapping("/guests/summary")
    fun summary(
        @PathVariable invitationId: Long,
        authentication: Authentication,
    ): GuestSummaryResponse = servicio.resumen(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
    )

    /** Alta unitaria. */
    @PostMapping("/guests")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @PathVariable invitationId: Long,
        @RequestBody request: GuestUpsertRequest,
        authentication: Authentication,
    ): GuestItem = servicio.crear(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        request = request,
    )

    /**
     * Vista previa del texto pegado. **No escribe nada**: enseña qué renglones entrarían y qué le
     * pasa a cada uno de los demás, con la corrección sugerida.
     */
    @PostMapping("/guests:preview")
    fun preview(
        @PathVariable invitationId: Long,
        @RequestBody request: GuestPasteRequest,
        authentication: Authentication,
    ): GuestPasteResponse = servicio.analizar(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        texto = request.text,
    )

    /** Importa solo los renglones válidos. Nunca falla entera por un renglón malo. */
    @PostMapping("/guests:import")
    fun import(
        @PathVariable invitationId: Long,
        @RequestBody request: GuestPasteRequest,
        authentication: Authentication,
    ): GuestImportResponse = servicio.importar(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        texto = request.text,
    )

    /** Edición. Exige que el invitado pertenezca a esta invitación (hallazgo S-04). */
    @PutMapping("/guests/{guestId}")
    fun update(
        @PathVariable invitationId: Long,
        @PathVariable guestId: Long,
        @RequestBody request: GuestUpsertRequest,
        authentication: Authentication,
    ): GuestItem = servicio.actualizar(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        guestId = guestId,
        request = request,
    )

    /** Baja. Es **física** en el motor, así que las dos comprobaciones de S-04 y S-05 importan. */
    @DeleteMapping("/guests/{guestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @PathVariable invitationId: Long,
        @PathVariable guestId: Long,
        authentication: Authentication,
    ) = servicio.eliminar(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        guestId = guestId,
    )

    /**
     * La **única** ruta del panel que revela un token, y lo entrega ya montado en la URL final, más
     * el mensaje listo para compartir y el enlace de WhatsApp cuando hay teléfono.
     */
    @GetMapping("/guests/{guestId}/link")
    fun link(
        @PathVariable invitationId: Long,
        @PathVariable guestId: Long,
        authentication: Authentication,
    ): GuestLinkResponse = servicio.enlace(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        guestId = guestId,
    )

    /** CSV con BOM UTF-8, encabezados en es-MX y sin tokens. */
    @GetMapping("/guests/export.csv")
    fun exportCsv(
        @PathVariable invitationId: Long,
        authentication: Authentication,
    ): ResponseEntity<ByteArrayResource> {
        val bytes = servicio.exportarCsv(
            userId = authentication.userId(),
            appRole = authentication.role(),
            invitationId = invitationId,
        )
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"invitados.csv\"")
            .contentType(MediaType.parseMediaType(TIPO_CSV))
            .contentLength(bytes.size.toLong())
            .body(ByteArrayResource(bytes))
    }

    /**
     * Enviar a **ese** invitado su enlace personal por correo (contrato `5-2` §1).
     *
     * `202` porque el correo se encola y sale en segundo plano, como el resto de los avisos del
     * backend: la respuesta significa «lo aceptamos y lo vamos a mandar», no «ya está en su bandeja».
     * Prometer la entrega sería mentir sobre algo que depende de un servidor de correo ajeno.
     *
     * Las comprobaciones —propiedad de la invitación, pertenencia del invitado, correo del invitado,
     * release activo y tope por invitación y día— están en [GuestPanelService.enviarCorreo], con el
     * motivo de cada una. El enlace es el mismo que devuelve [link] y se arma con `app.frontend.url`
     * (arreglo de **S-08**): ningún dominio escrito en el código.
     */
    @PostMapping("/guests/{guestId}:send-email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun sendEmail(
        @PathVariable invitationId: Long,
        @PathVariable guestId: Long,
        authentication: Authentication,
    ) = servicio.enviarCorreo(
        userId = authentication.userId(),
        appRole = authentication.role(),
        invitationId = invitationId,
        guestId = guestId,
    )

    companion object {
        const val TIPO_CSV = "text/csv; charset=utf-8"
    }
}
