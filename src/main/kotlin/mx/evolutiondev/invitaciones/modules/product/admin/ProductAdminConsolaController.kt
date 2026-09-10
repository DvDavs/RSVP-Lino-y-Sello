package mx.evolutiondev.invitaciones.modules.product.admin

import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * **Las seis rutas de lectura de la consola de administración del producto nuevo**
 * (`contrato-admin.md` §1, §2, §3, §5, §6, §7; pantalla en `12-producto-completo.md §B3.6`).
 *
 * §4 del contrato —deshabilitar y rehabilitar una invitación— **no está aquí y no se crea**: se
 * reutiliza tal cual `PUT /admin/invitations/{id}/toggle-status`
 * (`modules/admin/invitations/presentation/InvitationController.kt:127-140`), que ya comprueba
 * jerarquía en el servicio (`InvitationAdminService.kt:479-481`, dentro de `toggleInvitationStatus`,
 * `:471-487`; la cita anterior a `:461-463` apuntaba a `getInvitationById`, el método vecino — objeción
 * BAJA-1 de `5-E5-R2`, medida con `curl` en su §4). Decisión REUTILIZAR TAL CUAL de
 * `12-producto-completo.md §A2.5`.
 *
 * ### Autorización
 * `@PreAuthorize` **de clase**, igual que [ProductAdminHealthController] y que todo `templates2`
 * (ADR-1R-B-10). Es obligatorio y no decorativo: `/product/` + `**` no casa con ninguna regla de prefijo de
 * `core/auth/security/SecurityConfig.kt:36-47`, así que sin esta anotación caería en
 * `anyRequest().authenticated()` (`SecurityConfig.kt:47`) y **cualquier clienta con rol USER podría
 * leer las invitaciones y los pagos de todo el sistema**. `SecurityConfig.kt` no se toca: añadir un
 * prefijo al núcleo de seguridad para esto sería un cambio compartido por cuatro sesiones en paralelo.
 *
 * El `401` del anónimo lo produce `AuthEntryPointJwt` desde la cadena de filtros
 * (`SecurityConfig.kt:34`); el `403` del USER, `InvitationsAccessDeniedHandler` a partir del
 * `AccessDeniedException` que lanza esta anotación.
 *
 * ### Alcance
 * Cada método resuelve [AlcanceDeAdministracion] del `Authentication` y se lo pasa a la consulta. El
 * controlador **no filtra nada**: no puede, porque no ve las filas descartadas.
 *
 * ### Presentación
 * Ninguna (P3). Números, textos de la base e instantes ISO. Ni un color, ni una etiqueta de interfaz,
 * ni una fecha en formato local.
 */
@RestController
@RequestMapping("/product/admin")
@PreAuthorize("hasAnyRole('ADMIN','MASTER')")
class ProductAdminConsolaController(
    private val servicio: ConsolaDeAdministracionService,
) {

    /** §1 `GET /product/admin/metricas`. Cinco enteros. */
    @GetMapping("/metricas")
    fun metricas(authentication: Authentication): MetricasDeAdministracion =
        servicio.metricas(AlcanceDeAdministracion.de(authentication))

    /** §2 `GET /product/admin/clientas`. */
    @GetMapping("/clientas")
    fun clientas(
        @RequestParam(defaultValue = "0") pagina: Int,
        @RequestParam(defaultValue = "${ParametrosDeAdministracion.TAMANO_POR_DEFECTO}") tamano: Int,
        @RequestParam(required = false) buscar: String?,
        authentication: Authentication,
    ): PaginaDeClientas =
        servicio.clientas(AlcanceDeAdministracion.de(authentication), pagina, tamano, buscar)

    /**
     * §3 `GET /product/admin/invitaciones`.
     *
     * `plan` **es el id** del plan (`GET /product/admin/planes` lo devuelve junto al nombre), llega
     * como texto para poder responder `400` con cuerpo tanto si no es un número como si es un id que
     * no existe. Lo pide el wireframe de `12-producto-completo.md §B3.6`, que dibuja la barra de la
     * tabla como `[ Buscar ] [ Estado v ] [ Plan v ]`. Una invitación sin plan no casa con ningún
     * `plan=<id>`: ver [ParametrosDeAdministracion.planSolicitado].
     */
    @GetMapping("/invitaciones")
    fun invitaciones(
        @RequestParam(defaultValue = "0") pagina: Int,
        @RequestParam(defaultValue = "${ParametrosDeAdministracion.TAMANO_POR_DEFECTO}") tamano: Int,
        @RequestParam(required = false) buscar: String?,
        @RequestParam(required = false) estado: String?,
        @RequestParam(required = false) pago: String?,
        @RequestParam(required = false) plan: String?,
        authentication: Authentication,
    ): PaginaDeInvitaciones =
        servicio.invitaciones(AlcanceDeAdministracion.de(authentication), pagina, tamano, buscar, estado, pago, plan)

    /** §5 `GET /product/admin/pagos`. */
    @GetMapping("/pagos")
    fun pagos(
        @RequestParam(defaultValue = "0") pagina: Int,
        @RequestParam(defaultValue = "${ParametrosDeAdministracion.TAMANO_POR_DEFECTO}") tamano: Int,
        @RequestParam(required = false) estado: String?,
        authentication: Authentication,
    ): PaginaDePagos =
        servicio.pagos(AlcanceDeAdministracion.de(authentication), pagina, tamano, estado)

    /** §6 `GET /product/admin/planes`. */
    @GetMapping("/planes")
    fun planes(authentication: Authentication): CatalogoDePlanes =
        servicio.planes(AlcanceDeAdministracion.de(authentication))

    /** §7 `GET /product/admin/plantillas`. */
    @GetMapping("/plantillas")
    fun plantillas(authentication: Authentication): CatalogoDePlantillas =
        servicio.plantillas(AlcanceDeAdministracion.de(authentication))
}
