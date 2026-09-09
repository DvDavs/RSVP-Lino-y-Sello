package mx.evolutiondev.invitaciones.modules.product.account

import mx.evolutiondev.invitaciones.modules.product.ProductHealthResponse
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /product/account/health` — sonda de salud del subpaquete **`account`**.
 *
 * **De quién es este subpaquete.** Lo escribe la sesión **E3** (cuenta, marca y legal): perfil de la
 * clienta, datos de la marca Lino & Sello, avisos legales y las propiedades de contacto y correo de
 * [ProductContactProperties] y [ProductMailProperties].
 *
 * **Qué NO va aquí.** Invitados, RSVP y compartir (subpaquete `guests`, sesión E2); Stripe y planes
 * (subpaquete `payments`, sesión E4); pantallas de administración (subpaquete `admin`, sesión E5);
 * autenticación y contraseñas, que siguen viviendo en `modules/auth` y en `core/auth` y **no** se
 * mudan aquí. Tampoco nada de plantillas o del documento de invitación: eso es `modules/templates2`
 * (ADR-5-0C-01).
 *
 * **Autorización.** `/product/` + `**` **no tiene regla** en `SecurityConfig`: cae en
 * `anyRequest().authenticated()` (`SecurityConfig.kt:47`), así que la ruta ya nace cerrada a quien no
 * trae token. El `@PreAuthorize` de clase es defensa en profundidad —posible porque
 * `@EnableMethodSecurity` está activo (`SecurityConfig.kt:17`)— y sigue el patrón que `CatalogController`
 * fijó para `/editor/` (`CatalogController.kt:22-25`, ADR-1R-B-10): sin él, una regla nueva en
 * `SecurityConfig` que abriera `/product/` + `**` dejaría esta ruta sin ninguna barrera.
 */
@RestController
@RequestMapping("/product/account")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class AccountHealthController {

    /** No consulta nada: responde con el nombre del subpaquete y `ok` (ver [ProductHealthResponse]). */
    @GetMapping("/health")
    fun health(): ProductHealthResponse = ProductHealthResponse.de(SUBPAQUETE)

    companion object {
        const val SUBPAQUETE = "account"
    }
}
