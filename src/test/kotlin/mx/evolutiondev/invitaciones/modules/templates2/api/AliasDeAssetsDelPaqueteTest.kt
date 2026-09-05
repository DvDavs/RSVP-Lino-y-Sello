package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LoadedTemplateVersion
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateVersionLoader
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * I-09 (`bitacora/3-2d.md §5`, ADR-3B-I09-01) — **una plantilla SÍ puede referenciar sus propias
 * imágenes de demostración**.
 *
 * EL DEFECTO, medido contra el backend compartido antes de este arreglo: una invitación recién
 * creada con `boda-clasica@1.0.0` daba `cover.image` con `provenance:"empty"`,
 * `report.missingRequired:["cover.image"]` y `preflight.canPublish:false`, porque el `assetId` que
 * `defaults.json` escribe a mano no es el que `TemplateRegistrationService` acuña en el registro
 * (`"as_" + ulid.next()`, aleatorio). Y `rsvp.background`, que es `source:"fixed"`, quedaba
 * inalcanzable por cualquier vía: su único origen posible es `defaults.json` y escribirlo devuelve
 * `422 TPL_BLOCK_NOT_EDITABLE`.
 *
 * EL ARREGLO: `AssetEntry.id` opcional, resuelto como ALIAS en el `AssetIndex` y en el `assetMeta`
 * del reductor, contra la MISMA fila de `tpl_asset` (casada por `sha256`). La base no cambia.
 *
 * Las pruebas recorren la cadena entera con las piezas de producción y PostgreSQL real: registran
 * la versión, insertan las filas de `tpl_asset` que dejaría el registro, y leen el `composed` por
 * `EditorDocumentService`.
 */
class AliasDeAssetsDelPaqueteTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService

    @Autowired private lateinit var versiones: TemplateVersionLoader

    private val slug = "prueba-alias-i09"
    private var customerId = 0L
    private var invitationId = 0L

    /** Los mismos literales que `frontend/templates/boda-clasica/1.0.0/defaults.json`. */
    private val aliasPortada = AssetId("as_01J8DEM000000000000000C0V1")
    private val aliasFondo = AssetId("as_01J8DEM000000000000000RSV1")

    private val shaPortada = "a".repeat(64)
    private val shaFondo = "b".repeat(64)

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId, usaTemplates2 = true)
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    // ---------------------------------------------------------------------------------------- 1

    @Test
    fun `el alias del manifiesto entra en el AssetIndex apuntando a la fila real de tpl_asset`() {
        val version = registrarConAlias()

        val indice = editor.indiceDeAssets(invitationId, version)

        val portada = indice[aliasPortada]
        assertNotNull(portada, "el alias del manifiesto tiene que resolver: $indice")
        assertEquals("${EditorTestConfig.BASE_URL}/templates2/template/$slug/cover.webp", portada!!.url)
        assertEquals(1200, portada.width)
        assertEquals(1680, portada.height)
        // El `publicId` REAL sigue estando: el alias se suma, no sustituye.
        assertNotNull(indice[AssetId(publicIdDe(shaPortada))], "el publicId real no puede desaparecer")
    }

    @Test
    fun `sin alias declarado todo se comporta exactamente como antes (el cambio es aditivo)`() {
        val version = registrarSinAlias()

        val indice = editor.indiceDeAssets(invitationId, version)

        assertNull(indice[aliasPortada], "un paquete sin `id` no puede inventar alias")
        assertEquals(2, indice.size, "solo los dos publicId reales")
    }

    // ---------------------------------------------------------------------------------------- 2

    @Test
    fun `cover image deja de ser empty - el defecto de 3-2d 5 2`() {
        registrarConAlias()
        editor.chooseTemplate(customerId, invitationId, cuerpo())

        val r = editor.getDocument(customerId, invitationId)

        val bloque = bloqueDelComposed(r, "cover", "cover.image")
        assertEquals("default", bloque.first, "el default de la plantilla ya resuelve")
        assertEquals("${EditorTestConfig.BASE_URL}/templates2/template/$slug/cover.webp", bloque.second)
        assertEquals(
            emptyList<String>(),
            r.report.get("missingRequired").map { it.asText() },
            "`cover.image` ya no falta",
        )
    }

    @Test
    fun `rsvp background - source fixed - por fin llega al composed (3-2d 5 3)`() {
        val version = registrarConAlias()
        editor.chooseTemplate(customerId, invitationId, cuerpo())

        val r = editor.getDocument(customerId, invitationId)

        val bloque = bloqueDelComposed(r, "rsvp", "rsvp.background")
        assertEquals("fixed", bloque.first, "un bloque `fixed` solo puede venir de defaults.json")
        assertEquals("${EditorTestConfig.BASE_URL}/templates2/template/$slug/rsvp-bg.webp", bloque.second)
        assertEquals(version.templateVersionId, versiones.porSlugYVersion(slug, "1.0.0")!!.templateVersionId)
    }

    @Test
    fun `sin alias los dos bloques siguen vacios - el estado anterior a I-09`() {
        registrarSinAlias()
        editor.chooseTemplate(customerId, invitationId, cuerpo())

        val r = editor.getDocument(customerId, invitationId)

        assertEquals("empty", bloqueDelComposed(r, "cover", "cover.image").first)
        assertEquals("empty", bloqueDelComposed(r, "rsvp", "rsvp.background").first)
        assertEquals(listOf("cover.image"), r.report.get("missingRequired").map { it.asText() })
    }

    // ---------------------------------------------------------------------------------------- 3

    @Test
    fun `el assetMeta del reductor tambien trae el alias, para que image aspect valide`() {
        val version = registrarConAlias()

        val meta = editor.metadatosDeAssets(invitationId, version)

        val portada = meta[aliasPortada]
        assertNotNull(portada, "sin esto el reductor devolvería TPL_ASSET_NOT_OWNED para el alias")
        assertEquals(1200, portada!!.width)
        assertEquals(1680, portada.height)
        assertEquals("image/webp", portada.contentType)
    }

    // ---------------------------------------------------------------------------------------- 4

    /**
     * La garantía dura de ADR-3B-I09-01: **el alias no puede pisar jamás a un asset real**. Se monta
     * el peor caso posible —un asset de la INVITACIÓN cuyo `public_id` es exactamente el `id` que el
     * manifiesto declara— y gana el asset real. La base sigue siendo la autoridad; el alias es un
     * relleno de huecos.
     */
    @Test
    fun `si un id del manifiesto choca con un publicId real de la invitacion, gana el real`() {
        val version = registrarConAlias()
        insertarAsset(
            publicId = aliasPortada.value,
            sha256 = "c".repeat(64),
            s3Key = "templates2/invitation/$invitationId/de-la-clienta.webp",
            invitationId = invitationId,
            versionId = null,
            width = 640,
            height = 480,
        )

        val indice = editor.indiceDeAssets(invitationId, version)
        val meta = editor.metadatosDeAssets(invitationId, version)

        assertEquals(
            "${EditorTestConfig.BASE_URL}/templates2/invitation/$invitationId/de-la-clienta.webp",
            indice[aliasPortada]!!.url,
            "la foto de la clienta manda sobre el alias del paquete",
        )
        assertEquals(640, meta[aliasPortada]!!.width)
    }

    // ---------------------------------------------------------------------------------------------

    private fun cuerpo() = json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}""")

    /** `provenance` y `value.url` de un bloque escalar del `composed`. */
    private fun bloqueDelComposed(r: DocumentResponse, seccion: String, blockId: String): Pair<String, String?> {
        val s = r.composed.get("sections").first { it.get("key").asText() == seccion }
        val b = s.get("blocks").first { it.get("id").asText() == blockId }
        val valor = b.get("value")
        return b.get("provenance").asText() to valor?.takeIf { !it.isNull }?.get("url")?.asText()
    }

    private fun paquete(conAlias: Boolean): TemplatePackage {
        val manifiesto = Fx.manifiesto(
            listOf(
                Fx.seccion(
                    "cover", SectionType.COVER,
                    listOf(
                        Fx.texto("cover.title", BlockRole.COVER_TITLE, required = true),
                        Fx.imagen("cover.image", BlockRole.COVER_IMAGE, ImageAspect.PORTRAIT, required = true),
                    ),
                    required = true,
                ),
                Fx.seccion(
                    "rsvp", SectionType.RSVP,
                    // `source = fixed`: su ÚNICO origen posible es `defaults.json` (I-21 impide
                    // escribirlo: `422 TPL_BLOCK_NOT_EDITABLE`). Es el caso que ninguna alternativa
                    // a los alias cubría.
                    listOf(
                        Fx.imagen(
                            "rsvp.background", BlockRole.RSVP_BACKGROUND, ImageAspect.WIDE,
                            source = BlockSource.FIXED,
                        ),
                    ),
                ),
            ),
            slug = slug,
            assets = listOf(
                AssetEntry(
                    id = if (conAlias) aliasPortada else null,
                    path = "assets/cover.webp", sha256 = shaPortada,
                    contentType = AssetContentType.IMAGE_WEBP, bytes = 46_544,
                ),
                AssetEntry(
                    id = if (conAlias) aliasFondo else null,
                    path = "assets/rsvp-bg.webp", sha256 = shaFondo,
                    contentType = AssetContentType.IMAGE_WEBP, bytes = 43_340,
                ),
            ),
        )
        return TemplatePackage(
            manifest = manifiesto,
            theme = Fx.tema(),
            defaults = Fx.defaults(
                manifiesto,
                mapOf<String, BlockValue>(
                    "cover.title" to TextValue(TEXTO_DEMO),
                    "cover.image" to ImageValue(aliasPortada, "Pareja en el campo", Focal(0.5, 0.35)),
                    "rsvp.background" to ImageValue(aliasFondo, "", Focal(0.5, 0.5)),
                ),
            ),
        )
    }

    private fun registrarConAlias(): LoadedTemplateVersion = registrarYSembrar(paquete(conAlias = true))

    private fun registrarSinAlias(): LoadedTemplateVersion = registrarYSembrar(paquete(conAlias = false))

    /** Registra la versión y siembra las dos filas de `tpl_asset` que dejaría `TemplateRegistrar`. */
    private fun registrarYSembrar(pkg: TemplatePackage): LoadedTemplateVersion {
        val versionId = registrarVersion(pkg)
        insertarAsset(publicIdDe(shaPortada), shaPortada, "templates2/template/$slug/cover.webp", null, versionId, 1200, 1680)
        insertarAsset(publicIdDe(shaFondo), shaFondo, "templates2/template/$slug/rsvp-bg.webp", null, versionId, 1920, 1080)
        return versiones.porId(versionId)!!
    }

    /**
     * El `publicId` que acuñaría el servidor: un ULID opaco, NADA que ver con el alias que el
     * manifiesto declara. Crockford base32 en mayúsculas, 26 caracteres (sin I, L, O ni U).
     */
    private fun publicIdDe(sha256: String): String =
        "as_" + ("01J8SERV1D0R" + (if (sha256.first() == 'a') "P1" else "P2")).padEnd(26, '0')

    @Suppress("LongParameterList")
    private fun insertarAsset(
        publicId: String,
        sha256: String,
        s3Key: String,
        invitationId: Long?,
        versionId: Long?,
        width: Int,
        height: Int,
    ) {
        actualizar(
            "INSERT INTO tpl_asset (public_id, invitation_id, template_version_id, bucket, s3_key, sha256, " +
                "content_type, bytes, width, height) VALUES (?, ?, ?, 'bucket-de-pruebas', ?, ?, 'image/webp', 1000, ?, ?)",
            publicId, invitationId, versionId, s3Key, sha256, width, height,
        )
    }

    @Test
    fun `guarda de la prueba - el publicId sembrado no es el alias`() {
        assertTrue(publicIdDe(shaPortada) != aliasPortada.value)
        assertTrue(publicIdDe(shaFondo) != aliasFondo.value)
    }
}
