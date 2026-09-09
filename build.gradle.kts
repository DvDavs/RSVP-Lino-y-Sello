import java.io.ByteArrayOutputStream
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.25"
    kotlin("plugin.spring") version "1.9.25"
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
    kotlin("plugin.noarg") version "1.9.0"
    id("org.flywaydb.flyway") version "10.12.0"
    // templates2 (fase 2, bloque 2-0b): cobertura por paquete/clase — JaCoCo, no Kover (ADR-1R-C-08, 06 §2.1).
    jacoco
}

group = "mx.evolutiondev"
version = "0.0.1-SNAPSHOT"

noArg {
    annotation("jakarta.persistence.Entity")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Spring dependencies
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-mail")
    
    // Spring DevTools para hot-reload automático (solo en desarrollo)
    developmentOnly("org.springframework.boot:spring-boot-devtools")

    // Jackson JSON parser
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")

    // Kotlin reflection
    implementation("org.jetbrains.kotlin:kotlin-reflect")

    // Database
    runtimeOnly("org.postgresql:postgresql")
    
    // Flyway for database migrations
    implementation("org.flywaydb:flyway-core:10.21.0")
    implementation("org.flywaydb:flyway-database-postgresql:10.21.0")

    // JWT dependencies
    implementation("io.jsonwebtoken:jjwt-api:0.11.5")
    runtimeOnly("io.jsonwebtoken:jjwt-impl:0.11.5")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.11.5")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-reactor:1.7.3")

    // S3
    implementation("software.amazon.awssdk:s3:2.25.19")

    // Image processing
    implementation("net.coobird:thumbnailator:0.4.20")
    implementation("org.sejda.imageio:webp-imageio:0.1.6") // WebP support for ImageIO

    // Mongo
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb")

    // templates2: validación contra el JSON Schema draft 2020-12 emitido desde Zod (contratos.md §5, 02 §9.1)
    implementation("com.networknt:json-schema-validator:1.5.4")

    // PDF Generation - Using OpenPDF (fork of older iText with compatible API)
    implementation("com.github.librepdf:openpdf:1.3.30")
    
    // Excel Generation
    implementation("org.apache.poi:poi-ooxml:5.2.3")

    // Pagos (fase 5, sesion E4): SDK oficial de Stripe. Version FIJADA: el checkout y la
    // verificacion de firma del webhook dependen de la API de esta version exacta.
    implementation("com.stripe:stripe-java:29.5.0")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testRuntimeOnly("com.h2database:h2")
    testImplementation("de.flapdoodle.embed:de.flapdoodle.embed.mongo:4.11.0")
    implementation(kotlin("stdlib-jdk8"))
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.getByName<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    mainClass.set("mx.evolutiondev.invitaciones.InvitationsApplicationKt")
}

tasks.named<org.springframework.boot.gradle.tasks.run.BootRun>("bootRun") {
    mainClass.set("mx.evolutiondev.invitaciones.InvitationsApplicationKt")
    // Mostrar logs en tiempo real (como en Docker)
    jvmArgs = listOf("-Dspring.output.ansi.enabled=ALWAYS")
    standardInput = System.`in`
}

flyway {
    url = "jdbc:postgresql://localhost:5501/invitaciones"
    user = "evolution"
    password = "evolution123"
    locations = arrayOf("classpath:db/migration")
}

val compileKotlin: KotlinCompile by tasks
compileKotlin.kotlinOptions {
    jvmTarget = "21"
}
val compileTestKotlin: KotlinCompile by tasks
compileTestKotlin.kotlinOptions {
    jvmTarget = "21"
}

// ---------------------------------------------------------------------------------------------
// templates2 - fase 2, bloque 2-0b. Todo lo de abajo es del modulo nuevo y no afecta al antiguo.
// Fuentes: contratos.md 5 y 6 - 02-persistencia-y-catalogo.md 9 - 06-pruebas-y-calidad.md 2.1 y 3.
// AVISO: no escribas "/" seguido de "*" dentro de un comentario de este fichero: Kotlin anida los
// comentarios de bloque y el resto del script quedaria comentado EN SILENCIO (comprobado en 2-0b).
// ---------------------------------------------------------------------------------------------

// Ruta UNICA del JSON Schema emitido y de los golden files: se montan como recursos, sin copia ni
// symlink (ADR-1R-C-09; contratos.md 5 y 6). Dos rutas con copia es el mecanismo exacto de H-35.
sourceSets {
    main { resources.srcDir("frontend/packages/schema/json-schema") }
    test { resources.srcDir("frontend/packages/schema/golden") }
}

// Directorio de los 10 ejemplos completos de la fase 1 (contratos.md 3). No va al classpath.
val templates2EjemplosDir: String =
    layout.projectDirectory.dir("docs/rediseno-plantillas/diseno/ejemplos").asFile.absolutePath

jacoco { toolVersion = "0.8.12" }

