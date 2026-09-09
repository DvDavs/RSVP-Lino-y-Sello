
package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.http.*
import org.springframework.web.bind.annotation.*
import org.springframework.web.client.RestTemplate

/**
 * Webhook de Meta para WhatsApp.
 *
 * Fase 5, E3-C3 (ADR-5-E3-C3-01, hallazgo **S-01**): el `hub.verify_token` estaba **escrito en el
 * codigo** en la linea 13 de este fichero. Ahora sale del entorno
 * (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, via [WhatsAppConfiguracion]) y **vacio significa apagado**: sin
 * token configurado la ruta responde `503` y NUNCA compara contra una cadena vacia, que aceptaria
 * el alta de cualquiera.
 *
 * LO QUE ESTE FICHERO **SIGUE SIN HACER**, y queda dicho para que nadie lo de por cerrado:
 * el `POST` no comprueba `X-Hub-Signature-256` (hallazgo **S-09**). Un tercero que conozca la URL
 * puede seguir provocando un envio a un numero que el elija mientras el canal este encendido.
 * Cerrarlo exige el *app secret* de Meta, que es un tercer secreto que hoy no existe en ninguna
 * parte del repositorio ni del entorno: es un encargo propio, no un retoque de este.
 */
@RestController
@RequestMapping("/webhook")
class WhatsAppWebhookController(
    private val configuracion: WhatsAppConfiguracion,
) {

    // 🔹 1. Verificación webhook
    @GetMapping
    fun verifyWebhook(
        @RequestParam("hub.mode") mode: String,
        @RequestParam("hub.verify_token") token: String,
        @RequestParam("hub.challenge") challenge: String
    ): ResponseEntity<String> {

        if (!configuracion.webhookHabilitado) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(WhatsAppConfiguracion.MOTIVO_APAGADO)
        }

        return if (mode == "subscribe" && configuracion.verificaTokenDeWebhook(token)) {
            ResponseEntity.ok(challenge)
        } else {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body("Error")
        }
    }

    // 🔹 2. Recepción de mensajes
    @PostMapping
    fun receiveMessage(@RequestBody payload: Map<String, Any>): ResponseEntity<String> {

        // CANAL APAGADO: no se procesa nada y se dice por que. Meta reintenta ante un no-2xx, pero
        // si el canal esta apagado no hay ningun webhook dado de alta en Meta que pueda reintentar;
        // responder 200 aqui seria afirmar que se proceso un evento que se tiro a la basura.
        if (!configuracion.envioHabilitado) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(WhatsAppConfiguracion.MOTIVO_APAGADO)
        }

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

        if (!configuracion.envioHabilitado) return

        val url = "${configuracion.apiUrl}/${configuracion.phoneNumberId}/messages"

        val restTemplate = RestTemplate()

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            setBearerAuth(configuracion.accessToken)
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
