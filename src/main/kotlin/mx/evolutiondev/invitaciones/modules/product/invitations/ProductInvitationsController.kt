package mx.evolutiondev.invitaciones.modules.product.invitations

import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `POST /product/invitations` — la clienta crea **su** invitación. Contrato completo en
 * `memoria/handoffs/5-1b-contrato-alta.md`.
 *
 * **Autorización.** `/product/` + `**` no tiene regla en `SecurityConfig`: cae en
 * `anyRequest().authenticated()` (`SecurityConfig.kt:47`), así que la ruta nace cerrada sin tocar el
 * núcleo. El `@PreAuthorize` de clase es defensa en profundidad y sigue el patrón de
 * `CatalogController.kt:22-25` y `AccountHealthController.kt:31-33` (ADR-1R-B-10). Los tres roles del
 * sistema pueden usarla porque el dueño siempre es quien trae el token: un `ADMIN` que la llame se
 * crea una invitación **suya**, no ajena, así que no hay escalada que impedir.
 *
 * **Propiedad.** El `customer_id` sale de `authentication.userId()` (`_AuthenticationExt.kt:7`),
 * jamás del cuerpo. Un `{"customerId": 200}` no llega siquiera al servicio: el `ObjectMapper` del
 * núcleo descarta lo desconocido (ver [CrearInvitacionRequest]). Es la misma regla que `templates2`
 * fijó para matar H-13 (`EditorDocumentController.kt:26-28`).
 *
 * **No hay `GET` ni `PUT` aquí todavía**: este bloque abre el alta y el borrado del propio borrador.
 * Por eso la respuesta del alta no lleva cabecera `Location`, que apuntaría a una ruta inexistente.
 */
@RestController
@RequestMapping("/product/invitations")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class ProductInvitationsController(
    private val servicio: ProductInvitationService,
) {

    /** `201` cuando se crea; `200` cuando se reconoce un doble clic (§3 del contrato). */
    @PostMapping
    fun crear(
        authentication: Authentication,
        @RequestBody peticion: CrearInvitacionRequest,
    ): ResponseEntity<InvitacionCreadaResponse> {
        val resultado = servicio.crear(authentication.userId(), peticion)
        val estado = if (resultado.creada) HttpStatus.CREATED else HttpStatus.OK
        return ResponseEntity.status(estado).body(resultado.respuesta)
    }

    /**
     * `204` cuando se borra. **La salida que el `409` del tope ya prometía** (R1-05): sin ella, una
     * clienta con tres borradores no tenía forma de crear el cuarto, porque el único borrado del
     * sistema exige rol MASTER.
     *
     * El id va en la ruta y la propiedad **no** se comprueba aquí: la comprueba el `WHERE` de todas
     * las consultas del servicio, que llevan siempre el `customer_id` del token. Una invitación
     * ajena y una inexistente devuelven el mismo `404` con el mismo cuerpo, así que esta ruta no
     * sirve para sondear qué ids existen.
     */
    @DeleteMapping("/{invitationId}")
    fun eliminar(
        authentication: Authentication,
        @PathVariable invitationId: Long,
    ): ResponseEntity<Void> {
        servicio.eliminar(authentication.userId(), invitationId)
        return ResponseEntity.noContent().build()
    }
}
