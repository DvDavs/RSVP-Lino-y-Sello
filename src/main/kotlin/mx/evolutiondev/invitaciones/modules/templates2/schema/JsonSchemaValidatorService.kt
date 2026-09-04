package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.springframework.stereotype.Service

/**
 * Valida un `JsonNode` contra uno de los 11 esquemas del módulo y traduce cada `ValidationMessage` de
 * `com.networknt` a [Violation].
 *
 * El JSON Schema comprueba **forma**; las 30 invariantes comprueban lo que el esquema no puede
 * expresar ([Invariants]). Las dos capas se ejecutan siempre juntas: el esquema no ve `I-01`…`I-30` y
 * las invariantes no ven tipos ni patrones.
 */
@Service
class JsonSchemaValidatorService(private val registry: JsonSchemaRegistry) {

    /** Violaciones de forma, con la ruta de instancia que reporta la librería. Lista vacía = válido. */
    fun validate(nombreEsquema: String, node: JsonNode): List<Violation> =
        registry.schema(nombreEsquema).validate(node).map { m ->
            Violation.schema(m.type ?: "schema", m.instanceLocation.toString(), m.message)
        }.sortedWith(compareBy({ it.path }, { it.schemaCode }))

    fun isValid(nombreEsquema: String, node: JsonNode): Boolean = validate(nombreEsquema, node).isEmpty()

    /**
     * Valida o lanza con código tipado. `codigo` cambia según el punto de entrada: el registro de una
     * plantilla usa `TPL_MANIFEST_INVALID`, un cuerpo HTTP usa `TPL_MALFORMED_JSON` (`03 §5`).
     */
    fun requireValid(nombreEsquema: String, node: JsonNode, codigo: TplErrorCode = TplErrorCode.TPL_MANIFEST_INVALID) {
        val violaciones = validate(nombreEsquema, node)
        if (violaciones.isEmpty()) return
        val detalle = violaciones.map { mapOf("path" to it.path, "code" to it.schemaCode, "message" to it.detail) }
        val mensaje = "$nombreEsquema: ${violaciones.size} violaciones de esquema"
        throw when (codigo) {
            TplErrorCode.TPL_MALFORMED_JSON -> Templates2Exception.MalformedJson(mensaje, mapOf("violations" to detalle))
            else -> Templates2Exception.ManifestInvalid(mensaje, mapOf("violations" to detalle))
        }
    }
}
