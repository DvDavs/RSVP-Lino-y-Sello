package mx.evolutiondev.invitaciones.core.image

import org.springframework.stereotype.Component

@Component
class ImageFormatResolver {

    /**
     * Extracts the image format from the content type.
     *
     * @param contentType The MIME type (e.g., "image/jpeg")
     * @return The format string (e.g., "jpg")
     */
    fun getFormatFromContentType(contentType: String): String {
        return when (contentType.lowercase()) {
            "image/jpeg", "image/jpg" -> "jpg"
            "image/png" -> "png"
            "image/gif" -> "gif"
            "image/webp" -> "webp"
            else -> "jpg"
        }
    }

    /**
     * Validates if the content type is a supported image format.
     *
     * @param contentType The MIME type to validate
     * @return true if the format is supported, false otherwise
     */
    fun isSupportedFormat(contentType: String): Boolean {
        return contentType.lowercase() in listOf(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp"
        )
    }
}

