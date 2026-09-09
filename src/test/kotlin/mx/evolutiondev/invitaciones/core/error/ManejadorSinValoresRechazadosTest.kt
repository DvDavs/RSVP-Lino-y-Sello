package mx.evolutiondev.invitaciones.core.error

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.LoggerContext
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import jakarta.validation.Valid
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.AuthRequest
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import java.util.function.Supplier
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean
import org.springframework.context.support.GenericApplicationContext
import org.springframework.core.MethodParameter
import org.springframework.core.io.ClassPathResource
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.validation.BeanPropertyBindingResult
import org.springframework.validation.FieldError
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.servlet.mvc.method.annotation.ExceptionHandlerExceptionResolver

/**
 * R4-01 (`bitacora/5-E3-R4-cierre.md`): **un valor rechazado por la validación no puede acabar en el
 * registro.**
 *
 * El hallazgo: `InternalExceptionHandler` registraba `ex.message` de
 * `MethodArgumentNotValidException`, y ese mensaje **lleva dentro el valor que falló** (`rejected
 * value [...]`). Un alta con una contraseña que no pasa `@StrongPassword` dejaba la contraseña
 * entera en el registro **dos veces**: la línea del manejador y la línea `Resolved [...]` que
 * escribe `ExceptionHandlerExceptionResolver`, a la que Spring Boot le pone categoría de aviso
 * (`WebMvcAutoConfiguration.EnableWebMvcConfiguration.createExceptionResolver`) y que por tanto sale
 * con la configuración de fábrica. Nadie tiene que atacar nada: lo genera la clienta que teclea una
 * contraseña que usa en otro sitio y no cumple el requisito de fortaleza.
 *
 * Las dos vías se comprueban aquí, y las dos con **los niveles de registro reales**: la prueba lee
 * `application.yml` y se los aplica a Logback antes de pedir nada, así que lo que mide es el
 * despliegue por defecto y no un ajuste inventado para la ocasión.
 *
 * Lo que **sí** tiene que seguir saliendo es el diagnóstico: qué campos fallaron. El nombre del
 * campo basta para eso y es lo único que no puede llevar un valor dentro.
 */
class ManejadorSinValoresRechazadosTest {

    /**
     * Los dos valores de la petición. No son secretos de verdad —esto es una prueba— pero hacen de
     * contraseña y de correo: si alguno aparece en una línea de registro, la fuga está abierta.
     * La "contraseña" no tiene mayúscula, ni dígito, ni carácter especial, así que `@StrongPassword`
     * la rechaza; el "correo" no es un correo, así que `@Email` lo rechaza.
     */
    private val contrasenaRechazada = "valor-que-no-debe-quedar-registrado"
    private val correoRechazado = "esto-tampoco-es-un-correo"

    private val manejador = InternalExceptionHandler(DateFormatterImpl())
    private val sonda = SondaDeAlta()
    private val mvc: MockMvc = MockMvcBuilders.standaloneSetup(sonda).setControllerAdvice(manejador).build()

    private val recolector = ListAppender<ILoggingEvent>()
    private lateinit var contexto: LoggerContext
    private val nivelesPrevios = mutableMapOf<String, Level?>()

