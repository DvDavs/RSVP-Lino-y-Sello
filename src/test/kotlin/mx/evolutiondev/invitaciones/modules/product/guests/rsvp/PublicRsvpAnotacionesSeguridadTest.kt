package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * **Por qué esta superficie es `permitAll` y qué la protege en su lugar** — escrito aquí, en una
 * prueba, y no solo en un documento, porque es la única decisión de autorización del módulo
 * `product` que consiste en **no** poner una anotación.
 *
 * `modules/product` tiene la regla de que todo controlador lleva `@PreAuthorize` de clase
 * (ADR-5-0C-01, parte C §2 punto 3), y con razón: `/product/` + `**` no casa con ninguna regla de
 * `SecurityConfig.kt:36-47` y cae en `anyRequest().authenticated()`, así que la anotación es la
 * única barrera de rol.
 *
 * [PublicRsvpController] es la excepción, y es una excepción **forzosa**: quien abre el enlace es un
 * invitado sin cuenta, sin JWT y sin ninguna posibilidad de tenerlos —el producto no le va a pedir
 * que se registre para decir si va a una boda—. Un `@PreAuthorize` aquí devolvería `403` a todos los
 * invitados del sistema, y ninguna prueba funcional del panel lo notaría. Por eso la ruta cuelga de
 * `/public/`, que `SecurityConfig.kt:38` declara `permitAll()`: es la misma decisión y el mismo
 * prefijo que ya tomó `PublicRenderController` para el render.
 *
 * Lo que hace de barrera, entonces, es esto, y por eso hay una prueba por cada punto:
 *
 * | En lugar de la autorización | Dónde se comprueba |
 * |---|---|
 * | El token como credencial: 128 bits de `SecureRandom` (`JwtUtil.kt:66-71`, S-12) | Fuera de esta sesión: el token ya se acuñaba bien |
 * | La unión ES la comprobación de propiedad (§0.3 razón 2), así que no hay cruce que olvidar (origen de S-04) | `RsvpPuenteSqlTest` |
 * | Una sola respuesta de fallo para los seis motivos (§0.5) | `PublicRsvpControllerTest`, `los seis motivos…` |
 * | Límite por IP y por token con `429` que tampoco distingue | `PublicRsvpControllerTest`, `el limitador…`; `RsvpThrottleServiceTest` |
 * | Respuesta mínima: ni correo, ni teléfono, ni `cancellationToken`, ni otros invitados | `PublicRsvpControllerTest`, `la respuesta no lleva…` |
 * | Ningún mensaje de excepción en el cuerpo, con `include-message: always` activo (S-02) | `PublicRsvpControllerTest`, `un rechazo del servicio compartido…` |
 *
 * Si alguien añade el `@PreAuthorize` «por simetría» con el resto del módulo, esta prueba falla y
 * dice por qué. Ese es exactamente su trabajo.
 */
class PublicRsvpAnotacionesSeguridadTest {

    @Test
    fun `el controlador del RSVP publico NO lleva PreAuthorize, y es deliberado`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            PublicRsvpController::class.java, PreAuthorize::class.java,
        )
        assertNull(
            anotacion,
            "El invitado no tiene sesion: un @PreAuthorize aqui devolveria 403 a todos los invitados. " +
                "La ruta cuelga de /public/ (permitAll, SecurityConfig.kt:38) y lo que la protege es el " +
                "token de 128 bits, la union del puente, el 404 uniforme y el limitador. Ver el KDoc de " +
                "esta clase antes de anadir la anotacion.",
        )
    }

    @Test
    fun `los metodos tampoco llevan PreAuthorize`() {
        PublicRsvpController::class.java.declaredMethods.forEach { metodo ->
            assertNull(
                AnnotatedElementUtils.findMergedAnnotation(metodo, PreAuthorize::class.java),
                "El metodo ${metodo.name} no puede exigir rol: quien lo llama no tiene cuenta.",
            )
        }
    }

    /**
     * El prefijo **es** la decisión de seguridad: `/public/` es lo único que hace `permitAll` a esta
     * ruta (`SecurityConfig.kt:38`). Cambiarlo por `/product/` la dejaría en
     * `anyRequest().authenticated()` (`SecurityConfig.kt:47`) y todos los invitados verían `401`.
     */
    @Test
    fun `la ruta cuelga del prefijo publico, que es lo que la hace alcanzable sin sesion`() {
        val mapeo = AnnotatedElementUtils.findMergedAnnotation(
            PublicRsvpController::class.java, RequestMapping::class.java,
        )
        assertNotNull(mapeo, "PublicRsvpController debe declarar su @RequestMapping de clase")
        assertEquals(listOf("/public/r"), mapeo!!.value.toList())
    }

    /**
     * El advice acotado a este subpaquete es lo que impide que `server.error.include-message: always`
     * (S-02) convierta cada excepción en un oráculo. Sin el acotado, además, su handler de
     * `Exception` se volvería el manejador de errores de toda la aplicación.
     */
    @Test
    fun `el advice de errores esta acotado a este subpaquete`() {
        val advice = AnnotatedElementUtils.findMergedAnnotation(
            RsvpExceptionHandler::class.java, RestControllerAdvice::class.java,
        )
        assertNotNull(advice, "RsvpExceptionHandler debe ser un @RestControllerAdvice")
        assertEquals(
            listOf("mx.evolutiondev.invitaciones.modules.product.guests.rsvp"),
            advice!!.basePackages.toList(),
        )
    }

    /**
     * Los textos que ve el invitado son constantes de [RsvpException], no se componen con nada de la
     * petición y no llevan ningún dato personal. Se afirma sobre las instancias reales.
     */
    @Test
    fun `ningun mensaje de error lleva datos de nadie ni detalle interno`() {
        val errores = listOf(
            RsvpException.LinkNotFound(),
            RsvpException.Closed(),
            RsvpException.TooManyAttempts(),
            RsvpException.Invalid(),
            RsvpException.QuotaExceeded(),
            RsvpException.Internal(),
        )
        errores.forEach { e ->
            assertTrue(e.publicMessage.isNotBlank(), "${e.code} debe tener texto para el invitado")
            listOf("@", "token", "Token", "SQL", "Exception", "null").forEach { prohibido ->
                assertTrue(
                    !e.publicMessage.contains(prohibido),
                    "el mensaje de ${e.code} no puede contener \"$prohibido\": ${e.publicMessage}",
                )
            }
        }
        assertEquals("Este enlace ya no funciona", RsvpException.LinkNotFound().publicMessage)
    }
}
