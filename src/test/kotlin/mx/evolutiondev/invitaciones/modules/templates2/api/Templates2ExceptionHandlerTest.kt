package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.templates2.catalog.AssetStorageUnavailableException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.BreakingChangeNotMajorException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.PackageAssetMismatchException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.PackageTooLargeException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateVersionNotFoundException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.VersionHashMismatchException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.VersionLastPublishedException
import mx.evolutiondev.invitaciones.modules.templates2.composition.OperationError
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.fuera.SondaFueraDelModuloController
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import jakarta.validation.ConstraintViolationException
import org.springframework.core.MethodParameter
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.multipart.support.MissingServletRequestPartException
import software.amazon.awssdk.core.exception.SdkClientException
import java.io.File

/**
 * `03 §12` casos 37, 38 y 40, y la regla dura de ADR-016: **ninguna ruta de `templates2` devuelve un
 * error sin `code`, y ninguna cae en el manejador genérico del núcleo**.
 *
 * La prueba central es [todo_TplErrorCode_es_alcanzable_y_tiene_handler]: recorre el `enum` entero y
 * falla si algún código no se puede provocar desde una ruta del módulo o no sale con su HTTP. Un
 * código nuevo sin handler rompe esta prueba, que es exactamente lo que se busca.
 */
class Templates2ExceptionHandlerTest {

    private val sonda = Templates2ErrorProbeController()
    private val advice = Templates2ExceptionHandler(DateFormatterImpl())
    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(sonda)
        .setControllerAdvice(advice)
        .build()

    /** Lanza [e] desde la sonda y devuelve `(status, cuerpo)`. */
    private fun provocar(e: Throwable): Pair<Int, JsonNode> {
        sonda.lanzar = { throw e }
        val resultado = mvc.perform(get("/editor/invitations/1/sonda")).andReturn()
        sonda.lanzar = null
        val cuerpo = resultado.response.contentAsString
        assertTrue(cuerpo.isNotBlank(), "el error salió con cuerpo vacío: ${e::class.java.name}")
        return resultado.response.status to Templates2Json.readTree(cuerpo)
    }

    // =============================================================================================
    // Caso 38 de `03 §12` — todos los códigos, todos alcanzables
    // =============================================================================================

