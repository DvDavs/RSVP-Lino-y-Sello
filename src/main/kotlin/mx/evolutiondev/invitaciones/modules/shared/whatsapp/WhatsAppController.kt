package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/whatsapp")
class WhatsAppController(
    private val whatsAppService: WhatsAppService
) {
    @PostMapping("/send-masivo")
    fun sendMasivo(@RequestBody request: MasivoRequest): ResponseEntity<Map<String, Any>> {
        val results = whatsAppService.sendMasivo(request.guests)
        return ResponseEntity.ok(
            mapOf(
                "total" to results.size,
                "enviados" to results.count { !it.startsWith("ERROR") },
                "fallidos" to results.count { it.startsWith("ERROR") }
            )
        )
    }
}