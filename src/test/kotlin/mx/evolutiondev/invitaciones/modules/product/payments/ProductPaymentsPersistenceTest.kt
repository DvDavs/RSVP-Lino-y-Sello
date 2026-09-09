package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.util.UUID

/**
 * Beans del módulo dentro del *slice* `@DataJpaTest`, construidos a mano (mismo patrón que
 * `EditorTestConfig`, `templates2/api/EditorTestSupport.kt`): el filtro de tipos de `@DataJpaTest`
 * solo incluye entidades y repositorios Spring Data, así que un `@Service` queda fuera si no se
 * importa. Las propiedades se construyen aquí, **nunca** desde `application.yml`.
 */
@TestConfiguration
class PagosTestConfig {

    /**
     * [ProductPaymentsProperties] **no** se registra como bean: lleva `@ConfigurationProperties`, y un
     * `@Bean` de ese tipo hace que Spring intente re-enlazarlo por *setters* (`No setter found for
     * property: clave-secreta`, comprobado) porque una `data class` inmutable solo admite enlace por
     * constructor cuando la registra `@EnableConfigurationProperties`. Se pasa a mano a cada servicio,
     * que además es lo que el encargo pide: ninguna clave sale de `application.yml` en una prueba.
     */
    @Bean fun mapeadorDePruebas(): ObjectMapper = ObjectMapper()

    @Bean fun escrituras(pagos: ProductPaymentRepository) = PaymentWriteService(pagos)

    @Bean
    fun webhook(
        eventos: ProductStripeEventRepository,
        pagos: ProductPaymentRepository,
        banderas: InvitationPaymentFlagRepository,
        json: ObjectMapper,
        dominio: org.springframework.context.ApplicationEventPublisher,
    ) = StripeWebhookService(PagosFx.propiedades(), eventos, pagos, banderas, json, dominio)

    @Bean
    fun catalogo(planes: ProductPlanRepository, json: ObjectMapper) =
        PlanCatalogService(planes, PagosFx.propiedades(), json)
}

