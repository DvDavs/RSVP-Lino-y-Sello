package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.context.annotation.Import
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource

/**
 * Base compartida de las pruebas que necesitan un `ApplicationContext` de Spring real (JPA + Flyway +
 * Hibernate) contra el clúster de `PgTestCluster` (`06 §6`).
 *
 * `@DataJpaTest` es la porción de Spring Boot que da exactamente lo que `06 §6.2`/el brief piden y
 * nada más: arranca `DataSourceAutoConfiguration` + `FlywayAutoConfiguration` +
 * `HibernateJpaAutoConfiguration` + `JpaRepositoriesAutoConfiguration` + `TransactionAutoConfiguration`
 * y valida las entidades escaneadas contra el esquema real con `ddl-auto: validate`
 * (`application.yml:32`, heredado del classpath de `src/main/resources` sin tocarlo).
 *
 * **`@EntityScan` restringido a `templates2.persistence`** (hallazgo de esta sesión, ver
 * `bitacora/2-1.md`): por defecto `@DataJpaTest` escanea **todas** las `@Entity` de
 * `mx.evolutiondev.invitaciones` (Spring Boot deriva el paquete raíz subiendo hasta
 * `InvitationsApplication`), lo que arrastra `InvitationGuestEntity` del **módulo antiguo** —
 * verificado que esa entidad mapea `graduates_name` (`InvitationGuestEntity.kt:28`) y **ninguna**
 * migración del repositorio crea esa columna (`grep` sobre todos los `.sql` de `db/migration`: 0 resultados fuera
 * de la propia entidad Kotlin). Es un desajuste esquema/entidad **preexistente y ajeno a `templates2`**
 * que `ddl-auto: validate` ya haría fallar en producción igual — no es competencia de este bloque
 * arreglarlo (prohibido tocar el módulo antiguo) ni ocultarlo fuera de esta nota. Restringir el
 * `@EntityScan` a las 8 entidades de `templates2.persistence` aísla la prueba de ese defecto ajeno y
 * la deja probando exactamente lo que el brief pide: que `templates2` case con `V29`-`V37`.
 * `@EnableJpaRepositories` acompaña al `@EntityScan` por el mismo motivo: sin restringirlo también, el
 * escaneo por defecto de repositorios seguía registrando interfaces `JpaRepository` del módulo antiguo
 * (p. ej. una sobre `InvitationGiftRegistryEntity`) cuya entidad ya no es "managed" tras acotar el
 * `@EntityScan`, y Spring fallaba al construirlas con `IllegalArgumentException: Not a managed type`.
 *
 * Un `@TypeExcludeFilter` interno a `@DataJpaTest` **excluye** `@Component`/`@Service`/`CommandLineRunner`
 * que no sean entidades JPA o repositorios Spring Data — `MongoDataInitializer` (que sí necesitaría
 * Mongo, no disponible en este entorno) **nunca se instancia** en esta porción de Spring, verificado:
 * los tests de esta clase base y sus subclases arrancan sin Mongo ni credenciales de AWS/mail reales,
 * pese a que `application.yml` los declara.
 *
 * `@AutoConfigureTestDatabase(Replace.NONE)` es obligatorio: sin él, Spring Boot sustituye el
 * `DataSource` por una base embebida (H2, en el classpath de pruebas por `testRuntimeOnly` de otro
 * módulo) — exactamente lo que ADR-025/ADR-1R-C-10 descartan (`06 §6.2`: "H2 queda descartado, sin
 * excepción").
 *
 * `@Import(Templates2JsonConfig::class, BusinessSnapshotReader::class)`: el filtro de tipos de
 * `@DataJpaTest` (`DataJpaTypeExcludeFilter`) solo incluye por defecto `@Entity` y repositorios Spring
 * Data — un `@Configuration` (`Templates2JsonConfig`, de 2-0b) o un `@Repository` que no extiende
 * ninguna interfaz de Spring Data (`BusinessSnapshotReader`, que envuelve `EntityManager` a mano)
 * quedan fuera del slice si no se importan explícitamente (hallazgo de esta sesión: sin este `@Import`,
 * `@Autowired BusinessSnapshotReader` y `@Autowired @Qualifier("templates2ObjectMapper") ObjectMapper`
 * fallan con `NoSuchBeanDefinitionException`).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EntityScan(basePackageClasses = [TplTemplateEntity::class])
@EnableJpaRepositories(basePackages = ["mx.evolutiondev.invitaciones.modules.templates2.persistence"])
@Import(Templates2JsonConfig::class, BusinessSnapshotReader::class)
abstract class SpringPersistenceTestSupport {

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun datasourceProperties(registry: DynamicPropertyRegistry) {
            PgTestCluster.ensureReady()
            registry.add("spring.datasource.url") { PgTestCluster.jdbcUrl }
            registry.add("spring.datasource.username") { PgTestCluster.user }
            registry.add("spring.datasource.password") { PgTestCluster.password }
        }
    }
}
