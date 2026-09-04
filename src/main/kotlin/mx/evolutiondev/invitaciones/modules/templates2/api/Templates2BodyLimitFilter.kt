package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.autoconfigure.security.SecurityProperties
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader

/**
 * Límite de cuerpo de las rutas JSON del módulo (`03 §8`, ADR-032 enmendada por ADR-1R-B-14):
 * **768 KiB** en `POST …/document/operations` y **8 KiB** en el resto.
 *
 * **Por qué hace falta un filtro propio** (objeción A-10, verificado): Spring MVC **no tiene** ningún
 * ajuste que limite un cuerpo `application/json`. `server.tomcat.max-http-form-post-size` solo afecta a
 * `application/x-www-form-urlencoded` y `spring.servlet.multipart.*` solo a multipart; para un JSON no
 * hay límite de plataforma. Sin este filtro, H-45 ("acepta cualquier JSON") seguiría vivo en el módulo
 * nuevo.
 *
 * **Dos vías, porque una sola no basta.** `Content-Length` se comprueba primero y evita leer un solo
 * byte del cuerpo; pero un cliente puede mentir en esa cabecera o usar `Transfer-Encoding: chunked`, y
 * entonces no hay `Content-Length` que comprobar. Por eso el `InputStream` se envuelve además en uno
 * **contado** que aborta en cuanto se rebasa el tope. Las dos vías están probadas.
 *
 * **El filtro escribe él mismo el cuerpo de error** (`03 §10.4`): un `@RestControllerAdvice` no ve
 * nada de lo que lanza la cadena de filtros, así que lanzar aquí una excepción "para que la traduzca
 * el advice" habría producido el error genérico de la plataforma, sin `TPL_*`. Cuando el aborto ocurre
 * **dentro** del controlador (la lectura contada falla mientras Jackson deserializa), la señal viaja
 * como causa de `HttpMessageNotReadableException` y la traduce el advice, que la reconoce; ese camino
 * también está probado.
 *
 * **Qué NO limita.** `POST /master/templates2/versions` es `multipart/form-data` y su tope es el de
 * `spring.servlet.multipart.*` (15 MB por archivo / 64 MB por petición, `application.yml:51-55`), no
 * los 8 KiB de las rutas JSON — aviso 1 de `handoffs/2-3.md`. Y `POST …/assets` sube **cuerpo binario
 * crudo** de hasta 15 MiB (`03 §3.7`): su límite lo aplica `EditorAssetService` con el código
 * `TPL_ASSET_TOO_LARGE`, que es el que `03 §5` asigna a un asset grande. Ambas se excluyen aquí.
 */
