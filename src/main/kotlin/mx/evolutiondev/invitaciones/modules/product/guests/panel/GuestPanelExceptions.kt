package mx.evolutiondev.invitaciones.modules.product.guests.panel

/**
 * Códigos de error del panel de invitados (contrato `5-2` §0.6).
 *
 * Los seis primeros son literalmente los del contrato que esta superficie puede producir. Los dos
 * últimos son añadidos declarados, no inventados en silencio:
 *
 * - `RSVP_CLOSED` (**409**) — el contrato §1 lo pide por su nombre para `:send-email`: la invitación
 *   no está publicada, o el invitado no tiene correo, o ya se agotó la cuota del día. Es del catálogo
 *   del contrato §0.6 aunque nazca en la superficie pública.
 * - `GUEST_EMAIL_UNAVAILABLE` (**501**) — se conserva declarado para que ninguna respuesta antigua
 *   quede sin código, pero ya **no lo produce ninguna ruta**: `:send-email` está construida.
 * - `GUEST_INTERNAL` (**500**) — red de seguridad del advice. Sin él, cualquier excepción no prevista
 *   saldría por `GeneralExceptionHandler`, que **sí** filtra detalle interno al cliente
 *   (`Templates2ExceptionHandler.kt:152-160` documenta ese mismo defecto). Es la misma disciplina que
 *   ADR-016 fijó para `templates2`: ninguna ruta del módulo devuelve un `500` sin `code` y ninguna
 *   devuelve una traza.
 *
 * `RSVP_LINK_NOT_FOUND` y `RSVP_TOO_MANY_ATTEMPTS` son **solo** de la superficie pública (contrato
 * §2), que vive en `modules/product/guests/rsvp` y no es de este paquete. `RSVP_CLOSED` lo comparten
 * las dos superficies: allí porque el evento ya pasó, aquí porque no hay a dónde mandar el enlace.
 */
enum class GuestPanelErrorCode(val httpStatus: Int) {
    GUEST_NOT_FOUND(404),
    GUEST_INVALID(422),
    GUEST_DUPLICATE(409),
    GUEST_QUOTA_EXCEEDED(422),
    INVITATION_NOT_FOUND(404),
    RSVP_CLOSED(409),
    GUEST_EMAIL_UNAVAILABLE(501),
    GUEST_INTERNAL(500),
}

/**
 * Fallos del panel, con el `code` del contrato y un mensaje **escrito aquí**, en es-MX.
 *
 * Nunca se reenvía al cliente el mensaje de una excepción del servicio compartido: esos textos
 * mencionan ids, columnas y reglas internas, y `server.error.include-message: always` (hallazgo
 * S-02) ya convierte cualquier descuido en un oráculo. [GuestPanelService] traduce lo que llega de
 * `InvitationGuestsService` a una de estas.
 */
sealed class GuestPanelException(
    val code: GuestPanelErrorCode,
    message: String,
) : RuntimeException(message) {

    /**
     * Invitación inexistente **o** ajena, con el **mismo** cuerpo en los dos casos. Distinguirlas
     * sería un oráculo de enumeración de invitaciones ajenas (contrato §0.5, misma disciplina).
     */
    class InvitationNotFound :
        GuestPanelException(GuestPanelErrorCode.INVITATION_NOT_FOUND, "No encontramos esta invitación")

    /**
     * Invitado inexistente **o** de otra invitación, con el mismo cuerpo en los dos casos: es la
     * cara HTTP del arreglo de S-04.
     */
    class GuestNotFound :
        GuestPanelException(GuestPanelErrorCode.GUEST_NOT_FOUND, "No encontramos a este invitado")

    /** Datos que la clienta puede corregir. El mensaje dice qué revisar, sin detalle interno. */
    class GuestInvalid(mensaje: String) : GuestPanelException(GuestPanelErrorCode.GUEST_INVALID, mensaje)

    /** Ya hay un invitado con ese correo en esta invitación. */
    class GuestDuplicate(mensaje: String) : GuestPanelException(GuestPanelErrorCode.GUEST_DUPLICATE, mensaje)

    /** Cupos que las reglas del evento no permiten (`children_allowed` / `young_allowed`). */
    class QuotaExceeded(mensaje: String) :
        GuestPanelException(GuestPanelErrorCode.GUEST_QUOTA_EXCEEDED, mensaje)

    /**
     * No se puede mandar este correo **ahora**, y el mensaje dice por qué en términos de la clienta:
     * la invitación no está publicada, el invitado no tiene dirección, o ya se llegó al tope del día.
     * Nunca lleva detalle interno.
     */
    class RsvpClosed(mensaje: String) : GuestPanelException(GuestPanelErrorCode.RSVP_CLOSED, mensaje)

    /**
     * Se conserva por compatibilidad del catálogo; ninguna ruta la lanza desde que `:send-email`
     * existe. Ver [GuestPanelController.sendEmail].
     */
    class EmailUnavailable :
        GuestPanelException(
            GuestPanelErrorCode.GUEST_EMAIL_UNAVAILABLE,
            "Todavía no podemos enviar este enlace por correo. Compártelo por WhatsApp mientras tanto",
        )

    /** Fallo del servidor: se registra con traza en el log y **sin** traza en la respuesta. */
    class Internal(mensaje: String) : GuestPanelException(GuestPanelErrorCode.GUEST_INTERNAL, mensaje)
}
