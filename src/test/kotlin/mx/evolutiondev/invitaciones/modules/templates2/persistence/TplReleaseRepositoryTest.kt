package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * `TplReleaseRepository` (`02 §7.4`). Añadida por la revisión `2-1-REV` (objeción O-21-04): ninguno de
 * sus cinco métodos tenía prueba directa. `findActiveByPublicToken` es JPQL escrito a mano **con
 * subconsulta** y es la consulta del **render público** (`03 §3.7`, `contratos.md §4`): que Spring Data
 * la acepte al arrancar solo prueba que parsea, no que resuelva el token correcto.
 */
@Transactional
@DirtiesContext
class TplReleaseRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var releaseRepo: TplReleaseRepository
    @Autowired lateinit var documentRepo: TplDocumentRepository
    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun nuevaVersionId(): Long {
        val t = templateRepo.save(TplTemplateEntity(slug = "release-repo-" + System.nanoTime()))
        val v = versionRepo.save(
            TplTemplateVersionEntity(
                templateId = t.id, version = "1.0.0", versionMajor = 1, versionMinor = 0, versionPatch = 0,
                manifest = Templates2Json.mapper.createObjectNode(),
                theme = Templates2Json.mapper.createObjectNode(),
                defaults = Templates2Json.mapper.createObjectNode(),
                packageHash = "sha256:" + System.nanoTime().toString().padStart(64, '0').takeLast(64),
                eventKinds = Templates2Json.mapper.readTree("""["wedding"]"""),
            ),
        )
        entityManager.flush()
        return v.id
    }

    private fun nuevaInvitacionId(): Long {
        val customerId = (
            entityManager.createNativeQuery(
                "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (:e, false, true, 'x', 'USER') RETURNING id",
            ).setParameter("e", "releaserepo-${System.nanoTime()}@test.mx").singleResult as Number
            ).toLong()
        val templateId = (
            entityManager.createNativeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").singleResult as Number
            ).toLong()
        val invitationId = (
            entityManager.createNativeQuery(
                "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location) " +
                    "VALUES (:c, :t, true, false, false) RETURNING id",
            ).setParameter("c", customerId).setParameter("t", templateId).singleResult as Number
            ).toLong()
        entityManager.flush()
        return invitationId
    }

    private fun guardarRelease(invitationId: Long, versionId: Long, activo: Boolean, revision: Long = 0): TplReleaseEntity =
        releaseRepo.save(
            TplReleaseEntity(
                invitationId = invitationId, templateVersionId = versionId, documentRevision = revision,
                composed = Templates2Json.mapper.createObjectNode(),
                report = Templates2Json.mapper.createObjectNode(),
                businessSnapshot = Templates2Json.mapper.createObjectNode(),
                contentHash = "sha256:" + System.nanoTime().toString().padStart(64, '0').takeLast(64),
                isActive = activo,
                unpublishedAt = if (activo) null else Instant.now(),
            ),
        ).also { entityManager.flush() }

    @Test
    fun `findActiveByPublicToken resuelve el release activo por el token del documento y solo ese`() {
        val versionId = nuevaVersionId()
        val invitacionA = nuevaInvitacionId()
        val invitacionB = nuevaInvitacionId()
        val tokenA = "pub_" + "A".repeat(26)
        val tokenB = "pub_" + "B".repeat(26)
        documentRepo.insertIfAbsent(invitacionA, versionId, "{}", 2, tokenA)
        documentRepo.insertIfAbsent(invitacionB, versionId, "{}", 2, tokenB)
        val releaseA = guardarRelease(invitacionA, versionId, activo = true)
        guardarRelease(invitacionB, versionId, activo = true)
        entityManager.clear()

        val encontrado = releaseRepo.findActiveByPublicToken(tokenA)
        assertNotNull(encontrado, "el token de A debía resolver su release activo")
        assertEquals(releaseA.id, encontrado!!.id, "resolvió el release de otra invitación")
        assertEquals(invitacionA, encontrado.invitationId)
    }

    @Test
    fun `findActiveByPublicToken devuelve null si el token no existe o si el release esta despublicado`() {
        val versionId = nuevaVersionId()
        val invitationId = nuevaInvitacionId()
        val token = "pub_" + "C".repeat(26)
        documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, token)
        guardarRelease(invitationId, versionId, activo = false)
        entityManager.clear()

        assertNull(releaseRepo.findActiveByPublicToken(token), "un release despublicado no puede servirse al público")
        assertNull(releaseRepo.findActiveByPublicToken("pub_" + "D".repeat(26)), "un token inexistente debe dar null")
    }

    @Test
    fun `deactivateActive despublica el activo, fija unpublished_at y es idempotente`() {
        val versionId = nuevaVersionId()
        val invitationId = nuevaInvitacionId()
        val activo = guardarRelease(invitationId, versionId, activo = true)
        val momento = Instant.parse("2026-09-04T10:00:00Z")

        assertEquals(1, releaseRepo.deactivateActive(invitationId, momento))
        entityManager.clear()

        val releido = releaseRepo.findById(activo.id).orElseThrow()
        assertEquals(false, releido.isActive)
        assertNotNull(releido.unpublishedAt)
        assertNull(releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId), "ya no hay release activo")
        assertEquals(0, releaseRepo.deactivateActive(invitationId, momento), "una segunda despublicación no afecta filas")
    }

    @Test
    fun `findByInvitationIdAndIsActiveTrue devuelve el unico activo aunque haya historial`() {
        val versionId = nuevaVersionId()
        val invitationId = nuevaInvitacionId()
        guardarRelease(invitationId, versionId, activo = false, revision = 1)
        guardarRelease(invitationId, versionId, activo = false, revision = 2)
        val vigente = guardarRelease(invitationId, versionId, activo = true, revision = 3)
        entityManager.clear()

        assertEquals(vigente.id, releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId)?.id)

        val pagina = releaseRepo.findByInvitationIdOrderByPublishedAtDesc(invitationId, PageRequest.of(0, 10))
        assertEquals(3, pagina.totalElements, "el historial debe conservar los tres releases")
        assertTrue(pagina.content.first().publishedAt >= pagina.content.last().publishedAt)
    }
}
