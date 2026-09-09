package mx.evolutiondev.invitaciones.modules.product.account

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.auth.service.AmbitoIntentos
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Lo que una clienta puede hacer con **su propia** cuenta estando dentro (fase 5, E3;
 * `12-producto-completo.md §A2.1`).
 *
 * Las tres operaciones nacen de un hueco medido en el backend heredado:
 *
 * - **Cerrar sesión**: `grep -rni "logout"` sobre `src/main/kotlin` no devolvía nada. Los tokens de
 *   refresco solo se borraban al volver a entrar (`RefreshTokenService.kt:20-24`) o al deshabilitar
 *   la cuenta, así que un token robado vivía sus siete días pasara lo que pasara.
 * - **Cambiar la contraseña propia**: la única ruta era `PUT /admin/users/{id}/password/update`, que
 *   exige ADMIN o MASTER (`SecurityConfig.kt:42`) y que además **no pide la contraseña actual**
 *   (`AdminUsersService.kt:218-232`). Un `USER` no podía cambiar la suya.
 * - **Cambiar el correo de acceso**: `ProfileService.kt:44-52` lo cambiaba dentro del perfil, sin
 *   verificar el nuevo ni avisar al antiguo.
 *
 * Ninguna de las tres toca `SecurityConfig`: cuelgan de `/user/account/`, que ya está reservado a
 * USER/ADMIN/MASTER por prefijo (`SecurityConfig.kt:43`), y llevan además `@PreAuthorize` de clase
 * (ADR-1R-B-10) en [AccountController].
 */
