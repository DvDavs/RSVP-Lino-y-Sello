package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.flywaydb.core.Flyway
import java.io.File
import java.sql.Connection
import java.sql.DriverManager
import java.util.Properties

/**
 * Bootstrap de PostgreSQL para las pruebas de `templates2.persistence` (`06 §6`, ADR-025 + ADR-1R-C-10).
 * **El contrato es la variable de entorno `TPL_TEST_JDBC_URL`** (`06 §6.1`): si está definida (CI, con
 * `services: postgres`), se usa tal cual y este objeto no arranca nada. Si no lo está (local, sin
 * Docker), levanta `scripts/pg-ephemeral.sh start` con **un `TPL_TEST_STATE_DIR` propio de este
 * bloque** (`/tmp/templates2-pg-2-1` por defecto, overridable) para no colisionar con otro agente que
 * corra su propia suite en paralelo (el script documenta este riesgo en su cabecera), y lo para al
 * final de la JVM de pruebas con un shutdown hook.
 *
 * `object` (no una clase): un solo arranque por corrida de Gradle — Gradle usa una única JVM de test
 * por defecto (`forkEvery = 0`), así que un `object` con inicialización perezosa (`by lazy`, aquí
 * emulado con un bloque `init` idempotente vía `Unit` de Kotlin) basta para el "un solo arranque" que
 * pide `06 §6.2`; no hace falta un `TestExecutionListener` de JUnit Platform para esto.
 *
 * Además de arrancar el clúster, crea el rol `evolution` si falta: `V1__initial_schema.sql` (dump real
 * de producción) trae `ALTER TABLE … OWNER TO evolution` en cada tabla — verificado en esta sesión que
 * sin ese rol Flyway falla con `role "evolution" does not exist` al aplicar `V1`. Un clúster efímero
 * recién creado con `initdb -U postgres` no lo trae; crearlo es responsabilidad de este bootstrap de
 * pruebas, no del script `pg-ephemeral.sh` (que no conoce el contenido de las migraciones) ni de una
 * migración Flyway nueva (crear un rol de sistema no es un cambio de esquema del módulo).
 */
object PgTestCluster {

    val jdbcUrl: String
    val user: String
    val password: String

    private var startedByUs = false
    private var stateDir: String = ""

    init {
        val envUrl = System.getenv("TPL_TEST_JDBC_URL")
        if (!envUrl.isNullOrBlank()) {
            jdbcUrl = envUrl
            user = System.getenv("TPL_TEST_DB_USER") ?: "postgres"
            password = System.getenv("TPL_TEST_DB_PASSWORD") ?: ""
        } else {
            val info = startEphemeral()
            jdbcUrl = info.first
            user = info.second
            password = info.third
        }
        ensureEvolutionRole()
        migrate()
    }

    /** Fuerza la inicialización (el `init` de Kotlin ya corrió al cargar la clase; este método
     * existe solo para que el primer acceso desde una prueba sea explícito y legible). */
    fun ensureReady() { /* no-op: tocar el object ya dispara `init` */ }

    fun newConnection(): Connection = DriverManager.getConnection(jdbcUrl, user, password)

    private fun startEphemeral(): Triple<String, String, String> {
        val repoRoot = findRepoRoot()
        val script = File(repoRoot, "scripts/pg-ephemeral.sh")
        check(script.isFile) {
            "PgTestCluster: no encuentro scripts/pg-ephemeral.sh a partir de ${File(".").absolutePath} " +
                "y TPL_TEST_JDBC_URL no está definida. Arráncalo a mano: " +
                "TPL_TEST_STATE_DIR=/tmp/templates2-pg-2-1 scripts/pg-ephemeral.sh start"
        }
        stateDir = System.getenv("TPL_TEST_STATE_DIR") ?: "/tmp/templates2-pg-2-1"

        val pb = ProcessBuilder(script.absolutePath, "start")
        pb.directory(repoRoot)
        pb.environment()["TPL_TEST_STATE_DIR"] = stateDir
        pb.redirectErrorStream(true)
        val proc = pb.start()
        val output = proc.inputStream.bufferedReader().readText()
        val exit = proc.waitFor()
        check(exit == 0) { "PgTestCluster: pg-ephemeral.sh start falló (exit=$exit):\n$output" }

        val stateFile = File(stateDir, "state.env")
        check(stateFile.isFile) { "PgTestCluster: pg-ephemeral.sh no dejó $stateFile. Salida:\n$output" }
        val props = Properties().apply { stateFile.inputStream().use { load(it) } }
        val url = props.getProperty("TPL_TEST_JDBC_URL") ?: error("state.env sin TPL_TEST_JDBC_URL")
        val u = props.getProperty("TPL_TEST_DB_USER") ?: "postgres"
        val p = props.getProperty("TPL_TEST_DB_PASSWORD") ?: ""

        startedByUs = true
        Runtime.getRuntime().addShutdownHook(
            Thread {
                try {
                    val stopPb = ProcessBuilder(script.absolutePath, "stop")
                    stopPb.directory(repoRoot)
                    stopPb.environment()["TPL_TEST_STATE_DIR"] = stateDir
                    stopPb.redirectErrorStream(true)
                    stopPb.start().waitFor()
                } catch (_: Exception) {
                    // el shutdown hook no debe romper la JVM de pruebas por un fallo al limpiar
                }
            },
        )
        return Triple(url, u, p)
    }

    private fun findRepoRoot(): File {
        var dir = File(System.getProperty("user.dir")).absoluteFile
        repeat(6) {
            if (File(dir, "scripts/pg-ephemeral.sh").isFile) return dir
            dir = dir.parentFile ?: return@repeat
        }
        return File(System.getProperty("user.dir"))
    }

    /** Idempotente: ignora "el rol ya existe" (SQLState 42710). Ver KDoc de la clase. */
    private fun ensureEvolutionRole() {
        newConnection().use { conn ->
            conn.createStatement().use { st ->
                try {
                    st.execute(
                        "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'evolution') " +
                            "THEN CREATE ROLE evolution LOGIN SUPERUSER; END IF; END $$;",
                    )
                    Unit
                } catch (e: java.sql.SQLException) {
                    if (e.sqlState != "42710") throw e
                }
            }
        }
    }

    private fun migrate() {
        Flyway.configure()
            .dataSource(jdbcUrl, user, password)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
            .migrate()
    }
}
