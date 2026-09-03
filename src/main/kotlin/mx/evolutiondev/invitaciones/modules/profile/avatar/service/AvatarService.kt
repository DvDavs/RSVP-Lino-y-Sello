package mx.evolutiondev.invitaciones.modules.profile.avatar.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.modules.profile.avatar.repository.AvatarRepository
import mx.evolutiondev.invitaciones.modules.profile.avatar.repository.model.AvatarEntity
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.model.AvatarResponse
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.util.*

@Service
class AvatarService(
    private val avatarRepository: AvatarRepository,
    private val s3Service: S3Service
) {
    private val s3Bucket = S3Buckets.EDITOR
    private val avatarS3Path = "user/profile/config/avatars"
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    companion object {
        private const val MAX_FILE_SIZE = 200 * 1024L // 200KB en bytes
        private val ALLOWED_CONTENT_TYPES = setOf(
            "image/jpeg",
            "image/jpg", 
            "image/png",
            "image/webp"
        )
    }

    fun listAvatars(): List<AvatarResponse> {
        return avatarRepository.findAll().map { avatar ->
            val freshUrl = s3Service.generatePresignedUrl(s3Bucket, avatar.s3Key)
            AvatarResponse(
                id = avatar.id,
                url = freshUrl.toString()
            )
        }
    }

    @Transactional
    fun createAvatar(file: MultipartFile): AvatarResponse {
        validateFile(file)
        val extension = getFileExtension(file.contentType)
        val s3Key = "$avatarS3Path/${UUID.randomUUID()}.$extension"
        
        s3Service.uploadFile(s3Bucket, s3Key, file.bytes, file.contentType!!)
    
        val avatar = AvatarEntity(s3Key = s3Key)
        val savedAvatar = avatarRepository.save(avatar)
    
        val freshUrl = s3Service.generatePresignedUrl(s3Bucket, savedAvatar.s3Key)
        return AvatarResponse(id = savedAvatar.id, url = freshUrl.toString())
    }

    @Transactional
    fun updateAvatar(id: Long, file: MultipartFile): AvatarResponse {
        validateFile(file)
        val avatar = findAvatarById(id)
        val oldS3Key = avatar.s3Key
        val extension = getFileExtension(file.contentType)
        val newS3Key = "$avatarS3Path/${UUID.randomUUID()}.$extension"
        
        s3Service.uploadFile(s3Bucket, newS3Key, file.bytes, file.contentType!!)
    
        val updatedAvatar = avatarRepository.save(
            avatar.copy(s3Key = newS3Key)
        )
        
        coroutineScope.launch {
            s3Service.deleteFile(s3Bucket, oldS3Key)
        }
        
        val freshUrl = s3Service.generatePresignedUrl(s3Bucket, updatedAvatar.s3Key)
        return AvatarResponse(id = updatedAvatar.id, url = freshUrl.toString())
    }
    
    @Transactional
    fun deleteAvatar(id: Long) {
        val avatar = findAvatarById(id)
        val s3Key = avatar.s3Key
        
        avatarRepository.delete(avatar)
        
        coroutineScope.launch {
            s3Service.deleteFile(s3Bucket, s3Key)
        }
    }

    fun findAvatarById(id: Long): AvatarEntity {
        return avatarRepository.findById(id)
            .orElseThrow { IllegalArgumentException("El avatar con id $id no existe") }
    }

    private fun validateFile(file: MultipartFile) {
        if (file.isEmpty) {
            throw IllegalArgumentException("El archivo no puede estar vacío.")
        }
        
        if (file.size > MAX_FILE_SIZE) {
            throw IllegalArgumentException("El archivo excede el tamaño máximo permitido de 200KB. Por favor, optimiza tu imagen antes de subirla.")
        }
        
        val contentType = file.contentType
        if (contentType == null || contentType !in ALLOWED_CONTENT_TYPES) {
            throw IllegalArgumentException(
                "Tipo de archivo no permitido. Solo se aceptan: JPEG, JPG, PNG, WEBP."
            )
        }
    }
    
    private fun getFileExtension(contentType: String?): String {
        return when (contentType) {
            "image/jpeg", "image/jpg" -> "jpg"
            "image/png" -> "png"
            "image/webp" -> "webp"
            else -> "jpg"
        }
    }
}

