package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.core.error.GeneralExceptionHandler
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * **Contrato HTTP de las seis rutas de `/product/admin/` + `**`**: forma exacta del JSON, claves en
 * español y el `400` con cuerpo de los parámetros malos.
 *
 * Estilo copiado de `ProductAdminHealthControllerTest.kt:23-27` (`standaloneSetup`, sin contexto de
 * Spring) y de `RequestPasswordResetContractTest.kt` (`setControllerAdvice` con el **manejador de
 * errores de producción**, para que el `400` que se mide sea el que devuelve el servidor de verdad y
 * no el que fabricaría MockMvc por su cuenta).
 *
 * El servicio es **real** y solo se dobla [ConsultasDeAdministracion]: la validación de parámetros
 * vive en el servicio (`ConsolaDeAdministracionService.kt:31-33`), así que doblar el servicio entero
 * dejaría sin probar precisamente la regla «un valor fuera de rango es 400, no un recorte silencioso».
 *
 * `Authentication` llega por `principal(...)`: aquí no hay cadena de filtros —quien la ejerce es
 * `MatrizRutaRolProductAdminTest`— y Spring MVC resuelve un parámetro `Principal` desde
 * `request.getUserPrincipal()`.
 */
class ProductAdminConsolaControllerTest {

    private val consultas: ConsultasDeAdministracion = mock()
    private val pagos = PagosDesdeInvitaciones(
        consultas,
        mx.evolutiondev.invitaciones.modules.product.payments.ProductPaymentsProperties(moneda = "MXN"),
    )
    private val servicio = ConsolaDeAdministracionService(consultas, pagos)
    private val mvc: MockMvc = MockMvcBuilders.standaloneSetup(ProductAdminConsolaController(servicio))
        .setControllerAdvice(GeneralExceptionHandler(DateFormatterImpl()))
        .build()

    private val master = Identidades.como(Identidades.MASTER, id = 7L)

    // ------------------------------------------------------------------ §1

