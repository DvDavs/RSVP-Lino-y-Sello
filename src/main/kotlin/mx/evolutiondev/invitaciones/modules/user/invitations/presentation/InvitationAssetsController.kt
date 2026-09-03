package mx.evolutiondev.invitaciones.modules.user.invitations.presentation

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.image.ImageOptimizationService
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.core.s3.S3KeyService 
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.core.validation.FileValidationService
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.user.invitations.presentation.model.AssetDeleteRequest
import mx.evolutiondev.invitaciones.modules.user.invitations.presentation.model.AssetUploadResponse
import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationAccessValidationService
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import software.amazon.awssdk.services.s3.model.S3Exception

@RestController
@RequestMapping("/user/invitations")
class InvitationAssetsController(
    private val s3Service: S3Service,
    private val s3KeyService: S3KeyService,
    private val imageOptimizationService: ImageOptimizationService,
    private val fileValidationService: FileValidationService,
    private val invitationAccessValidationService: InvitationAccessValidationService,
    private val hierarchyValidationService: HierarchyValidationService
) {

    /**
     * Uploads an image asset for an invitation.
     * 
     * @param invitationId The ID of the invitation
     * @param sectionPath The section path in dot notation (e.g., "gallery.items.0")
     * @param file The image file to upload
     * @param authentication The authenticated user
     * @return AssetUploadResponse containing the public URL and S3 key
     */
    @PostMapping("/{invitationId}/assets/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @ResponseStatus(HttpStatus.OK)
    fun uploadAsset(
        @PathVariable invitationId: Long,
        @RequestParam sectionPath: String,
        @RequestParam("file") file: MultipartFile,
        authentication: Authentication
    ): AssetUploadResponse {
        val userId = authentication.userId()
        
        invitationAccessValidationService.validateInvitationAccess(userId, invitationId)
        fileValidationService.validateImageUpload(file)
        
        try {
            val fileExtension = s3KeyService.extractFileExtension(file.originalFilename)
            val key = s3KeyService.generateInvitationAssetKey(
                userId = userId,
                invitationId = invitationId,
                sectionPath = sectionPath,
                fileExtension = fileExtension
            )
            
            val contentType = file.contentType ?: "image/jpeg"
            val optimizedBytes = imageOptimizationService.optimizeImage(file.bytes, contentType)
            
            val publicUrl = s3Service.uploadPublicFile(
                bucket = S3Buckets.ASSETS,
                key = key,
                fileBytes = optimizedBytes,
                contentType = contentType
            )
            
            return AssetUploadResponse(
                url = publicUrl.toString(),
                key = key
            )
        } catch (e: S3Exception) {
            throw RuntimeException("Error al subir el archivo")
        }
    }

    /**
     * Deletes an asset from an invitation.
     * 
     * @param invitationId The ID of the invitation
     * @param request The delete request containing the asset URL
     * @param authentication The authenticated user
     * @return GeneralMessageResponse with success message
     */
    @DeleteMapping("/{invitationId}/assets/delete")
    @ResponseStatus(HttpStatus.OK)
    fun deleteAsset(
        @PathVariable invitationId: Long,
        @RequestBody request: AssetDeleteRequest,
        authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        
        invitationAccessValidationService.validateInvitationAccess(userId, invitationId)
        
        try {
            val key = s3KeyService.extractKeyFromUrl(request.assetUrl)
            val keyUserId = s3KeyService.extractUserIdFromKey(key)
            
            if (keyUserId != userId) {
                if (!hierarchyValidationService.validateUserAccess(userId, keyUserId)) {
                    throw IllegalArgumentException("No tienes permiso para eliminar este archivo")
                }
            }
            
            s3Service.deleteFile(S3Buckets.ASSETS, key)
            
            return GeneralMessageResponse(message = "Archivo eliminado exitosamente")
        } catch (e: IllegalArgumentException) {
            throw e
        } catch (e: S3Exception) {
            throw RuntimeException("Error al eliminar el archivo")
        }
    }
}
