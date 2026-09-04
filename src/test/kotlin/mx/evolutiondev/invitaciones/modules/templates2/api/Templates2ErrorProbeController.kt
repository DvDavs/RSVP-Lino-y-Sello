package mx.evolutiondev.invitaciones.modules.templates2.api

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Controlador de prueba que lanza lo que se le diga, **desde el paquete real**
 * `mx.evolutiondev.invitaciones.modules.templates2.api`.
 *
 * El paquete importa: `Templates2ExceptionHandler` está acotado con
 * `@RestControllerAdvice(basePackages = ["…templates2.api"])`, así que una sonda declarada en cualquier
 * otro paquete **no** sería atendida por él y la prueba mediría otra cosa. Es el caso 38 de `03 §12`
 * ("lanza cada excepción desde un controlador de prueba") tomado al pie de la letra.
 */
@RestController
@RequestMapping("/editor/invitations/{invitationId}/sonda")
class Templates2ErrorProbeController {

    /** Lo que este controlador lanzará en la siguiente petición. */
    @Volatile
    var lanzar: (() -> Unit)? = null

    @GetMapping
    fun get(): Map<String, String> {
        lanzar?.invoke()
        return mapOf("ok" to "true")
    }

    /** Ruta con cuerpo, para ejercitar el cuerpo ilegible y el límite de tamaño. */
    @PostMapping
    fun post(@RequestBody cuerpo: Map<String, Any?>): Map<String, Any?> {
        lanzar?.invoke()
        return cuerpo
    }

    /** Ruta con parámetro obligatorio, para el `400` de un parámetro ausente o mal tipado. */
    @GetMapping("/param")
    fun param(@RequestParam numero: Long): Map<String, Long> = mapOf("numero" to numero)
}
