package mx.evolutiondev.invitaciones.modules.templates2.api

import jakarta.validation.ConstraintViolationException
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistryException
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.multipart.support.MissingServletRequestPartException
import software.amazon.awssdk.core.exception.SdkException

/**
 * El **único** traductor de errores de `templates2` (`03 §10.1`, ADR-016 enmendada por ADR-1R-B-13).
 *
 * Tres decisiones, cada una con su motivo verificado en el código real:
 *
 * 1. **Advice propio, no ampliación del existente.** `core/error/GeneralExceptionHandler` es una clase
 *    del núcleo (`GeneralExceptionHandler.kt:26-29`) con 15 handlers del módulo antiguo; extenderla o
 *    modificarla es tocar el núcleo, que el contrato prohíbe.
 * 2. **`basePackages` acotado a `templates2.api`.** Este advice declara un handler de `Exception`, así
 *    que sin el acotado se habría convertido en el manejador de errores de **toda** la aplicación. Con
 *    él es imposible que altere el comportamiento del módulo antiguo.
 * 3. **`@Order(HIGHEST_PRECEDENCE)`.** Los dos advices existentes (`GeneralExceptionHandler`,
 *    `InternalExceptionHandler`) **no declaran orden** y quedan por tanto en `LOWEST_PRECEDENCE`. Sin
 *    este `@Order`, una `IllegalArgumentException` —o cualquier excepción que ambos declaren— podría
 *    resolverse allí, sin `code`, que es exactamente el patrón de H-14 (objeción A-11).
 *
 * **Lo que este advice NO puede capturar** (`03 §10.4`, límite real, no omisión):
 * - Nada de la cadena de filtros de Spring Security. El `401` por token ausente o inválido lo escribe
 *   `AuthEntryPointJwt` (`SecurityConfig.kt:34`) o `JwtTokenFilter.sendErrorResponse`
 *   (`JwtTokenFilter.kt:44,49,54`), y el `403` por rol lo escribe `InvitationsAccessDeniedHandler`
 *   (`SecurityConfig.kt:35`). Sus cuerpos son los de la plataforma y **no llevan `TPL_*`**. Ninguna
 *   prueba de este módulo debe esperar `TPL_FORBIDDEN` ahí (`03 §9.1`, nota).
 * - Las excepciones que Spring lanza **antes** de elegir un controlador (ruta inexistente, método no
 *   soportado): un advice acotado por `basePackages` no es aplicable cuando no hay `handlerMethod` que
 *   confrontar con el selector, así que esas siguen respondiendo con el cuerpo de la plataforma.
 * - `Templates2BodyLimitFilter` cuando aborta antes del controlador; por eso ese filtro escribe él
 *   mismo el cuerpo de `03 §10.2` con `TPL_BODY_TOO_LARGE`.
 *
 * **Regla dura (ADR-016): ninguna ruta de `templates2` devuelve un `500` sin `code`.** El handler final
 * de `Exception` lo garantiza, registrando la traza en el servidor y **nunca** en la respuesta.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.templates2.api"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class Templates2ExceptionHandler(private val dateFormatter: DateFormatter) {

    private val log = LoggerFactory.getLogger(Templates2ExceptionHandler::class.java)

    // =============================================================================================
    // 1-3. Las tres jerarquías tipadas del módulo (`03 §10.3` punto 1)
    // =============================================================================================

    /** Excepciones del editor y de los assets (2-4 y 2-5): rutas 2-16. */
    @ExceptionHandler(EditorException::class)
    fun editor(e: EditorException): ResponseEntity<TplErrorResponse> =
        respuesta(e.code, e.message.orEmpty(), e.details, e)

    /**
     * Excepciones del registro y del catálogo (2-3): rutas 1 y 17-19. Jerarquía paralela y no
     * subclase de `Templates2Exception` por ADR-2-3-01 (`sealed class` en un paquete congelado); para
     * este advice son indistinguibles, que es justo lo que aquella decisión perseguía.
     */
    @ExceptionHandler(TemplateRegistryException::class)
    fun registro(e: TemplateRegistryException): ResponseEntity<TplErrorResponse> =
        respuesta(e.code, e.message.orEmpty(), e.details, e)

    /** Raíz sellada del dominio: `MalformedJson` 400, `ManifestInvalid` 422, `Internal` 500. */
    @ExceptionHandler(Templates2Exception::class)
    fun dominio(e: Templates2Exception): ResponseEntity<TplErrorResponse> =
        respuesta(e.code, e.message.orEmpty(), e.details, e)

    // =============================================================================================
    // 4. Cuerpo ilegible  ·  y el 413 que llega disfrazado de cuerpo ilegible
    // =============================================================================================

    /**
     * `400 TPL_MALFORMED_JSON` (`03 §10.3` punto 2). **Necesario**: sin él lo capturaría
     * `GeneralExceptionHandler.kt:75-89`, que además **filtra el `rootCause` al cliente** — una fuga de
     * detalle interno que el módulo nuevo no quiere.
     *
     * La excepción tapa además un caso que no es un cuerpo malformado: cuando
     * [Templates2BodyLimitFilter] aborta la lectura **mientras Jackson deserializa**, su señal viaja
     * como causa y el error real es `413 TPL_BODY_TOO_LARGE`. Se distingue por la cadena de causas, no
     * por el mensaje.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun ilegible(e: HttpMessageNotReadableException): ResponseEntity<TplErrorResponse> {
        cuerpoDemasiadoGrande(e)?.let { return demasiadoGrande(it) }
        return respuesta(
            TplErrorCode.TPL_MALFORMED_JSON,
            "el cuerpo de la petición no es JSON válido para esta ruta",
            emptyMap(),
            e,
        )
    }

    /** El mismo `413` cuando la señal del filtro llega sin envolver (`03 §8`). */
    @ExceptionHandler(Templates2BodyLimitFilter.BodyTooLargeException::class)
    fun cuerpoGrande(e: Templates2BodyLimitFilter.BodyTooLargeException): ResponseEntity<TplErrorResponse> =
        demasiadoGrande(e)

    private fun cuerpoDemasiadoGrande(e: Throwable): Templates2BodyLimitFilter.BodyTooLargeException? {
        var causa: Throwable? = e
        var saltos = 0
        while (causa != null && saltos < MAX_CAUSAS) {
            if (causa is Templates2BodyLimitFilter.BodyTooLargeException) return causa
            causa = causa.cause
            saltos++
        }
        return null
    }

    private fun demasiadoGrande(e: Templates2BodyLimitFilter.BodyTooLargeException) = respuesta(
        TplErrorCode.TPL_BODY_TOO_LARGE,
        "el cuerpo de la petición supera el límite de ${e.limit} B de esta ruta",
        mapOf("limit" to e.limit),
        e,
    )

    // =============================================================================================
    // 5-6. Validación de argumentos (`03 §10.3` puntos 3 y 6)
    // =============================================================================================

    /**
     * `400 TPL_MALFORMED_JSON` con `details.fields`. Sin este handler lo capturaría
     * `InternalExceptionHandler` (`core/error/InternalExceptionHandler.kt:278-298`), **sin `code`**.
     */
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun argumentosInvalidos(e: MethodArgumentNotValidException): ResponseEntity<TplErrorResponse> {
        val campos = e.bindingResult.fieldErrors.map {
            mapOf("field" to it.field, "message" to it.defaultMessage)
        }
        return respuesta(
            TplErrorCode.TPL_MALFORMED_JSON,
            "la petición no cumple el contrato de esta ruta",
            mapOf("fields" to campos),
            e,
        )
    }

    @ExceptionHandler(ConstraintViolationException::class)
    fun violaciones(e: ConstraintViolationException): ResponseEntity<TplErrorResponse> {
        val campos = e.constraintViolations.map {
            mapOf("field" to it.propertyPath.toString(), "message" to it.message)
        }
        return respuesta(
            TplErrorCode.TPL_MALFORMED_JSON,
            "la petición no cumple el contrato de esta ruta",
            mapOf("fields" to campos),
            e,
        )
    }

    /**
     * Extensión declarada sobre la lista cerrada de `03 §10.3` (ADR-2-5-02): un `invitationId` que no
     * es un número (`/editor/invitations/abc/document`) es un error **del cliente** y sin este handler
     * caería en el de `Exception`, devolviendo `500 TPL_INTERNAL` por una petición mal formada. Un
     * `500` evitable es exactamente lo que ADR-016 prohíbe.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun tipoInvalido(e: MethodArgumentTypeMismatchException): ResponseEntity<TplErrorResponse> = respuesta(
        TplErrorCode.TPL_MALFORMED_JSON,
        "el parámetro \"${e.name}\" no tiene el tipo que esta ruta espera",
        mapOf("param" to e.name),
        e,
    )

    /** Misma razón que el anterior: un parámetro obligatorio ausente es `400`, nunca `500`. */
    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun parametroAusente(e: MissingServletRequestParameterException): ResponseEntity<TplErrorResponse> = respuesta(
        TplErrorCode.TPL_MALFORMED_JSON,
        "falta el parámetro obligatorio \"${e.parameterName}\"",
        mapOf("param" to e.parameterName),
        e,
    )

    // =============================================================================================
    // 7-8. Multipart: solo la ruta 17 (`03 §10.3` puntos 4 y 5)
    // =============================================================================================

    /** `413 TPL_ASSET_TOO_LARGE`: el asset de un paquete supera `spring.servlet.multipart.max-file-size`. */
    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun subidaGrande(e: MaxUploadSizeExceededException): ResponseEntity<TplErrorResponse> = respuesta(
        TplErrorCode.TPL_ASSET_TOO_LARGE,
        "el archivo supera el tamaño máximo aceptado",
        mapOf("maxUploadSize" to e.maxUploadSize),
        e,
    )

    /** `422 TPL_MANIFEST_INVALID`: paquete incompleto (falta `template`, `theme` o `defaults`). */
    @ExceptionHandler(MissingServletRequestPartException::class)
    fun parteAusente(e: MissingServletRequestPartException): ResponseEntity<TplErrorResponse> = respuesta(
        TplErrorCode.TPL_MANIFEST_INVALID,
        "al paquete le falta la parte \"${e.requestPartName}\"",
        mapOf("part" to e.requestPartName),
        e,
    )

    // =============================================================================================
    // 9. Integridad referencial: traducción por nombre de constraint (`03 §10.3` punto 7)
    // =============================================================================================

    /**
     * Los índices únicos del módulo **son** contrato, no accidentes, y un `500` genérico los borraría a
     * todos. La traducción es **por nombre de constraint**, nunca por el texto del mensaje:
     *
     * - **Carreras entre dos peticiones simultáneas** (`ux_tpl_document_snapshot_batch`,
     *   `uq_tpl_document_snapshot`, `ux_tpl_release_active_per_invitation`, los tres únicos de
     *   `tpl_asset`) → `409 TPL_REVISION_CONFLICT`, que es exactamente "tu estado base ya no vale,
     *   relee y reintenta". El caso **normal** de cada una —el reintento tras un timeout— lo resuelven
     *   antes los servicios leyendo lo que la primera petición ya escribió (`03 §3.4` punto 6,
     *   `02 §10.1` paso 5); aquí solo queda la carrera real, y su respuesta nunca es un `500`
     *   (aviso 1 de `handoffs/2-4.md`).
     * - `uq_tpl_template_version` / `uq_tpl_template_slug` → `409 TPL_VERSION_HASH_MISMATCH`: mismo
     *   `slug@version` con otro contenido, que es lo que mata H-09.
     * - `ck_tpl_document_doc_bytes` → `422 TPL_DOCUMENT_TOO_LARGE`.
     * - Cualquier otra, o ninguna reconocible → `500 TPL_INTERNAL` **con traza en el servidor**: una
     *   violación de integridad no prevista es un fallo del servidor, y disfrazarla de 4xx sería
     *   mentirle al cliente sobre quién tiene el problema.
     */
    @ExceptionHandler(DataIntegrityViolationException::class)
    fun integridad(e: DataIntegrityViolationException): ResponseEntity<TplErrorResponse> {
        val constraint = nombreDeConstraint(e)
        val codigo = when {
            constraint == null -> TplErrorCode.TPL_INTERNAL
            CONSTRAINTS_REINTENTO.any { constraint.contains(it) } -> TplErrorCode.TPL_REVISION_CONFLICT
            CONSTRAINTS_VERSION.any { constraint.contains(it) } -> TplErrorCode.TPL_VERSION_HASH_MISMATCH
            constraint.contains(CONSTRAINT_DOC_BYTES) -> TplErrorCode.TPL_DOCUMENT_TOO_LARGE
            else -> TplErrorCode.TPL_INTERNAL
        }
        if (codigo == TplErrorCode.TPL_INTERNAL) {
            log.error("templates2: violación de integridad no prevista (constraint={})", constraint, e)
        }
        return respuesta(
            codigo,
            mensajeDeIntegridad(codigo),
            if (constraint != null) mapOf("constraint" to constraint) else emptyMap(),
            e,
            registrar = false,
        )
    }

    private fun mensajeDeIntegridad(codigo: TplErrorCode): String = when (codigo) {
        TplErrorCode.TPL_REVISION_CONFLICT ->
            "otra petición escribió sobre el mismo recurso al mismo tiempo; vuelve a intentarlo"
        TplErrorCode.TPL_VERSION_HASH_MISMATCH ->
            "ya existe una versión registrada con ese identificador y otro contenido"
        TplErrorCode.TPL_DOCUMENT_TOO_LARGE -> "el documento resultante supera el tamaño máximo"
        else -> "la operación no se pudo completar"
    }

    /** El nombre real lo trae el `SQLException` de Postgres, no el mensaje de Spring. */
    private fun nombreDeConstraint(e: DataIntegrityViolationException): String? {
        var causa: Throwable? = e
        var saltos = 0
        while (causa != null && saltos < MAX_CAUSAS) {
            val texto = causa.message
            if (texto != null) {
                CONSTRAINTS_CONOCIDAS.firstOrNull { texto.contains(it) }?.let { return it }
            }
            causa = causa.cause
            saltos++
        }
        return null
    }

    // =============================================================================================
    // 10. S3 (`03 §10.3` punto 8)
    // =============================================================================================

    /**
     * `502 TPL_ASSET_STORAGE_UNAVAILABLE`: S3 no responde o rechaza. Es la red de seguridad — las
     * puertas de S3 del módulo (`TemplateAssetStorage`, `InvitationAssetStorage`) ya traducen sus
     * fallos —, y existe para que **ninguna** ruta acabe devolviendo un `500` opaco por una caída de
     * almacenamiento, que es un problema de infraestructura y no un fallo de la petición (A-16).
     */
    @ExceptionHandler(SdkException::class)
    fun s3(e: SdkException): ResponseEntity<TplErrorResponse> {
        log.error("templates2: el SDK de AWS falló", e)
        return respuesta(
            TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE,
            "el almacenamiento de archivos no está disponible",
            emptyMap(),
            e,
            registrar = false,
        )
    }

    // =============================================================================================
    // 11. Último recurso (`03 §10.3` punto 9)
    // =============================================================================================

    /**
     * `500 TPL_INTERNAL`, **con traza en el log del servidor y sin traza en la respuesta**. Es lo que
     * garantiza la regla dura de ADR-016: ninguna ruta del módulo devuelve un `500` sin `code`.
     */
    @ExceptionHandler(Exception::class)
    fun cualquiera(e: Exception): ResponseEntity<TplErrorResponse> {
        log.error("templates2: excepción no prevista en una ruta del módulo", e)
        return respuesta(
            TplErrorCode.TPL_INTERNAL,
            "error interno del servidor",
            emptyMap(),
            e,
            registrar = false,
        )
    }

    // =============================================================================================

    private fun respuesta(
        code: TplErrorCode,
        message: String,
        details: Map<String, Any?>,
        e: Throwable,
        registrar: Boolean = true,
    ): ResponseEntity<TplErrorResponse> {
        if (registrar) {
            if (code.httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR.value()) {
                log.error("templates2: {} ({})", code.name, message, e)
            } else {
                log.debug("templates2: {} ({})", code.name, message)
            }
        }
        val cuerpo = TplErrorResponse.de(
            code = code,
            message = message,
            timestamp = dateFormatter.parseCurrentDate(TplErrorResponse.PATRON_FECHA),
            details = details,
        )
        return ResponseEntity.status(code.httpStatus).body(cuerpo)
    }

    companion object {
        private const val MAX_CAUSAS = 12

        const val CONSTRAINT_DOC_BYTES = "ck_tpl_document_doc_bytes"

        /**
         * Carreras que el cliente resuelve reintentando (`03 §10.3` punto 7). Las tres de `tpl_asset`
         * entran aquí porque una subida simultánea del mismo archivo tiene la misma cura que un
         * `baseRevision` viejo: releer y repetir, que además devuelve entonces el asset existente
         * (`02 §10.1` paso 5).
         */
        val CONSTRAINTS_REINTENTO = listOf(
            "ux_tpl_document_snapshot_batch",
            "uq_tpl_document_snapshot",
            "ux_tpl_release_active_per_invitation",
            "uq_tpl_document_invitation",
            "ux_tpl_asset_invitation_sha",
            "ux_tpl_asset_version_sha",
            "uq_tpl_asset_public_id",
            "uq_tpl_asset_key",
        )

        /** Mismo `slug@version` con otro contenido (mata H-09). */
        val CONSTRAINTS_VERSION = listOf("uq_tpl_template_version", "uq_tpl_template_slug")

        val CONSTRAINTS_CONOCIDAS: List<String> =
            CONSTRAINTS_REINTENTO + CONSTRAINTS_VERSION + CONSTRAINT_DOC_BYTES
    }
}
