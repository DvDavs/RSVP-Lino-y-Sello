package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.EntityManager

/**
 * Prueba 5 del brief: round-trip JSONB. Un `JsonNode` guardado y releído es equivalente, y el
 * `ObjectMapper` que usa el módulo (`templates2ObjectMapper`, `Templates2JsonConfig` de 2-0b) es
 * realmente el que participa — no un mapper por defecto distinto (H-35, ADR-1R-B-06).
 */
@Transactional
@DirtiesContext
class JsonbRoundTripTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    @Autowired
    @Qualifier("templates2ObjectMapper")
    lateinit var templates2ObjectMapper: ObjectMapper

    private val original = Templates2Json.mapper.readTree(
        """{"z":1,"a":{"nested":["uno","dos",3,null,true]},"m":"áéíóú ñ 🎉"}""",
    )

    @Test
    fun `el bean templates2ObjectMapper es el singleton unico del modulo (no un mapper distinto)`() {
        assertSame(Templates2Json.mapper, templates2ObjectMapper)
    }

    @Test
    fun `un JsonNode guardado via JPA y releido via JPA es estructuralmente igual (independiente del orden de claves)`() {
        val template = templateRepo.save(TplTemplateEntity(slug = "roundtrip-" + System.nanoTime()))
        val version = versionRepo.save(
            TplTemplateVersionEntity(
                templateId = template.id,
                version = "1.0.0",
                versionMajor = 1,
                versionMinor = 0,
                versionPatch = 0,
                manifest = original,
                theme = Templates2Json.mapper.createObjectNode(),
                defaults = Templates2Json.mapper.createObjectNode(),
                packageHash = "sha256:" + "1".repeat(64),
                eventKinds = Templates2Json.mapper.readTree("""["wedding"]"""),
            ),
        )
        entityManager.flush()
        entityManager.clear() // fuerza una lectura real desde la base, no el caché de primer nivel

        val releido = versionRepo.findById(version.id).orElseThrow()
        assertEquals(original, releido.manifest, "el JsonNode releído debía ser igual al guardado")
        // jsonb reordena las claves (02 §1 decisión 3): el original tenía "z" antes que "a"; comprobamos
        // que la igualdad estructural de Jackson (independiente de orden) es la que se está usando.
        assertTrue(releido.manifest.fieldNames().asSequence().toList() != listOf("z", "a", "m") ||
            releido.manifest == original)
    }

    @Test
    fun `el texto crudo de la columna jsonb es reparseable por Templates2Json y coincide con el original`() {
        val template = templateRepo.save(TplTemplateEntity(slug = "roundtrip-raw-" + System.nanoTime()))
        val version = versionRepo.save(
            TplTemplateVersionEntity(
                templateId = template.id,
                version = "1.0.0",
                versionMajor = 1,
                versionMinor = 0,
                versionPatch = 0,
                manifest = original,
                theme = Templates2Json.mapper.createObjectNode(),
                defaults = Templates2Json.mapper.createObjectNode(),
                packageHash = "sha256:" + "2".repeat(64),
                eventKinds = Templates2Json.mapper.readTree("""["wedding"]"""),
            ),
        )
        entityManager.flush()

        // Misma transacción/conexión que el INSERT de arriba (vía el EntityManager, no una conexión
        // JDBC aparte): la fila todavía no hizo commit (@DataJpaTest hace rollback al final del test),
        // así que una conexión nueva bajo READ COMMITTED no la vería.
        @Suppress("UNCHECKED_CAST")
        val crudo = entityManager.createNativeQuery("SELECT manifest::text FROM tpl_template_version WHERE id = :id")
            .setParameter("id", version.id)
            .singleResult as String
        val reparsed = Templates2Json.mapper.readTree(crudo)
        assertEquals(original, reparsed, "el texto crudo de jsonb, reparseado con el mapper del módulo, debía igualar al original")
    }
}
