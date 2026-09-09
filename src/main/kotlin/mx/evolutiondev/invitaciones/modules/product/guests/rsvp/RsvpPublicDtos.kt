package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * Cuerpo de `GET` y `PUT` de `/public/r/{token}` (contrato 5-2 §2).
 *
 * **Lo que sale y por qué es exactamente esto.** El invitado que abre el enlace no tiene sesión, así
 * que la respuesta es todo lo que un tercero ve si intercepta el enlace en un reenvío de WhatsApp o
 * en una captura de pantalla. Por eso el DTO se define por lo que **no** lleva:
 *
 * - **No** lleva `cancellationToken` (S-13, y contrato §0.4: no se expone nunca).
 * - **No** lleva la dirección de correo del invitado: solo [PublicRsvpGuest.hasEmail], un booleano,
 *   para que la página pueda decir «te mandamos el detalle a tu correo» sin volcar la dirección en
 *   el HTML de una página que se reenvía.
 * - **No** lleva teléfono, ni mesa, ni id de invitado, ni id de invitación.
 * - **No** lleva ni un solo dato de otro invitado, ni los contadores del anfitrión.
 * - **No** lleva el detalle de la invitación: eso lo sirve el render público por su `publicToken`.
 *
 * El `fullName` del propio invitado sí sale, porque es lo que la página saluda y quien tiene el
 * enlace ya lo conoce.
 */
data class PublicRsvpResponse(
    val guest: PublicRsvpGuest,
    val event: PublicRsvpEvent,
)

/** Los cupos, los confirmados y el estado del invitado. Ver la nota de [PublicRsvpResponse]. */
data class PublicRsvpGuest(
    val fullName: String,
    val adults: Int,
    val children: Int,
    val young: Int,
    val adultsConfirmed: Int,
    val childrenConfirmed: Int,
    val youngConfirmed: Int,
    /** `PENDING`, `CONFIRMED` o `DECLINED` (`chk_attendance_status`, V16:40-42). */
    val status: String,
    /** Booleano a propósito: la dirección **nunca** sale del backend en esta superficie. */
    val hasEmail: Boolean,
)

/**
 * Lo mínimo del evento para pintar la página y decidir si se enseña el formulario.
 *
 * `publicToken` sale del puente de §A4.4 ([RsvpGuestReader]): es lo que permite a `/r/[token]`
 * pedir el render que ya existe sin que el invitado conozca dos tokens (§0.3).
 *
 * `closed` es `true` cuando la fecha del evento ya pasó. Existe porque
 * `GuestAttendanceService.kt:51-54` rechaza confirmar en ese caso: la página lo dice **antes** de
 * enseñar el formulario en vez de fallar al enviar. La regla no se duplica — el booleano se calcula
 * con `GuestAttendanceService.eventoCerrado`, que es la misma función que usa el rechazo.
 */
data class PublicRsvpEvent(
    val publicToken: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val closed: Boolean,
)

/**
 * Cuerpo del `PUT` (contrato 5-2 §2).
 *
 * **No tiene campo `email`, y eso es el arreglo de S-07 en esta superficie.** El defecto era que
 * `GuestAttendanceService` guardaba un correo nuevo si el cuerpo lo traía, sin confirmarlo ni avisar
 * al anterior: quien interceptara el enlace redirigía a su buzón todos los avisos posteriores. Aquí
 * el campo no existe; si alguien lo manda, Jackson lo descarta sin error gracias al
 * `@JsonIgnoreProperties` de abajo, que es literalmente lo que pide el contrato §2 («si viene se
 * ignora sin error»). El agujero del servicio
 * compartido se cerró además en su propio fichero, para que la superficie heredada tampoco lo
 * permita.
 *
 * `attending` es anulable **a propósito**: un cuerpo que no lo trae no puede significar «declino».
 * Se rechaza con `422 GUEST_INVALID`.
 *
 * ### Por qué el `@JsonIgnoreProperties` explícito, y no el defecto de Spring Boot
 * El defecto de Spring Boot es tolerar las propiedades desconocidas, así que a primera vista sobra.
 * **No sobra: verificado contra el backend vivo, esta aplicación las rechaza.** El motivo es que
 * `Templates2JsonConfig.kt:35-36` declara un bean `ObjectMapper` (el estricto de `templates2`, con
 * `FAIL_ON_UNKNOWN_PROPERTIES` activado, `Templates2Json.kt:29`) y eso desactiva por
 * `@ConditionalOnMissingBean` el `ObjectMapper` que Spring Boot habría creado, de modo que el
 * convertidor HTTP de **toda** la aplicación acaba siendo el estricto. `Templates2JsonConfig.kt:16-19`
 * dice explícitamente que evita ese efecto no marcándolo `@Primary`; no basta. Medido:
 * `PUT /auth/token` con un campo de más responde `400` y **el nombre de la clase y del campo dentro
 * del cuerpo**. Queda anotado para el orquestador; arreglarlo es del dueño de `templates2`.
 *
 * Sin esta anotación, un cuerpo con `email` daría `422` en vez de ignorarlo, que es lo contrario de
 * lo que manda el contrato §2. Con ella, la ruta se comporta igual sea cual sea el `ObjectMapper`.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class RsvpUpdateRequest(
    val attending: Boolean? = null,
    val adults: Int? = null,
    val children: Int? = null,
    val young: Int? = null,
    val message: String? = null,
)

/**
 * Cuerpo de **todos** los errores de esta superficie. Dos campos fijos y nada más.
 *
 * Nunca lleva el `message` de la excepción original: `server.error.include-message: always`
 * (hallazgo S-02) convierte cada excepción en un oráculo, así que los mensajes de aquí son
 * constantes escritas a mano en es-MX y no dependen de qué salió mal por dentro.
 */
data class RsvpErrorResponse(
    val code: String,
    val message: String,
)