tasks.test {
    useJUnitPlatform()
    systemProperty("templates2.ejemplos.dir", templates2EjemplosDir)
    testLogging { events("failed"); showStackTraces = true; exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.SHORT }
    finalizedBy(tasks.jacocoTestReport)
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports { xml.required = true; html.required = true }
    // El modulo antiguo no se mide: no tiene pruebas (H-19) y arrastraria el bundle a ~0 % (06 2.1).
    classDirectories.setFrom(files(classDirectories.files.map {
        fileTree(it) { include("mx/evolutiondev/invitaciones/modules/templates2/**") }
    }))
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.jacocoTestReport)
    classDirectories.setFrom(tasks.jacocoTestReport.get().classDirectories)
    violationRules {
        // ADR-024: nucleo de logica entrelazada. Los paquetes composition/migration los escriben 2-2 y
        // 2-3; mientras no exista ninguna clase en ellos JaCoCo no encuentra ningun PACKAGE que case con
        // `includes` y la regla no se evalua (no rompe el build por paquete inexistente). En cuanto
        // aparezca la primera clase, la regla aplica sin tocar este fichero.
        rule {
            element = "PACKAGE"
            includes = listOf(
                "mx.evolutiondev.invitaciones.modules.templates2.composition*",
                "mx.evolutiondev.invitaciones.modules.templates2.migration*",
            )
            limit { counter = "LINE";   value = "COVEREDRATIO"; minimum = "0.85".toBigDecimal() }
            limit { counter = "BRANCH"; value = "COVEREDRATIO"; minimum = "0.70".toBigDecimal() }
        }
        // ADR-024: resto del modulo (bundle ya filtrado a templates2 por classDirectories)
        rule {
            element = "BUNDLE"
            limit { counter = "LINE"; value = "COVEREDRATIO"; minimum = "0.80".toBigDecimal() }
        }
        // ADR-1R-C-08: ninguna clase de invariantes puede quedar sin tocar
        rule {
            element = "CLASS"
            includes = listOf("mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants*")
            limit { counter = "LINE"; value = "COVEREDRATIO"; minimum = "0.95".toBigDecimal() }
        }
    }
}

// verifyJsonSchemaEmitted (02 9.3, cierre 1): reemite el bundle y los 10 punteros desde el paquete
// TypeScript a un directorio temporal y falla si difieren de lo versionado en
// frontend/packages/schema/json-schema. Impide que alguien edite un esquema a mano o cambie un
// fichero de src sin regenerar. NUNCA pasa en silencio: si falta pnpm, falla con instrucciones.
val execOps: org.gradle.process.ExecOperations = objects.newInstance(ExecHolder::class.java).execOperations

abstract class ExecHolder {
    @get:javax.inject.Inject abstract val execOperations: org.gradle.process.ExecOperations
}

val verifyJsonSchemaEmitted by tasks.registering {
    group = "verification"
    description = "Reemite el JSON Schema desde @invitaciones/schema y falla si hay deriva con lo versionado."
    val frontendDir = layout.projectDirectory.dir("frontend").asFile
    val emittedDir = layout.projectDirectory.dir("frontend/packages/schema/json-schema").asFile
    val checkDir = layout.buildDirectory.dir("schema-check").get().asFile
    val pathEnv = System.getenv("PATH") ?: ""
    inputs.dir(emittedDir)
    inputs.dir(layout.projectDirectory.dir("frontend/packages/schema/src").asFile)
    inputs.file(layout.projectDirectory.file("frontend/packages/schema/scripts/emit-json-schema.ts").asFile)
    outputs.dir(checkDir)
    doLast {
        val pnpm = pathEnv.split(File.pathSeparator)
            .map { File(it, "pnpm") }
            .firstOrNull { it.isFile && it.canExecute() }
            ?.absolutePath
            ?: throw GradleException(
                "verifyJsonSchemaEmitted: `pnpm` no esta en el PATH.\n" +
                "Esta tarea reemite el JSON Schema desde frontend/packages/schema y lo compara con lo\n" +
                "versionado; sin Node/pnpm no puede comprobarse y NO se salta en silencio (contratos.md 5).\n" +
                "Instala Node 22 + pnpm 10, ejecuta `pnpm install` en frontend/ y repite. Si asumes\n" +
                "conscientemente que la comprobacion no se hace, excluyela con -x verifyJsonSchemaEmitted."
            )
        checkDir.deleteRecursively()
        checkDir.mkdirs()
        val salida = ByteArrayOutputStream()
        val exit = execOps.exec {
            workingDir = frontendDir
            commandLine(pnpm, "--filter", "@invitaciones/schema", "exec",
                "tsx", "scripts/emit-json-schema.ts", checkDir.absolutePath)
            isIgnoreExitValue = true
            standardOutput = salida
            errorOutput = salida
        }.exitValue
        if (exit != 0) throw GradleException(
            "verifyJsonSchemaEmitted: la reemision fallo (exit=$exit).\n" +
            "Falta `pnpm install` en frontend/? Salida:\n" + salida.toString(Charsets.UTF_8)
        )
        fun leer(d: File) = d.listFiles { f: File -> f.name.endsWith(".json") }.orEmpty()
            .associate { it.name to it.readBytes().toList() }
        val versionados = leer(emittedDir)
        val reemitidos = leer(checkDir)
        val faltan = reemitidos.keys - versionados.keys
        val sobran = versionados.keys - reemitidos.keys
        val distintos = reemitidos.keys.intersect(versionados.keys).filter { versionados[it] != reemitidos[it] }
        if (faltan.isNotEmpty() || sobran.isNotEmpty() || distintos.isNotEmpty()) throw GradleException(
            "verifyJsonSchemaEmitted: DERIVA entre el esquema versionado y el que emite el paquete TypeScript.\n" +
            (if (faltan.isNotEmpty()) "  sin versionar: " + faltan.sorted() + "\n" else "") +
            (if (sobran.isNotEmpty()) "  versionados de mas: " + sobran.sorted() + "\n" else "") +
            (if (distintos.isNotEmpty()) "  con contenido distinto: " + distintos.sorted() + "\n" else "") +
            "Ejecuta `pnpm --filter @invitaciones/schema run schema:emit` desde frontend/ y versiona el resultado."
        )
        logger.lifecycle("verifyJsonSchemaEmitted: ${reemitidos.size} esquemas identicos a los versionados.")
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
    dependsOn(verifyJsonSchemaEmitted)
}
