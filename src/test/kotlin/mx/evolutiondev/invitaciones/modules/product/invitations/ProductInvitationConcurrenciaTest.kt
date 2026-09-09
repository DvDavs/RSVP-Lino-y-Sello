package mx.evolutiondev.invitaciones.modules.product.invitations

import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateEntity
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * **R1-05, el corazón del hallazgo: la carrera del tope de borradores, contra PostgreSQL de verdad.**
 *
 * Por qué esta prueba no puede ser un doble en memoria: lo que cierra la carrera es un
 * `SELECT … FOR UPDATE` del motor (`ProductInvitationJpaRepository.bloquearCliente`), y un `Fake` de
 * Kotlin no reproduce ni `READ COMMITTED` ni los bloqueos de fila. La única prueba que demuestra algo
 * aquí es la que lanza N transacciones reales a la vez sobre una base real.
 *
 * Medido en esta rama **antes** del arreglo (con la línea del bloqueo comentada): ocho peticiones
 * simultáneas dejaron ocho filas y ninguna excepción de tope — el techo era el número de peticiones
 * en vuelo, exactamente lo que dice el informe. Con el bloqueo: tres filas y cinco `409`.
 *
 * La porción de Spring es la misma que usan las pruebas de persistencia de `templates2`
 * (`SpringPersistenceTestSupport.kt`), con dos diferencias necesarias:
 * - `@Transactional(NOT_SUPPORTED)`: `@DataJpaTest` envuelve cada prueba en una transacción que
 *   revierte al final; con ella puesta, los hilos verían una foto que nunca se confirma y la prueba
 *   no probaría nada. Aquí se escribe de verdad y se limpia a mano en `@AfterEach`.
 * - Se importan los tres beans del alta para que `@Transactional` de `crear` sea el proxy real.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EntityScan(basePackageClasses = [TplTemplateEntity::class])
