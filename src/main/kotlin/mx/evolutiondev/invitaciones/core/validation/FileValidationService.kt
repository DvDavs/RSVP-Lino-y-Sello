package mx.evolutiondev.invitaciones.core.validation

import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

@Service
class FileValidationService {

    companion object {
        private val ALLOWED_IMAGE_TYPES = listOf("image/jpeg", "image/png", "image/gif", "image/webp")
        private const val MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
    }

    /**
     * Validates that the uploaded file is an image with an allowed content type.
     * Allowed types: JPEG, PNG, GIF, WEBP
     * 
     * @param file The multipart file to validate
     * @throws IllegalArgumentException if the file type is not allowed
     */
    fun validateImageFile(file: MultipartFile) {
        if (file.contentType !in ALLOWED_IMAGE_TYPES) {
            throw IllegalArgumentException("El archivo debe ser una imagen válida (JPEG, PNG, GIF, WEBP)")
        }
    }

    /**
     * Validates that the file size does not exceed the maximum allowed size.
     * Maximum size: 5MB
     * 
     * @param file The multipart file to validate
     * @throws IllegalArgumentException if the file size exceeds the limit
     */
    fun validateFileSize(file: MultipartFile) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw IllegalArgumentException("El archivo no debe exceder los 5MB de tamaño")
        }
    }

    /**
     * Validates both image type and file size.
     * 
     * @param file The multipart file to validate
     * @throws IllegalArgumentException if validation fails
     */
    fun validateImageUpload(file: MultipartFile) {
        validateImageFile(file)
        validateFileSize(file)
    }
}

