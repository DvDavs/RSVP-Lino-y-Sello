package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.stereotype.Service
import org.springframework.web.reactive.function.client.WebClient
import reactor.core.publisher.Mono

/**
 * Envio por la Cloud API de Meta.
 *
 * Fase 5, E3-C3 (ADR-5-E3-C3-01, hallazgo S-01): la `apiUrl`, el numero y el token **ya no** se
 * inyectan aqui con `@Value` + `lateinit`. Salen de [WhatsAppConfiguracion], que ademas dice si el
 * canal esta configurado. Cuando no lo esta —que es el caso por defecto, porque hoy WhatsApp es
 * solo click-to-chat (`decisiones-dueno.md` D-04)— **no se llama a Meta**: se devuelve un error
 * declarado, no una peticion con `Bearer ` vacio que Meta rechazaria con un 401 ilegible.
 */
@Service
class WhatsAppService(
    private val webClient: WebClient.Builder,
    private val configuracion: WhatsAppConfiguracion,
) {
    /** Texto exacto que devuelve cada destinatario cuando el canal esta apagado. */
    val envioHabilitado: Boolean get() = configuracion.envioHabilitado

    private val apiUrl: String get() = configuracion.apiUrl
    private val phoneNumberId: String get() = configuracion.phoneNumberId
    private val accessToken: String get() = configuracion.accessToken

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
    // CANAL APAGADO (ADR-5-E3-C3-01): sin token o sin numero no se llama a Meta. Se devuelve el
    // mismo prefijo "ERROR:" que ya usa el resto del metodo, para que `sendMasivo` lo cuente como
    // fallido sin cambiar el contrato de la respuesta.
    if (!configuracion.envioHabilitado) {
        return Mono.just("ERROR: ${WhatsAppConfiguracion.MOTIVO_APAGADO}")
    }
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

