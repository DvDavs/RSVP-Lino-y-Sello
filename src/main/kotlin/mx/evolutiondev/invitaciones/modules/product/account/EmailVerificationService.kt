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
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * Verificación del correo de acceso (fase 5, E3; `12-producto-completo.md §A2.1` y §A6.4,
 * `ADR-5-E3-02`).
 *
 * **No hay infraestructura nueva**: el envío ya funciona y se usa en el alta
 * (`CustomerService.kt:139-148`), el token es el mismo `JwtUtil.generateSecureToken()` de 128 bytes
 * de `SecureRandom` que respalda la recuperación (`JwtUtil.kt:59-64`), el patrón «token + caducidad en
 * la fila del cliente» ya existía (`CustomerEntity.kt:39-40`) y el límite de intentos solo necesitaba
 * un ámbito propio (`AmbitoIntentos.VERIFICACION`).
 *
 * **La URL se construye con `app.frontend.url`**, como hace `ResetPasswordService.kt:82` y **nunca**
 * escrita en el código, que es el fallo S-08 de `EmailGuestNotifier.kt:68`.
 *
 * **Hoy la verificación no bloquea nada**: el alta sigue devolviendo sesión iniciada (§A2.1). Lo único
 * que cambia es que la cuenta nace marcada y la pantalla `/perfil` lo enseña.
 */
