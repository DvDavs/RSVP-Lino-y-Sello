package mx.evolutiondev.invitaciones.core.s3

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.presigner.S3Presigner

@Configuration
class S3ClientConfig(
        @Value("\${aws.region}") private val region: String,
        @Value("\${aws.credentials.access-key}") private val accessKey: String,
        @Value("\${aws.credentials.secret-key}") private val secretKey: String
) {

    @Bean
    fun s3ClientCredentialsProvider(): AwsCredentialsProvider {
        val credentials = AwsBasicCredentials.create(accessKey, secretKey)
        return StaticCredentialsProvider.create(credentials)
    }

    @Bean
    fun s3Client(provider: AwsCredentialsProvider): S3Client {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(provider)
                .build()
    }

    @Bean
    fun s3Presigner(provider: AwsCredentialsProvider): S3Presigner {
        return S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(provider)
                .build()
    }
}
