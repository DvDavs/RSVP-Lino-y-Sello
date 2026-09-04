package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.annotation.JsonInclude
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode

/**
 * Cuerpo **único** de cualquier `4xx`/`5xx` de `templates2` (`03 §10.2`, ADR-016 enmendada por
 * ADR-1R-B-13).
 *
 * **Por qué no se reutiliza `core/error/model/ErrorMessage`** (objeción A-12 / B-10, verificado):
 * `ErrorMessage` tiene exactamente cuatro campos —`timestamp`, `statusCode`, `errorsListed`,
 * `errors` (`core/error/model/ErrorMessage.kt:3-8`)— y **no tiene `code`**. El contrato de este módulo
 * se apoya en un código tipado por error (`03 §5`), así que prometer `code` dentro de `ErrorMessage`
 * era imposible sin modificar una clase del núcleo, que este módulo no puede tocar.
 *
 * La forma es deliberadamente **compatible** con la del núcleo en sus dos primeros campos
 * (`timestamp` con el mismo patrón `dd/MM/yyyy HH:mm:ss` del `DateFormatter` existente y `statusCode`),
 * para no introducir un segundo formato de fecha ni una forma ajena en la API.
 *
 * `details` es un mapa libre pero **no arbitrario**: cada código de `03 §5` documenta qué lleva
 * (`operations`, `source`, `constraint`, `currentRevision`, `violations`, `diff`, …). Nunca lleva
 * trazas ni mensajes internos: el `500` se registra **con** traza en el servidor y **sin** traza en la
 * respuesta (`03 §10.3` punto 9).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class TplErrorResponse(
    val timestamp: String,
    val statusCode: Int,
    val code: String,
    val message: String,
    val details: Map<String, Any?>? = null,
) {

    companion object {

        /** Patrón del resto del backend (`GeneralExceptionHandler.kt:34`); no se introduce otro. */
        const val PATRON_FECHA = "dd/MM/yyyy HH:mm:ss"

        fun de(
            code: TplErrorCode,
            message: String,
            timestamp: String,
            details: Map<String, Any?> = emptyMap(),
        ): TplErrorResponse = TplErrorResponse(
            timestamp = timestamp,
            statusCode = code.httpStatus,
            code = code.name,
            message = message,
            details = details.ifEmpty { null },
        )
    }
}
