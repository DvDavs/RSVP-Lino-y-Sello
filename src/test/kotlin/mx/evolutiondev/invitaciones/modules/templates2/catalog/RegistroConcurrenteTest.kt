package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrationAuditor
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import java.util.concurrent.Callable
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * `02 §11.4` — **registro concurrente de la misma plantilla**, con dos hilos de verdad.
 *
 * Sin el `SELECT … FOR UPDATE` sobre `tpl_template` del paso 3, dos MASTER que registran a la vez
 * calculan el diff estructural contra la misma versión anterior y ambos se creen los primeros. Con él,
 * uno crea y el otro, al reintentar su lectura ya serializado, encuentra el `package_hash` y responde
 * `noop_same_hash` — **visible**, no un descarte mudo.
 */
class RegistroConcurrenteTest : RegistroTestSupport() {

    @Autowired lateinit var servicio: TemplateRegistrationService
    @Autowired lateinit var almacen: AlmacenFalso
    @Autowired lateinit var templates: TplTemplateRepository
    @Autowired lateinit var auditoria: TplTemplateRegistrationQueryRepository

    @BeforeEach
    fun limpiarAntes() {
        limpiarCatalogo(SLUG)
        almacen.reiniciar()
    }

    @AfterEach
    fun limpiarDespues() = limpiarCatalogo(SLUG)

    @Test
    fun `dos hilos registrando el mismo paquete a la vez producen un alta y un noop`() {
        val barrera = CyclicBarrier(2)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val tareas = (1..2).map {
                Callable {
                    val raw = PaqueteFixture.ejemplo(PLANTILLA)
                    barrera.await(30, TimeUnit.SECONDS)
                    servicio.register(raw)
                }
            }
            val resultados = pool.invokeAll(tareas, 120, TimeUnit.SECONDS).map { it.get() }

            assertEquals(
                listOf("created", "noop_same_hash"),
                resultados.map { it.wire }.sorted(),
                "uno crea y el otro responde no-op; nunca dos altas ni un descarte silencioso",
            )
            assertEquals(
                1,
                resultados.map { it.templateVersionId }.distinct().size,
                "ambos hilos deben acabar apuntando a la MISMA versión",
            )
            val id = templates.findBySlug(SLUG)!!.id
            assertEquals(1L, contar("SELECT count(*) FROM tpl_template_version WHERE template_id = ?", id))
            assertEquals(1L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", SLUG))

            val auditadas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc(SLUG, PageRequest.of(0, 10))
            assertEquals(2, auditadas.size, "los dos intentos dejan rastro (02 §2 V35)")
            assertEquals(
                listOf(TemplateRegistrationAuditor.CREADO, TemplateRegistrationAuditor.NOOP),
                auditadas.map { it.result }.sorted(),
            )
            assertTrue(
                auditadas.all { it.requestedHash == resultados[0].packageHash },
                "los dos intentos son el mismo paquete y comparten package_hash",
            )
        } finally {
            pool.shutdownNow()
        }
    }

    companion object {
        const val PLANTILLA = "xv-jardin-1.0.0"
        const val SLUG = "xv-jardin"
    }
}
