package mx.evolutiondev.invitaciones.modules.templates2.api

import jakarta.servlet.http.HttpServletRequest
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.MediaType
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.test.web.servlet.setup.StandaloneMockMvcBuilder

/**
 * `03 §8` y caso 23 de `03 §12`: el cuerpo se corta **por las dos vías** y el error lleva `code`.
 *
 * Las dos vías se prueban por separado a propósito. Comprobar solo `Content-Length` deja abierto el
 * caso real que motivó el filtro: un cliente que **miente** en la cabecera o que usa
 * `Transfer-Encoding: chunked`, donde no hay `Content-Length` que comprobar. La segunda vía se
 * ejercita con una petición cuyo `getContentLength()` devuelve `-1` aunque el cuerpo exista, que es
 * exactamente lo que ve el servlet en una petición troceada.
 */
class Templates2BodyLimitFilterTest {

    private val filtro = Templates2BodyLimitFilter(Templates2Json.mapper, DateFormatterImpl())

    // =============================================================================================
    // Vía 1: la cabecera
    // =============================================================================================

    @Test
    fun `un cuerpo de 800 KiB en operations se rechaza antes de deserializar`() {
        val leido = java.util.concurrent.atomic.AtomicBoolean(false)
        val respuesta = MockHttpServletResponse()
        filtro.doFilter(
            peticion("/editor/invitations/42/document/operations", ByteArray(800 * 1024) { 'x'.code.toByte() }),
            respuesta,
        ) { req, _ -> req.inputStream.readBytes(); leido.set(true) }

        assertEquals(413, respuesta.status)
        val cuerpo = Templates2Json.readTree(respuesta.contentAsString)
        assertEquals("TPL_BODY_TOO_LARGE", cuerpo["code"].asText())
        assertEquals(Templates2BodyLimitFilter.LIMITE_OPERACIONES, cuerpo["details"]["limit"].asInt())
        assertTrue(!leido.get(), "el cuerpo no debe llegar al controlador: el corte es antes de deserializar")
    }

    @Test
    fun `las demas rutas JSON del editor cortan en 8 KiB`() {
        val respuesta = MockHttpServletResponse()
        filtro.doFilter(
            peticion("/editor/invitations/42/document/restore", ByteArray(9 * 1024) { 'x'.code.toByte() }),
            respuesta,
        ) { _, _ -> }

        assertEquals(413, respuesta.status)
        assertEquals(
            Templates2BodyLimitFilter.LIMITE_JSON,
            Templates2Json.readTree(respuesta.contentAsString)["details"]["limit"].asInt(),
        )
    }

    @Test
    fun `un cuerpo dentro del limite pasa intacto`() {
        val respuesta = MockHttpServletResponse()
        val bytes = """{"baseRevision":1}""".toByteArray()
        var recibido: ByteArray? = null
        filtro.doFilter(peticion("/editor/invitations/42/document/restore", bytes), respuesta) { req, _ ->
            recibido = req.inputStream.readBytes()
        }
        assertEquals(200, respuesta.status)
        assertEquals(String(bytes), String(recibido!!))
    }

    // =============================================================================================
    // Vía 2: la lectura contada (cabecera ausente o mentirosa)
    // =============================================================================================

    @Test
    fun `sin Content-Length, el corte lo hace la lectura contada`() {
        val respuesta = MockHttpServletResponse()
        val peticion = peticionSinLongitud(
            "/editor/invitations/42/document/operations",
            ByteArray(800 * 1024) { 'x'.code.toByte() },
        )
        assertEquals(-1, peticion.contentLengthLong, "el arreglo debe simular una petición troceada")

        filtro.doFilter(peticion, respuesta) { req, _ -> req.inputStream.readBytes() }

        assertEquals(413, respuesta.status)
        assertEquals("TPL_BODY_TOO_LARGE", Templates2Json.readTree(respuesta.contentAsString)["code"].asText())
    }

    @Test
    fun `una cabecera que miente por defecto no salva al cuerpo grande`() {
        val respuesta = MockHttpServletResponse()
        // Declara 10 bytes y envía 9 KiB: la cabecera pasa la vía 1 y la vía 2 lo para.
        val peticion = peticionConLongitudFalsa("/editor/invitations/42/document/restore", 9 * 1024, 10)

        filtro.doFilter(peticion, respuesta) { req, _ -> req.inputStream.readBytes() }

        assertEquals(413, respuesta.status)
        assertEquals("TPL_BODY_TOO_LARGE", Templates2Json.readTree(respuesta.contentAsString)["code"].asText())
    }

    @Test
    fun `la lectura por getReader tambien esta contada`() {
        val respuesta = MockHttpServletResponse()
        val peticion = peticionSinLongitud(
            "/editor/invitations/42/document/restore",
            ByteArray(9 * 1024) { 'x'.code.toByte() },
        )
        filtro.doFilter(peticion, respuesta) { req, _ -> (req as HttpServletRequest).reader.readText(); Unit }
        assertEquals(413, respuesta.status)
    }

    @Test
    fun `la lectura byte a byte tambien cuenta`() {
        val respuesta = MockHttpServletResponse()
        val peticion = peticionSinLongitud(
            "/editor/invitations/42/document/restore",
            ByteArray(9 * 1024) { 'x'.code.toByte() },
        )
        filtro.doFilter(peticion, respuesta) { req, _ ->
            val entrada = req.inputStream
            // Un cliente que lee de uno en uno no puede saltarse el límite.
            while (entrada.read() != -1) Unit
        }
        assertEquals(413, respuesta.status)
    }

    // =============================================================================================
    // Lo que el filtro NO limita
    // =============================================================================================