@Service
class AccountService(
    private val customerRepository: CustomerRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val passwordEncoder: PasswordEncoder,
    private val authThrottleService: AuthThrottleService,
    private val emailService: EmailService,
    private val emailVerificationService: EmailVerificationService,
    private val jwtUtil: JwtUtil,
    private val mailProperties: ProductMailProperties,
    private val contactProperties: ProductContactProperties,
    @Value("\${producto.cuenta.verificacion-horas:24}") private val horasDeValidez: Long = 24,
) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * `POST /user/account/logout` — cierre de sesión **global**: borra todos los tokens de refresco de
     * quien llama, en todos sus dispositivos.
     *
     * Alcance honesto: el `accessToken` que ya está emitido sigue siendo válido hasta que caduque,
     * porque es un JWT firmado y la aplicación es `STATELESS` (`SecurityConfig.kt:31-32`); no hay
     * lista de revocación y montarla sería otro trabajo con otra ADR. Lo que esta ruta garantiza es
     * que **no se puede renovar**: cuando el `accessToken` caduque, se acabó.
     */
    fun cerrarSesion(userId: Long): GeneralMessageResponse {
        refreshTokenRepository.deleteAllByCustomerId(userId)
        return GeneralMessageResponse(message = MENSAJE_SESION_CERRADA)
    }

    /**
     * `PUT /user/account/password` — cambio de contraseña **con la actual**.
     *
     * Tres cosas que la ruta administrativa no hace y esta sí: exige la contraseña actual, pasa por
     * el límite de intentos en su ámbito propio ([AmbitoIntentos.CAMBIO_CUENTA]) y **cierra todas las
     * sesiones** al terminar. Lo último es el punto: cambiar la contraseña porque «creo que alguien
     * entró» no sirve de nada si el token de refresco del intruso sobrevive al cambio.
     */
    fun cambiarPassword(userId: Long, actual: String, nueva: String): GeneralMessageResponse {
        val customer = buscar(userId)
        authThrottleService.comprobar(AmbitoIntentos.CAMBIO_CUENTA, customer.email)

        if (!passwordEncoder.matches(actual, customer.password)) {
            authThrottleService.registrarIntento(AmbitoIntentos.CAMBIO_CUENTA, customer.email)
            throw AccountException(
                AccountErrorCode.CUENTA_PASSWORD_INCORRECTA,
                "Tu contraseña actual no coincide",
            )
        }

        refreshTokenRepository.deleteAllByCustomerId(customer.id)
        customer.password = passwordEncoder.encode(nueva)
        customerRepository.save(customer)
        authThrottleService.registrarExito(AmbitoIntentos.CAMBIO_CUENTA, customer.email)

        return GeneralMessageResponse(message = MENSAJE_PASSWORD_CAMBIADA)
    }

    /**
     * `POST /user/account/email` — pide el cambio del correo de acceso.
     *
     * Aquí **no se cambia nada todavía**: se guarda el correo nuevo como pendiente
     * (`customer.email_pending`), se acuña un token y se mandan dos correos —el enlace al buzón
     * **nuevo** y un aviso al **antiguo**, que es lo que faltaba en `ProfileService.kt:44-52`—. El
     * correo de acceso solo cambia cuando alguien abre el enlace (`POST /auth/verify-email`).
     *
     * **Respuesta genérica siempre**, incluso si la dirección está tomada: decir «ese correo ya
     * existe» aquí convertiría cualquier cuenta en un buscador de cuentas ajenas. La disponibilidad se
     * comprueba contra `findByEmailEvenIfDisabled` —las **deshabilitadas también**, porque el índice
     * único no distingue (`CustomerEntity.kt:23`)— y, si está ocupada, no se guarda pendiente ni se
     * manda nada; quien de verdad se equivocó de dirección no recibe el enlace y lo vuelve a pedir.
     */
    fun pedirCambioDeCorreo(userId: Long, nuevoCorreo: String, password: String): GeneralMessageResponse {
        val customer = buscar(userId)
        authThrottleService.comprobar(AmbitoIntentos.CAMBIO_CUENTA, customer.email)

        if (!passwordEncoder.matches(password, customer.password)) {
            authThrottleService.registrarIntento(AmbitoIntentos.CAMBIO_CUENTA, customer.email)
            throw AccountException(
                AccountErrorCode.CUENTA_PASSWORD_INCORRECTA,
                "Tu contraseña no coincide",
            )
        }

        val normalizado = nuevoCorreo.trim()
        val ocupado = customerRepository.findByEmailEvenIfDisabled(normalizado)
        val disponible = ocupado == null || ocupado.id == customer.id
        val esOtro = !normalizado.equals(customer.email, ignoreCase = true)

        if (disponible && esOtro) {
            val token = jwtUtil.generateSecureToken()
            customer.emailPending = normalizado
            customer.emailVerificationToken = token
            customer.emailVerificationExpiry = Instant.now().plusSeconds(horasDeValidez * 3600)
            customerRepository.save(customer)

            emailVerificationService.enviarCorreoDeVerificacion(customer.name, normalizado, token)
            avisarAlCorreoAnterior(customer, normalizado)
        }

        // Cuenta siempre, disponible o no: si solo contaran los intentos fallidos, el límite no
        // frenaría a quien vaya probando direcciones para ver cuáles existen.
        authThrottleService.registrarIntento(AmbitoIntentos.CAMBIO_CUENTA, customer.email)

        return GeneralMessageResponse(message = MENSAJE_CAMBIO_DE_CORREO)
    }

    /** El aviso al buzón que se está quedando atrás. Sin él, un cambio de correo es silencioso. */
    private fun avisarAlCorreoAnterior(customer: CustomerEntity, nuevoCorreo: String) {
        val anterior = customer.email
        coroutineScope.launch {
            emailService.sendEmail(
                to = anterior,
                templateName = PLANTILLA_AVISO_DE_CAMBIO,
                variables = mapOf(
                    "customerName" to customer.name,
                    "newEmail" to nuevoCorreo,
                    "companyName" to mailProperties.remitenteNombre,
                    "supportEmail" to contactProperties.soporte,
                ),
            )
        }
    }

    private fun buscar(userId: Long): CustomerEntity =
        customerRepository.findById(userId).orElseThrow {
            // No se filtra el id en el mensaje: quien llama ya sabe quién es, y el texto acaba en logs.
            AccountException(AccountErrorCode.CUENTA_TOKEN_INVALIDO, "No encontramos tu cuenta")
        }

    companion object {
        const val PLANTILLA_AVISO_DE_CAMBIO = "email-change-notice"

        const val MENSAJE_SESION_CERRADA = "Cerramos la sesión en todos tus dispositivos"

        const val MENSAJE_PASSWORD_CAMBIADA =
            "Tu contraseña se actualizó y cerramos las sesiones abiertas. Vuelve a iniciar sesión."

        /** Genérico a propósito: no dice si la dirección estaba disponible. */
        const val MENSAJE_CAMBIO_DE_CORREO =
            "Si la dirección está disponible, te enviamos un enlace para confirmarla. Tu correo de acceso no cambia hasta que la confirmes."
    }
}
