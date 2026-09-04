package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.json.JsonMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.KotlinModule
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import java.security.MessageDigest

/**
 * **El único** `ObjectMapper` del módulo (`02 §8.1`), más las dos utilidades de hash canónico.
 *
 * `FAIL_ON_UNKNOWN_PROPERTIES` es P1 literal: el JSON de `templates2` procede de un esquema cerrado
 * (`z.strictObject` en todo `packages/schema/src`), así que una clave desconocida es un error de
 * contrato, no algo que descartar. El bean de Spring lo expone `Templates2JsonConfig`, **sin
 * `@Primary`**: cambiar el mapper de la aplicación activaría esa opción para el módulo antiguo, que
 * depende explícitamente de lo contrario (H-35).
 */
object Templates2Json {

    /** Construye un mapper nuevo con la configuración de `02 §8.1`. */
    fun buildMapper(): ObjectMapper = JsonMapper.builder()
        .addModule(KotlinModule.Builder().build())
        .addModule(JavaTimeModule())
        .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .serializationInclusion(JsonInclude.Include.NON_NULL)
        .build()

    /** Instancia compartida. Un `ObjectMapper` ya configurado es seguro entre hilos. */
    val mapper: ObjectMapper = buildMapper()

    /** Lee un árbol JSON. Un cuerpo no parseable es `TPL_MALFORMED_JSON`, nunca una excepción cruda. */
    fun readTree(texto: String): JsonNode =
        try {
            mapper.readTree(texto)
        } catch (e: com.fasterxml.jackson.core.JacksonException) {
            throw Templates2Exception.MalformedJson("JSON no parseable: " + e.originalMessage, cause = e)
        }

    /** JSON canónico de `01 §5.5`. */
    fun canonical(node: JsonNode): String = CanonicalJson.canonical(node)

    /** `"sha256:" + 64 hex` sobre el JSON canónico (nunca sobre los bytes de `jsonb`, ADR-1R-B-07). */
    fun sha256Canonical(node: JsonNode): String =
        "sha256:" + hex(sha256(canonical(node).toByteArray(Charsets.UTF_8)))

    internal fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    internal fun hex(bytes: ByteArray): String {
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            sb.append("0123456789abcdef"[v ushr 4])
            sb.append("0123456789abcdef"[v and 0x0F])
        }
        return sb.toString()
    }
}
