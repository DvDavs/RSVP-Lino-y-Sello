package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/whatsapp")
class WhatsAppController(
    private val whatsAppService: WhatsAppService
) {
    /**
     * ATENCION, ESTA RUTA SIGUE SIENDO EL HALLAZGO **S-06** («pasarela abierta»,
     * `diseno/12-producto-completo.md`): acepta **cualquier** lista de telefonos del cuerpo, sin
     * `invitationId`, sin comprobacion de pertenencia y sin limite de volumen, con rol `USER`
     * (`SecurityConfig.kt:45`). E3-C3 **no arregla S-06** —no es su encargo y `SecurityConfig` es
     * territorio prohibido—; lo unico que cambia aqui es que, cuando el canal no esta configurado,
     * la ruta lo dice en vez de intentar el envio (ADR-5-E3-C3-01).
     */
    @PostMapping("/send-masivo")
    fun sendMasivo(@RequestBody request: MasivoRequest): ResponseEntity<Map<String, Any>> {
        // CANAL APAGADO: 503 con un cuerpo honesto, no un 500 ni un 200 que miente diciendo que se
        // envio. `Retry-After` no se pone: no es una indisponibilidad temporal, es configuracion
        // que falta.
        if (!whatsAppService.envioHabilitado) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf(
                    "code" to WhatsAppConfiguracion.CODIGO_APAGADO,
                    "message" to WhatsAppConfiguracion.MOTIVO_APAGADO,
                )
            )
        }
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
