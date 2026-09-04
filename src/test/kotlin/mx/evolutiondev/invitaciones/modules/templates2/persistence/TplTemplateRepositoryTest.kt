package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional

/** `insertIgnoreConflict` + `lockBySlug` (`02 §4` paso 3, `02 §7.4`, `02 §11.4`). */
@Transactional
@DirtiesContext
class TplTemplateRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var templateRepo: TplTemplateRepository

    @Test
    fun `insertIgnoreConflict crea la fila la primera vez y no hace nada la segunda`() {
        val slug = "insert-ignore-" + System.nanoTime()
        assertEquals(1, templateRepo.insertIgnoreConflict(slug))
        assertEquals(0, templateRepo.insertIgnoreConflict(slug), "un slug repetido no debe insertar una segunda fila")
        assertEquals(1, templateRepo.findAll().count { it.slug == slug })
    }

    @Test
    fun `lockBySlug encuentra la fila existente y bloquea sin lanzar dentro de la misma transaccion`() {
        val slug = "lock-by-slug-" + System.nanoTime()
        templateRepo.insertIgnoreConflict(slug)
        val bloqueada = templateRepo.lockBySlug(slug)
        assertNotNull(bloqueada)
        assertEquals(slug, bloqueada!!.slug)
    }

    @Test
    fun `lockBySlug sobre un slug inexistente devuelve null`() {
        assertEquals(null, templateRepo.lockBySlug("no-existe-" + System.nanoTime()))
    }
}
