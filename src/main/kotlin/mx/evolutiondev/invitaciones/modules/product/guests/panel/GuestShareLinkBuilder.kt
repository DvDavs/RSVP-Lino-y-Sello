package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Construye el enlace personal del invitado y lo que la clienta comparte con él.
 *
 * **El origen sale siempre de la configuración**, nunca del código. `app.frontend.url` (variable
 * `FRONTEND_URL`) ya existe inyectada en el backend (`ResetPasswordService.kt:40`,
 * `EditorDocumentService.kt:84`) y es la que fijó la parte C §4: no se inventa una segunda variable
 * de origen. Escribir el host a mano es exactamente el hallazgo **S-08**
 * (`EmailGuestNotifier.kt:68`, un dominio del producto antiguo compilado dentro del binario), y por
 * eso aquí, si la propiedad viene vacía, **no se adivina un valor**: la ruta falla y lo dice.
 *
 * La forma del enlace es `/r/<confirmationToken>`, decidida en `12-producto-completo.md §0.3`: el
 * invitado no necesita conocer el `publicToken` y el token no viaja en la cadena de consulta.
 */
@Component
class GuestShareLinkBuilder(
    @Value("\${app.frontend.url:}") private val frontendUrl: String,
) {

    /** `https://…/r/<token>`. */
    fun enlace(confirmationToken: String): String {
        val origen = frontendUrl.trim().trimEnd('/')
        if (origen.isEmpty()) {
            throw GuestPanelException.Internal("Todavía no podemos generar el enlace para compartir")
        }
        return "$origen$RUTA_RSVP$confirmationToken"
    }

    /**
     * `https://wa.me/<teléfono sin + ni espacios>?text=<mensaje>`, solo si hay teléfono con dígitos.
     * WhatsApp espera el número en crudo: sin `+`, sin espacios, sin guiones ni paréntesis.
     */
    fun whatsapp(telefono: String?, mensaje: String): String? {
        val digitos = telefono.orEmpty().filter { it.isDigit() }
        if (digitos.length < MIN_DIGITOS) return null
        return "$BASE_WHATSAPP$digitos?text=${URLEncoder.encode(mensaje, StandardCharsets.UTF_8)}"
    }

    /**
     * El texto que la clienta manda tal cual. Cálido, en es-MX y **sin emojis** (regla del encargo);
     * no menciona la fecha ni a los anfitriones porque esos datos viven en relaciones perezosas de
     * la invitación y cargarlos aquí abriría una consulta por invitado en el listado.
     */
    fun texto(nombre: String?, url: String): String {
        val saludo = nombre?.trim()?.takeIf { it.isNotEmpty() }?.let { "${primerNombre(it)}, " } ?: ""
        val cuerpo = "te compartimos tu invitación. Ábrela para ver todos los detalles y " +
            "confirmar tu asistencia: $url"
        return if (saludo.isEmpty()) cuerpo.replaceFirstChar { it.uppercaseChar() } else saludo + cuerpo
    }

    private fun primerNombre(nombre: String): String = nombre.split(" ").first()

    companion object {
        const val RUTA_RSVP = "/r/"
        const val BASE_WHATSAPP = "https://wa.me/"

        /** Menos dígitos que esto no es un número marcable; se omite el enlace en vez de dar uno roto. */
        const val MIN_DIGITOS = 8
    }
}
