
package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.http.*
import org.springframework.web.bind.annotation.*
import org.springframework.web.client.RestTemplate
import org.springframework.beans.factory.annotation.Value

@RestController
@RequestMapping("/webhook")
class WhatsAppWebhookController {

    private val VERIFY_TOKEN = "whatsapp_webhook_agape_26"
    // private val ACCESS_TOKEN = "TU_TOKEN_DE_META"
    // private val PHONE_NUMBER_ID = "TU_PHONE_NUMBER_ID"

    @Value("\${whatsapp.phone-number-id}")
    private lateinit var PHONE_NUMBER_ID: String

    @Value("\${whatsapp.access-token}")
    private lateinit var ACCESS_TOKEN: String

    // 🔹 1. Verificación webhook
    @GetMapping
    fun verifyWebhook(
        @RequestParam("hub.mode") mode: String,
        @RequestParam("hub.verify_token") token: String,
        @RequestParam("hub.challenge") challenge: String
    ): ResponseEntity<String> {

        return if (mode == "subscribe" && token == VERIFY_TOKEN) {
            ResponseEntity.ok(challenge)
        } else {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body("Error")
        }
    }

    // 🔹 2. Recepción de mensajes
    @PostMapping
    fun receiveMessage(@RequestBody payload: Map<String, Any>): ResponseEntity<String> {

        try {
            val entry = (payload["entry"] as List<Map<String, Any>>)[0]
            val changes = (entry["changes"] as List<Map<String, Any>>)[0]
            val value = changes["value"] as Map<String, Any>

            val messages = value["messages"] as? List<Map<String, Any>>

            if (!messages.isNullOrEmpty()) {
                val from = messages[0]["from"] as String

                if (from != "5212224718023") {
                    sendWhatsAppMessage(from)
                }
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }

        return ResponseEntity.ok("EVENT_RECEIVED")
    }

    // 🔹 3. Enviar mensaje
    fun sendWhatsAppMessage(to: String) {

        val url = "https://graph.facebook.com/v18.0/$PHONE_NUMBER_ID/messages"

        val restTemplate = RestTemplate()

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            setBearerAuth(ACCESS_TOKEN)
        }

        val body = """
            {
              "messaging_product": "whatsapp",
              "to": "$to",
              "type": "text",
              "text": {
                "body": "Para más info contacta a este número: 5212201592694"
              }
            }
        """.trimIndent()

        val entity = HttpEntity(body, headers)

        restTemplate.postForEntity(url, entity, String::class.java)
    }
}