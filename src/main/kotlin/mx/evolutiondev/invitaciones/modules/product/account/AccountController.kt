package mx.evolutiondev.invitaciones.modules.product.account

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * La cuenta de quien ya está dentro (fase 5, E3; `12-producto-completo.md §A2.1`).
 *
 * **Dónde cuelga y por qué** (`ADR-5-E3-03`). Se eligió `/user/account/` frente a las otras dos
 * opciones que había sobre la mesa:
 *
 * - **`/auth/` + `**` (descartada)**: es `permitAll` (`SecurityConfig.kt:37`), así que estas tres
 *   rutas —que solo tienen sentido para quien ya entró— tendrían que leer y validar el token a mano
 *   dentro del controlador. Escribir autenticación a mano al lado de una cadena de filtros que ya la
 *   hace es la manera clásica de que las dos no digan lo mismo.
 * - **`/product/account/` + `**` (descartada)**: cae en `anyRequest().authenticated()`
 *   (`SecurityConfig.kt:47`), que es correcto pero acepta **cualquier** principal autenticado, sin
 *   distinguir rol. Sirve; simplemente da una garantía más floja que la de al lado.
 * - **`/user/account/` (elegida)**: `SecurityConfig.kt:43` ya reserva `/user/` + `**` a USER, ADMIN y
 *   MASTER. La ruta nace con el rol comprobado **sin tocar el fichero compartido de seguridad**, y
 *   queda pegada a `/user/profile`, que es donde el frontend ya busca las cosas de la clienta.
 *
 * El `@PreAuthorize` de clase es defensa en profundidad, el patrón de `CatalogController.kt:22-25`
 * (ADR-1R-B-10): si mañana alguien cambiara la regla de prefijo, la anotación seguiría siendo barrera.
 *
 * Ninguna de las tres rutas acepta un id ajeno: el sujeto es siempre `authentication.userId()`, como
 * en `ProfileController.kt:33`.
 */
@RestController
@RequestMapping("/user/account")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
@Validated
class AccountController(
    private val accountService: AccountService,
) {

    /** Cierre de sesión global: borra todos los tokens de refresco de quien llama. Sin cuerpo. */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.OK)
    fun cerrarSesion(authentication: Authentication): GeneralMessageResponse =
        accountService.cerrarSesion(authentication.userId())

    /** Cambio de contraseña propia: exige la actual y cierra todas las sesiones. */
    @PutMapping("/password")
    @ResponseStatus(HttpStatus.OK)
    fun cambiarPassword(
        authentication: Authentication,
        @Valid @RequestBody request: ChangePasswordRequest,
    ): GeneralMessageResponse = accountService.cambiarPassword(
        userId = authentication.userId(),
        actual = request.currentPassword,
        nueva = request.newPassword,
    )

    /**
     * Pide el cambio del correo de acceso. No cambia nada hasta que se confirma el enlace en
     * `POST /auth/verify-email`. Respuesta genérica siempre.
     */
    @PostMapping("/email")
    @ResponseStatus(HttpStatus.OK)
    fun pedirCambioDeCorreo(
        authentication: Authentication,
        @Valid @RequestBody request: ChangeEmailRequest,
    ): GeneralMessageResponse = accountService.pedirCambioDeCorreo(
        userId = authentication.userId(),
        nuevoCorreo = request.email,
        password = request.password,
    )
}
