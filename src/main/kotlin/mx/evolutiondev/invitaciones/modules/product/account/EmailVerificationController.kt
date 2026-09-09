package mx.evolutiondev.invitaciones.modules.product.account

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import org.springframework.http.HttpStatus
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * Verificación del correo de acceso (fase 5, E3; `12-producto-completo.md §A2.1`, `ADR-5-E3-02`).
 *
 * **Por qué cuelga de `/auth/` y no de `/user/`**: quien abre el enlace del correo viene de su buzón,
 * normalmente en otro dispositivo y **sin sesión**. Una ruta autenticada obligaría a entrar antes de
 * verificar, que es justo lo que no se puede pedir a quien todavía no ha podido entrar. `/auth/` + `**`
 * es `permitAll` (`SecurityConfig.kt:37`), así que la ruta nace abierta y **no** hace falta tocar el
 * fichero compartido de seguridad. La barrera de estas dos rutas no es el rol: es el token de 128
 * bytes de `SecureRandom` en una y el límite de intentos en la otra.
 *
 * La clase vive en `modules/product/account` —territorio de E3— aunque su prefijo de ruta sea
 * `/auth/`: en Spring la ruta la fija el mapeo, no el paquete, y `modules/auth` no es territorio de
 * esta sesión.
 */
@RestController
@RequestMapping("/auth")
@Validated
class EmailVerificationController(
    private val emailVerificationService: EmailVerificationService,
) {

    /** Confirma el buzón (y aplica el cambio de correo pendiente, si lo había). */
    @PostMapping("/verify-email")
    @ResponseStatus(HttpStatus.OK)
    fun verificar(@Valid @RequestBody request: VerifyEmailRequest): GeneralMessageResponse =
        emailVerificationService.verificar(request.token)

    /**
     * Reenvía el enlace. La respuesta es **siempre la misma**, exista o no la cuenta
     * (`EmailVerificationService.MENSAJE_REENVIO`), y pasa por el límite de intentos.
     *
     * Los dos puntos del nombre son deliberados y no son un descuido: es la forma que ya usa
     * `templates2` para las acciones sobre un recurso (`MasterTemplateRegistryController.kt:91`,
     * `:deprecate`).
     */
    @PostMapping("/verify-email:resend")
    @ResponseStatus(HttpStatus.OK)
    fun reenviar(@Valid @RequestBody request: ResendVerificationRequest): GeneralMessageResponse =
        emailVerificationService.reenviar(request.email)
}
