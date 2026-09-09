package mx.evolutiondev.invitaciones.modules.product.account

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * `producto.correo.*` de `application.yml`: **quién firma** los correos que manda el producto nuevo.
 *
 * No es el transporte —eso ya lo resuelve `core/email` con sus dos estrategias— sino el remitente de
 * la marca: `no-responder@linoysello.com` como `from` y `hola@linoysello.com` como `Reply-To`
 * (ADR-DUENO-02). Lo consume la sesión **E3**, y E2 lo lee tal cual para los correos de invitados.
 *
 * Vacío = **no configurado**: sin remitente no se manda correo con una dirección inventada. El nombre
 * visible sí trae valor por defecto porque no es un dato sensible ni una identidad falsificable.
 */
@ConfigurationProperties(prefix = "producto.correo")
data class ProductMailProperties(
    val remitente: String = "",
    val remitenteNombre: String = NOMBRE_POR_DEFECTO,
    val responderA: String = "",
) {
    /** `true` cuando hay una dirección de remitente real con la que firmar. */
    val configurado: Boolean get() = remitente.isNotBlank()

    companion object {
        const val NOMBRE_POR_DEFECTO = "Lino & Sello"
    }
}
