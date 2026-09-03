package mx.evolutiondev.invitaciones.core.image

import net.coobird.thumbnailator.Thumbnails
import org.springframework.stereotype.Service
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO

@Service
class ImageOptimizationService(
    private val imageFormatResolver: ImageFormatResolver 
) {

    companion object {
        private const val MAX_WIDTH = 1920
        private const val MAX_HEIGHT = 1920
        private const val COMPRESSION_QUALITY = 0.85
    }

    /**
     * Optimizes an image by resizing if necessary and compressing to reduce file size
     * while maintaining acceptable quality.
     *
     * @param imageBytes The original image bytes
     * @param contentType The MIME type of the image (e.g., "image/jpeg")
     * @return Optimized image bytes
     */
    fun optimizeImage(imageBytes: ByteArray, contentType: String): ByteArray {
        val inputStream = ByteArrayInputStream(imageBytes)
        val image = ImageIO.read(inputStream)
            ?: throw IllegalArgumentException("No se pudo leer la imagen")

        val width = image.width
        val height = image.height

        val needsResize = width > MAX_WIDTH || height > MAX_HEIGHT

        val outputStream = ByteArrayOutputStream()

        val format = imageFormatResolver.getFormatFromContentType(contentType)

        if (needsResize) {
            Thumbnails.of(image)
                .size(MAX_WIDTH, MAX_HEIGHT)
                .outputFormat(format)
                .outputQuality(COMPRESSION_QUALITY)
                .toOutputStream(outputStream)
        } else {
            Thumbnails.of(image)
                .scale(1.0)
                .outputFormat(format)
                .outputQuality(COMPRESSION_QUALITY)
                .toOutputStream(outputStream)
        }

        return outputStream.toByteArray()
    }

    /**
     * Resizes an image if it exceeds the maximum width or height.
     * Maintains aspect ratio.
     *
     * @param imageBytes The original image bytes
     * @param contentType The MIME type of the image
     * @return Resized image bytes, or original if no resize needed
     */
    fun resizeIfNeeded(imageBytes: ByteArray, contentType: String): ByteArray {
        val inputStream = ByteArrayInputStream(imageBytes)
        val image = ImageIO.read(inputStream)
            ?: throw IllegalArgumentException("No se pudo leer la imagen")

        val width = image.width
        val height = image.height

        if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
            return imageBytes
        }

        val outputStream = ByteArrayOutputStream()
        val format = imageFormatResolver.getFormatFromContentType(contentType)

        Thumbnails.of(image)
            .size(MAX_WIDTH, MAX_HEIGHT)
            .outputFormat(format)
            .toOutputStream(outputStream)

        return outputStream.toByteArray()
    }

    /**
     * Compresses an image to reduce file size while maintaining quality.
     *
     * @param imageBytes The original image bytes
     * @param contentType The MIME type of the image
     * @param quality Compression quality (0.0 to 1.0), defaults to 0.85
     * @return Compressed image bytes
     */
    fun compressImage(imageBytes: ByteArray, contentType: String, quality: Double = COMPRESSION_QUALITY): ByteArray {
        val inputStream = ByteArrayInputStream(imageBytes)
        val image = ImageIO.read(inputStream)
            ?: throw IllegalArgumentException("No se pudo leer la imagen")

        val outputStream = ByteArrayOutputStream()
        val format = imageFormatResolver.getFormatFromContentType(contentType)

        Thumbnails.of(image)
            .scale(1.0)
            .outputFormat(format)
            .outputQuality(quality)
            .toOutputStream(outputStream)

        return outputStream.toByteArray()
    }
}
