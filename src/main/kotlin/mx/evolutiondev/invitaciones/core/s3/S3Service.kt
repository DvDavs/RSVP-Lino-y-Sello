package mx.evolutiondev.invitaciones.core.s3

import org.springframework.stereotype.Service
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import java.net.URL
import java.net.URLDecoder
import java.time.Duration

@Service
class S3Service(
    private val s3Client: S3Client,
    private val s3Presigner: S3Presigner
) {

    fun uploadFile(bucket: String, key: String, fileBytes: ByteArray, contentType: String): URL {
        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build(),
            RequestBody.fromBytes(fileBytes)
        )
        return generatePresignedUrl(bucket, key)
    }

    fun generatePresignedUrl(bucket: String, key: String, duration: Duration = Duration.ofDays(7)): URL {
        val getObjectRequest = GetObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build()

        val presignRequest = GetObjectPresignRequest.builder()
            .signatureDuration(duration)
            .getObjectRequest(getObjectRequest)
            .build()

        val presignedRequest = s3Presigner.presignGetObject(presignRequest)
        return presignedRequest.url()
    }

    fun deleteFile(bucket: String, key: String) {
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build()
        )
    }

    fun uploadPublicFile(bucket: String, key: String, fileBytes: ByteArray, contentType: String): URL {
        s3Client.putObject(
            PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build(),
            RequestBody.fromBytes(fileBytes)
        )

        val urlString = s3Client.utilities().getUrl { it.bucket(bucket).key(key) }.toString()
        return URL(URLDecoder.decode(urlString, "UTF-8"))
    }
}