    @Test
    fun `no toca el multipart de la ruta MASTER ni la subida binaria de assets`() {
        val multipart = MockHttpServletRequest("POST", "/master/templates2/versions").apply {
            contentType = MediaType.MULTIPART_FORM_DATA_VALUE
            setContent(ByteArray(100 * 1024))
        }
        val r1 = MockHttpServletResponse()
        filtro.doFilter(multipart, r1) { req, _ -> req.inputStream.readBytes() }
        assertEquals(200, r1.status, "el tope del multipart es el de application.yml, no los 8 KiB de este filtro")

        val assets = peticion("/editor/invitations/42/assets", ByteArray(100 * 1024))
        val r2 = MockHttpServletResponse()
        filtro.doFilter(assets, r2) { req, _ -> req.inputStream.readBytes() }
        assertEquals(200, r2.status, "el tope de un asset son 15 MiB y su código es TPL_ASSET_TOO_LARGE")
    }

    @Test
    fun `no toca las rutas de lectura ni las de fuera del modulo`() {
        val get = MockHttpServletRequest("GET", "/editor/invitations/42/document")
        val r1 = MockHttpServletResponse()
        filtro.doFilter(get, r1, MockFilterChain())
        assertEquals(200, r1.status)

        val ajena = MockHttpServletRequest("POST", "/user/invitations/42/config").apply {
            contentType = MediaType.APPLICATION_JSON_VALUE
            setContent(ByteArray(9 * 1024))
        }
        val r2 = MockHttpServletResponse()
        filtro.doFilter(ajena, r2) { req, _ -> req.inputStream.readBytes() }
        assertEquals(200, r2.status, "el filtro no puede alterar el comportamiento del módulo antiguo")
    }

    // =============================================================================================
    // El camino completo: filtro + controlador + advice
    // =============================================================================================

    /**
     * Cuando el aborto ocurre **dentro** del controlador —Jackson leyendo el cuerpo—, la señal viaja
     * envuelta en `HttpMessageNotReadableException`. Sin el reconocimiento por cadena de causas del
     * advice, ese caso saldría como `400 TPL_MALFORMED_JSON`: un cuerpo demasiado grande contado como
     * un cuerpo mal formado.
     */
    @Test
    fun `con el advice, el corte durante la deserializacion sigue siendo 413`() {
        val constructor = MockMvcBuilders.standaloneSetup(Templates2ErrorProbeController())
        constructor.setControllerAdvice(Templates2ExceptionHandler(DateFormatterImpl()))
        constructor.addFilter<StandaloneMockMvcBuilder>(filtro)
        val mvc: MockMvc = constructor.build()

        val grande = "{\"a\":\"" + "x".repeat(9 * 1024) + "\"}"
        val resultado = mvc.perform(
            post("/editor/invitations/42/sonda")
                .contentType(MediaType.APPLICATION_JSON)
                .content(grande),
        ).andReturn()

        assertEquals(413, resultado.response.status)
        assertEquals(
            "TPL_BODY_TOO_LARGE",
            Templates2Json.readTree(resultado.response.contentAsString)["code"].asText(),
        )
    }

    @Test
    fun `el filtro se registra solo sobre las rutas del modulo y tras la cadena de seguridad`() {
        val registro = Templates2BodyLimitFilterConfig().templates2BodyLimitFilterRegistration(filtro)
        assertEquals(setOf("/editor/*", "/master/templates2/*"), registro.urlPatterns)
        assertTrue(
            registro.order > org.springframework.boot.autoconfigure.security.SecurityProperties.DEFAULT_FILTER_ORDER,
            "debe ir DETRÁS de Spring Security para que un anónimo reciba 401 y no 413 (03 §9.1)",
        )
    }

    // =============================================================================================

    private fun peticion(ruta: String, cuerpo: ByteArray) =
        MockHttpServletRequest("POST", ruta).apply {
            contentType = MediaType.APPLICATION_JSON_VALUE
            setContent(cuerpo)
        }

    /**
     * `MockHttpServletRequest` deriva `getContentLength()` del contenido, así que hay que sobrescribirlo
     * para reproducir una petición troceada, que es donde la cabecera no existe.
     */
    private fun peticionSinLongitud(ruta: String, cuerpo: ByteArray) =
        object : MockHttpServletRequest("POST", ruta) {
            override fun getContentLength(): Int = -1
            override fun getContentLengthLong(): Long = -1
            override fun getHeader(name: String): String? =
                if (name.equals("Content-Length", ignoreCase = true)) null else super.getHeader(name)
        }.apply {
            contentType = MediaType.APPLICATION_JSON_VALUE
            setContent(cuerpo)
        }

    private fun peticionConLongitudFalsa(ruta: String, bytesReales: Int, declarados: Long) =
        object : MockHttpServletRequest("POST", ruta) {
            override fun getContentLength(): Int = declarados.toInt()
            override fun getContentLengthLong(): Long = declarados
        }.apply {
            contentType = MediaType.APPLICATION_JSON_VALUE
            setContent(ByteArray(bytesReales) { 'x'.code.toByte() })
        }

    @Test
    fun `un cuerpo vacio no dispara nada`() {
        val respuesta = MockHttpServletResponse()
        val vacia = MockHttpServletRequest("POST", "/editor/invitations/42/document/restore").apply {
            contentType = MediaType.APPLICATION_JSON_VALUE
        }
        filtro.doFilter(vacia, respuesta) { req, _ -> req.inputStream.readBytes() }
        assertEquals(200, respuesta.status)
        assertNull(respuesta.contentType)
    }
}
