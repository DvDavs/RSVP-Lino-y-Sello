package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * La autorización de estas rutas depende de una anotación, y **una anotación que alguien borre en un
 * refactor no rompe ninguna prueba funcional**. Esta sí. Es el patrón de
 * `Templates2AnotacionesSeguridadTest.kt:24-40`, por el mismo motivo y con la misma forma.
 *
 * El prefijo `/product/` + `**` no casa con ninguna regla de `SecurityConfig.kt:36-47` y cae en
 * `anyRequest().authenticated()` (`:47`): sin el `@PreAuthorize` de clase, cualquier cuenta
 * autenticada de cualquier rol alcanzaría el panel de invitados (ADR-5-0C-01).
 */
class GuestPanelAnotacionesSeguridadTest {

    @Test
    fun `el panel de invitados exige uno de los tres roles reales a nivel de clase`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            GuestPanelController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "GuestPanelController debe llevar @PreAuthorize (ADR-5-0C-01)")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value)
    }

    @Test
    fun `la base de las rutas es la del contrato 5-2`() {
        assertEquals(
            listOf("/product/invitations/{invitationId}"),
            AnnotatedElementUtils.findMergedAnnotation(
                GuestPanelController::class.java, RequestMapping::class.java,
            )!!.value.toList(),
        )
    }

    /**
     * El advice **tiene** que estar acotado a este subpaquete: declara un handler de `Exception` y
     * sin `basePackages` se convertiría en el manejador de errores de toda la aplicación, incluido
     * el subpaquete hermano `…guests.rsvp`, que es de otra sesión y tiene su propio contrato.
     */
    @Test
    fun `el advice de errores esta acotado al subpaquete del panel`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            GuestPanelExceptionHandler::class.java, RestControllerAdvice::class.java,
        )
        assertNotNull(anotacion, "GuestPanelExceptionHandler debe llevar @RestControllerAdvice")
        assertEquals(
            listOf("mx.evolutiondev.invitaciones.modules.product.guests.panel"),
            anotacion!!.basePackages.toList(),
        )
    }

    /** Los códigos del contrato `5-2` §0.6, con el estado HTTP que ese contrato les asigna. */
    @Test
    fun `los codigos de error llevan el estado del contrato`() {
        assertEquals(404, GuestPanelErrorCode.GUEST_NOT_FOUND.httpStatus)
        assertEquals(422, GuestPanelErrorCode.GUEST_INVALID.httpStatus)
        assertEquals(409, GuestPanelErrorCode.GUEST_DUPLICATE.httpStatus)
        assertEquals(422, GuestPanelErrorCode.GUEST_QUOTA_EXCEEDED.httpStatus)
        assertEquals(404, GuestPanelErrorCode.INVITATION_NOT_FOUND.httpStatus)
    }
}
