package mx.evolutiondev.invitaciones.core.s3

import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.HeadObjectRequest
import software.amazon.awssdk.services.s3.model.S3Exception

fun S3Client.objectExists(bucket: String, key: String): Boolean {
    return try {
        this.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build())
        true
    } catch (e: S3Exception) {
        e.statusCode() != 404
    }
}
