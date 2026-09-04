package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional

/**
 * `TplAssetRepository` (`02 §7.4`). Añadida por la revisión `2-1-REV` (objeción O-21-04): los cinco
 * métodos de este repositorio no tenían **ninguna** prueba directa — solo se ejercitaban de refilón por
 * SQL crudo desde `IdempotencyIndexesTest`/`AssetGcTriggerTest`, que no pasan por Spring Data.
 *
 * El caso que de verdad importa es `existsOwned`: es la comprobación de pertenencia de **ADR-030**
 * (`contratos.md §4`, "`assetId` verificado por pertenencia en cada operación de escritura"), un
 * control de autorización. Además es JPQL escrito a mano con **dos parámetros nulables** — Spring Data
 * valida al arrancar que la consulta *parsea*, nunca que devuelva lo correcto ni que PostgreSQL sepa
 * inferir el tipo de un parámetro que llega `null`.
 */
@Transactional
@DirtiesContext
class TplAssetRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var assetRepo: TplAssetRepository
    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun nuevaVersionId(): Long {
        val t = templateRepo.save(TplTemplateEntity(slug = "asset-repo-" + System.nanoTime()))
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
            ).setParameter("e", "assetrepo-${System.nanoTime()}@test.mx").singleResult as Number
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

    private fun ulid(seed: Char) = seed.toString().repeat(26)

    private fun guardarAssetDeInvitacion(invitationId: Long, publicId: String, sha: String): TplAssetEntity =
        assetRepo.save(
            TplAssetEntity(
                publicId = publicId, invitationId = invitationId, bucket = "assets-bucket",
                s3Key = "templates2/invitation/$invitationId/$sha.webp", sha256 = sha,
                contentType = "image/webp", bytes = 100,
            ),
        ).also { entityManager.flush() }

    @Test
    fun `existsOwned es true solo para el dueno correcto y false para otra invitacion (ADR-030)`() {
        val invitacionA = nuevaInvitacionId()
        val invitacionB = nuevaInvitacionId()
        val publicId = "as_" + ulid('A')
        guardarAssetDeInvitacion(invitacionA, publicId, "a".repeat(64))

        assertTrue(
            assetRepo.existsOwned(publicId, invitationId = invitacionA, templateVersionId = null),
            "el asset pertenece a la invitación A: existsOwned debía ser true",
        )
        assertFalse(
            assetRepo.existsOwned(publicId, invitationId = invitacionB, templateVersionId = null),
            "FALLO DE AUTORIZACIÓN: un asset de la invitación A no puede darse por propio de la B",
        )
    }

    @Test
    fun `existsOwned distingue el dueno version-de-plantilla del dueno invitacion`() {
        val versionId = nuevaVersionId()
        val publicId = "as_" + ulid('B')
        assetRepo.save(
            TplAssetEntity(
                publicId = publicId, templateVersionId = versionId, bucket = "assets-bucket",
                s3Key = "templates2/template/x/1.0.0/${"b".repeat(64)}.webp", sha256 = "b".repeat(64),
                contentType = "image/webp", bytes = 100,
            ),
        )
        entityManager.flush()

        assertTrue(assetRepo.existsOwned(publicId, invitationId = null, templateVersionId = versionId))
        assertFalse(
            assetRepo.existsOwned(publicId, invitationId = nuevaInvitacionId(), templateVersionId = null),
            "un asset de plantilla no pertenece a ninguna invitación",
        )
    }

    @Test
    fun `existsOwned con los dos parametros nulos es false y no lanza (PostgreSQL debe inferir el tipo del null)`() {
        val invitationId = nuevaInvitacionId()
        val publicId = "as_" + ulid('C')
        guardarAssetDeInvitacion(invitationId, publicId, "c".repeat(64))

        // Sin esta prueba nadie garantiza que un parámetro `null` de tipo Long no reviente en Postgres
        // con "could not determine data type of parameter" al construir la consulta.
        assertFalse(assetRepo.existsOwned(publicId, invitationId = null, templateVersionId = null))
    }

    @Test
    fun `existsOwned es false para un publicId que no existe`() {
        val invitationId = nuevaInvitacionId()
        assertFalse(assetRepo.existsOwned("as_" + ulid('D'), invitationId = invitationId, templateVersionId = null))
    }

    @Test
    fun `findByPublicId, findByInvitationIdAndSha256 y countByInvitationId responden lo que dicen`() {
        val invitationId = nuevaInvitacionId()
        val publicId = "as_" + ulid('E')
        val sha = "e".repeat(64)
        guardarAssetDeInvitacion(invitationId, publicId, sha)
        entityManager.clear()

        assertNotNull(assetRepo.findByPublicId(publicId))
        assertNull(assetRepo.findByPublicId("as_" + ulid('F')))
        assertEquals(publicId, assetRepo.findByInvitationIdAndSha256(invitationId, sha)?.publicId)
        assertNull(assetRepo.findByInvitationIdAndSha256(invitationId, "f".repeat(64)))
        assertEquals(1L, assetRepo.countByInvitationId(invitationId))
    }

    @Test
    fun `findByTemplateVersionIdAndSha256 es la idempotencia por contenido de los assets de paquete`() {
        val versionId = nuevaVersionId()
        val sha = "9".repeat(64)
        assetRepo.save(
            TplAssetEntity(
                publicId = "as_" + ulid('G'), templateVersionId = versionId, bucket = "assets-bucket",
                s3Key = "templates2/template/y/1.0.0/$sha.webp", sha256 = sha,
                contentType = "image/webp", bytes = 100,
            ),
        )
        entityManager.flush()
        entityManager.clear()

        assertNotNull(assetRepo.findByTemplateVersionIdAndSha256(versionId, sha))
        assertNull(assetRepo.findByTemplateVersionIdAndSha256(versionId, "8".repeat(64)))
    }
}
