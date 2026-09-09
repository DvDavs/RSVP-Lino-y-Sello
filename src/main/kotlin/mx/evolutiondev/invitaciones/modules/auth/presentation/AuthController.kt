package mx.evolutiondev.invitaciones.modules.auth.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.AuthRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.RefreshTokenRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.ResetPasswordRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.UpdatePasswordResetRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.RecoveryPasswordSentResponse
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.TokenResponse
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.auth.service.RefreshTokenService
import mx.evolutiondev.invitaciones.modules.auth.service.ResetPasswordService
import org.springframework.http.HttpStatus
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/auth")
@Validated
class AuthController(
        private val customerService: CustomerService,
        private val refreshTokenService: RefreshTokenService,
        private val resetPasswordService: ResetPasswordService,
        private val jwtUtil: JwtUtil
) {

    @PostMapping("/token")
    @ResponseStatus(HttpStatus.OK)
    fun attemptAuth(@Valid @RequestBody authRequest: AuthRequest): TokenResponse {
        val customer = customerService.validateUser(authRequest)
        val refreshToken = refreshTokenService.createOrUpdateRefreshToken(customer)
        return generateTokenResponse(customer, refreshToken)
    }

    @PostMapping("/token/refresh")
    @ResponseStatus(HttpStatus.OK)
    /**
     * Rotación en cada canje (`ADR-5-E3-01`): el token que llega se quema y la respuesta trae uno
     * nuevo. Mismos campos que antes; lo único que cambia es que el `refreshToken` del cuerpo ya no
     * es el que mandó el cliente.
     */
    fun attemptRefreshToken(@Valid @RequestBody refreshTokenRequest: RefreshTokenRequest): TokenResponse {
        val refreshToken = refreshTokenService.rotateRefreshToken(refreshTokenRequest.refreshToken)
        return generateTokenResponse(refreshToken.customer, refreshToken)
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.OK)
    fun attemptSignUp(@Valid @RequestBody userRequest: UserRequest): TokenResponse {
        val customer = customerService.signUp(userRequest)
        val refreshToken = refreshTokenService.createOrUpdateRefreshToken(customer)

        return generateTokenResponse(customer, refreshToken)
    }

    @PostMapping("/request-password-reset")
    @ResponseStatus(HttpStatus.OK)
    fun requestResetPassword(@Valid @RequestBody resetPasswordRequest: ResetPasswordRequest): RecoveryPasswordSentResponse {
        return resetPasswordService.generateResetToken(resetPasswordRequest.email)
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.OK)
    fun resetPassword(@Valid @RequestBody updatePasswordResetRequest: UpdatePasswordResetRequest): GeneralMessageResponse {
        return resetPasswordService.resetPassword(updatePasswordResetRequest)
    }

    private fun generateTokenResponse(customer: CustomerEntity, refreshToken: RefreshTokenEntity): TokenResponse {
        return TokenResponse(
                accessToken = jwtUtil.generateToken(customer.id, customer.email, customer.role.name),
                refreshToken = refreshToken.token,
                role = customer.role.name,
                isSurveyAnswered = customer.isSurveyAnswered
        )
    }
}