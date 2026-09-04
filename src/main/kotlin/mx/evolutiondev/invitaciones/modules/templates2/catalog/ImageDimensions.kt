package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType

/**
 * Alto y ancho de una imagen leídos **de su cabecera**, sin decodificarla.
 *
 * Hacen falta de verdad, no son adorno: el reductor hace cumplir `image.aspect` con `meta.width` y
 * `meta.height` de `tpl_asset` (`OperationReducer.kt:376-388`) y, **si faltan, no comprueba nada** y la
 * restricción del `BlockSpec` queda sin validador — justo lo que `contratos.md §3` prohíbe ("cero
 * restricciones del esquema sin validador"). Este es el único punto donde el dato existe.
 *
 * No se usa `ImageIO`: no trae lector de WebP, que es el formato preferente del módulo, y decodificar
 * la imagen entera para leer dos números gasta memoria proporcional al tamaño de la imagen. Leer la
 * cabecera es exacto y acotado.
 *
 * **Por qué vive en `catalog` y no en `api` (objeción ADV-09, bloque 2-6).** 2-5 lo escribió dentro de
 * `api/EditorAssetService.kt`, así que solo lo usaba la subida de assets **de invitación**; 2-3 dejaba
 * los assets **de plantilla** con `width`/`height` a `NULL` (ADR-2-3-07) y el reductor, por diseño, no
 * comprueba nada si faltan las dimensiones: un `setBlock` con el `assetId` de un asset de plantilla
 * pasaba `image.aspect` **siempre**. Aquí, junto a [MagicBytes] —el otro lector de cabeceras, que ya
 * comparten las dos rutas de alta—, lo usan las dos: `api.EditorAssetService.subir` y
 * `catalog.TemplateRegistrationService.subirAssets`. Cero restricciones del esquema sin validador
 * (`contratos.md §3`).
 *
 * **Lo que sigue sin cubrir**: un archivo cuya cabecera no se pueda leer devuelve `null` y su
 * `aspect` no se comprueba. Es deliberado (`01 §6.5`: no rechazar por falta de dato) y vale igual para
 * las dos rutas; el rechazo por tipo lo hace antes [MagicBytes].
 */
object ImageDimensions {

    /** `null` cuando el formato no es de imagen o la cabecera no es legible; nunca lanza. */
    fun de(tipo: AssetContentType, bytes: ByteArray): Pair<Int, Int>? = when (tipo) {
        AssetContentType.IMAGE_PNG -> png(bytes)
        AssetContentType.IMAGE_JPEG -> jpeg(bytes)
        AssetContentType.IMAGE_WEBP -> webp(bytes)
        else -> null
    }

    /**
     * Firma (8) + longitud (4) + `IHDR` (4) + ancho (4) + alto (4), big-endian.
     *
     * Se comprueban la **firma** y el nombre del primer *chunk*, que en un PNG bien formado es siempre
     * `IHDR`. Sin esa guarda, cualquier archivo de 24 bytes o más devolvía los cuatro bytes de las
     * posiciones 16 y 20 como si fueran dimensiones: números inventados que el reductor usaría para
     * rechazar o aceptar un `image.aspect`. Inventar es peor que devolver `null` (`01 §6.5`).
     */
    private fun png(b: ByteArray): Pair<Int, Int>? {
        if (b.size < 24) return null
        if (!empiezaPor(b, FIRMA_PNG)) return null
        if (ascii(b, 12, 4) != "IHDR") return null
        val w = entero32(b, 16)
        val h = entero32(b, 20)
        return if (w > 0 && h > 0) w to h else null
    }

    private val FIRMA_PNG = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)

    private fun empiezaPor(b: ByteArray, firma: ByteArray): Boolean {
        if (b.size < firma.size) return false
        for (i in firma.indices) if (b[i] != firma[i]) return false
        return true
    }

    /**
     * Se recorren los segmentos hasta el primer `SOFn` (`0xC0`-`0xCF` salvo `C4`, `C8` y `CC`, que no
     * son marcos). Alto y ancho van en los bytes 5-8 del segmento, big-endian.
     */
    @Suppress("ReturnCount", "MagicNumber")
    private fun jpeg(b: ByteArray): Pair<Int, Int>? {
        var i = 2
        while (i + 9 < b.size) {
            if ((b[i].toInt() and 0xFF) != 0xFF) { i++; continue }
            val marca = b[i + 1].toInt() and 0xFF
            val longitud = ((b[i + 2].toInt() and 0xFF) shl 8) or (b[i + 3].toInt() and 0xFF)
            val esMarco = marca in 0xC0..0xCF && marca != 0xC4 && marca != 0xC8 && marca != 0xCC
            if (esMarco) {
                val h = ((b[i + 5].toInt() and 0xFF) shl 8) or (b[i + 6].toInt() and 0xFF)
                val w = ((b[i + 7].toInt() and 0xFF) shl 8) or (b[i + 8].toInt() and 0xFF)
                return if (w > 0 && h > 0) w to h else null
            }
            if (longitud < 2) return null
            i += 2 + longitud
        }
        return null
    }

    /** Los tres contenedores reales de WebP: `VP8 ` (con pérdida), `VP8L` (sin) y `VP8X` (extendido). */
    @Suppress("MagicNumber")
    private fun webp(b: ByteArray): Pair<Int, Int>? {
        if (b.size < 30) return null
        return when (ascii(b, 12, 4)) {
            "VP8 " -> {
                val w = (((b[27].toInt() and 0xFF) shl 8) or (b[26].toInt() and 0xFF)) and 0x3FFF
                val h = (((b[29].toInt() and 0xFF) shl 8) or (b[28].toInt() and 0xFF)) and 0x3FFF
                if (w > 0 && h > 0) w to h else null
            }
            "VP8L" -> {
                val bits = (b[21].toInt() and 0xFF) or ((b[22].toInt() and 0xFF) shl 8) or
                    ((b[23].toInt() and 0xFF) shl 16) or ((b[24].toInt() and 0xFF) shl 24)
                val w = (bits and 0x3FFF) + 1
                val h = ((bits ushr 14) and 0x3FFF) + 1
                w to h
            }
            "VP8X" -> {
                val w = entero24(b, 24) + 1
                val h = entero24(b, 27) + 1
                w to h
            }
            else -> null
        }
    }

    private fun entero32(b: ByteArray, off: Int): Int =
        ((b[off].toInt() and 0xFF) shl 24) or ((b[off + 1].toInt() and 0xFF) shl 16) or
            ((b[off + 2].toInt() and 0xFF) shl 8) or (b[off + 3].toInt() and 0xFF)

    private fun entero24(b: ByteArray, off: Int): Int =
        (b[off].toInt() and 0xFF) or ((b[off + 1].toInt() and 0xFF) shl 8) or
            ((b[off + 2].toInt() and 0xFF) shl 16)

    private fun ascii(b: ByteArray, off: Int, largo: Int): String =
        String(b, off, largo, Charsets.US_ASCII)
}
