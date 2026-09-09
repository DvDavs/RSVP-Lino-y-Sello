package mx.evolutiondev.invitaciones.core.config

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean
import org.springframework.core.io.ClassPathResource

/**
 * R3-02 (`bitacora/5-E3-R3-verificacion.md` §4): **el registro de la aplicación no puede volcar
 * material sensible por configuración de fábrica.**
 *
 * El hallazgo era de una línea: `application.yml` dejaba `spring.jpa.show-sql: true` y
 * `logging.level.org.hibernate: debug`, y con DEBUG Hibernate imprime cada entidad que carga o
 * descarga (`EntityPrinter`) y cada parámetro que enlaza o extrae (`org.hibernate.orm.jdbc.bind` y
 * `.extract`). Como éste es el **único** `application.yml` del repositorio y no hay perfil que lo
 * apague, cualquier despliegue acababa con el token de verificación de correo en claro, el token de
 * recuperación, el hash bcrypt y los datos personales de las clientas dentro del registro.
 *
 * Lo que fija esta prueba es la **configuración por defecto**, que es la que corre en producción:
 * ningún `logging.level` nace en `debug` ni en `trace`, los tres emisores de datos están fijados
 * expresamente para que no los arrastre subir `org.hibernate`, y `show-sql` nace apagado. Que la
 * puerta siga abierta para desarrollo —por variable de entorno— es justo lo que comprueba
 * [seSiguePudiendoDiagnosticarEnDesarrollo]: apagar el registro entero no era el arreglo.
 *
 * Es una prueba de **configuración**, no de comportamiento: no levanta Spring ni base de datos. La
 * comprobación de que con esto el registro real ya no contiene un token está en la bitácora
 * `5-E3-C5.md`, hecha contra un backend arrancado a mano.
 */
class RegistroSinDatosSensiblesTest {

    /** Niveles que hacen hablar a Hibernate de los valores que pasan por el JDBC. */
    private val nivelesQueVuelcanDatos = setOf("debug", "trace", "all")

    private val configuracion: Map<String, String> by lazy {
        val yaml = YamlPropertiesFactoryBean().apply { setResources(ClassPathResource("application.yml")) }
        val propiedades = requireNotNull(yaml.`object`) { "no se pudo leer application.yml" }
        // Ojo con `stringPropertyNames()`: snakeyaml convierte `true` en un Boolean y ese método deja
        // fuera las claves cuyo valor no es un String — o sea, justo las que hay que vigilar.
        propiedades.entries.associate { (clave, valor) -> clave.toString() to valor.toString() }
    }

    /**
     * `${VARIABLE:valor}` → `valor`. Es lo que de verdad corre cuando nadie define la variable, o sea
     * lo que corre en producción salvo que alguien lo pida expresamente.
     */
    private fun porDefecto(valor: String): String {
        val entre = Regex("^\\$\\{[^:}]+:(.*)}$").find(valor.trim()) ?: return valor.trim()
        return entre.groupValues[1].trim()
    }

    private fun valor(clave: String): String =
            requireNotNull(configuracion[clave]) { "falta `$clave` en application.yml; claves: ${configuracion.keys.sorted()}" }

    @Test
    @DisplayName("R3-02: ningún logger nace en debug ni en trace")
    fun ningunLoggerNaceEnDebug() {
        val niveles = configuracion.filterKeys { it.startsWith("logging.level.") }
        assertTrue(niveles.isNotEmpty(), "esperaba encontrar niveles de registro declarados")

        val culpables = niveles.filterValues { porDefecto(it).lowercase() in nivelesQueVuelcanDatos }
        assertTrue(
                culpables.isEmpty(),
                "estos loggers nacen volcando datos y este es el único application.yml del repositorio: " +
                        "${culpables.keys.sorted()}. Si hace falta para diagnosticar, déjalo detrás de una " +
                        "variable de entorno con el valor seguro por defecto.",
        )
    }

    @Test
    @DisplayName("R3-02: los tres emisores de datos de Hibernate están fijados aparte")
    fun losEmisoresDeDatosEstanFijadosAparte() {
        // No basta con bajar `org.hibernate`: si sólo estuviera ése, el día que alguien lo suba a
        // debug para mirar una consulta se llevaría de propina los valores enlazados y las entidades.
        // Estas tres claves existen para que subir `org.hibernate` NO vuelva a filtrar.
        val emisores = listOf(
                "logging.level.org.hibernate.orm.jdbc.bind" to "los parámetros que se enlazan en cada sentencia",
                "logging.level.org.hibernate.orm.jdbc.extract" to "los valores que se leen de la base",
                "logging.level.org.hibernate.internal.util.EntityPrinter" to "la entidad entera en cada carga y descarga",
        )
        emisores.forEach { (clave, queImprime) ->
            val nivel = porDefecto(valor(clave)).lowercase()
            assertFalse(
                    nivel in nivelesQueVuelcanDatos,
                    "`$clave` imprime $queImprime; por defecto no puede estar en `$nivel`",
            )
        }
    }

    @Test
    @DisplayName("R3-02: show-sql nace apagado")
    fun showSqlNaceApagado() {
        assertEquals(
                "false",
                porDefecto(valor("spring.jpa.show-sql")).lowercase(),
                "`spring.jpa.show-sql` vuelca en el registro todas las sentencias de cualquier despliegue",
        )
    }

    /**
     * La otra mitad del encargo, y no es un detalle: apagar el registro entero habría dejado al equipo
     * sin diagnóstico. Las cuatro palancas siguen ahí, con el valor seguro por defecto y el peligroso
     * a un `export` de distancia.
     */
    @Test
    @DisplayName("R3-02: se sigue pudiendo diagnosticar en desarrollo, por variable de entorno")
    fun seSiguePudiendoDiagnosticarEnDesarrollo() {
        val palancas = listOf(
                "spring.jpa.show-sql" to "SPRING_JPA_SHOW_SQL",
                "logging.level.org.hibernate" to "LOG_HIBERNATE",
                "logging.level.org.hibernate.orm.jdbc.bind" to "LOG_HIBERNATE_PARAMETROS",
                "logging.level.org.hibernate.internal.util.EntityPrinter" to "LOG_HIBERNATE_ENTIDADES",
        )
        palancas.forEach { (clave, variable) ->
            assertTrue(
                    valor(clave).contains("\${$variable:"),
                    "`$clave` tiene que seguir siendo ajustable con `$variable`, o el equipo se queda sin diagnóstico",
            )
        }
        // Y el registro de la aplicación sigue encendido: esto no es «apagar los logs».
        assertEquals("info", porDefecto(valor("logging.level.root")).lowercase())
    }
}
