package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.EntityManager

/** `searchCatalog` (`02 §7.4`): `@>` sobre `event_kinds JSONB`, nativa por no tener equivalente JPQL. */
@Transactional
@DirtiesContext
class TplTemplateVersionRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun publish(slug: String, eventKinds: String, minPlanTier: Short, status: String = "published"): Long {
        val t = templateRepo.save(TplTemplateEntity(slug = slug))
        val v = versionRepo.save(
            TplTemplateVersionEntity(
                templateId = t.id, version = "1.0.0", versionMajor = 1, versionMinor = 0, versionPatch = 0,
                manifest = Templates2Json.mapper.createObjectNode(),
                theme = Templates2Json.mapper.createObjectNode(),
                defaults = Templates2Json.mapper.createObjectNode(),
                packageHash = "sha256:" + System.nanoTime().toString().padStart(64, '0').takeLast(64),
                eventKinds = Templates2Json.mapper.readTree(eventKinds),
                minPlanTier = minPlanTier,
                status = status,
            ),
        )
        entityManager.flush()
        return v.id
    }

    @Test
    fun `searchCatalog encuentra una version cuyo event_kinds contiene el evento pedido`() {
        publish("catalog-wedding-" + System.nanoTime(), """["wedding","generic"]""", 1)

        val resultado = versionRepo.searchCatalog("wedding", planTier = 3)
        assertTrue(resultado.isNotEmpty(), "se esperaba al menos una versión con 'wedding' en event_kinds")
    }

    @Test
    fun `searchCatalog NO encuentra una version cuyo event_kinds no contiene el evento pedido`() {
        val slug = "catalog-quince-only-" + System.nanoTime()
        publish(slug, """["quince"]""", 1)

        val resultado = versionRepo.searchCatalog("wedding", planTier = 3).filter { it.templateId ==
            templateRepo.findBySlug(slug)!!.id }
        assertTrue(resultado.isEmpty(), "una versión sin 'wedding' en event_kinds no debe aparecer al buscar 'wedding'")
    }

    @Test
    fun `searchCatalog respeta min_plan_tier (planTier del cliente debe cubrir el requerido)`() {
        val slug = "catalog-tier2-" + System.nanoTime()
        publish(slug, """["wedding"]""", minPlanTier = 2)
        val templateId = templateRepo.findBySlug(slug)!!.id

        val conTierBajo = versionRepo.searchCatalog("wedding", planTier = 1).filter { it.templateId == templateId }
        assertTrue(conTierBajo.isEmpty(), "planTier 1 no debe ver una versión que exige min_plan_tier 2")

        val conTierSuficiente = versionRepo.searchCatalog("wedding", planTier = 2).filter { it.templateId == templateId }
        assertEquals(1, conTierSuficiente.size)
    }

    @Test
    fun `searchCatalog excluye versiones deprecated`() {
        val slug = "catalog-deprecated-" + System.nanoTime()
        publish(slug, """["wedding"]""", 1, status = "deprecated")
        val templateId = templateRepo.findBySlug(slug)!!.id

        val resultado = versionRepo.searchCatalog("wedding", planTier = 3).filter { it.templateId == templateId }
        assertTrue(resultado.isEmpty(), "una versión 'deprecated' no debe salir en el catálogo")
    }
}
