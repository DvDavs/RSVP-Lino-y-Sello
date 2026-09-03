package mx.evolutiondev.invitaciones.core.s3

import org.springframework.stereotype.Service
import java.net.URI
import java.util.UUID

@Service
class S3KeyService {

    /**
     * Extracts the S3 key from a full S3 URL.
     * Expected URL format: https://bucket.s3.amazonaws.com/user/123/...
     * or https://bucket.s3.region.amazonaws.com/user/123/...
     * 
     * @param url The full S3 URL
     * @return The extracted S3 key (path after bucket)
     * @throws IllegalArgumentException if the URL format is invalid
     */
    fun extractKeyFromUrl(url: String): String {
        return try {
            val uri = URI(url)
            val path = uri.path.removePrefix("/")
            if (path.isEmpty()) {
                throw IllegalArgumentException("Formato de URL inválido")
            }
            path
        } catch (e: Exception) {
            throw IllegalArgumentException("Formato de URL inválido")
        }
    }

    /**
     * Extracts and validates the user ID from an S3 key.
     * Expected key format: user/{userId}/invitation/{invitationId}/...
     * 
     * @param key The S3 key
     * @return The extracted user ID
     * @throws IllegalArgumentException if the key format is invalid or user ID cannot be parsed
     */
    fun extractUserIdFromKey(key: String): Long {
        val parts = key.split("/")
        if (parts.size < 4 || parts[0] != "user") {
            throw IllegalArgumentException("Formato de URL inválido")
        }
        return parts[1].toLongOrNull()
            ?: throw IllegalArgumentException("ID de usuario inválido en la URL")
    }

    /**
     * Generates a unique S3 key for an invitation asset.
     * Format: user/{userId}/invitation/{invitationId}/{sectionPath}/{uniqueFilename}
     * 
     * @param userId The user ID
     * @param invitationId The invitation ID
     * @param sectionPath The section path in dot notation
     * @param fileExtension The file extension (e.g., "jpg")
     * @return The generated S3 key
     */
    fun generateInvitationAssetKey(
        userId: Long,
        invitationId: Long,
        sectionPath: String,
        fileExtension: String
    ): String {
        val uniqueFilename = "${UUID.randomUUID()}.$fileExtension"
        return "user/$userId/invitation/$invitationId/$sectionPath/$uniqueFilename"
    }

    /**
     * Extracts the file extension from a filename.
     * 
     * @param filename The filename
     * @param defaultExtension The default extension to use if none is found
     * @return The file extension without the dot
     */
    fun extractFileExtension(filename: String?, defaultExtension: String = "jpg"): String {
        return filename?.substringAfterLast('.', "") ?: defaultExtension
    }
}

