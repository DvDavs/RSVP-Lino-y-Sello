package mx.evolutiondev.invitaciones.modules.product.guests

import mx.evolutiondev.invitaciones.modules.product.ProductHealthResponse
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /product/guests/health` — sonda de salud del subpaquete **`guests`**.
 *
 * **De quién es este subpaquete.** Lo escribe la sesión **E2** (invitados, RSVP y compartir): listas
 * de invitados, confirmación de asistencia, enlaces por invitado y el envío por WhatsApp o correo.
 *
 * **Qué NO va aquí.** Cuenta, marca y legal (subpaquete `account`, sesión E3); pagos (subpaquete
 * `payments`, sesión E4); administración (subpaquete `admin`, sesión E5). Y **nada** se toca de
 * `modules/user/invitations`, `modules/master/templates` ni `MongoDataInitializer`: siguen prohibidos
 * durante toda la fase 5 y se retiran en la fase 7 (ADR-5-0C-01).
 *
 * **Autorización.** Idéntica a la de [mx.evolutiondev.invitaciones.modules.product.account.AccountHealthController]:
 * `/product/` + `**` cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`) y el `@PreAuthorize`
 * de clase es defensa en profundidad. La ruta **pública** del invitado —quien contesta el RSVP sin
 * cuenta— no es ésta: cuando E2 la construya tendrá que colgar de `/public/` + `**`, que ya es
 * `permitAll()` en `SecurityConfig.kt:38`, igual que hizo `PublicRenderController`.
 */
@RestController
@RequestMapping("/product/guests")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class GuestsHealthController {

    /** No consulta nada: responde con el nombre del subpaquete y `ok` (ver [ProductHealthResponse]). */
    @GetMapping("/health")
    fun health(): ProductHealthResponse = ProductHealthResponse.de(SUBPAQUETE)

    companion object {
        const val SUBPAQUETE = "guests"
    }
}