    @BeforeEach
    fun engancharElRegistro() {
        contexto = LoggerFactory.getILoggerFactory() as LoggerContext
        aplicarLosNivelesDeApplicationYml()
        recolector.context = contexto
        recolector.start()
        contexto.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).addAppender(recolector)
    }

    @AfterEach
    fun soltarElRegistro() {
        contexto.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME).detachAppender(recolector)
        recolector.stop()
        // El `LoggerContext` es del JVM entero: dejarlo como estaba para no cambiarle el registro a
        // las demás pruebas de la misma pasada.
        nivelesPrevios.forEach { (nombre, nivel) -> contexto.getLogger(nombre).level = nivel }
        nivelesPrevios.clear()
    }

    // =============================================================================================

    @Test
    @DisplayName("R4-01: un alta con contraseña débil no deja el valor en el registro")
    fun elValorRechazadoNoLlegaAlRegistro() {
        val respuesta = mvc.perform(
            post("/sonda/alta")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$correoRechazado","password":"$contrasenaRechazada"}"""),
        ).andReturn().response

        assertEquals(400, respuesta.status, "la petición tiene que salir rechazada, si no la prueba no mide nada")
        exigirQueElRegistroNoLleveLosValores()
    }

    @Test
    @DisplayName("R4-01: el registro sigue diciendo QUÉ campos fallaron")
    fun elRegistroSigueSirviendoParaDiagnosticar() {
        mvc.perform(
            post("/sonda/alta")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$correoRechazado","password":"$contrasenaRechazada"}"""),
        )

        val registro = lineas().joinToString("\n")
        assertTrue(
            registro.contains("password"),
            "sin el nombre del campo el registro no sirve para diagnosticar; línea(s): $registro",
        )
        assertTrue(
            registro.contains("email"),
            "sin el nombre del campo el registro no sirve para diagnosticar; línea(s): $registro",
        )
    }

    /**
     * La segunda línea del hallazgo, y la que no se ve montando el advice a mano: el `Resolved [...]`
     * de `ExceptionHandlerExceptionResolver`. Spring Boot le da categoría de aviso, así que sale a
     * `WARN` en cualquier despliegue; aquí se monta el resolutor **igual que lo monta Spring Boot**
     * para que la prueba mida la vía real.
     */
    @Test
    @DisplayName("R4-01: la línea `Resolved [...]` de Spring tampoco lleva el valor")
    fun elResolutorDeSpringTampocoRegistraElValor() {
        val resolutor = resolutorComoLoMontaSpringBoot()
        val peticion = MockHttpServletRequest("POST", "/auth/signup")

        val resuelto = resolutor.resolveException(
            peticion,
            MockHttpServletResponse(),
            null,
            excepcionDeValidacionConLosValores(),
        )

        assertTrue(
            resuelto != null,
            "el resolutor tiene que haber atendido la excepción, si no la prueba no mide nada; " +
                "emisores: ${lineas().map { it.substringBefore(' ') }}",
        )
        exigirQueElRegistroNoLleveLosValores()
    }

    /**
     * La otra mitad de la pregunta de R4-01: si los valores viajan además **al cliente**. El cuerpo
     * lo escribe el propio manejador (no `BasicErrorController`), así que `include-message: always`
     * no lo toca; lo que sale es el nombre del campo y el texto de la regla.
     */
    @Test
    @DisplayName("R4-01: la respuesta devuelve el campo y la regla, nunca el valor")
    fun laRespuestaTampocoDevuelveElValor() {
        val cuerpo = mvc.perform(
            post("/sonda/alta")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$correoRechazado","password":"$contrasenaRechazada"}"""),
        ).andReturn().response.contentAsString

        assertTrue(cuerpo.contains("password"), "la clienta necesita saber qué campo corregir; cuerpo: $cuerpo")
        assertTrue(
            !cuerpo.contains(contrasenaRechazada) && !cuerpo.contains(correoRechazado),
            "la respuesta no puede devolver el valor rechazado",
        )
    }

    // =============================================================================================

    private fun lineas(): List<String> = recolector.list.map { evento ->
        buildString {
            append(evento.loggerName).append(' ').append(evento.formattedMessage)
            var causa = evento.throwableProxy
            var saltos = 0
            while (causa != null && saltos < 12) {
                append(' ').append(causa.className).append(' ').append(causa.message)
                causa = causa.cause
                saltos++
            }
        }
    }

    private fun exigirQueElRegistroNoLleveLosValores() {
        listOf(contrasenaRechazada to "la contraseña", correoRechazado to "el correo").forEach { (valor, que) ->
            val culpables = lineas().filter { it.contains(valor) }
            assertTrue(
                culpables.isEmpty(),
                "$que rechazado quedó escrito en ${culpables.size} línea(s) del registro. " +
                    "Un fallo de validación se registra con el NOMBRE de los campos, nunca con `ex.message`. " +
                    "Emisor(es): ${culpables.map { it.substringBefore(' ') }.distinct()}",
            )
        }
    }

    /** La misma excepción que produce un `@Valid` fallido, con los valores rechazados dentro. */
    private fun excepcionDeValidacionConLosValores(): MethodArgumentNotValidException {
        val metodo = SondaDeAlta::class.java.getDeclaredMethod("alta", AuthRequest::class.java)
        val enlace = BeanPropertyBindingResult(
            AuthRequest(email = correoRechazado, password = contrasenaRechazada),
            "authRequest",
        )
        enlace.addError(
            FieldError(
                "authRequest", "password", contrasenaRechazada, false, null, null,
                "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial",
            ),
        )
        enlace.addError(
            FieldError(
                "authRequest", "email", correoRechazado, false, null, null,
                "Debes proporcinar un correo electrónico válido",
            ),
        )
        return MethodArgumentNotValidException(MethodParameter(metodo, 0), enlace)
    }

    /**
     * `ExceptionHandlerExceptionResolver` con la categoría de aviso que le pone Spring Boot en
     * `WebMvcAutoConfiguration.EnableWebMvcConfiguration.createExceptionResolver()`. Sin esa llamada
     * el resolutor calla, y la prueba no vería la línea que el hallazgo denuncia.
     */
    private fun resolutorComoLoMontaSpringBoot(): ExceptionHandlerExceptionResolver {
        val aplicacion = GenericApplicationContext()
        aplicacion.registerBean(
            "internalExceptionHandler",
            InternalExceptionHandler::class.java,
            Supplier { InternalExceptionHandler(DateFormatterImpl()) },
        )
        aplicacion.refresh()
        return ExceptionHandlerExceptionResolver().apply {
            applicationContext = aplicacion
            // Los convierte Spring Boot desde `HttpMessageConverters`; el resolutor a pelo sólo trae
            // los de texto y sin uno de JSON no llegaría a escribir el cuerpo (ni, por tanto, a
            // registrar el `Resolved [...]` que esta prueba vigila).
            messageConverters = listOf(MappingJackson2HttpMessageConverter())
            setWarnLogCategory(ExceptionHandlerExceptionResolver::class.java.name)
            afterPropertiesSet()
        }
    }

    /**
     * Los niveles del `application.yml` de verdad, aplicados a Logback. Es lo que convierte esto en
     * una prueba del **despliegue por defecto**: sin ella el `root` de Logback nace en `debug` y
     * mediría un entorno que no existe.
     */
    private fun aplicarLosNivelesDeApplicationYml() {
        val yaml = YamlPropertiesFactoryBean().apply { setResources(ClassPathResource("application.yml")) }
        val propiedades = requireNotNull(yaml.`object`) { "no se pudo leer application.yml" }
        propiedades.entries
            .map { (clave, valor) -> clave.toString() to valor.toString() }
            .filter { (clave, _) -> clave.startsWith("logging.level.") }
            .forEach { (clave, valor) ->
                val nombre = clave.removePrefix("logging.level.")
                    .let { if (it == "root") org.slf4j.Logger.ROOT_LOGGER_NAME else it }
                nivelesPrevios.putIfAbsent(nombre, contexto.getLogger(nombre).level)
                contexto.getLogger(nombre).level = Level.toLevel(porDefecto(valor), Level.INFO)
            }
    }

    /** `${VARIABLE:valor}` → `valor`: lo que corre cuando nadie define la variable. */
    private fun porDefecto(valor: String): String =
        Regex("^\\$\\{[^:}]+:(.*)}$").find(valor.trim())?.groupValues?.get(1)?.trim() ?: valor.trim()

    /** Sonda con el DTO real del alta, para que la validación sea la de producción y no una imitación. */
    @RestController
    class SondaDeAlta {
        @PostMapping("/sonda/alta")
        fun alta(@Valid @RequestBody peticion: AuthRequest): String = "ok"
    }
}
