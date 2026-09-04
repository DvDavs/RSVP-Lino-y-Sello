package mx.evolutiondev.invitaciones.modules.templates2.catalog

import org.slf4j.LoggerFactory
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.io.File

/**
 * Registro de una plantilla **desde la línea de comandos**, sin HTTP y sin token (P4: "en un paso, sin
 * reiniciar"). Recorre exactamente el mismo [TemplateRegistrationService] que
 * `POST /master/templates2/versions`: no es una segunda vía de alta, es el mismo camino con otro
 * transporte (`02 §4` cierre: "No existe una segunda vía de alta").
 *
 * **No se ejecuta en el arranque normal.** El bean solo existe si se pasa
 * `--templates2.register.enabled=true`; sin esa propiedad, `@ConditionalOnProperty` deja la aplicación
 * exactamente como estaba (probado en `TemplateRegisterCommandTest`).
 *
 * ```
 * ./gradlew bootRun --args="--templates2.register.enabled=true \
 *     --templates2.register.path=templates/boda-clasica/1.0.0"
 * java -jar app.jar --templates2.register.enabled=true \
 *     --templates2.register.path=/ruta/boda-clasica-1.0.0.zip --templates2.register.requester=7
 * ```
 *
 * `path` acepta el **directorio** `templates/<slug>/<version>/` de `01 §2.1` o un **ZIP** con ese
 * árbol. `requester` (opcional) es el `customer.id` que queda en `published_by`/`requested_by`.
 * El resultado se imprime y el proceso termina con código 0 (alta o no-op) o 1 (rechazo), para que un
 * script de despliegue pueda encadenarlo.
 */
@Component
@ConditionalOnProperty(name = [TemplateRegisterCommand.ENABLED], havingValue = "true")
class TemplateRegisterCommand(private val service: TemplateRegistrationService) : ApplicationRunner {

    private val log = LoggerFactory.getLogger(TemplateRegisterCommand::class.java)

    override fun run(args: ApplicationArguments) {
        val ruta = valor(args, PATH)
        if (ruta.isNullOrBlank()) {
            log.error(
                "templates2: falta --{}=<directorio templates/<slug>/<version>/ o .zip>. " +
                    "No se registró nada.", PATH,
            )
            return
        }
        val requester = valor(args, REQUESTER)?.toLongOrNull()
        val resultado = runCatching { registrar(File(ruta), requester) }
        resultado.onSuccess { salida ->
            log.info(
                "templates2: {} {}@{} (templateVersionId={}, packageHash={}, assets={})",
                salida.wire, salida.slug, salida.version, salida.templateVersionId,
                salida.packageHash, salida.assetsRegistered,
            )
        }.onFailure { e ->
            log.error("templates2: registro RECHAZADO desde \"{}\": {}", ruta, e.message)
        }
    }

    /** Expuesto para las pruebas y para cualquier arranque programático; no depende de Spring Boot. */
    fun registrar(origen: File, requesterId: Long? = null): TemplateRegistrationOutcome {
        val raw = if (origen.isDirectory) {
            TemplatePackageReader.fromDirectory(origen)
        } else {
            origen.inputStream().use { TemplatePackageReader.fromZip(it) }
        }
        return service.register(raw, requesterId)
    }

    private fun valor(args: ApplicationArguments, nombre: String): String? =
        args.getOptionValues(nombre)?.firstOrNull()

    companion object {
        const val ENABLED = "templates2.register.enabled"
        const val PATH = "templates2.register.path"
        const val REQUESTER = "templates2.register.requester"
    }
}