    /**
     * Una excepción por código. La tabla es exhaustiva **por construcción**: la prueba compara sus
     * claves con `TplErrorCode.entries` y falla si sobra o falta alguna, de modo que añadir un código
     * al `enum` sin darle handler ni forma de provocarlo rompe aquí.
     */
    private fun provocadores(): Map<TplErrorCode, () -> Unit> = mapOf(
        TplErrorCode.TPL_FORBIDDEN to { throw ForbiddenException("no") },
        TplErrorCode.TPL_NOT_MIGRATED to { throw NotMigratedException("no") },
        TplErrorCode.TPL_DOCUMENT_NOT_STARTED to { throw DocumentNotStartedException("no") },
        TplErrorCode.TPL_TEMPLATE_VERSION_NOT_FOUND to { throw TemplateVersionNotFoundException("no") },
        TplErrorCode.TPL_PLAN_TIER_INSUFFICIENT to { throw PlanTierInsufficientException("no") },
        TplErrorCode.TPL_MIGRATION_PLAN_MISSING to { throw MigrationPlanMissingException("no") },
        TplErrorCode.TPL_REVISION_CONFLICT to { throw RevisionConflictException("no") },
        TplErrorCode.TPL_OPERATION_INVALID to {
            throw OperationRejectedException.de(OperationError.OperationInvalid("setBlock", "x"), 0)
        },
        TplErrorCode.TPL_BLOCK_UNKNOWN to {
            throw OperationRejectedException.de(OperationError.BlockUnknown(BlockId("cover.title")), 0)
        },
        TplErrorCode.TPL_BLOCK_NOT_EDITABLE to {
            throw OperationRejectedException.de(
                OperationError.BlockNotEditable(BlockId("cover.date"), BlockSource.BUSINESS), 0,
            )
        },
        TplErrorCode.TPL_TEMP_ID_UNRESOLVED to { throw TempIdUnresolvedException("no") },
        TplErrorCode.TPL_TEMP_ID_DUPLICATE to { throw TempIdDuplicateException("no") },
        TplErrorCode.TPL_ASSET_NOT_OWNED to {
            throw OperationRejectedException.de(OperationError.AssetNotOwned(AssetId(ASSET)), 0)
        },
        TplErrorCode.TPL_ASSET_SPEC_MISMATCH to {
            throw OperationRejectedException.de(OperationError.AssetSpecMismatch(AssetId(ASSET), "aspect"), 0)
        },
        TplErrorCode.TPL_ASSET_NOT_FOUND to { throw AssetNotFoundException("no") },
        TplErrorCode.TPL_ASSET_IN_USE to { throw AssetInUseException("no") },
        TplErrorCode.TPL_ASSET_TOO_LARGE to { throw AssetTooLargeException("no") },
        TplErrorCode.TPL_ASSET_TYPE_UNSUPPORTED to { throw AssetTypeUnsupportedException("no") },
        TplErrorCode.TPL_ASSET_QUOTA_EXCEEDED to { throw AssetQuotaExceededException("no") },
        TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE to { throw AssetStorageUnavailableException("no") },
        TplErrorCode.TPL_DOCUMENT_TOO_LARGE to { throw DocumentTooLargeException("no") },
        TplErrorCode.TPL_EVENT_DATE_INVALID to { throw EventDateInvalidException("no") },
        TplErrorCode.TPL_BODY_TOO_LARGE to { throw PackageTooLargeException("no") },
        TplErrorCode.TPL_MALFORMED_JSON to { throw Templates2Exception.MalformedJson("no") },
        TplErrorCode.TPL_SNAPSHOT_NOT_FOUND to { throw SnapshotNotFoundException("no") },
        TplErrorCode.TPL_PUBLISH_BLOCKED_MISSING_REQUIRED to {
            throw PublishBlockedException(TplErrorCode.TPL_PUBLISH_BLOCKED_MISSING_REQUIRED, "no")
        },
        TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT to {
            throw PublishBlockedException(TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT, "no")
        },
        TplErrorCode.TPL_PUBLISH_BLOCKED_INVALID_VALUES to {
            throw PublishBlockedException(TplErrorCode.TPL_PUBLISH_BLOCKED_INVALID_VALUES, "no")
        },
        TplErrorCode.TPL_RELEASE_NOT_FOUND to { throw ReleaseNotFoundException("no") },
        TplErrorCode.TPL_INVITATION_UNAVAILABLE to { throw InvitationUnavailableException("no") },
        TplErrorCode.TPL_MANIFEST_INVALID to { throw Templates2Exception.ManifestInvalid("no") },
        TplErrorCode.TPL_PACKAGE_ASSET_MISMATCH to { throw PackageAssetMismatchException("no") },
        TplErrorCode.TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR to { throw BreakingChangeNotMajorException("no") },
        TplErrorCode.TPL_VERSION_HASH_MISMATCH to { throw VersionHashMismatchException("no") },
        TplErrorCode.TPL_VERSION_LAST_PUBLISHED to { throw VersionLastPublishedException("no") },
        // El único 500 posible del módulo, y lleva `code` igual que los demás (ADR-016).
        TplErrorCode.TPL_INTERNAL to { throw Templates2Exception.Internal("no") },
    )

    @Test
    fun `todo TplErrorCode es alcanzable y tiene handler`() {
        val provocadores = provocadores()
        val declarados = TplErrorCode.entries.toSet()

        assertEquals(
            emptySet<TplErrorCode>(), declarados - provocadores.keys,
            "hay códigos de TplErrorCode que ninguna excepción del módulo produce: sin handler o inalcanzables",
        )
        assertEquals(
            emptySet<TplErrorCode>(), provocadores.keys - declarados,
            "la tabla de esta prueba nombra códigos que ya no existen en TplErrorCode",
        )

        for ((codigo, lanzar) in provocadores) {
            sonda.lanzar = lanzar
            val resultado = mvc.perform(get("/editor/invitations/1/sonda")).andReturn()
            sonda.lanzar = null
            val cuerpo = Templates2Json.readTree(resultado.response.contentAsString)
            assertEquals(codigo.httpStatus, resultado.response.status, "HTTP de $codigo")
            assertEquals(codigo.name, cuerpo["code"].asText(), "code de $codigo")
            assertEquals(codigo.httpStatus, cuerpo["statusCode"].asInt(), "statusCode de $codigo")
            assertTrue(cuerpo.hasNonNull("message"), "$codigo sin message")
            assertTrue(cuerpo.hasNonNull("timestamp"), "$codigo sin timestamp")
        }
    }

