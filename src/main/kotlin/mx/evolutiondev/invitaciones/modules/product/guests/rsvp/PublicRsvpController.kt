package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET` y `PUT` de `/public/` + `r/{token}` — la superficie del invitado (contrato 5-2 §2).
 *
 * Es la página que abre una persona **sin cuenta** desde un enlace de WhatsApp, y por tanto la
 * superficie más expuesta del producto.
 *
 * ### Por qué esta clase NO lleva `@PreAuthorize`, y qué la protege en su lugar
 * Es la única ausencia deliberada del módulo, y conviene decirla con todas las letras porque en
 * `modules/product` todos los demás controladores sí la llevan.
 *
 * El invitado **no tiene sesión**: no hay cuenta, no hay JWT y no puede haberlos, porque el producto
 * no le va a pedir que se registre para decir si va a una boda. Cualquier `@PreAuthorize` aquí
 * devolvería `403` a todo el mundo y la ruta no serviría para nada. Por eso cuelga de `/public/`,
 * que `SecurityConfig.kt:38` declara `permitAll()`. Es la misma decisión, con el mismo prefijo, que
 * ya tomó `PublicRenderController` para el render de la invitación.
 *
 * Lo que sustituye a la autorización, entonces, es esto y solo esto:
 *
 * 1. **El token es la credencial.** 128 bits de entropía real de `SecureRandom`
 *    (`JwtUtil.kt:66-71`, hallazgo S-12): no se adivina.
 * 2. **La unión ES la comprobación de propiedad** (§0.3, razón 2). El puente resuelve invitado,
 *    invitación, `publicToken`, release activo y estado del anfitrión en una sola consulta con
 *    `JOIN` internos, así que no existe un cruce que alguien pueda olvidarse de hacer — que es
 *    exactamente el origen del hallazgo S-04 en la superficie heredada.
 * 3. **Una sola respuesta de fallo.** Seis motivos, un `404` idéntico byte a byte. Sin oráculo de
 *    enumeración.
 * 4. **Límite de intentos** por IP y por token, con ámbito propio y un `429` que tampoco distingue.
 * 5. **Respuesta mínima**: los cupos del invitado, su estado, un booleano de correo y el
 *    `publicToken` del evento. Nada de otros invitados, ninguna dirección, ningún
 *    `cancellationToken`.
 *
 * Hay una prueba —`PublicRsvpAnotacionesSeguridadTest`— que afirma que esta ausencia sigue siendo
 * deliberada, porque una anotación que aparece «por simetría» en un refactor rompería la ruta para
 * todos los invitados y ninguna prueba funcional lo notaría hasta producción.
 *
 * ### Errores
 * Nunca se capturan aquí. Van por [RsvpExceptionHandler], un `@RestControllerAdvice` acotado a este
 * subpaquete, con códigos tipados y mensajes fijos en es-MX.
 */
@RestController
@RequestMapping("/public/r")
class PublicRsvpController(private val servicio: PublicRsvpService) {

    /**
     * La ficha del invitado y lo mínimo del evento. Ver [PublicRsvpResponse] para el detalle de qué
     * sale y, sobre todo, de qué no sale.
     */
    @GetMapping("/{token}")
    fun consultar(@PathVariable token: String): PublicRsvpResponse = servicio.consultar(token)

    /**
     * Confirma (`attending: true`) o declina (`attending: false`), y admite cambiar de opinión en los
     * dos sentidos cuantas veces haga falta con el **mismo** token.
     *
     * `required = false` en el cuerpo es a propósito: sin él, un `PUT` sin cuerpo lo rechazaría
     * Spring antes de llegar al advice de este subpaquete y respondería con el cuerpo de la
     * plataforma, que con `server.error.include-message: always` (S-02) lleva texto interno dentro.
     * Con esto, el cuerpo ausente llega como `null` y sale por el mismo `422 GUEST_INVALID` que
     * cualquier otro cuerpo que no se pueda atender.
     */
    @PutMapping("/{token}")
    fun responder(
        @PathVariable token: String,
        @RequestBody(required = false) peticion: RsvpUpdateRequest?,
    ): PublicRsvpResponse = servicio.responder(token, peticion)
}