@Service
class EmailVerificationService(
    private val customerRepository: CustomerRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val emailService: EmailService,
    private val authThrottleService: AuthThrottleService,
    private val jwtUtil: JwtUtil,
    private val mailProperties: ProductMailProperties,
    @Value("\${app.frontend.url}") private val frontendUrl: String,
    /**
     * Ventana del token, en horas. 24 h y no los 15 min de la recuperación: aquí no se está tomando
     * el control de una cuenta, se está confirmando un buzón, y un enlace que caduca mientras la
     * persona come es un enlace que acaba en soporte.
     *
     * Va por `@Value` con valor por defecto porque `application.yml` lo está editando otra sesión;
     * queda **pedida** al orquestador como `producto.cuenta.verificacion-horas`.
     */
    @Value("\${producto.cuenta.verificacion-horas:24}") private val horasDeValidez: Long = 24,
) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Marca la cuenta como **no verificada** y le acuña un token. No guarda: lo hace quien la esté
     * dando de alta, en su propio `save` (`CustomerService.signUp`), para no escribir dos veces la
     * misma fila.
     */
    fun prepararVerificacionDeAlta(customer: CustomerEntity): String {
        val token = jwtUtil.generateSecureToken()
        customer.emailVerified = false
        customer.emailVerificationToken = token
        customer.emailVerificationExpiry = Instant.now().plusSeconds(horasDeValidez * 3600)
        return token
    }

    /** Manda el correo de verificación. Como todos los envíos del backend, no se espera (§A6.1). */
    fun enviarCorreoDeVerificacion(nombre: String, destino: String, token: String) {
        coroutineScope.launch {
            emailService.sendEmail(
                to = destino,
                templateName = PLANTILLA_VERIFICACION,
                variables = mapOf(
                    "customerName" to nombre,
                    "verificationUrl" to urlDeVerificacion(token),
                    "companyName" to mailProperties.remitenteNombre,
                ),
            )
        }
    }

    /**
     * `POST /auth/verify-email`. Confirma el buzón y, si había un cambio de correo pendiente, lo
     * aplica: es el mismo token para los dos casos, porque los dos prueban exactamente lo mismo
     * —que quien abre el enlace lee ese buzón—.
     *
     * Cuando el cambio se aplica se **cierran todas las sesiones**: el correo de acceso acaba de
     * cambiar y una sesión abierta con el anterior no debe sobrevivir al cambio.
     */
    fun verificar(token: String): GeneralMessageResponse {
        val customer = customerRepository.findByEmailVerificationToken(token)
            ?: throw AccountException(
                AccountErrorCode.CUENTA_TOKEN_INVALIDO,
                "El enlace de verificación no es válido o ya se usó. Pide uno nuevo.",
            )

        if (customer.emailVerificationExpiry?.isBefore(Instant.now()) != false) {
            // R1-06: al caducar el token se **borra también el cambio de correo pendiente**. Antes solo
            // caducaba el token y `email_pending` se quedaba escrito para siempre, así que una petición
            // abandonada (`ana@gmial.com`, un dedazo) seguía siendo una oferta de toma de cuenta viva:
            // bastaba con volver a armarla. El pendiente y el token nacen juntos
            // (`AccountService.pedirCambioDeCorreo`), así que mueren juntos.
            limpiarVerificacionCaducada(customer)
            throw AccountException(
                AccountErrorCode.CUENTA_TOKEN_CADUCADO,
                "El enlace de verificación caducó. Pide uno nuevo.",
            )
        }

        val pendiente = customer.emailPending
        var cambioDeCorreo = false
        if (!pendiente.isNullOrBlank() && !pendiente.equals(customer.email, ignoreCase = true)) {
            // Se vuelve a comprobar la disponibilidad AQUÍ y contra las cuentas deshabilitadas
            // también: el índice único de `customer.email` (`V1__initial_schema.sql:1605`) no
            // distingue entre habilitadas y deshabilitadas, y sin esta comprobación el choque saldría
            // como un 500 (el defecto que §A2.1 describe en `ProfileService.kt:37-42`).
            val ocupado = customerRepository.findByEmailEvenIfDisabled(pendiente)
            if (ocupado != null && ocupado.id != customer.id) {
                throw AccountException(
                    AccountErrorCode.CUENTA_CORREO_NO_DISPONIBLE,
                    "Ese correo ya no está disponible. Pide el cambio otra vez con otro.",
                )
            }
            customer.email = pendiente
            cambioDeCorreo = true
        }

        customer.emailPending = null
        customer.emailVerified = true
        customer.emailVerificationToken = null
        customer.emailVerificationExpiry = null

        if (cambioDeCorreo) {
            refreshTokenRepository.deleteAllByCustomerId(customer.id)
        }
        // R1-08: la comprobación de disponibilidad de arriba no es atómica —`email_pending` no tiene
        // unicidad (`V41:13-14`)— así que dos confirmaciones simultáneas del mismo correo pasan las dos
        // y una revienta contra el índice único de `customer.email`. Esa
        // `DataIntegrityViolationException` se captura AQUÍ y se convierte en el error de dominio que
        // ya existe para ese caso. Si se dejara escapar, saldría por el manejo genérico y, con
        // `include-message: always` (S-02), el cuerpo podía llevar el nombre de la restricción y el
        // valor en conflicto: **el correo de la otra clienta**.
        try {
            customerRepository.save(customer)
        } catch (e: DataIntegrityViolationException) {
            throw AccountException(
                AccountErrorCode.CUENTA_CORREO_NO_DISPONIBLE,
                "Ese correo ya no está disponible. Pide el cambio otra vez con otro.",
            )
        }

        return GeneralMessageResponse(
            message = if (cambioDeCorreo) MENSAJE_CORREO_CAMBIADO else MENSAJE_VERIFICADO,
        )
    }

    /**
     * `POST /auth/verify-email:resend`. **Respuesta genérica siempre**, igual que
     * `request-password-reset` (`ResetPasswordService.kt:52-53`): exista o no la cuenta, esté o no
     * verificada, el cuerpo es el mismo. Cualquier variante por caso volvería a enumerar cuentas.
     *
     * Pasa por [AmbitoIntentos.VERIFICACION] **antes** de tocar la base: sin ese límite, esta ruta es
     * un amplificador de correo —una petición sin autenticar, un correo enviado— sobre un canal SMTP
     * de cuenta gratuita (§A6.4, tercera condición).
     */
    fun reenviar(email: String): GeneralMessageResponse {
        authThrottleService.comprobar(AmbitoIntentos.VERIFICACION, email)

        val customer = customerRepository.findByEmail(email)
        if (customer != null) {
            val limpiado = limpiarVerificacionCaducada(customer)

            // R1-06. **El reenvío ya no re-arma un cambio de correo pendiente.** Antes, cualquiera —sin
            // autenticarse— llamaba a esta ruta con el correo ACTUAL de la víctima, se acuñaba un token
            // nuevo y se mandaba **al buzón pendiente**; quien acabara controlando esa dirección se
            // quedaba con la cuenta. Rearmar un cambio de correo exige probar quién eres, y eso solo lo
            // hace `POST /user/account/email`, que pide la contraseña.
            //
            // Con un pendiente vivo esta ruta no hace nada en absoluto: tampoco manda el enlace al buzón
            // de acceso, porque ese enlace **aplicaría el cambio pendiente** al abrirlo
            // (`verificar`, arriba) y entonces el enlace no probaría la posesión del buzón nuevo, que es
            // justo lo que tiene que probar. Cuando el pendiente caduca, `limpiarVerificacionCaducada`
            // lo borra y el reenvío vuelve a funcionar.
            val hayCambioPendiente = !customer.emailPending.isNullOrBlank()
            val hayQueMandar = !customer.emailVerified && !hayCambioPendiente

            // R1-14. El cubo por cuenta se indexa por el correo recibido, así que rotar la dirección en
            // cada intento lo esquiva: con una lista de correos reales sin verificar, una petición por
            // dirección es un correo por dirección. Este presupuesto **por IP y por ventana** cuenta los
            // envíos que de verdad salen, no las peticiones, así que la rotación deja de amplificar.
            // Se agota **en silencio**: la respuesta es la misma de siempre. Si el agotamiento
            // respondiera `429` sería un oráculo nuevo —solo se agotaría con direcciones reales— y
            // habríamos cambiado una fuga por otra.
            if (hayQueMandar && authThrottleService.consumirEnvio(AmbitoIntentos.VERIFICACION)) {
                val token = jwtUtil.generateSecureToken()
                customer.emailVerificationToken = token
                customer.emailVerificationExpiry = Instant.now().plusSeconds(horasDeValidez * 3600)
                customerRepository.save(customer)
                enviarCorreoDeVerificacion(customer.name, customer.email, token)
            } else if (limpiado) {
                customerRepository.save(customer)
            }
        }

        // Cuenta SIEMPRE: si solo contaran los correos inexistentes, el límite se esquivaría pidiendo
        // el reenvío de una cuenta real (misma lógica que `ResetPasswordService.kt:88-91`).
        authThrottleService.registrarIntento(AmbitoIntentos.VERIFICACION, email)

        return GeneralMessageResponse(message = MENSAJE_REENVIO)
    }

    /**
     * Borra la verificación en curso —token, caducidad **y cambio de correo pendiente**— cuando la
     * ventana ya pasó (R1-06). No guarda: devuelve `true` si tocó algo, y guarda quien la llame.
     *
     * Por qué el pendiente cae con el token: los dos se escriben en el mismo `save`
     * (`AccountService.pedirCambioDeCorreo`) con la misma caducidad, así que un pendiente cuyo token
     * caducó es un pendiente que ya nadie puede confirmar. Dejarlo escrito solo servía para que lo
     * re-armara un tercero.
     */
    private fun limpiarVerificacionCaducada(customer: CustomerEntity): Boolean {
        val caducidad = customer.emailVerificationExpiry ?: return false
        if (!caducidad.isBefore(Instant.now())) return false
        val habiaAlgo = customer.emailPending != null || customer.emailVerificationToken != null
        customer.emailPending = null
        customer.emailVerificationToken = null
        customer.emailVerificationExpiry = null
        return habiaAlgo
    }

    /** El enlace del correo, siempre desde `app.frontend.url`. Nunca escrito en el código (S-08). */
    fun urlDeVerificacion(token: String): String = "$frontendUrl/verificar-correo?token=$token"

    companion object {
        const val PLANTILLA_VERIFICACION = "email-verification"

        /**
         * Respuesta ÚNICA del reenvío. Redactada para ser cierta en los cuatro casos posibles: cuenta
         * inexistente, cuenta ya verificada, cuenta sin verificar y cambio de correo pendiente.
         */
        const val MENSAJE_REENVIO =
            "Si el correo corresponde a una cuenta sin verificar, te enviamos un enlace de verificación"

        const val MENSAJE_VERIFICADO = "Tu correo quedó verificado"

        const val MENSAJE_CORREO_CAMBIADO =
            "Tu correo quedó verificado y es el nuevo correo de acceso. Vuelve a iniciar sesión."
    }
}