    // =============================================================================================
    // Caso 37 de `03 §12` — paridad con la tabla de `03 §5`
    // =============================================================================================

    /**
     * La tabla de `03 §5` se lee **del documento de diseño real**, no de una copia: una copia se
     * desincroniza y la prueba dejaría de medir lo que dice medir. El archivo se localiza a partir de
     * `-Dtemplates2.ejemplos.dir`, que `build.gradle.kts` ya fija.
     */
    @Test
    fun `el enum coincide con la tabla de codigos de 03 5`() {
        val doc = documentoDeApi()
        val filas = Regex("""^\|\s*`(TPL_[A-Z_]+)`\s*\|\s*(\d{3})\s*\|""", RegexOption.MULTILINE)
            .findAll(doc.readText())
            .associate { it.groupValues[1] to it.groupValues[2].toInt() }

        assertTrue(filas.size >= TplErrorCode.entries.size, "la tabla de 03 §5 tiene menos filas que el enum")
        for (codigo in TplErrorCode.entries) {
            val http = filas[codigo.name]
            assertNotNull(http, "${codigo.name} no está en la tabla de 03 §5")
            assertEquals(http, codigo.httpStatus, "${codigo.name}: el HTTP del enum y el de la tabla difieren")
        }
        val sobrantes = filas.keys - TplErrorCode.entries.map { it.name }.toSet()
        assertEquals(emptySet<String>(), sobrantes, "la tabla de 03 §5 nombra códigos que el enum no declara")
    }

    private fun documentoDeApi(): File {
        val ejemplos = File(
            System.getProperty("templates2.ejemplos.dir")
                ?: error("falta -Dtemplates2.ejemplos.dir (lo fija tasks.test en build.gradle.kts)"),
        )
        val doc = File(ejemplos.parentFile, "03-api.md")
        assertTrue(doc.isFile, "no encuentro ${doc.absolutePath}")
        return doc
    }

    // =============================================================================================
    // Forma del cuerpo y handlers concretos de `03 §10.3`
    // =============================================================================================

    @Test
    fun `el cuerpo es el de 03 10-2 y lleva los details del error`() {
        val (status, cuerpo) = provocar(
            OperationRejectedException.de(
                OperationError.BlockNotEditable(BlockId("cover.date"), BlockSource.BUSINESS), 2,
            ),
        )
        assertEquals(422, status)
        assertEquals("TPL_BLOCK_NOT_EDITABLE", cuerpo["code"].asText())
        // `03 §10.2`: exactamente cinco campos, ni uno más.
        assertEquals(
            listOf("code", "details", "message", "statusCode", "timestamp"),
            cuerpo.fieldNames().asSequence().sorted().toList(),
        )
        assertEquals(2, cuerpo["details"]["operations"][0]["index"].asInt())
        assertEquals("business", cuerpo["details"]["operations"][0]["source"].asText())
        // Mismo formato de fecha que el resto del backend (`GeneralExceptionHandler.kt:34`).
        assertTrue(
            Regex("""^\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}$""").matches(cuerpo["timestamp"].asText()),
            "timestamp con otro formato: ${cuerpo["timestamp"].asText()}",
        )
    }

    @Test
    fun `sin details, el campo no aparece en vez de aparecer vacio`() {
        val (_, cuerpo) = provocar(ForbiddenException("no"))
        assertNull(cuerpo["details"], "details vacío debe omitirse, no viajar como {}")
    }

