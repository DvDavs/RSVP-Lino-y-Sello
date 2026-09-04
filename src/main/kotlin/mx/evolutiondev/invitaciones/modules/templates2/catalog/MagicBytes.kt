package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType

/**
 * Verificación del **número mágico** de un asset (`02 §10.1` paso 4): el `contentType` declarado tiene
 * que corresponder con los primeros bytes del archivo. El módulo antiguo solo mira el `content-type`
 * declarado (`core/validation/FileValidationService.kt:21-24`); aquí no basta, porque el declarante es
 * quien sube el paquete.
 *
 * Discrepancia → `415 TPL_ASSET_TYPE_UNSUPPORTED` (`03 §5`). Puro y sin E/S.
 */
object MagicBytes {

    fun coincide(tipo: AssetContentType, bytes: ByteArray): Boolean = when (tipo) {
        AssetContentType.IMAGE_WEBP -> prefijo(bytes, "RIFF") && enPosicion(bytes, 8, "WEBP")
        AssetContentType.IMAGE_PNG -> empiezaPor(bytes, PNG)
        AssetContentType.IMAGE_JPEG -> empiezaPor(bytes, JPEG)
        AssetContentType.IMAGE_SVG -> esSvg(bytes)
        AssetContentType.AUDIO_MPEG -> esMp3(bytes)
        AssetContentType.FONT_WOFF2 -> prefijo(bytes, "wOF2")
    }

    private val PNG = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    private val JPEG = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())

    private fun empiezaPor(bytes: ByteArray, firma: ByteArray): Boolean {
        if (bytes.size < firma.size) return false
        for (i in firma.indices) if (bytes[i] != firma[i]) return false
        return true
    }

    private fun prefijo(bytes: ByteArray, ascii: String): Boolean = enPosicion(bytes, 0, ascii)

    private fun enPosicion(bytes: ByteArray, offset: Int, ascii: String): Boolean {
        if (bytes.size < offset + ascii.length) return false
        for (i in ascii.indices) if (bytes[offset + i] != ascii[i].code.toByte()) return false
        return true
    }

    /** SVG es texto: se acepta si el primer elemento no vacío abre `svg` o una declaración XML. */
    private fun esSvg(bytes: ByteArray): Boolean {
        val cabecera = String(bytes.copyOfRange(0, minOf(bytes.size, 512)), Charsets.UTF_8).trimStart()
        return cabecera.startsWith("<?xml") || cabecera.startsWith("<svg") || cabecera.startsWith("<!DOCTYPE svg")
    }

    /** MP3 con etiqueta ID3 o con la cabecera de trama (`0xFF` + 3 bits a 1). */
    private fun esMp3(bytes: ByteArray): Boolean {
        if (prefijo(bytes, "ID3")) return true
        if (bytes.size < 2) return false
        val b0 = bytes[0].toInt() and 0xFF
        val b1 = bytes[1].toInt() and 0xFF
        return b0 == 0xFF && (b1 and 0xE0) == 0xE0
    }
}