@Component
class Templates2BodyLimitFilter(
    @Qualifier("templates2ObjectMapper") private val mapper: ObjectMapper,
    private val dateFormatter: DateFormatter,
) : OncePerRequestFilter() {

    /**
     * Señal de aborto de la lectura contada. Es una [IOException] **a propósito**: es lo único que
     * `ServletInputStream.read()` puede lanzar sin romper el contrato del servlet, y es lo que Jackson
     * envuelve en `HttpMessageNotReadableException` — de ahí que el advice pueda reconocerla por la
     * cadena de causas y responder `413` en vez del `400` que daría un cuerpo ilegible cualquiera.
     */
    class BodyTooLargeException(val limit: Int, val leidos: Long) :
        IOException("el cuerpo supera el límite de $limit B para esta ruta")

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val limite = limiteDe(request)
        if (limite == null) {
            filterChain.doFilter(request, response)
            return
        }

        // Vía 1: la cabecera. Barata y sin leer un byte del cuerpo.
        val declarado = request.contentLengthLong
        if (declarado > limite) {
            escribir413(response, limite, declarado)
            return
        }

        // Vía 2: lectura contada. Cubre `chunked` y la cabecera mentirosa.
        val contado = CuerpoContado(request, limite)
        try {
            filterChain.doFilter(contado, response)
        } catch (e: BodyTooLargeException) {
            if (response.isCommitted) throw e
            escribir413(response, e.limit, e.leidos)
        }
    }

    /**
     * `null` = esta petición no la limita este filtro. `03 §8`: 768 KiB en `operations`, 8 KiB en el
     * resto de rutas JSON del editor y del registro.
     */
    private fun limiteDe(request: HttpServletRequest): Int? {
        if (!METODOS_CON_CUERPO.contains(request.method.uppercase())) return null
        val ruta = request.requestURI ?: return null
        if (!ruta.startsWith(PREFIJO_EDITOR) && !ruta.startsWith(PREFIJO_MASTER)) return null
        if (esMultipart(request)) return null
        // La subida de assets es cuerpo binario crudo con su propio tope y su propio código (`03 §3.7`).
        if (ruta.endsWith(SUFIJO_ASSETS)) return null
        return if (ruta.endsWith(SUFIJO_OPERACIONES)) LIMITE_OPERACIONES else LIMITE_JSON
    }

    private fun esMultipart(request: HttpServletRequest): Boolean {
        val tipo = request.contentType ?: return false
        return tipo.lowercase().startsWith(MediaType.MULTIPART_FORM_DATA_VALUE)
    }

    private fun escribir413(response: HttpServletResponse, limite: Int, bytes: Long) {
        val cuerpo = TplErrorResponse.de(
            code = TplErrorCode.TPL_BODY_TOO_LARGE,
            message = "el cuerpo de la petición supera el límite de $limite B de esta ruta",
            timestamp = dateFormatter.parseCurrentDate(TplErrorResponse.PATRON_FECHA),
            details = mapOf("limit" to limite, "bytes" to if (bytes >= 0) bytes else null),
        )
        response.status = TplErrorCode.TPL_BODY_TOO_LARGE.httpStatus
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        response.writer.write(mapper.writeValueAsString(cuerpo))
        response.writer.flush()
    }

    /** Envoltura que cuenta lo leído y aborta al rebasar; no acumula el cuerpo en memoria. */
    private class CuerpoContado(request: HttpServletRequest, private val limite: Int) :
        HttpServletRequestWrapper(request) {

        private var stream: ServletInputStream? = null
        private var reader: BufferedReader? = null

        override fun getInputStream(): ServletInputStream {
            stream?.let { return it }
            val creado = Contador(super.getInputStream(), limite)
            stream = creado
            return creado
        }

        override fun getReader(): BufferedReader {
            reader?.let { return it }
            val creado = BufferedReader(InputStreamReader(inputStream, characterEncoding ?: Charsets.UTF_8.name()))
            reader = creado
            return creado
        }
    }

    private class Contador(
        private val delegado: ServletInputStream,
        private val limite: Int,
    ) : ServletInputStream() {

        private var leidos = 0L

        override fun read(): Int {
            val b = delegado.read()
            if (b != -1) sumar(1)
            return b
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            val n = delegado.read(b, off, len)
            if (n > 0) sumar(n)
            return n
        }

        private fun sumar(n: Int) {
            leidos += n
            if (leidos > limite) throw BodyTooLargeException(limite, leidos)
        }

        override fun isFinished(): Boolean = delegado.isFinished
        override fun isReady(): Boolean = delegado.isReady
        override fun setReadListener(readListener: ReadListener?) = delegado.setReadListener(readListener)
        override fun available(): Int = delegado.available()
        override fun close() = delegado.close()
    }

    companion object {
        /** `03 §8`: cuerpo de `POST …/document/operations`. */
        const val LIMITE_OPERACIONES = 768 * 1024

        /** `03 §8`: cuerpo de las demás rutas JSON del editor. */
        const val LIMITE_JSON = 8 * 1024

        const val PREFIJO_EDITOR = "/editor/"
        const val PREFIJO_MASTER = "/master/templates2/"
        const val SUFIJO_OPERACIONES = "/document/operations"
        const val SUFIJO_ASSETS = "/assets"

        private val METODOS_CON_CUERPO = setOf("POST", "PUT", "PATCH")
    }
}

/**
 * Registro del filtro **solo** sobre `/editor/` + `*` y `/master/templates2/` + `*` (`03 §8`),
 * después de la
 * cadena de Spring Security.
 *
 * **Por qué después y no antes**: `03 §9.1` fija que una petición anónima recibe `401` en todas las
 * rutas autenticadas, y ese `401` lo escribe `AuthEntryPointJwt` desde la cadena de seguridad. Con el
 * filtro por delante, un anónimo con un cuerpo grande recibiría `413` y sabría que la ruta existe.
 * Colocarlo detrás no cuesta nada en protección: el contenedor no lee el cuerpo hasta que alguien
 * pide el `InputStream`, y quien lo pide es el controlador, que está detrás de los dos filtros.
 */
@Configuration(proxyBeanMethods = false)
class Templates2BodyLimitFilterConfig {

    @Bean
    fun templates2BodyLimitFilterRegistration(
        filtro: Templates2BodyLimitFilter,
    ): FilterRegistrationBean<Templates2BodyLimitFilter> {
        val registro = FilterRegistrationBean(filtro)
        registro.addUrlPatterns("/editor/*", "/master/templates2/*")
        registro.order = SecurityProperties.DEFAULT_FILTER_ORDER + 1
        registro.setName("templates2BodyLimitFilter")
        return registro
    }
}
