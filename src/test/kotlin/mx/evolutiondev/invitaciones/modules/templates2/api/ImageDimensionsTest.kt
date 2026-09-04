package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.catalog.ImageDimensions
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream

/**
 * `ImageDimensions` lee el alto y el ancho de la **cabecera**, sin decodificar la imagen.
 *
 * Esto no es un detalle de comodidad: si `tpl_asset.width`/`height` quedan nulos, el reductor **no
 * comprueba** `image.aspect` (`OperationReducer.kt:377-388`) y una restricción declarada en el
 * `BlockSpec` se queda sin validador, que es justo lo que `contratos.md §3` prohíbe. Por eso los tres
 * formatos que el editor acepta tienen aquí su caso, incluidos los **tres** contenedores de WebP: el
 * formato preferente del módulo es el único que `ImageIO` no sabe leer.
 */
class ImageDimensionsTest {

    @Test
    fun `PNG lee el ancho y el alto del IHDR`() {
        assertEquals(1600 to 1200, ImageDimensions.de(AssetContentType.IMAGE_PNG, png(1600, 1200)))
        assertEquals(1 to 1, ImageDimensions.de(AssetContentType.IMAGE_PNG, png(1, 1)))
    }

    @Test
    fun `JPEG recorre los segmentos hasta el primer SOF`() {
        // Un APP0 (JFIF) por delante, como en cualquier JPEG real, y luego el SOF0.
        assertEquals(800 to 600, ImageDimensions.de(AssetContentType.IMAGE_JPEG, jpeg(800, 600, marcaSof = 0xC0)))
        // SOF2 (progresivo) es igual de válido.
        assertEquals(64 to 48, ImageDimensions.de(AssetContentType.IMAGE_JPEG, jpeg(64, 48, marcaSof = 0xC2)))
    }

    @Test
    fun `JPEG ignora los marcadores que no son de marco`() {
        // 0xC4 es una tabla Huffman, no un marco: si se confundiera, devolvería basura.
        val conHuffman = jpeg(320, 240, marcaSof = 0xC1, marcaPrevia = 0xC4)
        assertEquals(320 to 240, ImageDimensions.de(AssetContentType.IMAGE_JPEG, conHuffman))
    }

    @Test
    fun `WebP con perdida (VP8) usa los 14 bits de cada dimension`() {
        assertEquals(1024 to 768, ImageDimensions.de(AssetContentType.IMAGE_WEBP, vp8(1024, 768)))
    }

    @Test
    fun `WebP sin perdida (VP8L) desempaqueta las dimensiones del entero de 32 bits`() {
        assertEquals(300 to 200, ImageDimensions.de(AssetContentType.IMAGE_WEBP, vp8l(300, 200)))
    }

    @Test
    fun `WebP extendido (VP8X) lee el lienzo de 24 bits`() {
        assertEquals(4000 to 3000, ImageDimensions.de(AssetContentType.IMAGE_WEBP, vp8x(4000, 3000)))
    }

