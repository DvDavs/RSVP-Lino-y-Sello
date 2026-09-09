package mx.evolutiondev.invitaciones.modules.product.account

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * `producto.contacto.*` de `application.yml`: los datos de contacto que la interfaz enseña
 * (pie de página, ayuda, avisos legales). Los consume la sesión **E3**.
 *
 * [whatsapp] es **solo click-to-chat**, sin API de WhatsApp Business (ADR-DUENO-02): es un número que
 * se pinta en un enlace `wa.me`, no una credencial. Aun así viaja por variable de entorno y no
 * escrito en el YAML, porque es un dato personal del dueño y el repositorio es público para el equipo.
 *
 * Vacío = **no se pinta ese contacto**. Un pie de página sin teléfono es aceptable; un pie de página
 * con un teléfono de ejemplo que alguien marque, no.
 */
@ConfigurationProperties(prefix = "producto.contacto")
data class ProductContactProperties(
    val correo: String = "",
    val whatsapp: String = "",
    val soporte: String = "",
)
