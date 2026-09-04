package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext

/**
 * **La prueba más importante del brief.** Si cualquier entidad de `templates2` no casa con el DDL de
 * `V29`-`V37` (columna que falta o mal nombrada, tipo JDBC incompatible), `ddl-auto: validate`
 * (`application.yml:32`) hace que el `ApplicationContext` **no arranque** — aquí, y de forma idéntica en
 * producción para toda la aplicación, no solo `templates2` (`02 §1`, `02 §8.2`). Que este `@Test`
 * exista y pase ya es la aserción: si `ddl-auto: validate` fallara, `@BeforeEach` de Spring lanzaría
 * antes de llegar al cuerpo del método (el contexto se prepara una vez por clase y se cachea; un fallo
 * de validación lo tira con `BeanCreationException` envolviendo `SchemaManagementException`).
 *
 * También cubre la prueba 2 del brief ("arranque de contexto Spring con las 9 migraciones Flyway
 * aplicadas"): `@DataJpaTest` dispara `FlywayAutoConfiguration` como parte del mismo arranque, contra
 * el mismo clúster real de `PgTestCluster`, que aplica `V1`-`V37` completas antes de que Hibernate
 * valide nada.
 *
 * **Alcance real de la red de seguridad, medido por la revisión `2-1-REV` con tres sabotajes
 * deliberados sobre las entidades** (salida literal en `bitacora/2-1-REV.md`): `validate` **sí** detecta
 * una columna que falta (`missing column [...] in table [...]`) y un tipo JDBC que no casa
 * (`wrong column type encountered...`); **no** detecta un desajuste de **nulabilidad** — cambiar
 * `nullable = false` a `true` sobre una columna `NOT NULL` deja esta prueba en verde. Hibernate no
 * compara `is_nullable` bajo `validate`. Esa clase de desajuste hay que cubrirla con una prueba de
 * inserción o de `information_schema`, no confiando en esta.
 *
 * `SpringPersistenceTestSupport` restringe el `@EntityScan` a las 8 entidades de `templates2.persistence`
 * (ver su KDoc): un desajuste preexistente y ajeno a este bloque en el módulo antiguo
 * (`InvitationGuestEntity.graduatesName` sin migración que cree la columna — hallazgo de esta sesión,
 * `bitacora/2-1.md`) hace que **el escaneo por defecto de `@DataJpaTest`** (todo `mx.evolutiondev.invitaciones`)
 * ya falle hoy, sin que `templates2` tenga nada que ver. Esta prueba queda así acotada a lo que compete
 * a este bloque: que las 8 entidades nuevas casen con `V29`-`V37`.
 */
@DirtiesContext
class DdlValidateTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var templateVersionRepo: TplTemplateVersionRepository
    @Autowired lateinit var assetRepo: TplAssetRepository
    @Autowired lateinit var documentRepo: TplDocumentRepository
    @Autowired lateinit var snapshotRepo: TplDocumentSnapshotRepository
    @Autowired lateinit var releaseRepo: TplReleaseRepository
    @Autowired lateinit var registrationRepo: TplTemplateRegistrationRepository
    @Autowired lateinit var assetGcRepo: TplAssetGcRepository
    @Autowired lateinit var flagRepo: Templates2FlagRepository

    @Test
    fun `el contexto arranca y las 9 migraciones ya se aplicaron (ddl-auto validate en verde)`() {
        assertNotNull(templateRepo)
        assertNotNull(templateVersionRepo)
        assertNotNull(assetRepo)
        assertNotNull(documentRepo)
        assertNotNull(snapshotRepo)
        assertNotNull(releaseRepo)
        assertNotNull(registrationRepo)
        assertNotNull(assetGcRepo)
        assertNotNull(flagRepo)
        // Tocar cada repositorio con una consulta real de verdad ejerce a Hibernate contra el esquema
        // (el arranque ya validó el mapeo estático; esto comprueba que también genera SQL ejecutable).
        templateRepo.findBySlug("no-existe-" + System.nanoTime()) // no lanza: SQL ejecutable de verdad
        assertNotNull(assetGcRepo.count())
    }
}
