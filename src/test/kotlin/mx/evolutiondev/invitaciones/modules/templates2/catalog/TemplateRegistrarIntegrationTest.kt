package mx.evolutiondev.invitaciones.modules.templates2.catalog

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrationAuditor
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRegistrationQueryRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionRepository
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import java.nio.file.Files

/**
 * El algoritmo de `02 §4` de punta a punta contra **PostgreSQL real**.
 *
 * La primera prueba es **criterio de aceptación de la fase 2 entera**: registrar
 * `boda-clasica-1.0.0` y `xv-jardin-1.0.0` (los ejemplos completos de la fase 1) en un solo paso,
 * sin escribir Kotlin y sin reiniciar la aplicación (P4).
 */
class TemplateRegistrarIntegrationTest : RegistroTestSupport() {

    @Autowired lateinit var servicio: TemplateRegistrationService
    @Autowired lateinit var almacen: AlmacenFalso
    @Autowired lateinit var templates: TplTemplateRepository
    @Autowired lateinit var versions: TplTemplateVersionRepository
    @Autowired lateinit var assets: TplAssetRepository
    @Autowired lateinit var auditoria: TplTemplateRegistrationQueryRepository
    @Autowired lateinit var parser: TemplatePackageParser
    @Autowired lateinit var claves: Templates2S3KeyService
    @Autowired lateinit var ulid: UlidGenerator
    @Autowired lateinit var registrador: TemplateRegistrar
    @Autowired lateinit var auditor: TemplateRegistrationAuditor

    private val slugs = arrayOf("boda-clasica", "xv-jardin")

    @BeforeEach
    fun limpiarAntes() {
        limpiarCatalogo(*slugs)
        almacen.reiniciar()
    }

    @AfterEach
    fun limpiarDespues() = limpiarCatalogo(*slugs)

    @Test
    fun `registra los dos ejemplos completos de la fase 1 en un solo paso`() {
        for (plantilla in listOf("boda-clasica-1.0.0", "xv-jardin-1.0.0")) {
            val raw = PaqueteFixture.ejemplo(plantilla)
            val salida = servicio.register(raw)

            assertTrue(salida.result is RegistrationResult.Created, "$plantilla debía crearse")
            assertEquals("created", salida.wire)
            assertFalse(salida.alreadyRegistered)
            assertEquals(plantilla, "${salida.slug}-${salida.version}")

            val plantillaFila = templates.findBySlug(salida.slug)
            assertNotNull(plantillaFila, "el slug ${salida.slug} debe existir en tpl_template")
            val version = versions.findByTemplateIdAndPackageHash(plantillaFila!!.id, salida.packageHash)
            assertNotNull(version, "la versión debe estar guardada bajo su package_hash")
            assertEquals(salida.version, version!!.version)
            assertEquals("published", version.status)
            assertEquals(salida.templateVersionId, version.id)

            // Los assets: un objeto en S3 y una fila en tpl_asset por cada uno, con clave determinista.
            val filas = assets.findAll().filter { it.templateVersionId == version.id }
            assertEquals(salida.assetsRegistered, filas.size)
            for (fila in filas) {
                assertTrue(
                    fila.s3Key.startsWith("templates2/template/${salida.slug}/${salida.version}/"),
                    "clave S3 inesperada: ${fila.s3Key} (02 §10.2)",
                )
                assertTrue(fila.s3Key.contains(fila.sha256), "la clave S3 debe llevar el sha256 (determinismo)")
                assertTrue(almacen.subidos.containsKey(fila.s3Key), "el objeto debe estar en S3 ANTES que la fila")
            }

            // Auditoría: un intento, resultado 'created'.
            val auditadas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc(salida.slug, PageRequest.of(0, 10))
            // Evidencia para la bitacora: es el criterio de aceptacion de la fase, conviene verlo.
            println(
                "REGISTRO OK $plantilla -> result=${salida.wire} templateVersionId=${version.id} " +
                    "packageHash=${salida.packageHash} assets=${salida.assetsRegistered} " +
                    "auditoria=${auditadas.map { it.result }}",
            )
            assertEquals(1, auditadas.size)
            assertEquals(TemplateRegistrationAuditor.CREADO, auditadas[0].result)
            assertEquals(salida.packageHash, auditadas[0].requestedHash)
            assertEquals(version.id, auditadas[0].templateVersionId)
            assertNull(auditadas[0].errorCode)
        }
    }

