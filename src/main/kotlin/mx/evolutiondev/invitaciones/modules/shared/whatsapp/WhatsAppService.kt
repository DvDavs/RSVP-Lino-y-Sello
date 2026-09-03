package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

@Service
class WhatsAppService(
    private val webClient: WebClient.Builder
) {
    @Value("\${whatsapp.api-url}")
    private lateinit var apiUrl: String

    @Value("\${whatsapp.phone-number-id}")
    private lateinit var phoneNumberId: String

    @Value("\${whatsapp.access-token}")
    private lateinit var accessToken: String

    // fun sendInvitation(guest: GuestWhatsAppDTO): Mono<String> {
    //     val client = webClient.baseUrl(apiUrl).build()

    //     val body = mapOf(
    //         "messaging_product" to "whatsapp",
    //         "to" to guest.phone,
    //         "type" to "text",
    //         "text" to mapOf(
    //             "body" to "¡Hola ${guest.fullName}! Te comparto tu invitación: ${guest.invitationUrl}"
    //         )
    //     )

    //     return client.post()
    //         .uri("/$phoneNumberId/messages")
    //         .header("Authorization", "Bearer $accessToken")
    //         .header("Content-Type", "application/json")
    //         .bodyValue(body)
    //         .retrieve()
    //         .bodyToMono(String::class.java)
    //         .onErrorResume { error ->
    //             Mono.just("ERROR: ${error.message}")
    //         }
    // }

    fun sendInvitation(guest: GuestWhatsAppDTO): Mono<String> {
    val client = webClient.baseUrl(apiUrl).build()

    val body = mapOf(
        "messaging_product" to "whatsapp",
        "to" to guest.phone,
        "type" to "template",
        "template" to mapOf(
            "name" to "ver_invitacion", // 👈 nombre EXACTO aprobado en Meta
            "language" to mapOf(
                "code" to "es_MX"
            ),
            "components" to listOf(
                mapOf(
                    "type" to "header",
                    "parameters" to listOf(
                        mapOf(
                            "type" to "text",
                            "text" to guest.fullName
                        )
                    )
                ),

                mapOf(
                    "type" to "body",
                    "parameters" to listOf(
                        // mapOf("type" to "text", "text" to guest.fullName),
                        mapOf("type" to "text", "text" to guest.invitationUrl)
                    )
                )
            )
        )
    )

    // val body = mapOf(
    // "messaging_product" to "whatsapp",
    // "to" to guest.phone,
    // "type" to "template",
    // "template" to mapOf(
    //     "name" to "hello_world",
    //     "language" to mapOf(
    //         "code" to "en_US"
    //     )
    //     )
    // )

    return client.post()
        .uri("/$phoneNumberId/messages")
        .header("Authorization", "Bearer $accessToken")
        .header("Content-Type", "application/json")
        .bodyValue(body)
        .retrieve()
        .onStatus({ it.isError }) { response ->
            response.bodyToMono(String::class.java).doOnNext { errorBody ->
                println("❌ Error Meta API - Status: ${response.statusCode()} Body: $errorBody") // ← agrega esto
            }.flatMap { Mono.error(RuntimeException(it)) }
        }
        .bodyToMono(String::class.java)
        .doOnNext { println("✅ Respuesta Meta API: $it") } // ← agrega esto
        .onErrorResume { error ->
            println("❌ Error enviando a ${guest.phone}: ${error.message}") // ← agrega esto
            Mono.just("ERROR: ${error.message}")
        }
}

    fun sendMasivo(guests: List<GuestWhatsAppDTO>): List<String> {
        return guests.map { sendInvitation(it).block() ?: "ERROR" }
    }
}

