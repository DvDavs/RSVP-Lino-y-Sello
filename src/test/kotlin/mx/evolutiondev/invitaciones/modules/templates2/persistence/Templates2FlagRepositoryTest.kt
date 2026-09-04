package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.EntityManager

/** Único acceso a `invitation.uses_templates2` (`02 §6`, `02 §2` V36) — nunca vía `InvitationEntity`. */
@Transactional
@DirtiesContext
class Templates2FlagRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var flagRepo: Templates2FlagRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun fixtureInvitationId(): Long {
        @Suppress("UNCHECKED_CAST")
        val customerId = (entityManager.createNativeQuery(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (:e, false, true, 'x', 'USER') RETURNING id",
        ).setParameter("e", "flagrepo-${System.nanoTime()}@test.mx").singleResult as Number).toLong()
        @Suppress("UNCHECKED_CAST")
        val templateId = (entityManager.createNativeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").singleResult as Number).toLong()
        @Suppress("UNCHECKED_CAST")
        val invitationId = (entityManager.createNativeQuery(
            "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location) VALUES (:c, :t, true, false, false) RETURNING id",
        ).setParameter("c", customerId).setParameter("t", templateId).singleResult as Number).toLong()
        entityManager.flush()
        return invitationId
    }

    @Test
    fun `una invitacion recien creada tiene uses_templates2 en false por DEFAULT`() {
        val id = fixtureInvitationId()
        assertEquals(false, flagRepo.usesTemplates2(id))
    }

    @Test
    fun `setUsesTemplates2 activa la bandera y usesTemplates2 lo refleja`() {
        val id = fixtureInvitationId()
        val filas = flagRepo.setUsesTemplates2(id, true)
        assertEquals(1, filas)
        assertTrue(flagRepo.usesTemplates2(id) == true)
    }

    @Test
    fun `setUsesTemplates2 tambien puede desactivarla (rollback de corte)`() {
        val id = fixtureInvitationId()
        flagRepo.setUsesTemplates2(id, true)
        flagRepo.setUsesTemplates2(id, false)
        assertFalse(flagRepo.usesTemplates2(id) == true)
    }

    @Test
    fun `una invitacion inexistente devuelve null, no lanza`() {
        assertEquals(null, flagRepo.usesTemplates2(-1L))
    }
}