/**
 * Las tablas `product_*` (V42-V44) contra **PostgreSQL real** (`PgTestCluster`, el mismo clúster
 * efímero de `templates2`; H2 está descartado sin excepción).
 *
 * Esta clase prueba tres cosas que **no se pueden simular**:
 *
 * 1. Que las entidades JPA casan con el esquema: `@DataJpaTest` arranca con `ddl-auto: validate`
 *    (`application.yml`), así que una columna mal mapeada impide arrancar el contexto y esta suite
 *    entera falla.
 * 2. Que la **idempotencia** del webhook es una clave primaria de verdad y no un `if` optimista.
 * 3. Que el escritor de `invitation.is_paid` y el retirado del release activo hacen lo que dicen
 *    sobre las tablas reales, incluidas las del módulo antiguo que este módulo solo toca por
 *    consulta nativa acotada.
 *
 * `@EntityScan` restringido al paquete de pagos por el mismo defecto ajeno que documenta
 * `SpringPersistenceTestSupport.kt:21-35`: el escaneo por defecto arrastra `InvitationGuestEntity`,
 * que mapea una columna que ninguna migración crea.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EntityScan(basePackageClasses = [ProductPlanEntity::class])
@EnableJpaRepositories(basePackages = ["mx.evolutiondev.invitaciones.modules.product.payments"])
@Import(PagosTestConfig::class, InvitationPaymentInfoReader::class)
class ProductPaymentsPersistenceTest {

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun datasource(registry: DynamicPropertyRegistry) {
            PgTestCluster.ensureReady()
            registry.add("spring.datasource.url") { PgTestCluster.jdbcUrl }
            registry.add("spring.datasource.username") { PgTestCluster.user }
            registry.add("spring.datasource.password") { PgTestCluster.password }
        }
    }

    @PersistenceContext private lateinit var em: EntityManager
    @Autowired private lateinit var fuente: javax.sql.DataSource
    @Autowired private lateinit var planes: ProductPlanRepository
    @Autowired private lateinit var pagos: ProductPaymentRepository
    @Autowired private lateinit var eventos: ProductStripeEventRepository
    @Autowired private lateinit var banderas: InvitationPaymentFlagRepository
    @Autowired private lateinit var datos: InvitationPaymentInfoReader
    @Autowired private lateinit var webhook: StripeWebhookService
    @Autowired private lateinit var catalogo: PlanCatalogService

    // =============================================================================================
    // V42 — el catálogo sembrado
    // =============================================================================================

    @Test
    fun `V42 siembra los tres planes activos y ordenados`() {
        val activos = planes.findByActivoTrueOrderByOrdenAscIdAsc()
        assertEquals(listOf("sencillo", "fiesta", "grande"), activos.map { it.codigo })
        assertEquals(listOf(49900L, 89900L, 149900L), activos.map { it.precioCentavos })
        assertTrue(activos.all { it.moneda == "MXN" })
        // El plan «grande» no tiene tope de invitados: `NULL` es "sin límite", no cero.
        assertNull(activos.first { it.codigo == "grande" }.invitadosMax)
        assertEquals(1, activos.count { it.recomendado }, "solo un plan se recomienda")
    }

    /** `incluye` es `jsonb` y se lee como lista de frases, no como un texto crudo. */
    @Test
    fun `el catalogo devuelve las frases de incluye ya parseadas`() {
        val fiesta = catalogo.catalogo().planes.first { it.codigo == "fiesta" }
        assertTrue(fiesta.incluye.isNotEmpty())
        assertTrue(fiesta.incluye.any { it.contains("150") }, "las viñetas del plan salen del jsonb")
    }

    // =============================================================================================
    // V44 — idempotencia real
    // =============================================================================================

    /**
     * **Escenario 7 del encargo (5-4-ADV): dos webhooks idénticos a la vez.** Stripe reintenta, y
     * dos entregas del mismo evento pueden solaparse. Aquí no se simula nada: son dos conexiones de
     * verdad al mismo Postgres, cada una con su transacción, insertando el mismo `event.id` a la vez.
     *
     * Lo que se mide es que la exclusión la da la **clave primaria** y no un `if` optimista: la
     * segunda transacción se bloquea en el índice único hasta que la primera confirma y entonces
     * `ON CONFLICT DO NOTHING` le devuelve `0` filas. Exactamente una de las dos procesa el evento.
     */
    @Test
    fun `dos webhooks identicos a la vez solo dejan procesar a uno`() {
        val id = "evt_${UUID.randomUUID()}"
        val barrera = java.util.concurrent.CyclicBarrier(2)
        val hilos = java.util.concurrent.Executors.newFixedThreadPool(2)
        try {
            val tareas = (1..2).map {
                java.util.concurrent.Callable {
                    fuente.connection.use { c ->
                        c.autoCommit = false
                        barrera.await(10, java.util.concurrent.TimeUnit.SECONDS)
                        val filas = c.prepareStatement(
                            "INSERT INTO product_stripe_event (event_id, tipo) VALUES (?, ?) " +
                                "ON CONFLICT (event_id) DO NOTHING",
                        ).use { st ->
                            st.setString(1, id)
                            st.setString(2, "checkout.session.completed")
                            st.executeUpdate()
                        }
                        c.commit()
                        filas
                    }
                }
            }
            val resultados = hilos.invokeAll(tareas).map { it.get(20, java.util.concurrent.TimeUnit.SECONDS) }
            assertEquals(1, resultados.sum(), "solo una de las dos entregas inserta: $resultados")
            assertEquals(1L, contarEventos(id), "y en la tabla queda una sola fila")
        } finally {
            hilos.shutdownNow()
            borrarEvento(id)
        }
    }

    @Test
    fun `el mismo event_id solo se inserta una vez`() {
        val id = "evt_${UUID.randomUUID()}"
        assertEquals(1, eventos.insertarSiEsNuevo(id, "checkout.session.completed"))
        assertEquals(0, eventos.insertarSiEsNuevo(id, "checkout.session.completed"))
        assertEquals(1, eventos.marcarProcesado(id, StripeWebhookService.RES_PROCESADO))
    }

    // =============================================================================================
    // El escritor de is_paid y el retirado del release
    // =============================================================================================

    @Test
    fun `el webhook marca la invitacion pagada y escribe total_amount`() {
        val cliente = nuevoCliente()
        val invitacion = nuevaInvitacion(cliente, pagada = false)
        val pago = nuevoPago(invitacion, cliente, "cs_${UUID.randomUUID()}")
        assertFalse(banderas.isPaid(invitacion) ?: false)

        val cuerpo = PagosFx.eventoDeSesion(
            "evt_${UUID.randomUUID()}", sessionId = pago.stripeCheckoutSessionId!!,
            amountTotal = pago.importeCentavos, invitationId = invitacion, paymentId = pago.id,
        )
        webhook.procesar(cuerpo, PagosFx.firmar(cuerpo))
        em.clear()

        assertTrue(banderas.isPaid(invitacion) == true, "el webhook es el único que abre la puerta")
        assertEquals(899.0, totalAmount(invitacion))
        assertEquals(EstadoDePago.PAGADO, pagos.findById(pago.id).get().estado)
    }

    /** **Replay**: el segundo intento no vuelve a escribir ni una fila. */
    @Test
    fun `un replay del mismo evento no vuelve a escribir`() {
        val cliente = nuevoCliente()
        val invitacion = nuevaInvitacion(cliente, pagada = false)
        val pago = nuevoPago(invitacion, cliente, "cs_${UUID.randomUUID()}")
        val eventId = "evt_${UUID.randomUUID()}"
        val cuerpo = PagosFx.eventoDeSesion(
            eventId, sessionId = pago.stripeCheckoutSessionId!!,
            amountTotal = pago.importeCentavos, invitationId = invitacion, paymentId = pago.id,
        )
        val firma = PagosFx.firmar(cuerpo)
        webhook.procesar(cuerpo, firma)
        em.clear()

        // Se deshace la marca a mano: si el replay reprocesara, la volvería a poner.
        banderas.marcarNoPagada(invitacion)
        em.clear()
        val segunda = webhook.procesar(cuerpo, PagosFx.firmar(cuerpo))
        em.clear()

        assertEquals(true, segunda.duplicado)
        assertFalse(banderas.isPaid(invitacion) ?: false, "el replay no debe reprocesar nada")
    }

    @Test
    fun `un reembolso quita is_paid y retira el release activo`() {
        val cliente = nuevoCliente()
        val invitacion = nuevaInvitacion(cliente, pagada = true)
        val intent = "pi_${UUID.randomUUID()}"
        val pago = nuevoPago(invitacion, cliente, "cs_${UUID.randomUUID()}", intent, EstadoDePago.PAGADO)
        val release = nuevoRelease(invitacion)

        val cuerpo = PagosFx.eventoDeCargo("evt_${UUID.randomUUID()}", paymentIntent = intent)
        webhook.procesar(cuerpo, PagosFx.firmar(cuerpo))
        em.clear()

        assertFalse(banderas.isPaid(invitacion) ?: true)
        assertEquals(EstadoDePago.REEMBOLSADO, pagos.findById(pago.id).get().estado)
        assertFalse(releaseActivo(release), "el enlace público deja de servir en origen (ADR-5-0B-01)")
    }

    // =============================================================================================
    // Lectura de la invitación
    // =============================================================================================

    @Test
    fun `el lector devuelve dueno, estado de pago y nombre del evento`() {
        val cliente = nuevoCliente()
        val invitacion = nuevaInvitacion(cliente, pagada = false)
        val leido = datos.leer(invitacion)
        assertNotNull(leido)
        assertEquals(cliente, leido!!.customerId)
        assertFalse(leido.pagada)
        // Sin gente registrada, el nombre es el tipo de evento de la plantilla heredada.
        assertNotNull(leido.nombreEvento, "el nombre sale de event_type, no se inventa aquí")
    }

    @Test
    fun `el lector devuelve null para una invitacion inexistente`() {
        assertNull(datos.leer(-1))
        assertNull(banderas.customerId(-1))
    }

    @Test
    fun `el correo del cliente se lee sin cargar el modulo antiguo`() {
        val cliente = nuevoCliente()
        assertTrue(datos.correoDelCliente(cliente)!!.endsWith("@example.test"))
    }

    /** Un cobro es de su clienta y de nadie más: la consulta del historial ya filtra. */
    @Test
    fun `el historial por cliente no devuelve pagos de otra cuenta`() {
        val unaClienta = nuevoCliente()
        val otraClienta = nuevoCliente()
        val suya = nuevaInvitacion(unaClienta, pagada = false)
        val ajena = nuevaInvitacion(otraClienta, pagada = false)
        nuevoPago(suya, unaClienta, "cs_${UUID.randomUUID()}")
        nuevoPago(ajena, otraClienta, "cs_${UUID.randomUUID()}")
        val propios = pagos.findByCustomerIdOrderByIdDesc(unaClienta)
        assertEquals(1, propios.size)
        assertEquals(suya, propios.single().invitationId)
    }

    // =============================================================================================
    // Fixtures (consultas nativas: este módulo no monta el grafo del módulo antiguo)
    // =============================================================================================

    private fun nuevoCliente(): Long = (
        em.createNativeQuery(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) " +
                "VALUES (:e, false, true, 'x', 'USER') RETURNING id",
        ).setParameter("e", "pagos-${UUID.randomUUID()}@example.test").singleResult as Number
        ).toLong()

    private fun plantillaLegacy(): Long =
        (em.createNativeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").singleResult as Number).toLong()

    private fun nuevaInvitacion(customerId: Long, pagada: Boolean): Long = (
        em.createNativeQuery(
            "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location, is_paid) " +
                "VALUES (:c, :t, true, false, false, :p) RETURNING id",
        ).setParameter("c", customerId).setParameter("t", plantillaLegacy()).setParameter("p", pagada)
            .singleResult as Number
        ).toLong()

    private fun nuevoPago(
        invitationId: Long,
        customerId: Long,
        sessionId: String,
        intentId: String? = null,
        estado: EstadoDePago = EstadoDePago.PENDIENTE,
    ): ProductPaymentEntity {
        val plan = planes.findByCodigoAndActivoTrue("fiesta")!!
        return pagos.saveAndFlush(
            ProductPaymentEntity(
                invitationId = invitationId, customerId = customerId, productPlanId = plan.id,
                estado = estado, importeCentavos = plan.precioCentavos, moneda = plan.moneda,
                stripeCheckoutSessionId = sessionId, stripePaymentIntentId = intentId,
            ),
        )
    }

    private fun nuevoRelease(invitationId: Long): Long {
        val plantilla = (
            em.createNativeQuery("INSERT INTO tpl_template (slug) VALUES (:s) RETURNING id")
                .setParameter("s", "pagos-" + UUID.randomUUID().toString().take(20)).singleResult as Number
            ).toLong()
        val version = (
            em.createNativeQuery(
                "INSERT INTO tpl_template_version (template_id, version, version_major, version_minor, " +
                    "version_patch, manifest, theme, defaults, package_hash, event_kinds) " +
                    "VALUES (:t, '1.0.0', 1, 0, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, :h, '[\"wedding\"]'::jsonb) RETURNING id",
            ).setParameter("t", plantilla)
                .setParameter("h", "sha256:" + "0".repeat(56) + UUID.randomUUID().toString().replace("-", "").take(8))
                .singleResult as Number
            ).toLong()
        return (
            em.createNativeQuery(
                "INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed, " +
                    "report, business_snapshot, content_hash, is_active) " +
                    "VALUES (:i, :v, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, :h, true) RETURNING id",
            ).setParameter("i", invitationId).setParameter("v", version)
                .setParameter("h", "sha256:" + "1".repeat(56) + UUID.randomUUID().toString().replace("-", "").take(8))
                .singleResult as Number
            ).toLong()
    }

    private fun releaseActivo(releaseId: Long): Boolean =
        em.createNativeQuery("SELECT is_active FROM tpl_release WHERE id = :id")
            .setParameter("id", releaseId).singleResult as Boolean

    /** Fuera de la transacción de la prueba: las dos conexiones del escenario 7 ya confirmaron. */
    private fun contarEventos(eventId: String): Long = fuente.connection.use { c ->
        c.prepareStatement("SELECT count(*) FROM product_stripe_event WHERE event_id = ?").use { st ->
            st.setString(1, eventId)
            st.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    private fun borrarEvento(eventId: String) = fuente.connection.use { c ->
        c.prepareStatement("DELETE FROM product_stripe_event WHERE event_id = ?").use { st ->
            st.setString(1, eventId)
            st.executeUpdate()
        }
    }

    private fun totalAmount(invitationId: Long): Double =
        (em.createNativeQuery("SELECT total_amount FROM invitation WHERE id = :id")
            .setParameter("id", invitationId).singleResult as Number).toDouble()
}
