package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.composition.AssetMeta
import mx.evolutiondev.invitaciones.modules.templates2.composition.DefaultOperationReducer
import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.composition.OperationError
import mx.evolutiondev.invitaciones.modules.templates2.composition.OperationResult
import mx.evolutiondev.invitaciones.modules.templates2.composition.ReducerContext
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.io.ByteArrayOutputStream

/**
 * Objeción **ADV-09** de la revisión adversarial global, cerrada en el bloque 2-6 (ADR-2-6-03).
 *
 * El defecto: `contratos.md §3` exige "cero restricciones del esquema sin validador", y `image.aspect`
 * se valida **en el reductor** con `tpl_asset.width`/`height`. 2-5 pobló esas columnas para los assets
 * de invitación (`ImageDimensions`); 2-3 dejaba los de **plantilla** a `NULL` (ADR-2-3-07) y el
 * reductor, por diseño, no comprueba nada si faltan (`01 §6.5`: no rechazar por falta de dato). El
 * resultado era que un `setBlock` con el `assetId` de un asset de plantilla pasaba `aspect` **siempre**.
 *
 * La prueba recorre la cadena entera con las piezas de producción y sin mocks de por medio: registra un
 * paquete real por [TemplateRegistrationService], lee las filas que quedaron en `tpl_asset` y alimenta
 * con ellas el **reductor real**. La costura que se estaba rompiendo —`tpl_asset.width`/`height`— queda
 * fijada por los dos lados a la vez.
 */
class TemplateAssetAspectTest : RegistroTestSupport() {

    @Autowired private lateinit var servicio: TemplateRegistrationService
    @Autowired private lateinit var parser: TemplatePackageParser
    @Autowired private lateinit var assets: TplAssetRepository

    private val slug = "boda-clasica"

    /** 800 × 800: cuadrada, cumple `aspect: "square"`. */
    private val cuadrada = webpVp8x(800, 800)

    /** 1600 × 400: ratio 4,0. Viola `square` y `portrait`; cumple `wide` (≥ 1,6). */
    private val apaisada = webpVp8x(1600, 400)

    @BeforeEach
    fun limpiarAntes() = limpiarCatalogo(slug)

    @AfterEach
    fun limpiarDespues() = limpiarCatalogo(slug)

    @Test
    fun `el registro puebla width y height de los assets del paquete`() {
        val salida = registrar()

        val filas = assets.findAll().filter { it.templateVersionId == salida }
        assertEquals(2, filas.size)
        val porSha = filas.associateBy { it.sha256 }

        val fCuadrada = porSha[sha(cuadrada)]
        assertNotNull(fCuadrada, "falta la fila del asset cuadrado")
        assertEquals(800, fCuadrada!!.width)
        assertEquals(800, fCuadrada.height)

        val fApaisada = porSha[sha(apaisada)]
        assertNotNull(fApaisada, "falta la fila del asset apaisado")
        assertEquals(1600, fApaisada!!.width)
        assertEquals(400, fApaisada.height)
    }

    /**
     * El caso que antes pasaba en silencio: un asset de plantilla de 1600 × 400 en un bloque declarado
     * `aspect: "square"`.
     */
    @Test
    fun `un asset de plantilla que viola image aspect ahora se rechaza`() {
        val error = aplicar("couple.groomPhoto", apaisada)

        assertTrue(error is OperationError.AssetSpecMismatch, "se esperaba AssetSpecMismatch, llegó $error")
        error as OperationError.AssetSpecMismatch
        assertEquals("aspect", error.constraint)
        assertEquals(TplErrorCode.TPL_ASSET_SPEC_MISMATCH, error.code)
    }

    @Test
    fun `y tambien en un bloque obligatorio con aspect portrait`() {
        val error = aplicar("cover.image", apaisada)
        assertEquals("aspect", (error as OperationError.AssetSpecMismatch).constraint)
    }

    @Test
    fun `un asset de plantilla que respeta image aspect se acepta`() {
        assertNull(aplicar("couple.bridePhoto", cuadrada), "800x800 cumple aspect square")
    }

