package mx.evolutiondev.invitaciones.modules.templates2.fuera

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Sonda **fuera** de `templates2.api`, para comprobar el límite del advice.
 *
 * `Templates2ExceptionHandler` declara un handler de `Exception`. Si `basePackages` no acotara el
 * advice, ese handler se convertiría en el manejador de errores de **toda** la aplicación y los errores
 * del módulo antiguo empezarían a salir con `code: TPL_INTERNAL` — una regresión invisible en producción
 * y un incumplimiento directo de P10 ("no perturbar lo que ya funciona"). Este controlador vive en un
 * paquete que **no** casa con `basePackages` precisamente para que la prueba pueda demostrarlo.
 */
@RestController
@RequestMapping("/ajena/recurso")
class SondaFueraDelModuloController {

    @GetMapping
    fun explota(): String = throw IllegalArgumentException("un error del módulo antiguo")
}
