package mx.evolutiondev.invitaciones.modules.user.template.service

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.error.exception.InvitationDisabledException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import mx.evolutiondev.invitaciones.core.error.exception.UserDisabledException
import mx.evolutiondev.invitaciones.core.model.MimeType
import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.core.s3.objectExists
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.user.template.presentation.model.UserInvitationTemplateConfigRequest
import mx.evolutiondev.invitaciones.modules.user.template.presentation.model.UserInvitationTemplateConfigResponse
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import java.net.URL
import java.time.Duration

@Service
class UserTemplateService(
        private val s3: S3Client,
        private val s3Presigner: S3Presigner,
        private val s3Service: S3Service,
        private val invitationRepository: InvitationRepository,
        private val hierarchyValidationService: HierarchyValidationService
) {
    fun recoverInvitationTemplateConfig(
            userId: Long,
            invitationId: Long
    ): UserInvitationTemplateConfigResponse {
        invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación a la que intentas acceder no existe") }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para acceder a esta invitación")
        }

        /**
         * TODO: Recover configuration saved from mongo collections, if doesn't exist, copy general template structure
         * pairing with invitation information
         * */

        return UserInvitationTemplateConfigResponse(emptyMap())
    }

    fun updateInvitationTemplateConfig(
            userId: Long,
            invitationId: Long,
            config: UserInvitationTemplateConfigRequest
    ): UserInvitationTemplateConfigResponse {
        invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación a la que intentas acceder no existe") }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para acceder a esta invitación")
        }

        /**
         * TODO: Update mongo collection with new configuration
         * */

        return UserInvitationTemplateConfigResponse(config.sections)
    }

    fun uploadInvitationTemplate(
            userId: Long,
            invitationId: Long,
            file: MultipartFile
    ): URL {
        val invitation = invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación a la que intentas acceder no existe") }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para acceder a esta invitación")
        }

        if (file.contentType != MimeType.HTML.type) {
            throw IllegalArgumentException("Solo se permiten archivos .html")
        }

        // Usar siempre el customer.id para la ruta, ya que generatePublicSignedUrl usa ownerId (customer.id)
        val ownerId = invitation.customer.id
        val fileKey = "user/$ownerId/invitation/$invitationId/invitation-${invitationId}-template.html"

        // Subir el archivo con permisos públicos y obtener la URL pública permanente
        val publicUrl = s3Service.uploadPublicFile(
                bucket = S3Buckets.ASSETS,
                key = fileKey,
                fileBytes = file.bytes,
                contentType = MimeType.HTML.type
        )

        // Actualizar el estado de la invitación después de la subida exitosa
        invitation.isFinished = true
        invitation.updatedBy = userId
        invitationRepository.save(invitation)

        return publicUrl
    }

    fun generateSignedUrl(userId: Long, invitationId: Long): URL {
        val invitation = invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación a la que intentas acceder no existe") }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para acceder a esta invitación")
        }

        // Usar siempre el customer.id para la ruta, consistente con uploadInvitationTemplate y generatePublicSignedUrl
        val ownerId = invitation.customer.id
        val key = "user/$ownerId/invitation/$invitationId/invitation-${invitationId}-template.html"

        if (!s3.objectExists(S3Buckets.ASSETS, key)) {
            throw IllegalArgumentException("No se ha encontrado la plantilla personalizada de la invitación")
        }

        val getObjectRequest = GetObjectRequest.builder()
                .bucket(S3Buckets.ASSETS)
                .key(key)
                .build()

        val presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofDays(7))
                .getObjectRequest(getObjectRequest)
                .build()

        return s3Presigner.presignGetObject(presignRequest).url()
    }

    /**
     * Generates a signed URL for public access to an invitation template.
     * This method is intended for guests viewing their invitation without authentication.
     * The userId is obtained from the invitation's owner (customer).
     *
     * Validates that:
     * - The invitation is enabled
     * - The owner user is enabled (not disabled)
     * - The owner user is not banned
     *
     * @param invitationId The ID of the invitation
     * @return The signed URL to access the template
     * @throws InvitationDisabledException if the invitation is disabled
     * @throws UserDisabledException if the owner user is disabled
     * @throws UserBannedException if the owner user is banned
     */
    fun generatePublicSignedUrl(invitationId: Long): URL {
        val invitation = invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación no existe") }

        // Validar que la invitación esté habilitada
        if (!invitation.isEnabled) {
            throw InvitationDisabledException("La invitación no está disponible en este momento.")
        }

        val customer = invitation.customer
        if (!customer.isEnabled) {
            throw UserDisabledException("La invitación no está disponible en este momento.")
        }
        if (customer.isBanned) {
            throw UserBannedException("La invitación no está disponible en este momento.")
        }

        val ownerId = customer.id
        val key = "user/$ownerId/invitation/$invitationId/invitation-${invitationId}-template.html"

        if (!s3.objectExists(S3Buckets.ASSETS, key)) {
            throw IllegalArgumentException("No se ha encontrado la plantilla de la invitación")
        }

        val getObjectRequest = GetObjectRequest.builder()
                .bucket(S3Buckets.ASSETS)
                .key(key)
                .build()

        val presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofDays(7))
                .getObjectRequest(getObjectRequest)
                .build()

        return s3Presigner.presignGetObject(presignRequest).url()
    }
}