    @Test
    fun `registrar dos veces el mismo paquete responde alreadyRegistered y no duplica filas`() {
        val raw = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val primera = servicio.register(raw)
        val segunda = servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))

        assertTrue(segunda.result is RegistrationResult.NoopSameHash)
        assertTrue(segunda.alreadyRegistered, "el reenvío no puede descartarse en silencio (contratos §4)")
        assertEquals("noop_same_hash", segunda.wire)
        assertEquals(primera.templateVersionId, segunda.templateVersionId)
        assertEquals(primera.packageHash, segunda.packageHash)

        val id = templates.findBySlug("boda-clasica")!!.id
        assertEquals(1L, contar("SELECT count(*) FROM tpl_template_version WHERE template_id = ?", id))
        assertEquals(2L, contar("SELECT count(*) FROM tpl_template_registration WHERE template_slug = ?", "boda-clasica"))
        val resultados = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("boda-clasica", PageRequest.of(0, 10))
            .map { it.result }.sorted()
        assertEquals(listOf(TemplateRegistrationAuditor.CREADO, TemplateRegistrationAuditor.NOOP), resultados)
    }

    @Test
    fun `la misma version con otro contenido es 409 y nunca pisa la publicada`() {
        servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        // Mismo slug@version, distinto defaults.json: el package_hash cambia (ADR-1R-D-03).
        val otro = PaqueteFixture.variante("boda-clasica-1.0.0", "1.0.0", quitarBloque = "footer.note")

        val e = assertThrows<VersionHashMismatchException> { servicio.register(otro) }
        assertEquals(409, e.status)
        assertEquals(TplErrorCode.TPL_VERSION_HASH_MISMATCH, e.code)

        val id = templates.findBySlug("boda-clasica")!!.id
        assertEquals(1L, contar("SELECT count(*) FROM tpl_template_version WHERE template_id = ?", id))
        val rechazos = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("boda-clasica", PageRequest.of(0, 10))
            .filter { it.result == TemplateRegistrationAuditor.RECHAZADO }
        assertEquals(1, rechazos.size, "el intento rechazado debe dejar rastro (02 §2 V35)")
        assertEquals(TplErrorCode.TPL_VERSION_HASH_MISMATCH.name, rechazos[0].errorCode)
    }

    @Test
    fun `un cambio estructural sin bump mayor se rechaza (ADR-028)`() {
        servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        val menor = PaqueteFixture.variante("boda-clasica-1.0.0", "1.1.0", quitarBloque = "footer.note")

        val e = assertThrows<BreakingChangeNotMajorException> { servicio.register(menor) }
        assertEquals(422, e.status)
        assertEquals(TplErrorCode.TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR, e.code)
        val diff = e.details["diff"] as Map<*, *>
        assertEquals(listOf("footer.note"), diff["removedBlocks"])

        val id = templates.findBySlug("boda-clasica")!!.id
        assertEquals(1L, contar("SELECT count(*) FROM tpl_template_version WHERE template_id = ?", id))
        assertEquals(
            1,
            auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("boda-clasica", PageRequest.of(0, 10))
                .count { it.result == TemplateRegistrationAuditor.RECHAZADO },
        )
    }

    @Test
    fun `un cambio estructural con bump mayor pero sin plan que lo cubra se rechaza`() {
        servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        val mayorSinPlan = PaqueteFixture.variante("boda-clasica-1.0.0", "2.0.0", quitarBloque = "footer.note")

        val e = assertThrows<BreakingChangeNotMajorException> { servicio.register(mayorSinPlan) }
        val sinCubrir = e.details["uncovered"] as List<*>
        assertEquals(1, sinCubrir.size)
        assertEquals("removedBlock", (sinCubrir[0] as Map<*, *>)["kind"])
        assertEquals("footer.note", (sinCubrir[0] as Map<*, *>)["target"])
    }

    @Test
    fun `un cambio estructural con bump mayor y MigrationPlan que lo cubre se registra`() {
        servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        val plan = PaqueteFixture.planRemoveBlock("boda-clasica", "1.0.0", "2.0.0", "footer.note")
        val mayor = PaqueteFixture.variante(
            "boda-clasica-1.0.0", "2.0.0",
            quitarBloque = "footer.note",
            migrationsFrom = listOf("1.0.0"),
            planes = mapOf("1.0.0-to-2.0.0.json" to plan),
        )

        val salida = servicio.register(mayor)
        assertTrue(salida.result is RegistrationResult.Created)
        assertEquals(listOf("footer.note"), salida.structuralDiff!!.removedBlocks.map { it.value })

        val fila = versions.findByTemplateIdAndVersion(templates.findBySlug("boda-clasica")!!.id, "2.0.0")
        assertNotNull(fila)
        assertTrue(
            fila!!.migrationPlans.has("1.0.0"),
            "migration_plans debe guardar el plan por versión de origen (02 §2 V30, ADR-1R-B-02)",
        )
    }

    @Test
    fun `si S3 falla a mitad no persiste nada y queda auditoria del rechazo`() {
        almacen.fallarEnLaSubida = 2 // boda-clasica trae dos assets
        val e = assertThrows<AssetStorageUnavailableException> { servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0")) }
        assertEquals(502, e.status)

        assertEquals(0L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", "boda-clasica"))
        assertEquals(1, almacen.subidos.size, "el primer objeto sí llegó a S3: queda huérfano e inerte (02 §10.5)")
        val filas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("boda-clasica", PageRequest.of(0, 10))
        assertEquals(1, filas.size)
        assertEquals(TemplateRegistrationAuditor.RECHAZADO, filas[0].result)
        assertEquals(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE.name, filas[0].errorCode)
    }

    /**
     * **Objeción ADV-06 de `bitacora/2-adv.md`, cerrada aquí.**
     *
     * La prueba de arriba fuerza el fallo con `AssetStorageUnavailableException`, que es una
     * `TemplateRegistryException` y la atrapa el **primer** `catch` de `subirAssets`
     * (`TemplateRegistrationService.kt:65`). El fallo realista de S3 —un `SdkException`, un socket
     * cortado, un `IOException`— no es del módulo y cae en el `catch (e: Exception)` de la línea 68,
     * que al cierre de la fase tenía cobertura **0** (`TemplateRegistrationService.kt:71`, `0/2`).
     * Esa rama es la que traduce un fallo ajeno a `502 TPL_ASSET_STORAGE_UNAVAILABLE` **y** deja la
     * fila de auditoría: sin ella, un corte de red habría salido como `500 TPL_INTERNAL` sin rastro
     * de intento (P1).
     *
     * Se prueban las dos ramas del `?:`: excepción con mensaje y excepción sin mensaje.
     */
    @Test
    fun `un fallo de S3 ajeno al modulo tambien sale como 502 y deja auditoria`() {
        val conMensaje = servicioConS3Roto { RuntimeException("Connection reset by peer") }
        val e = assertThrows<AssetStorageUnavailableException> {
            conMensaje.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        }
        assertEquals(502, e.status)
        assertEquals(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE, e.code)
        assertTrue(
            e.message!!.contains("Connection reset by peer"),
            "el diagnóstico ajeno no puede perderse: ${e.message}",
        )

        assertEquals(0L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", "boda-clasica"))
        assertEquals(0, almacen.subidos.size, "este servicio no usa el almacén falso: nada debió subirse")
        val filas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("boda-clasica", PageRequest.of(0, 10))
        assertEquals(1, filas.size, "un fallo ajeno de S3 también deja intento auditado")
        assertEquals(TemplateRegistrationAuditor.RECHAZADO, filas[0].result)
        assertEquals(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE.name, filas[0].errorCode)
        assertTrue(filas[0].requestedHash.startsWith("sha256:"))
    }

    @Test
    fun `un fallo de S3 sin mensaje se audita igual, con el nombre de la clase`() {
        val sinMensaje = servicioConS3Roto { IllegalStateException() }
        assertThrows<AssetStorageUnavailableException> {
            sinMensaje.register(PaqueteFixture.ejemplo("xv-jardin-1.0.0"))
        }
        val filas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("xv-jardin", PageRequest.of(0, 10))
        assertEquals(1, filas.size)
        assertEquals(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE.name, filas[0].errorCode)
    }

    /**
     * El mismo servicio de producción con un almacén que revienta con una excepción **ajena** al
     * módulo. No se toca [AlmacenFalso] para no alterar las pruebas que ya dependen de él.
     */
    private fun servicioConS3Roto(fallo: () -> Exception) = TemplateRegistrationService(
        parser,
        TemplateAssetStorage { _, _, _, _ -> throw fallo() },
        claves,
        ulid,
        registrador,
        auditor,
        RegistroTestConfig.BUCKET,
    )

    /**
     * Caso 12 de `03 §12` (`templateRegister_rollbackAfterAssets_auditRowSurvives`). El fallo se fuerza
     * con una versión de 26 caracteres: pasa el semver del esquema y de `ck_..._semver`, pero no cabe en
     * `version VARCHAR(20)`, así que el `INSERT` del paso 7 revienta con la transacción ya abierta y con
     * los assets ya subidos.
     */
    @Test
    fun `si el INSERT de la version falla, la fila de auditoria sobrevive al rollback`() {
        val raw = PaqueteFixture.variante("xv-jardin-1.0.0", "10000000.20000000.30000000")
        assertThrows<Templates2Exception.Internal> { servicio.register(raw) }

        assertEquals(0L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", "xv-jardin"))
        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE bucket = ?", RegistroTestConfig.BUCKET))
        val filas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("xv-jardin", PageRequest.of(0, 10))
        assertEquals(1, filas.size, "sin REQUIRES_NEW esta fila desaparecería con el rollback (objeción B-04)")
        assertEquals(TemplateRegistrationAuditor.RECHAZADO, filas[0].result)
        assertEquals(TplErrorCode.TPL_INTERNAL.name, filas[0].errorCode)
        assertNull(filas[0].templateVersionId)
    }

    @Test
    fun `un paquete invalido deja auditoria con el hash crudo y sin tocar el catalogo`() {
        val base = PaqueteFixture.ejemplo("xv-jardin-1.0.0")
        val roto = RawTemplatePackage(
            base.files.toMutableMap().apply { put("theme.json", "{".toByteArray()) },
        )
        val e = assertThrows<Templates2Exception.ManifestInvalid> { servicio.register(roto) }
        assertEquals(TplErrorCode.TPL_MANIFEST_INVALID, e.code)

        assertEquals(0L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", "xv-jardin"))
        assertEquals(0, almacen.subidos.size, "un paquete inválido no debe llegar a subir nada a S3")
        val filas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("xv-jardin", PageRequest.of(0, 10))
        assertEquals(1, filas.size)
        assertEquals(TplErrorCode.TPL_MANIFEST_INVALID.name, filas[0].errorCode)
        assertTrue(filas[0].requestedHash.startsWith("sha256:"))
    }

    @Test
    fun `el id del solicitante queda en published_by y en requested_by`() {
        val cliente = nuevoCliente()
        try {
            val salida = servicio.register(PaqueteFixture.ejemplo("xv-jardin-1.0.0"), cliente)
            val fila = versions.findById(salida.templateVersionId).orElseThrow()
            assertEquals(cliente, fila.publishedBy)
            val auditadas = auditoria.findByTemplateSlugOrderByCreatedAtDescIdDesc("xv-jardin", PageRequest.of(0, 5))
            assertEquals(cliente, auditadas[0].requestedBy)
        } finally {
            limpiarCatalogo("xv-jardin")
            borrarCliente(cliente)
        }
    }

    /**
     * P4 de punta a punta **sin HTTP y sin token**: el mismo paquete, la misma transacción y la misma
     * idempotencia visible, entrando por el comando de linea (`02 §4` cierre: no hay segunda via).
     */
    @Test
    fun `el comando de linea registra el paquete y su reintento es un no-op visible`() {
        val tmp = Files.createTempDirectory("t2-3-cli-integ").toFile()
        try {
            val dir = PaqueteFixture.directorio(
                PaqueteFixture.ejemplo("xv-jardin-1.0.0"), tmp, "xv-jardin", "1.0.0",
            )
            val comando = TemplateRegisterCommand(servicio)
            val primera = comando.registrar(dir)
            assertTrue(primera.result is RegistrationResult.Created)
            assertEquals("xv-jardin", primera.slug)
            assertNotNull(versions.findById(primera.templateVersionId).orElse(null))

            val segunda = comando.registrar(dir)
            assertTrue(segunda.alreadyRegistered)
            assertEquals(primera.templateVersionId, segunda.templateVersionId)
            assertEquals(1L, contar("SELECT count(*) FROM tpl_template WHERE slug = ?", "xv-jardin"))
        } finally {
            tmp.deleteRecursively()
        }
    }

    @Test
    fun `dos assets con los mismos bytes son un solo objeto y una sola fila`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val manifest = Templates2Json.mapper.readTree(base.files.getValue("template.json")).deepCopy<ObjectNode>()
        val assetsNode = manifest.get("assets") as ArrayNode
        val primero = assetsNode[0].deepCopy<ObjectNode>()
        primero.put("path", "assets/copia.webp")
        assetsNode.add(primero)
        val files = base.files.toMutableMap()
        files["assets/copia.webp"] = base.files.getValue("assets/preview.webp")
        files["template.json"] = PaqueteFixture.texto(manifest)

        val salida = servicio.register(RawTemplatePackage(files))
        assertEquals(2, salida.assetsRegistered, "3 rutas, 2 contenidos distintos")
        assertEquals(2L, contar("SELECT count(*) FROM tpl_asset WHERE template_version_id = ?", salida.templateVersionId))
    }
}
