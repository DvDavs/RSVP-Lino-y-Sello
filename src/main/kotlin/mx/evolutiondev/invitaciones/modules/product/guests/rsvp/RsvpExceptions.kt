package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.springframework.http.HttpStatus

/**
 * Códigos tipados de la superficie pública del RSVP (contrato 5-2 §0.6).
 *
 * Del catálogo del contrato esta superficie usa cuatro: [RSVP_LINK_NOT_FOUND], [RSVP_CLOSED],
 * [RSVP_TOO_MANY_ATTEMPTS], [GUEST_INVALID] y [GUEST_QUOTA_EXCEEDED]. Los del panel
 * (`GUEST_NOT_FOUND`, `GUEST_DUPLICATE`, `INVITATION_NOT_FOUND`) no aparecen aquí: decir «el
 * invitado no existe» en una ruta pública es exactamente el oráculo que §0.5 prohíbe.
 *
 * [RSVP_INTERNAL] **no** está en el catálogo del contrato y se añade por necesidad: sin él, un fallo
 * inesperado saldría por `GeneralExceptionHandler` con el `message` de la excepción dentro
 * (`server.error.include-message: always`, S-02). Queda anotado para el orquestador.
 */
enum class RsvpErrorCode {
    RSVP_LINK_NOT_FOUND,
    RSVP_CLOSED,
    RSVP_TOO_MANY_ATTEMPTS,
    GUEST_INVALID,
    GUEST_QUOTA_EXCEEDED,
    RSVP_INTERNAL,
}

/**
 * Excepciones de la superficie pública. **Todas llevan su mensaje ya escrito y público**: no hay
 * constructor que acepte texto libre, así que es imposible que un detalle interno —el nombre del
 * invitado, su correo, el token, el motivo real del fallo— acabe en el cuerpo de la respuesta.
 *
 * [LinkNotFound] es deliberadamente un objeto sin parámetros: los **seis** motivos de fallo del
 * contrato §0.5 (token inexistente, mal formado, invitado deshabilitado, invitación sin release
 * activo, anfitrión deshabilitado, anfitrión bloqueado) construyen exactamente la misma instancia y
 * por tanto el mismo cuerpo byte a byte. Distinguirlos es un oráculo de enumeración.
 */
sealed class RsvpException(
    val code: RsvpErrorCode,
    val status: HttpStatus,
    /** Texto fijo en es-MX que se devuelve al invitado. Nunca se compone con datos de la petición. */
    val publicMessage: String,
) : RuntimeException(publicMessage) {

    /** El único `404` de la superficie. Ver la nota de la clase: sin parámetros a propósito. */
    class LinkNotFound : RsvpException(
        RsvpErrorCode.RSVP_LINK_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        MENSAJE_ENLACE_NO_ENCONTRADO,
    )

    /** La fecha del evento ya pasó (`GuestAttendanceService.kt:51-54`). */
    class Closed : RsvpException(
        RsvpErrorCode.RSVP_CLOSED,
        HttpStatus.CONFLICT,
        "Este evento ya pasó y las confirmaciones están cerradas",
    )

    /**
     * Límite de intentos superado. **El cuerpo es el mismo exista o no el token**: si el `429`
     * cambiara según el token, el propio limitador sería el oráculo que el `404` uniforme evita.
     */
    class TooManyAttempts : RsvpException(
        RsvpErrorCode.RSVP_TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
        "Demasiados intentos. Espera unos minutos e inténtalo de nuevo",
    )

    /**
     * Cuerpo del `PUT` que no se puede atender: sin `attending`, con cifras negativas, con mensaje
     * larguísimo o con los tres cupos en cero cuando se dice que sí se asiste.
     *
     * El texto es **uno solo** para los cuatro casos, y eso es intencionado: cada variante de
     * mensaje es un bit que se le regala a quien esté probando el formulario.
     */
    class Invalid : RsvpException(
        RsvpErrorCode.GUEST_INVALID,
        HttpStatus.UNPROCESSABLE_ENTITY,
        "Revisa los datos de tu confirmación",
    )

    /**
     * Se pidieron más lugares de los asignados, o de un tipo que el evento no permite
     * (`invitation.children_allowed` / `young_allowed`).
     *
     * No dice **cuántos** son el máximo: el `GET` ya se lo dio al invitado legítimo en `guest.adults`,
     * `guest.children` y `guest.young`, así que repetirlo en el error solo serviría a quien no tenga
     * el enlace.
     */
    class QuotaExceeded : RsvpException(
        RsvpErrorCode.GUEST_QUOTA_EXCEEDED,
        HttpStatus.UNPROCESSABLE_ENTITY,
        "No puedes confirmar más lugares de los que te asignaron",
    )

    /** Fallo inesperado. Ver la nota de [RsvpErrorCode.RSVP_INTERNAL]. */
    class Internal : RsvpException(
        RsvpErrorCode.RSVP_INTERNAL,
        HttpStatus.INTERNAL_SERVER_ERROR,
        "No pudimos procesar tu confirmación. Inténtalo más tarde",
    )

    companion object {
        /** Literal del contrato §0.5, palabra por palabra. Ninguna otra copia en el módulo. */
        const val MENSAJE_ENLACE_NO_ENCONTRADO = "Este enlace ya no funciona"
    }
}
