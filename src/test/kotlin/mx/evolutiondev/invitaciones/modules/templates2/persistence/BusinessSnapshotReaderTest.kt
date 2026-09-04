package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.EntityManager

/**
 * `BusinessSnapshotReader` (`02 §7.4`): proyección de solo lectura sobre `invitation` +
 * `invitation_template` + `event_type` + `invitation_plan`. Cubre el mapeo `eventKind`/`planTier`
 * documentado como supuesto conservador en el KDoc de la clase y en `preguntas-abiertas.md` (ADR-2-1-04).
 */
@Transactional
@DirtiesContext
class BusinessSnapshotReaderTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var reader: BusinessSnapshotReader
    @Autowired lateinit var entityManager: EntityManager

    private fun eventTypeId(name: String, isWedding: Boolean = false): Long {
        @Suppress("UNCHECKED_CAST")
        return (entityManager.createNativeQuery(
            "INSERT INTO event_type (name, is_wedding, is_enabled) VALUES (:n, :w, true) RETURNING id",
        ).setParameter("n", name).setParameter("w", isWedding).singleResult as Number).toLong()
    }

    private fun invitationTemplateId(eventTypeId: Long, planId: Long): Long {
        @Suppress("UNCHECKED_CAST")
        return (entityManager.createNativeQuery(
            "INSERT INTO invitation_template (price, event_type_id, invitation_plan_id, is_enabled) VALUES (0, :et, :p, true) RETURNING id",
        ).setParameter("et", eventTypeId).setParameter("p", planId).singleResult as Number).toLong()
    }

    private fun invitation(templateId: Long, date: String? = "2027-01-01", childrenAllowed: Boolean? = true): Long {
        @Suppress("UNCHECKED_CAST")
        val customerId = (entityManager.createNativeQuery(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (:e, false, true, 'x', 'USER') RETURNING id",
        ).setParameter("e", "bsr-${System.nanoTime()}@test.mx").singleResult as Number).toLong()
        @Suppress("UNCHECKED_CAST")
        val id = (entityManager.createNativeQuery(
            "INSERT INTO invitation (customer_id, template_id, date, children_allowed, is_enabled, is_finished, all_events_same_location) " +
                "VALUES (:c, :t, :d, :ca, true, false, false) RETURNING id",
        ).setParameter("c", customerId).setParameter("t", templateId).setParameter("d", date).setParameter("ca", childrenAllowed)
            .singleResult as Number).toLong()
        entityManager.flush()
        return id
    }

    @Test
    fun `event_type is_wedding=true siempre mapea a WEDDING, sin mirar el nombre`() {
        val et = eventTypeId("Nombre irrelevante", isWedding = true)
        val tpl = invitationTemplateId(et, planId = 1)
        val invId = invitation(tpl)

        val snap = reader.read(invId)!!
        assertEquals(EventKind.WEDDING, snap.eventKind)
    }

    @Test
    fun `un nombre reconocido del catalogo sembrado mapea al EventKind correspondiente (Quince anos)`() {
        val et = eventTypeId("Quince años", isWedding = false)
        val tpl = invitationTemplateId(et, planId = 1)
        val invId = invitation(tpl)

        val snap = reader.read(invId)!!
        assertEquals(EventKind.QUINCE, snap.eventKind)
    }

    @Test
    fun `un nombre fuera del catalogo mapeado cae en GENERIC, nunca lanza`() {
        val et = eventTypeId("Aniversario de la empresa", isWedding = false)
        val tpl = invitationTemplateId(et, planId = 1)
        val invId = invitation(tpl)

        val snap = reader.read(invId)!!
        assertEquals(EventKind.GENERIC, snap.eventKind)
    }

    @Test
    fun `is_premium=true mapea planTier 2, is_premium=false mapea planTier 1`() {
        val et = eventTypeId("Bautizo", isWedding = false)
        val tplBasico = invitationTemplateId(et, planId = 1)
        val tplPremium = invitationTemplateId(et, planId = 2)

        assertEquals(1, reader.read(invitation(tplBasico))!!.planTier)
        assertEquals(2, reader.read(invitation(tplPremium))!!.planTier)
    }

    @Test
    fun `campos nulos de invitation llegan como null (date, time, hashtag) o false (children_allowed)`() {
        val et = eventTypeId("Comunión", isWedding = false)
        val tpl = invitationTemplateId(et, planId = 1)
        val invId = invitation(tpl, date = null, childrenAllowed = null)

        val snap = reader.read(invId)!!
        assertNull(snap.date)
        assertEquals(false, snap.childrenAllowed, "children_allowed NULL debe coalescer a false, BusinessSnapshot.childrenAllowed no es nulable")
    }

    @Test
    fun `una invitacion inexistente devuelve null, no lanza`() {
        assertNull(reader.read(-1L))
    }
}