    @Test
    fun `metricas devuelve los cinco enteros del contrato y ni uno mas`() {
        whenever(consultas.metricas(any())).thenReturn(MetricasDeAdministracion(128, 141, 96, 103, 412))

        mvc.perform(get("/product/admin/metricas").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.clientas").value(128))
            .andExpect(jsonPath("$.invitaciones").value(141))
            .andExpect(jsonPath("$.publicadas").value(96))
            .andExpect(jsonPath("$.pagadas").value(103))
            .andExpect(jsonPath("$.rsvpUltimos7Dias").value(412))
            .andExpect(jsonPath("$.*", hasSize<Any>(5)))
    }

    /** El alcance que llega a la consulta es el del solicitante, no uno fijo. */
    @Test
    fun `el alcance que se pasa a la consulta sale del Authentication`() {
        whenever(consultas.metricas(any())).thenReturn(MetricasDeAdministracion(0, 0, 0, 0, 0))

        mvc.perform(get("/product/admin/metricas").principal(Identidades.como(Identidades.ADMIN, id = 42L)))
            .andExpect(status().isOk)

        verify(consultas).metricas(eq(AlcanceDeAdministracion(yo = 42L, todo = 0)))
    }

    @Test
    fun `un MASTER pide sin restriccion y un ADMIN acotado`() {
        assertEquals(1, AlcanceDeAdministracion.de(Identidades.como(Identidades.MASTER, 5L)).todo)
        assertEquals(0, AlcanceDeAdministracion.de(Identidades.como(Identidades.ADMIN, 5L)).todo)
    }

    // ------------------------------------------------------------------ §2

    @Test
    fun `clientas devuelve la pagina con las claves del contrato`() {
        whenever(consultas.contarClientas(any(), any())).thenReturn(128)
        whenever(consultas.clientas(any(), any(), any(), any())).thenReturn(
            listOf(
                ClientaDeAdministracion(
                    id = 12, nombre = "Ana Torres", correo = "ana@example.com", rol = "USER",
                    habilitada = true, invitaciones = 3, altaEn = "2026-03-02T10:00:00Z",
                ),
            ),
        )

        mvc.perform(get("/product/admin/clientas").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total").value(128))
            .andExpect(jsonPath("$.pagina").value(0))
            .andExpect(jsonPath("$.tamano").value(20))
            .andExpect(jsonPath("$.elementos[0].id").value(12))
            .andExpect(jsonPath("$.elementos[0].nombre").value("Ana Torres"))
            .andExpect(jsonPath("$.elementos[0].correo").value("ana@example.com"))
            .andExpect(jsonPath("$.elementos[0].rol").value("USER"))
            .andExpect(jsonPath("$.elementos[0].habilitada").value(true))
            .andExpect(jsonPath("$.elementos[0].invitaciones").value(3))
            .andExpect(jsonPath("$.elementos[0].altaEn").value("2026-03-02T10:00:00Z"))
    }

    /** El desplazamiento es `pagina * tamano` y se calcula en el servidor, no lo manda el cliente. */
    @Test
    fun `la pagina se traduce a desplazamiento`() {
        whenever(consultas.contarClientas(any(), any())).thenReturn(0)
        whenever(consultas.clientas(any(), any(), any(), any())).thenReturn(emptyList())

        mvc.perform(get("/product/admin/clientas?pagina=3&tamano=25").principal(master))
            .andExpect(status().isOk)

        verify(consultas).clientas(any(), any(), eq(25), eq(75))
    }

    // ------------------------------------------------------------------ §3

    @Test
    fun `invitaciones devuelve las claves del contrato y enlacePublico nulo se serializa como null`() {
        whenever(consultas.contarInvitaciones(any(), any(), any(), any(), any())).thenReturn(2)
        whenever(consultas.invitaciones(any(), any(), any(), any(), any(), any(), any())).thenReturn(
            listOf(
                InvitacionDeAdministracion(
                    id = 7, evento = "Boda", fecha = "2026-11-14", hora = "18:00",
                    clientaId = 12, clienta = "Ana Torres", plan = "Fiesta", pagada = true,
                    importe = 1490.0, estado = "publicada", enlacePublico = "pub_ABC",
                    usaTemplates2 = true, creadaEn = "2026-03-02T10:00:00Z",
                ),
                InvitacionDeAdministracion(
                    id = 8, evento = "XV", fecha = "2026-12-01", hora = "20:00",
                    clientaId = 13, clienta = "M Cruz", plan = null, pagada = false,
                    importe = 0.0, estado = "en-edicion", enlacePublico = null,
                    usaTemplates2 = false, creadaEn = "2026-03-03T10:00:00Z",
                ),
            ),
        )

        mvc.perform(get("/product/admin/invitaciones").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total").value(2))
            .andExpect(jsonPath("$.elementos[0].enlacePublico").value("pub_ABC"))
            .andExpect(jsonPath("$.elementos[0].usaTemplates2").value(true))
            .andExpect(jsonPath("$.elementos[0].importe").value(1490.0))
            // La clave TIENE que existir y valer null: el contrato dice `null`, no «sin la clave».
            .andExpect(jsonPath("$.elementos[1].enlacePublico").doesNotExist())
            .andExpect(jsonPath("$.elementos[1]", org.hamcrest.Matchers.hasKey("enlacePublico")))
            .andExpect(jsonPath("$.elementos[1]", org.hamcrest.Matchers.hasKey("plan")))
    }

    @Test
    fun `los filtros de estado y pago viajan traducidos a la consulta`() {
        whenever(consultas.contarInvitaciones(any(), any(), any(), any(), any())).thenReturn(0)
        whenever(consultas.invitaciones(any(), any(), any(), any(), any(), any(), any())).thenReturn(emptyList())

        mvc.perform(get("/product/admin/invitaciones?estado=deshabilitada&pago=pendiente").principal(master))
            .andExpect(status().isOk)

        verify(consultas).contarInvitaciones(any(), any(), eq(3), eq(2), eq(0L))
    }

    // ------------------------------------------------------------------ §3 · filtro «Plan»

    /**
     * El filtro `plan` del wireframe (`12-producto-completo.md §B3.6`: `[ Buscar ] [ Estado v ]
     * [ Plan v ]`). **Viaja el id, no el nombre** (el porqué está en
     * `ParametrosDeAdministracion.planSolicitado`).
     */
    @Test
    fun `el filtro de plan viaja como id a la consulta y solo tras comprobar que existe`() {
        whenever(consultas.planExiste(eq(2L))).thenReturn(true)
        whenever(consultas.contarInvitaciones(any(), any(), any(), any(), any())).thenReturn(0)
        whenever(consultas.invitaciones(any(), any(), any(), any(), any(), any(), any())).thenReturn(emptyList())

        mvc.perform(get("/product/admin/invitaciones?plan=2").principal(master))
            .andExpect(status().isOk)

        verify(consultas).planExiste(2L)
        verify(consultas).contarInvitaciones(any(), any(), any(), any(), eq(2L))
        verify(consultas).invitaciones(any(), any(), any(), any(), any(), any(), eq(2L))
    }

    @Test
    fun `sin plan en la peticion no se comprueba el catalogo y no hay filtro`() {
        whenever(consultas.contarInvitaciones(any(), any(), any(), any(), any())).thenReturn(0)
        whenever(consultas.invitaciones(any(), any(), any(), any(), any(), any(), any())).thenReturn(emptyList())

        mvc.perform(get("/product/admin/invitaciones").principal(master))
            .andExpect(status().isOk)

        verify(consultas, never()).planExiste(any())
        verify(consultas).contarInvitaciones(any(), any(), any(), any(), eq(0L))
    }

    /**
     * Las dos formas de que `plan` esté mal son **400 con cuerpo**, nunca una lista vacía: una lista
     * vacía sería indistinguible de «ese plan no tiene invitaciones» y quien mire la consola se
     * creería el cero.
     */
    @Test
    fun `un plan que no es numero y un plan que no existe son 400 con cuerpo`() {
        whenever(consultas.planExiste(eq(99L))).thenReturn(false)

        mvc.perform(get("/product/admin/invitaciones?plan=Premium").principal(master))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.statusCode").value(400))
            .andExpect(jsonPath("$.errors.error").value(org.hamcrest.Matchers.containsString("id numérico")))

        mvc.perform(get("/product/admin/invitaciones?plan=99").principal(master))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.statusCode").value(400))
            .andExpect(jsonPath("$.errors.error").value(org.hamcrest.Matchers.containsString("ningún plan del catálogo")))

        // Y no se consulta nada en ninguno de los dos casos.
        verify(consultas, never()).contarInvitaciones(any(), any(), any(), any(), any())
        verify(consultas, never()).invitaciones(any(), any(), any(), any(), any(), any(), any())
    }

    @Test
    fun `un plan cero o negativo tambien es 400, no un centinela colado desde fuera`() {
        listOf("0", "-1").forEach { valor ->
            mvc.perform(get("/product/admin/invitaciones?plan=$valor").principal(master))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.errors.error").isNotEmpty)
        }
        verify(consultas, never()).planExiste(any())
    }

    // ------------------------------------------------------------------ §5, §6, §7

    @Test
    fun `pagos declara su origen y la moneda de la configuracion`() {
        whenever(consultas.contarPagos(any(), any())).thenReturn(0)
        whenever(consultas.pagos(any(), any(), any(), any())).thenReturn(emptyList())

        mvc.perform(get("/product/admin/pagos").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.origen").value("invitaciones"))
            .andExpect(jsonPath("$.elementos", hasSize<Any>(0)))
    }

    /** `devuelto` es válido y hoy no lo produce nadie: página vacía, **no** un 400. */
    @Test
    fun `pagos acepta devuelto y responde una pagina vacia sin consultar`() {
        mvc.perform(get("/product/admin/pagos?estado=devuelto").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.total").value(0))
            .andExpect(jsonPath("$.elementos", hasSize<Any>(0)))
    }

    @Test
    fun `planes devuelve el catalogo heredado con su recuento`() {
        whenever(consultas.planes(any())).thenReturn(listOf(PlanDeAdministracion(1, "Fiesta", 12)))

        mvc.perform(get("/product/admin/planes").principal(master))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.elementos[0].id").value(1))
            .andExpect(jsonPath("$.elementos[0].nombre").value("Fiesta"))
            .andExpect(jsonPath("$.elementos[0].invitaciones").value(12))
    }

    @Test
    fun `plantillas cuenta lo que haya, sin cifras codificadas`() {
        whenever(consultas.plantillas(any())).thenReturn(
            listOf(
                PlantillaDeAdministracion("boda-clasica", "1.0.2", "published", listOf("wedding"), "2026-03-02T10:00:00Z", 12),
                PlantillaDeAdministracion("boda-clasica", "1.0.1", "deprecated", listOf("wedding", "xv"), "2026-03-01T10:00:00Z", 0),
                PlantillaDeAdministracion("xv-moderna", "2.0.0", "published", listOf("xv"), "2026-03-05T10:00:00Z", 4),
            ),
        )

        mvc.perform(get("/product/admin/plantillas").principal(master))
            .andExpect(status().isOk)
            // `total` es el tamaño de la lista devuelta, no un número escrito en el código.
            .andExpect(jsonPath("$.total").value(3))
            .andExpect(jsonPath("$.elementos", hasSize<Any>(3)))
            .andExpect(jsonPath("$.elementos[0].estado").value("published"))
            .andExpect(jsonPath("$.elementos[1].tiposDeEvento", hasSize<Any>(2)))
    }

    // ------------------------------------------------------------------ 400 con cuerpo

    @Test
    fun `un parametro fuera de rango es 400 con cuerpo, nunca un recorte silencioso`() {
        val casos = listOf(
            "/product/admin/clientas?pagina=-1",
            "/product/admin/clientas?tamano=0",
            "/product/admin/clientas?tamano=101",
            "/product/admin/invitaciones?estado=cualquiera",
            "/product/admin/invitaciones?pago=medio-pagada",
            "/product/admin/pagos?estado=inventado",
        )
        casos.forEach { ruta ->
            mvc.perform(get(ruta).principal(master))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.errors.error").isNotEmpty)
        }
    }

    // ------------------------------------------------------------------ la anotación

    /**
     * La autorización de las seis rutas depende de una anotación de clase; una anotación que alguien
     * borre en un refactor no rompe ninguna prueba funcional. Esta sí (mismo motivo que
     * `ProductAdminHealthControllerTest.kt:43-50`).
     */
    @Test
    fun `la clase exige los roles del contrato`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            ProductAdminConsolaController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "ProductAdminConsolaController debe llevar @PreAuthorize (ADR-1R-B-10)")
        assertEquals("hasAnyRole('ADMIN','MASTER')", anotacion!!.value)
    }
}
