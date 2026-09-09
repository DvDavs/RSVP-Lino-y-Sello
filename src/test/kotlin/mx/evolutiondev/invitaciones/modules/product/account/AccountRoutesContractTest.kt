package mx.evolutiondev.invitaciones.modules.product.account

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.http.MediaType
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * Contrato HTTP de las rutas de cuenta (`handoffs/5-E3-A2-contrato-cuenta.md`).
 *
 * Se afirma sobre el **JSON serializado**, no sobre tipos de Kotlin, porque es el JSON lo que consume
 * la pantalla `/perfil`: si mañana alguien renombra un `code` o cambia el estado, esta clase cae.
 *
 * Estilo de `CatalogControllerTest.kt:28-32` y `RequestPasswordResetContractTest.kt:58-61`:
 * `standaloneSetup` con el advice real enganchado, sin contexto de Spring y sin base de datos.
 */
class AccountRoutesContractTest {

    private val verificacion: EmailVerificationService = mock()
    private val cuentas: AccountService = mock()

    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(
            EmailVerificationController(verificacion),
            AccountController(cuentas),
        )
        .setControllerAdvice(ProductAccountExceptionHandler(DateFormatterImpl()))
        .build()

    @Test
    @DisplayName("verify-email responde 200 con el mensaje del servicio")
    fun verificarFeliz() {
        whenever(verificacion.verificar("token-bueno"))
            .thenReturn(GeneralMessageResponse(EmailVerificationService.MENSAJE_VERIFICADO))

        mvc.perform(
            post("/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"token":"token-bueno"}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value(EmailVerificationService.MENSAJE_VERIFICADO))
    }

    @Test
    @DisplayName("un token caducado sale con el code estable CUENTA_TOKEN_CADUCADO y 400")
    fun tokenCaducado() {
        whenever(verificacion.verificar(any()))
            .thenThrow(AccountException(AccountErrorCode.CUENTA_TOKEN_CADUCADO, "caducó"))

        mvc.perform(
            post("/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"token":"token-viejo"}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("CUENTA_TOKEN_CADUCADO"))
            .andExpect(jsonPath("$.statusCode").value(400))
    }

    @Test
    @DisplayName("un cuerpo sin token sale como CUENTA_DATOS_INVALIDOS, no como 500")
    fun cuerpoInvalido() {
        mvc.perform(
            post("/auth/verify-email")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"token":""}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("CUENTA_DATOS_INVALIDOS"))
    }

    @Test
    @DisplayName("el reenvio responde 200 y el MISMO mensaje generico")
    fun reenvioGenerico() {
        whenever(verificacion.reenviar(any()))
            .thenReturn(GeneralMessageResponse(EmailVerificationService.MENSAJE_REENVIO))

        mvc.perform(
            post("/auth/verify-email:resend")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"nadie@ejemplo.mx"}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.message").value(EmailVerificationService.MENSAJE_REENVIO))
            .andExpect(jsonPath("$.*", org.hamcrest.Matchers.hasSize<Any>(1)))
    }

    @Test
    @DisplayName("las rutas de cuenta exigen rol por anotacion, no solo por prefijo")
    fun laAnotacionEsLaBarrera() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            AccountController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "AccountController debe llevar @PreAuthorize (ADR-1R-B-10)")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value)
    }

    /**
     * Las dos rutas de verificación **no** llevan `@PreAuthorize` a propósito: cuelgan de `/auth/`, que
     * es `permitAll` (`SecurityConfig.kt:37`), porque quien abre el enlace del correo no tiene sesión.
     * Si alguien la añadiera «por si acaso», la verificación dejaría de funcionar para quien más la
     * necesita, así que también se afirma la ausencia.
     */
    @Test
    @DisplayName("la verificacion de correo NO exige sesion")
    fun laVerificacionEsPublica() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            EmailVerificationController::class.java, PreAuthorize::class.java,
        )
        assertEquals(null, anotacion, "verify-email tiene que seguir siendo pública")
    }
}
