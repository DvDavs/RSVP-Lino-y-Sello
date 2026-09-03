package mx.evolutiondev.invitaciones.core.email.strategy

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mx.evolutiondev.invitaciones.core.email.exception.EmailSendingException
import mx.evolutiondev.invitaciones.core.email.model.EmailRequest
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.WebClientResponseException
import org.springframework.web.reactive.function.client.awaitBodilessEntity

@JsonInclude(JsonInclude.Include.NON_NULL)
data class MailerSendRequestPayload(
    val from: From,
    val to: List<To>,
    val subject: String,
    val html: String,
    val text: String
)
data class From(val email: String, val name: String)
data class To(val email: String)

@ConfigurationProperties(prefix = "mailersend")
data class MailerSendProperties(
    val apiToken: String = "",
    val fromEmail: String = "",
    val fromName: String = "Invitaciones"
)

@Component
@ConditionalOnProperty(name = ["email.provider"], havingValue = "mailersend")
@EnableConfigurationProperties(MailerSendProperties::class)
class MailerSendEmailStrategy(
    private val mailerSendProperties: MailerSendProperties
) : EmailSenderStrategy {

    private val logger = LoggerFactory.getLogger(MailerSendEmailStrategy::class.java)

    private val webClient = WebClient.builder()
        .baseUrl("https://api.mailersend.com/v1")
        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        .build()

    override suspend fun send(request: EmailRequest) {
        val emailPayload = MailerSendRequestPayload(
            from = From(email = mailerSendProperties.fromEmail, name = mailerSendProperties.fromName),
            to = listOf(To(email = request.to)),
            subject = request.subject,
            html = request.htmlBody,
            text = request.textBody
        )

        logger.info("Sending email via MailerSend to ${request.to}")

        withContext(Dispatchers.IO) {
            try {
                webClient.post()
                    .uri("/email")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer ${mailerSendProperties.apiToken}")
                    .bodyValue(emailPayload)
                    .retrieve()
                    .awaitBodilessEntity()

                logger.info("Email successfully sent via MailerSend to ${request.to}")

            } catch (e: WebClientResponseException) {
                val errorBody = e.responseBodyAsString
                logger.error("MailerSend error for ${request.to}. Status: ${e.statusCode}. Response body: $errorBody", e)
                throw EmailSendingException("Failed to send email via MailerSend to ${request.to}: ${e.message}", e)
            } catch (e: Exception) {
                logger.error("An unexpected error occurred while sending email via MailerSend to ${request.to}", e)
                throw EmailSendingException("Failed to send email via MailerSend to ${request.to}", e)
            }
        }
    }

    override fun getStrategyName(): String = "MailerSend"
}
