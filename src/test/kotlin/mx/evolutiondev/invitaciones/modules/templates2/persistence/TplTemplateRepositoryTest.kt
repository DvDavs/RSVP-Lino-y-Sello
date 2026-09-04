package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional

/** `insertIgnoreConflict` + `lockBySlug` (`02 §4` paso 3, `02 §7.4`, `02 §11.4`). */
@Transactional
@DirtiesContext
class TplTemplateRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var entityManager: EntityManager

    @Test
    fun `insertIgnoreConflict crea la fila la primera vez y no hace nada la segunda`() {
        val slug = "insert-ignore-" + System.nanoTime()
        assertEquals(1, templateRepo.insertIgnoreConflict(slug))
        assertEquals(0, templateRepo.insertIgnoreConflict(slug), "un slug repetido no debe insertar una segunda fila")
        assertEquals(1, templateRepo.findAll().count { it.slug == slug })
    }

    @Test
    fun `lockBySlug toma de verdad un PESSIMISTIC_WRITE (el FOR UPDATE de 02 §4 paso 3)`() {
        val slug = "lock-by-slug-" + System.nanoTime()
        templateRepo.insertIgnoreConflict(slug)
        val bloqueada = templateRepo.lockBySlug(slug)
        assertNotNull(bloqueada)
        assertEquals(slug, bloqueada!!.slug)
        // Añadido por la revisión 2-1-REV (objeción O-21-05): sin este bloqueo, dos MASTER que
        // registran el mismo slug a la vez calculan el diff estructural contra la misma versión
        // anterior (`02 §11.4`). Que el método devuelva la fila no prueba que el `FOR UPDATE` se emita.
        assertEquals(
            LockModeType.PESSIMISTIC_WRITE,
            entityManager.getLockMode(bloqueada),
            "lockBySlug debe mantener un bloqueo pesimista de escritura sobre la fila del slug",
        )
    }

    @Test
    fun `lockBySlug sobre un slug inexistente devuelve null`() {
        assertEquals(null, templateRepo.lockBySlug("no-existe-" + System.nanoTime()))
    }
}