    @Test
    fun `un 500 no lleva traza en el cuerpo (caso 40 de 03 12)`() {
        sonda.lanzar = { throw RuntimeException("secreto interno: contraseña=x") }
        val resultado = mvc.perform(get("/editor/invitations/1/sonda")).andReturn()
        sonda.lanzar = null
        val texto = resultado.response.contentAsString
        assertEquals(500, resultado.response.status)
        val cuerpo = Templates2Json.readTree(texto)
        assertEquals("TPL_INTERNAL", cuerpo["code"].asText())
        assertFalse(texto.contains("secreto interno"), "el mensaje interno se filtró al cliente")
        assertFalse(texto.contains("java.lang.RuntimeException"), "la traza se filtró al cliente")
        assertFalse(texto.contains("at mx.evolutiondev"), "la traza se filtró al cliente")
    }

    @Test
    fun `un cuerpo ilegible es 400 TPL_MALFORMED_JSON sin filtrar el rootCause`() {
        val resultado = mvc.perform(
            post("/editor/invitations/1/sonda")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{ esto no es json "),
        ).andReturn()
        assertEquals(400, resultado.response.status)
        val cuerpo = Templates2Json.readTree(resultado.response.contentAsString)
        assertEquals("TPL_MALFORMED_JSON", cuerpo["code"].asText())
        assertFalse(
            resultado.response.contentAsString.contains("JsonParseException"),
            "GeneralExceptionHandler.kt:75-89 filtra el rootCause; este advice no debe hacerlo",
        )
    }

    @Test
    fun `un parametro mal tipado es 400, nunca 500`() {
        val resultado = mvc.perform(get("/editor/invitations/1/sonda/param").param("numero", "abc")).andReturn()
        assertEquals(400, resultado.response.status)
        assertEquals(
            "TPL_MALFORMED_JSON",
            Templates2Json.readTree(resultado.response.contentAsString)["code"].asText(),
        )
    }

    @Test
    fun `un parametro obligatorio ausente es 400, nunca 500`() {
        val resultado = mvc.perform(get("/editor/invitations/1/sonda/param")).andReturn()
        assertEquals(400, resultado.response.status)
        assertEquals(
            "TPL_MALFORMED_JSON",
            Templates2Json.readTree(resultado.response.contentAsString)["code"].asText(),
        )
    }

    @Test
    fun `la validacion de argumentos sale como 400 con el detalle por campo`() {
        val metodo = Templates2ErrorProbeController::class.java.getDeclaredMethod("post", Map::class.java)
        val enlace = BeanPropertyBindingResult(Any(), "cuerpo")
        enlace.addError(FieldError("cuerpo", "baseRevision", "debe ser un entero"))
        val (status, cuerpo) = provocar(MethodArgumentNotValidException(MethodParameter(metodo, 0), enlace))

        assertEquals(400, status)
        assertEquals("TPL_MALFORMED_JSON", cuerpo["code"].asText())
        assertEquals("baseRevision", cuerpo["details"]["fields"][0]["field"].asText())
    }

    @Test
    fun `una ConstraintViolationException tambien lleva codigo, no el 400 sin code del nucleo`() {
        val (status, cuerpo) = provocar(ConstraintViolationException("limit debe ser <= 100", emptySet()))
        assertEquals(400, status)
        assertEquals("TPL_MALFORMED_JSON", cuerpo["code"].asText())
    }

    @Test
    fun `los constraint de idempotencia se traducen, y lo desconocido es 500 con codigo`() {
        val casos = mapOf(
            "ux_tpl_document_snapshot_batch" to (409 to "TPL_REVISION_CONFLICT"),
            "ux_tpl_release_active_per_invitation" to (409 to "TPL_REVISION_CONFLICT"),
            "ux_tpl_asset_invitation_sha" to (409 to "TPL_REVISION_CONFLICT"),
            "uq_tpl_template_version" to (409 to "TPL_VERSION_HASH_MISMATCH"),
            "ck_tpl_document_doc_bytes" to (422 to "TPL_DOCUMENT_TOO_LARGE"),
            "una_constraint_que_nadie_previo" to (500 to "TPL_INTERNAL"),
        )
        for ((constraint, esperado) in casos) {
            val (status, cuerpo) = provocar(
                DataIntegrityViolationException(
                    "could not execute statement",
                    RuntimeException("ERROR: duplicate key value violates unique constraint \"$constraint\""),
                ),
            )
            assertEquals(esperado.first, status, constraint)
            assertEquals(esperado.second, cuerpo["code"].asText(), constraint)
        }
    }

    @Test
    fun `un fallo del SDK de AWS es 502, no un 500 opaco`() {
        val (status, cuerpo) = provocar(SdkClientException.builder().message("timeout").build())
        assertEquals(502, status)
        assertEquals("TPL_ASSET_STORAGE_UNAVAILABLE", cuerpo["code"].asText())
    }

    @Test
    fun `los errores de multipart de la ruta MASTER llevan su codigo`() {
        val (statusGrande, grande) = provocar(MaxUploadSizeExceededException(1024))
        assertEquals(413, statusGrande)
        assertEquals("TPL_ASSET_TOO_LARGE", grande["code"].asText())

        val (statusParte, parte) = provocar(MissingServletRequestPartException("template"))
        assertEquals(422, statusParte)
        assertEquals("TPL_MANIFEST_INVALID", parte["code"].asText())
        assertEquals("template", parte["details"]["part"].asText())
    }

    /**
     * `03 §10.1`: el acotado por paquete no es decorativo. Con un handler de `Exception` sin acotar,
     * este advice se habría convertido en el manejador de errores de toda la aplicación.
     */
    @Test
    fun `el advice no toca los errores de un controlador de otro paquete`() {
        val ajeno = MockMvcBuilders
            .standaloneSetup(SondaFueraDelModuloController())
            .setControllerAdvice(advice)
            .build()

        val resultado = runCatching { ajeno.perform(get("/ajena/recurso")).andReturn() }

        val cuerpo = resultado.getOrNull()?.response?.contentAsString.orEmpty()
        assertFalse(
            cuerpo.contains("TPL_"),
            "el advice de templates2 respondió a un controlador de fuera del módulo: $cuerpo",
        )
    }

    /**
     * `03 §10.4`: lo que Spring lanza **antes** de elegir controlador (ruta inexistente, método no
     * soportado) no llega a un advice acotado por `basePackages`, porque no hay tipo de controlador
     * contra el que evaluar el selector. Queda con el cuerpo de la plataforma, y este módulo no puede
     * —ni debe— cambiarlo.
     */
    @Test
    fun `una ruta inexistente no la responde este advice`() {
        val resultado = runCatching { mvc.perform(get("/editor/invitations/1/no-existe")).andReturn() }
        val cuerpo = resultado.getOrNull()?.response?.contentAsString.orEmpty()
        assertFalse(cuerpo.contains("TPL_"), "una ruta sin handler no puede llevar un código del módulo")
    }

    @Test
    fun `el advice esta acotado por paquete y con precedencia maxima`() {
        val anotacion = org.springframework.core.annotation.AnnotatedElementUtils.findMergedAnnotation(
            Templates2ExceptionHandler::class.java,
            org.springframework.web.bind.annotation.RestControllerAdvice::class.java,
        )
        assertNotNull(anotacion, "el advice debe declarar @RestControllerAdvice")
        assertEquals(
            listOf("mx.evolutiondev.invitaciones.modules.templates2.api"),
            anotacion!!.basePackages.toList(),
            "sin basePackages, el handler de Exception se tragaría los errores del módulo antiguo",
        )
        val orden = org.springframework.core.annotation.AnnotatedElementUtils.findMergedAnnotation(
            Templates2ExceptionHandler::class.java, org.springframework.core.annotation.Order::class.java,
        )
        assertNotNull(orden, "el advice debe declarar @Order")
        assertEquals(
            org.springframework.core.Ordered.HIGHEST_PRECEDENCE, orden!!.value,
            "los advices existentes quedan en LOWEST_PRECEDENCE; sin HIGHEST el nuestro no gana",
        )
    }

    companion object {
        private const val ASSET = "as_01J8ZQ2K3M4N5P6R7S8T9V0W1X"
    }
}