    @Test
    fun `lo que no es imagen o no se entiende devuelve null en vez de inventar`() {
        assertNull(ImageDimensions.de(AssetContentType.AUDIO_MPEG, ByteArray(64)))
        assertNull(ImageDimensions.de(AssetContentType.IMAGE_PNG, ByteArray(10)), "PNG truncado")
        assertNull(ImageDimensions.de(AssetContentType.IMAGE_JPEG, ByteArray(4)), "JPEG truncado")
        assertNull(ImageDimensions.de(AssetContentType.IMAGE_WEBP, ByteArray(12)), "WebP truncado")
        assertNull(
            ImageDimensions.de(AssetContentType.IMAGE_WEBP, riff("XXXX", ByteArray(40))),
            "un contenedor WebP desconocido no se adivina",
        )
        assertNull(ImageDimensions.de(AssetContentType.IMAGE_PNG, png(0, 0)), "0x0 no es una imagen")
        // ADV-09: sin la guarda de firma + IHDR, cualquier archivo de >= 24 B declarado PNG devolvía
        // los bytes de las posiciones 16 y 20 como si fueran dimensiones. Inventar es peor que null.
        assertNull(
            ImageDimensions.de(AssetContentType.IMAGE_PNG, ByteArray(64) { (it * 31 and 0x7F).toByte() }),
            "sin la firma PNG no hay dimensiones que leer",
        )
        assertNull(
            ImageDimensions.de(
                AssetContentType.IMAGE_PNG,
                byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) + ByteArray(40),
            ),
            "con la firma pero sin IHDR en el primer chunk, tampoco",
        )
        assertNull(
            ImageDimensions.de(AssetContentType.IMAGE_JPEG, byteArrayOf(0xFF.toByte(), 0xD8.toByte()) + ByteArray(20)),
            "sin ningún SOF no hay dimensiones",
        )
    }

    // =============================================================================================
    // Constructores de cabeceras reales
    // =============================================================================================

    private fun png(ancho: Int, alto: Int): ByteArray {
        val salida = ByteArrayOutputStream()
        salida.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        salida.write(byteArrayOf(0, 0, 0, 13))
        salida.write("IHDR".toByteArray(Charsets.US_ASCII))
        salida.write(be32(ancho))
        salida.write(be32(alto))
        salida.write(byteArrayOf(8, 6, 0, 0, 0))
        salida.write(ByteArray(4))
        return salida.toByteArray()
    }

    private fun jpeg(ancho: Int, alto: Int, marcaSof: Int, marcaPrevia: Int? = null): ByteArray {
        val salida = ByteArrayOutputStream()
        salida.write(byteArrayOf(0xFF.toByte(), 0xD8.toByte())) // SOI
        // APP0 de 16 bytes, como el JFIF de cualquier cámara.
        salida.write(byteArrayOf(0xFF.toByte(), 0xE0.toByte(), 0x00, 0x10))
        salida.write(ByteArray(14))
        if (marcaPrevia != null) {
            salida.write(byteArrayOf(0xFF.toByte(), marcaPrevia.toByte(), 0x00, 0x06))
            salida.write(ByteArray(4))
        }
        salida.write(byteArrayOf(0xFF.toByte(), marcaSof.toByte(), 0x00, 0x11))
        salida.write(byteArrayOf(8)) // precisión
        salida.write(byteArrayOf((alto shr 8).toByte(), alto.toByte()))
        salida.write(byteArrayOf((ancho shr 8).toByte(), ancho.toByte()))
        salida.write(ByteArray(10))
        return salida.toByteArray()
    }

    /** `RIFF` + tamaño + `WEBP` + el chunk pedido. */
    private fun riff(chunk: String, datos: ByteArray): ByteArray {
        val salida = ByteArrayOutputStream()
        salida.write("RIFF".toByteArray(Charsets.US_ASCII))
        salida.write(le32(datos.size + 12))
        salida.write("WEBP".toByteArray(Charsets.US_ASCII))
        salida.write(chunk.toByteArray(Charsets.US_ASCII))
        salida.write(le32(datos.size))
        salida.write(datos)
        return salida.toByteArray()
    }

    private fun vp8(ancho: Int, alto: Int): ByteArray {
        val datos = ByteArrayOutputStream()
        datos.write(byteArrayOf(0x00, 0x00, 0x00)) // frame tag
        datos.write(byteArrayOf(0x9D.toByte(), 0x01, 0x2A)) // start code
        datos.write(byteArrayOf(ancho.toByte(), (ancho shr 8).toByte()))
        datos.write(byteArrayOf(alto.toByte(), (alto shr 8).toByte()))
        datos.write(ByteArray(8))
        return riff("VP8 ", datos.toByteArray())
    }

    private fun vp8l(ancho: Int, alto: Int): ByteArray {
        val bits = ((ancho - 1) and 0x3FFF) or (((alto - 1) and 0x3FFF) shl 14)
        val datos = ByteArrayOutputStream()
        datos.write(byteArrayOf(0x2F)) // firma VP8L
        datos.write(le32(bits))
        datos.write(ByteArray(12))
        return riff("VP8L", datos.toByteArray())
    }

    private fun vp8x(ancho: Int, alto: Int): ByteArray {
        val datos = ByteArrayOutputStream()
        datos.write(ByteArray(4)) // banderas + reservado
        datos.write(le24(ancho - 1))
        datos.write(le24(alto - 1))
        datos.write(ByteArray(12))
        return riff("VP8X", datos.toByteArray())
    }

    private fun be32(v: Int) = byteArrayOf((v ushr 24).toByte(), (v ushr 16).toByte(), (v ushr 8).toByte(), v.toByte())
    private fun le32(v: Int) = byteArrayOf(v.toByte(), (v ushr 8).toByte(), (v ushr 16).toByte(), (v ushr 24).toByte())
    private fun le24(v: Int) = byteArrayOf(v.toByte(), (v ushr 8).toByte(), (v ushr 16).toByte())
}