    /**
     * La prueba que impide que las tres anteriores pasen por el motivo equivocado: **con las
     * dimensiones a `NULL` —el estado exacto que dejaba 2-3— el mismo `setBlock` sobre el mismo asset
     * apaisado se acepta**. Sin ella, "ahora se rechaza" no probaría que el remedio es poblar
     * `width`/`height`.
     */
    @Test
    fun `con width y height a NULL el reductor no comprueba nada - el estado anterior a ADV-09`() {
        val versionId = registrar()
        val fila = assets.findAll().first { it.templateVersionId == versionId && it.sha256 == sha(apaisada) }
        val pkg = parser.parse(paquete()).pkg
        val id = AssetId(fila.publicId)

        val ctxSinDimensiones = ReducerContext(
            pkg = pkg,
            newUlid = { "01J8ZZZZZZZZZZZZZZZZZZZZZZ" },
            assetMeta = { if (it == id) AssetMeta(fila.bytes, null, null, fila.contentType) else null },
        )
        val r = DefaultOperationReducer.apply(
            Fx.documento(pkg.manifest, pkg.theme),
            Operation.SetBlock(BlockId("couple.groomPhoto"), ImageValue(id, "", Focal(0.5, 0.5))),
            ctxSinDimensiones,
        )
        assertTrue(r is OperationResult.Ok, "sin dimensiones el aspect no se comprueba (01 §6.5): $r")
    }

    // ---------------------------------------------------------------------------------------------

    /** Registra el paquete y devuelve el `template_version_id`. */
    private fun registrar(): Long = servicio.register(paquete()).templateVersionId

    /**
     * `boda-clasica-1.0.0` con bytes de imagen **reales** en sus dos assets declarados. El manifiesto
     * del ejemplo ya trae `cover.image` con `aspect: "portrait"` y `couple.{groom,bride}Photo` con
     * `aspect: "square"`: no hace falta inventar una plantilla para probar esto.
     */
    private fun paquete(): RawTemplatePackage = PaqueteFixture.ejemplo(
        "boda-clasica-1.0.0",
        mapOf("assets/preview.webp" to cuadrada, "assets/rsvp-bg.webp" to apaisada),
    )

    /** Ejecuta un `setBlock` con el asset de plantilla ya registrado; `null` si el reductor lo acepta. */
    private fun aplicar(blockId: String, bytes: ByteArray): OperationError? {
        val versionId = registrar()
        val fila = assets.findAll().first { it.templateVersionId == versionId && it.sha256 == sha(bytes) }
        val pkg = parser.parse(paquete()).pkg
        val id = AssetId(fila.publicId)

        val ctx = ReducerContext(
            pkg = pkg,
            newUlid = { "01J8ZZZZZZZZZZZZZZZZZZZZZZ" },
            // Exactamente lo que arma `EditorDocumentService.metadatosDeAssets` con la fila real.
            assetMeta = { if (it == id) AssetMeta(fila.bytes, fila.width, fila.height, fila.contentType) else null },
        )
        val r = DefaultOperationReducer.apply(
            Fx.documento(pkg.manifest, pkg.theme),
            Operation.SetBlock(BlockId(blockId), ImageValue(id, "", Focal(0.5, 0.5))),
            ctx,
        )
        return (r as? OperationResult.Failed)?.error
    }

    private fun sha(bytes: ByteArray): String = PaqueteFixture.hex(PaqueteFixture.sha256(bytes))

    /**
     * WebP extendido (`VP8X`), que es el único contenedor cuyo lienzo admite 24 bits por dimensión, así
     * que sirve para cualquier tamaño de prueba. Pasa [MagicBytes] (`RIFF` … `WEBP`) e
     * [ImageDimensions] con las dimensiones exactas que se le piden.
     */
    private fun webpVp8x(ancho: Int, alto: Int): ByteArray {
        val datos = ByteArrayOutputStream()
        datos.write(ByteArray(4))                       // banderas + reservado
        datos.write(le24(ancho - 1))
        datos.write(le24(alto - 1))
        datos.write(ByteArray(12))
        val cuerpo = datos.toByteArray()

        val salida = ByteArrayOutputStream()
        salida.write("RIFF".toByteArray(Charsets.US_ASCII))
        salida.write(le32(cuerpo.size + 12))
        salida.write("WEBP".toByteArray(Charsets.US_ASCII))
        salida.write("VP8X".toByteArray(Charsets.US_ASCII))
        salida.write(le32(cuerpo.size))
        salida.write(cuerpo)
        return salida.toByteArray()
    }

    private fun le32(v: Int) = byteArrayOf(v.toByte(), (v ushr 8).toByte(), (v ushr 16).toByte(), (v ushr 24).toByte())
    private fun le24(v: Int) = byteArrayOf(v.toByte(), (v ushr 8).toByte(), (v ushr 16).toByte())

    /** Guarda de la prueba: si el fixture dejara de ser un WebP legible, todo lo demás sería vacuo. */
    @Test
    fun `el fixture es un WebP que MagicBytes acepta y ImageDimensions sabe leer`() {
        assertTrue(MagicBytes.coincide(AssetContentType.IMAGE_WEBP, apaisada))
        assertEquals(1600 to 400, ImageDimensions.de(AssetContentType.IMAGE_WEBP, apaisada))
        assertEquals(800 to 800, ImageDimensions.de(AssetContentType.IMAGE_WEBP, cuadrada))
    }
}
