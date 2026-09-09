package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.modules.product.ProductHealthResponse
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /product/admin/health` — sonda de salud del subpaquete **`admin`**.
 *
 * **De quién es este subpaquete.** Lo escribe la sesión **E5** (administración del producto nuevo).
 *
 * **Qué NO va aquí.** Los tres subpaquetes de clienta (`account` E3, `guests` E2, `payments` E4). Y no
 * se toca `modules/admin`, que es el módulo administrativo **viejo**: convive sin mezclarse hasta la
 * fase 7. Por eso esta clase se llama `ProductAdminHealthController` y no `AdminHealthController`, para
 * que buscar por nombre no confunda los dos módulos.
 *
 * **Autorización.** Este subpaquete es el único que **restringe por rol**: `ADMIN` y `MASTER`, la misma
 * pareja que `SecurityConfig.kt:42` exige para `/admin/` + `**`. La ruta vive bajo `/product/`, que no
 * casa con `/admin/` + `**` y por tanto solo heredaría `anyRequest().authenticated()`
 * (`SecurityConfig.kt:47`): sin este `@PreAuthorize` una clienta con rol `USER` podría llamar a una
 * ruta administrativa. Es exactamente el hueco que ADR-1R-B-10 cerró para `/editor/`.
 */
@RestController
@RequestMapping("/product/admin")
@PreAuthorize("hasAnyRole('ADMIN','MASTER')")
class ProductAdminHealthController {

    /** No consulta nada: responde con el nombre del subpaquete y `ok` (ver [ProductHealthResponse]). */
    @GetMapping("/health")
    fun health(): ProductHealthResponse = ProductHealthResponse.de(SUBPAQUETE)

    companion object {
        const val SUBPAQUETE = "admin"
    }
}
