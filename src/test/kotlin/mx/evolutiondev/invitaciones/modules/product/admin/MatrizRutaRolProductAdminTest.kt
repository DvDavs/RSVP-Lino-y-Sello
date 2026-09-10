package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.core.auth.security.AuthEntryPointJwt
import mx.evolutiondev.invitaciones.core.auth.security.InvitationsAccessDeniedHandler
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.test.context.ContextConfiguration
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.context.web.WebAppConfiguration
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import org.springframework.web.servlet.config.annotation.EnableWebMvc

/**
 * **La tabla ruta × rol de la consola de administración, ejecutada de verdad.**
 *
 * Seis rutas × cuatro identidades = 24 celdas, en **una** prueba parametrizada. Lo que mide cada
 * columna y de dónde sale el código:
 *
 * | Identidad | Esperado | Quién lo produce |
 * |---|---|---|
 * | `MASTER` | `200` | el `@PreAuthorize` de clase acepta el rol |
 * | `ADMIN` | `200` | ídem |
 * | `USER` | `403` | `AccessDeniedException` del `@PreAuthorize` → `InvitationsAccessDeniedHandler` |
 * | anónimo | `401` | `anyRequest().authenticated()` → `AuthEntryPointJwt` |
 *
 * ### Por qué esta prueba levanta una cadena de seguridad en vez de mirar la anotación
 * Comprobar que la anotación existe (que es lo que hace `elPreAuthorizeDeClaseEsElDelContrato`, y lo
 * que hacía `Templates2AnotacionesSeguridadTest.kt:24-40`) demuestra que **está escrita**, no que
 * **surta efecto**: sin `@EnableMethodSecurity` la anotación es un comentario caro. Aquí se ejerce la
 * ruta HTTP completa y se lee el código de estado.
 *
 * ### Qué reproduce de `SecurityConfig` y qué no
 * Reproduce **exactamente** las dos líneas de las que depende `/product/` + `**`:
 * `anyRequest().authenticated()` (`core/auth/security/SecurityConfig.kt:47` — `/product/` no casa con
 * ninguna regla de prefijo de `:37-46`) y el par entrada/denegación de `:34-35`, con los **mismos dos
 * beans de producción**, no con dobles. No reproduce `JwtTokenFilter`: la traducción de un JWT a un
 * `Authentication` no es código de esta sesión y ya tiene sus pruebas; lo que aquí se mide es qué hace
 * la ruta **dado** un `Authentication`, que es lo único que este subpaquete puede romper.
 * `SecurityConfig.kt` no se toca (es fichero compartido por cuatro sesiones en paralelo).
 *
 * El servicio es un doble: esta prueba no habla de datos, habla de quién entra.
 */
@ExtendWith(SpringExtension::class)
@WebAppConfiguration
@ContextConfiguration(classes = [MatrizRutaRolProductAdminTest.Contexto::class])
class MatrizRutaRolProductAdminTest {

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @EnableMethodSecurity
    class Contexto {

        @Bean
        fun servicio(): ConsolaDeAdministracionService = mock()

        @Bean
        fun controlador(servicio: ConsolaDeAdministracionService) = ProductAdminConsolaController(servicio)

        @Bean
        fun formateadorDeFechas(): DateFormatter = DateFormatterImpl()

        @Bean
        fun entrada(f: DateFormatter) = AuthEntryPointJwt(f)

        @Bean
        fun denegacion(f: DateFormatter) = InvitationsAccessDeniedHandler(f)

        @Bean
        fun cadena(
            http: HttpSecurity,
            entrada: AuthEntryPointJwt,
            denegacion: InvitationsAccessDeniedHandler,
        ): SecurityFilterChain =
            http.csrf { it.disable() }
                .exceptionHandling {
                    it.authenticationEntryPoint(entrada)
                    it.accessDeniedHandler(denegacion)
                }
                .authorizeHttpRequests { it.anyRequest().authenticated() }
                .build()
    }

    @Autowired private lateinit var contexto: WebApplicationContext
    @Autowired private lateinit var servicio: ConsolaDeAdministracionService

    private lateinit var mvc: MockMvc

    @BeforeEach
    fun preparar() {
        mvc = MockMvcBuilders.webAppContextSetup(contexto)
            .apply<DefaultMockMvcBuilder>(springSecurity())
            .build()
        whenever(servicio.metricas(any())).thenReturn(MetricasDeAdministracion(0, 0, 0, 0, 0))
        whenever(servicio.clientas(any(), any(), any(), anyOrNull()))
            .thenReturn(PaginaDeClientas(0, 0, 20, emptyList()))
        whenever(servicio.invitaciones(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull()))
            .thenReturn(PaginaDeInvitaciones(0, 0, 20, emptyList()))
        whenever(servicio.pagos(any(), any(), any(), anyOrNull()))
            .thenReturn(PaginaDePagos(0, 0, 20, PagosDesdeInvitaciones.ORIGEN, emptyList()))
        whenever(servicio.planes(any())).thenReturn(CatalogoDePlanes(emptyList()))
        whenever(servicio.plantillas(any())).thenReturn(CatalogoDePlantillas(0, emptyList()))
    }

    @ParameterizedTest(name = "GET {0} como {1} responde {2}")
    @MethodSource("celdas")
    fun `la tabla ruta por rol`(ruta: String, identidad: String, esperado: Int) {
        val peticion = get(ruta).apply {
            // `with(authentication(...))` y no `principal(...)`: lo primero deja el `Authentication` en
            // el `SecurityContext`, que es lo que mira la cadena de filtros; lo segundo solo rellena
            // `request.getUserPrincipal()` y la cadena responde 401 a todo (medido).
            if (identidad != ANONIMO) with(authentication(Identidades.como(identidad)))
        }
        val respuesta = mvc.perform(peticion).andReturn().response
        assertEquals(esperado, respuesta.status, "GET $ruta como $identidad")
    }

    companion object {

        const val ANONIMO = "ANONIMO"

        /** Las seis rutas de lectura del contrato. §4 no está: se reutiliza una ruta heredada. */
        val RUTAS = listOf(
            "/product/admin/metricas",
            "/product/admin/clientas",
            "/product/admin/invitaciones",
            "/product/admin/pagos",
            "/product/admin/planes",
            "/product/admin/plantillas",
        )

        @JvmStatic
        fun celdas(): List<org.junit.jupiter.params.provider.Arguments> = RUTAS.flatMap { ruta ->
            listOf(
                org.junit.jupiter.params.provider.Arguments.of(ruta, Identidades.MASTER, 200),
                org.junit.jupiter.params.provider.Arguments.of(ruta, Identidades.ADMIN, 200),
                org.junit.jupiter.params.provider.Arguments.of(ruta, Identidades.USER, 403),
                org.junit.jupiter.params.provider.Arguments.of(ruta, ANONIMO, 401),
            )
        }
    }
}