@EnableJpaRepositories(basePackages = ["mx.evolutiondev.invitaciones.modules.templates2.persistence"])
@Import(ProductInvitationJpaRepository::class, ProductInvitationService::class, ProductInvitationThrottle::class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ProductInvitationConcurrenciaTest {

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun datasourceProperties(registry: DynamicPropertyRegistry) {
            PgTestCluster.ensureReady()
            registry.add("spring.datasource.url") { PgTestCluster.jdbcUrl }
            registry.add("spring.datasource.username") { PgTestCluster.user }
            registry.add("spring.datasource.password") { PgTestCluster.password }
            // El pool tiene que dar una conexión a cada hilo a la vez, o la "concurrencia" se
            // convertiría en una cola y la prueba pasaría por el motivo equivocado.
            registry.add("spring.datasource.hikari.maximum-pool-size") { "16" }
        }

        /** Peticiones simultáneas. Más del doble del tope, para que la carrera tenga margen. */
        const val SIMULTANEAS = 8
    }

    @Autowired
    private lateinit var servicio: ProductInvitationService

    @Autowired
    private lateinit var repositorio: ProductInvitationJpaRepository

    @Autowired
    private lateinit var gestorDeTransacciones: PlatformTransactionManager

    private var clienta: Long = 0

    private val fecha: String = LocalDate.now(ProductInvitationService.ZONA).plusMonths(6).toString()

    @BeforeEach
    fun sembrarClienta() {
        PgTestCluster.newConnection().use { conn ->
            conn.prepareStatement(
                """
                INSERT INTO customer (email, password, role, is_enabled, is_banned, created_at, updated_at)
                VALUES (?, 'x', 'USER', true, false, NOW(), NOW())
                RETURNING id
                """.trimIndent(),
            ).use { st ->
                st.setString(1, "concurrencia-${System.nanoTime()}@pruebas.invalid")
                st.executeQuery().use { rs ->
                    rs.next()
                    clienta = rs.getLong(1)
                }
            }
        }
    }

    @AfterEach
    fun limpiar() {
        PgTestCluster.newConnection().use { conn ->
            conn.createStatement().use { st ->
                st.executeUpdate("DELETE FROM invitation WHERE customer_id = $clienta")
                st.executeUpdate("DELETE FROM customer WHERE id = $clienta")
            }
        }
    }

    /**
     * El hallazgo, tal cual: N altas legítimas de la misma clienta lanzadas a la vez no pueden dejar
     * más de [ProductInvitationService.MAXIMO_BORRADORES] filas.
     *
     * Cada hilo manda una hora distinta a propósito: así ninguna se deduplica por la ventana del
     * doble clic y lo único que puede frenarlas es el tope.
     */
    @Test
    fun `N altas simultaneas de la misma clienta no pasan del tope de borradores`() {
        // Servicio idéntico al de producción salvo por el retardo de [RepositorioLento], y con la
        // transacción abierta a mano porque el proxy de `@Transactional` no cruza a otros hilos.
        val lento = ProductInvitationService(RepositorioLento(repositorio), ProductInvitationThrottle())
        val transaccion = TransactionTemplate(gestorDeTransacciones)
        val salida = CountDownLatch(1)
        val terminadas = CountDownLatch(SIMULTANEAS)
        val creadas = AtomicInteger()
        val topes = AtomicInteger()
        val inesperada = AtomicReference<Throwable?>()
        val piscina = Executors.newFixedThreadPool(SIMULTANEAS)

        repeat(SIMULTANEAS) { i ->
            piscina.execute {
                try {
                    salida.await()
                    transaccion.execute {
                        lento.crear(
                            clienta,
                            CrearInvitacionRequest(
                                eventKind = "wedding",
                                eventDate = fecha,
                                eventTime = "1%d:00".format(i % 10),
                                hashtag = "#hilo$i",
                            ),
                        )
                    }
                    creadas.incrementAndGet()
                } catch (e: LimiteDeBorradoresException) {
                    topes.incrementAndGet()
                } catch (e: Throwable) {
                    inesperada.compareAndSet(null, e)
                } finally {
                    terminadas.countDown()
                }
            }
        }

        salida.countDown()
        assertTrue(terminadas.await(60, TimeUnit.SECONDS), "las altas simultáneas no terminaron a tiempo")
        piscina.shutdown()

        inesperada.get()?.let { throw AssertionError("un hilo falló por algo que no es el tope", it) }

        val filas = contarInvitaciones()
        assertEquals(
            ProductInvitationService.MAXIMO_BORRADORES,
            filas,
            "el tope tiene que aguantar la carrera: $SIMULTANEAS altas simultáneas dejaron $filas filas",
        )
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES, creadas.get(), "solo tres altas deben prosperar")
        assertEquals(SIMULTANEAS - ProductInvitationService.MAXIMO_BORRADORES, topes.get(), "el resto son 409 del tope")
    }

    /**
     * La otra mitad de R1-05: **hay salida**. Borrar un borrador suyo libera cupo de verdad, que es
     * justo lo que el mensaje del `409` promete.
     */
    @Test
    fun `borrar un borrador propio libera cupo`() {
        val ids = (1..ProductInvitationService.MAXIMO_BORRADORES).map {
            servicio.crear(clienta, CrearInvitacionRequest("wedding", fecha, "1$it:00")).respuesta.invitationId
        }
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES, contarInvitaciones())

        servicio.eliminar(clienta, ids.first())
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES - 1, contarInvitaciones())

        servicio.crear(clienta, CrearInvitacionRequest("wedding", fecha, "22:00"))
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES, contarInvitaciones())
    }

    /** El borrado ajeno no existe: mismo `404` que el de una invitación que no está. */
    @Test
    fun `una invitacion ajena no se puede borrar y responde como si no existiera`() {
        val mia = servicio.crear(clienta, CrearInvitacionRequest("wedding", fecha, "17:00")).respuesta.invitationId

        val e = runCatching { servicio.eliminar(clienta + 999_999, mia) }.exceptionOrNull()

        assertTrue(e is InvitacionNoEncontradaException, "esperaba PRD_INVITATION_NOT_FOUND, llegó $e")
        assertEquals(1, contarInvitaciones(), "la invitación ajena sigue en su sitio")
    }

    private fun contarInvitaciones(): Int = PgTestCluster.newConnection().use { conn ->
        conn.createStatement().use { st ->
            st.executeQuery("SELECT count(*) FROM invitation WHERE customer_id = $clienta").use { rs ->
                rs.next()
                rs.getInt(1)
            }
        }
    }

    /**
     * El repositorio real con un retardo entre **contar** y **insertar**. Sin él la prueba no prueba
     * nada: ocho hilos que arrancan a la vez pueden acabar serializándose solos por el ruido del
     * arranque, y entonces pasa igual con bloqueo que sin él (medido: pasó sin bloqueo).
     *
     * Con el retardo el reparto es determinista. **Sin** `bloquearCliente` los ocho cuentan cero
     * antes de que ninguno confirme y los ocho insertan; **con** él, el `FOR UPDATE` los pone en cola
     * y cada uno cuenta lo que ya escribió el anterior. El retardo no cambia ninguna consulta: solo
     * ensancha la ventana que el hallazgo describe.
     */
    private class RepositorioLento(
        private val real: ProductInvitationRepository,
        private val retardoMs: Long = 250,
    ) : ProductInvitationRepository by real {
        override fun contarBorradores(customerId: Long): Int {
            val total = real.contarBorradores(customerId)
            Thread.sleep(retardoMs)
            return total
        }
    }
}
