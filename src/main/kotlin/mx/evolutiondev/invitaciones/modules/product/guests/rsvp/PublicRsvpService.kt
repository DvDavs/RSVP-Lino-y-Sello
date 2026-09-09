package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.GuestAttendanceService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.ConfirmAttendanceRequest
import org.springframework.stereotype.Service

/**
 * La lógica de `/public/` + `r/{token}` (contrato 5-2 §2).
 *
 * ### El orden de los pasos es la mitad del diseño de seguridad
 * Toda petición hace exactamente esto, y en este orden:
 *
 * 1. **Límite de intentos** ([RsvpThrottleService]), antes que nada. Así el `429` cuesta lo mismo
 *    exista o no el token y no gasta ni una consulta: no puede convertirse en un oráculo.
 * 2. **Formato del token**, en memoria. Un token que no puede existir se descarta sin ir a la base
 *    de datos.
 * 3. **Una** consulta, la del puente ([RsvpGuestReader]), que resuelve invitado, evento,
 *    `publicToken`, release activo y estado del anfitrión de una vez. Cero filas → el mismo `404`.
 *
 * Los seis motivos de fallo de §0.5 salen todos del paso 2 o del paso 3 con la misma excepción sin
 * parámetros, [RsvpException.LinkNotFound], así que el cuerpo es idéntico byte a byte y el trabajo
 * realizado, prácticamente el mismo.
 *
 * ### Qué hace y qué no hace con los datos personales
 * No registra nada. Ni el token, ni el nombre, ni el correo, ni el teléfono, ni en `DEBUG`. Tampoco
 * los mete en el mensaje de una excepción: las de [RsvpException] llevan su texto fijo escrito en la
 * propia clase, que es lo que impide que `server.error.include-message: always` (S-02) los saque por
 * el cuerpo de la respuesta.
 */
@Service
class PublicRsvpService(
    private val lector: RsvpGuestReader,
    private val guestAttendanceService: GuestAttendanceService,
    private val limitador: RsvpThrottleService,
) {

    /** `GET /public/` + `r/{token}`. Solo lee. */
    fun consultar(token: String): PublicRsvpResponse = respuesta(fila(token))

    /**
     * `PUT /public/` + `r/{token}`: confirma o declina, y permite cambiar de opinión en los dos
     * sentidos cuantas veces haga falta —`GuestAttendanceService.confirmAttendance` ya cubre los dos
     * caminos con `isAttending` y **no** comprueba el estado previo antes de volver a confirmar
     * (`GuestAttendanceService.kt:50-54`)—.
     *
     * Escribir es lo único que hace esta ruta con el invitado: **no** toca su correo (S-07), no toca
     * su teléfono, no toca sus cupos asignados ni su mesa.
     */
    fun responder(token: String, peticion: RsvpUpdateRequest?): PublicRsvpResponse {
        val fila = fila(token)

        if (GuestAttendanceService.eventoCerrado(fila.eventDate, fila.eventTime)) {
            throw RsvpException.Closed()
        }

        val cuerpo = peticion ?: throw RsvpException.Invalid()
        val asiste = cuerpo.attending ?: throw RsvpException.Invalid()
        validarCuerpo(cuerpo, asiste, fila)

        val actualizado = confirmar(token, cuerpo, asiste)
        return respuesta(fila, actualizado)
    }

    // ---------------------------------------------------------------------------------------

    /**
     * Los pasos 1 a 3 de la nota de la clase. Devuelve la fila del puente o lanza el único `404`.
     */
    private fun fila(token: String): RsvpGuestRow {
        limitador.comprobar(token)
        limitador.registrarIntento(token)
        if (!formatoPlausible(token)) throw RsvpException.LinkNotFound()
        return lector.read(token) ?: throw RsvpException.LinkNotFound()
    }

    /**
     * Descarte barato de lo que **no puede** ser un token de invitado, para no mandar a la base de
     * datos cadenas arbitrarias de una ruta pública.
     *
     * Los `confirmation_token` se acuñan con `JwtUtil.generateInvitationSecureToken()`
     * (`JwtUtil.kt:66-71`): 16 bytes de `SecureRandom` en Base64 URL sin relleno, es decir 22
     * caracteres del alfabeto `A-Za-z0-9_-`. El tope de 255 es el de la columna
     * (`V8__create_invitation_guest_table.sql:18`). No se estrecha a exactamente 22 caracteres para
     * no dejar fuera tokens heredados que pudieran haberse acuñado de otro modo.
     *
     * Esto **no** es un oráculo: la respuesta es la misma `404` que la de un token bien formado que
     * no existe, y ningún token real es rechazado aquí, así que el camino rápido no distingue
     * «existe» de «no existe» — solo «esto ni siquiera es un token».
     */
    private fun formatoPlausible(token: String): Boolean =
        token.length in 1..MAX_LONGITUD_TOKEN && token.all { it.esBase64Url() }

    private fun Char.esBase64Url(): Boolean =
        this in 'A'..'Z' || this in 'a'..'z' || this in '0'..'9' || this == '-' || this == '_'

    /**
     * Las mismas reglas que `GuestAttendanceService.validateGuestCounts`
     * (`GuestAttendanceService.kt:144-178`) y `confirmPositiveAttendance` (`:99-102`), comprobadas
     * aquí **antes** de llamar al servicio compartido.
     *
     * Se comprueban dos veces a propósito, y la duplicación está acotada y es deliberada: el servicio
     * compartido señala todos sus rechazos con `IllegalArgumentException` y un texto libre, así que
     * la única forma de devolver el `GUEST_QUOTA_EXCEEDED` que el contrato pide —sin leer mensajes de
     * excepción, que es frágil, y sin filtrar esos mensajes al invitado, que es S-02— es decidir el
     * código aquí. El servicio compartido **sigue siendo el que manda**: si estas comprobaciones se
     * quedaran cortas, él rechaza igual, y ese rechazo se traduce a `422 GUEST_INVALID` con texto
     * fijo. Hay una prueba que confronta las dos listas de reglas.
     */
    private fun validarCuerpo(cuerpo: RsvpUpdateRequest, asiste: Boolean, fila: RsvpGuestRow) {
        val adultos = cuerpo.adults ?: 0
        val ninos = cuerpo.children ?: 0
        val jovenes = cuerpo.young ?: 0

        if (adultos < 0 || ninos < 0 || jovenes < 0) throw RsvpException.Invalid()
        if ((cuerpo.message?.length ?: 0) > MAX_LONGITUD_MENSAJE) throw RsvpException.Invalid()

        if (!asiste) return

        if (adultos + ninos + jovenes < 1) throw RsvpException.Invalid()

        if (adultos > fila.adults || ninos > fila.children || jovenes > fila.young) {
            throw RsvpException.QuotaExceeded()
        }
        if (ninos > 0 && !fila.childrenAllowed) throw RsvpException.QuotaExceeded()
        if (jovenes > 0 && !fila.youngAllowed) throw RsvpException.QuotaExceeded()
    }

    /**
     * Llama al servicio compartido y traduce **todo** lo que pueda salir de él a un error tipado con
     * mensaje fijo. Ningún texto del servicio compartido llega al invitado.
     *
     * `email = null` no es un descuido: es el arreglo de S-07 visto desde esta superficie. El DTO de
     * entrada ni siquiera declara el campo, así que aquí no hay nada que pasar.
     */
    private fun confirmar(token: String, cuerpo: RsvpUpdateRequest, asiste: Boolean): InvitationGuestEntity =
        try {
            guestAttendanceService.confirmAttendance(
                token,
                ConfirmAttendanceRequest(
                    isAttending = asiste,
                    email = null,
                    adultsConfirmed = cuerpo.adults ?: 0,
                    childrenConfirmed = cuerpo.children ?: 0,
                    youngConfirmed = cuerpo.young ?: 0,
                    message = cuerpo.message,
                ),
            )
        } catch (e: GuestNotFoundException) {
            // El invitado se deshabilitó entre la consulta del puente y la escritura.
            throw RsvpException.LinkNotFound()
        } catch (e: IllegalArgumentException) {
            // Regla del servicio compartido que estas validaciones no anticiparon. Se responde con el
            // código genérico y **el texto fijo**: el mensaje original nunca sale.
            throw RsvpException.Invalid()
        }

    /** Respuesta del `GET`: todo sale de la fila del puente. */
    private fun respuesta(fila: RsvpGuestRow) = PublicRsvpResponse(
        guest = PublicRsvpGuest(
            fullName = fila.fullName,
            adults = fila.adults,
            children = fila.children,
            young = fila.young,
            adultsConfirmed = fila.adultsConfirmed,
            childrenConfirmed = fila.childrenConfirmed,
            youngConfirmed = fila.youngConfirmed,
            status = fila.status,
            hasEmail = fila.hasEmail,
        ),
        event = evento(fila),
    )

    /**
     * Respuesta del `PUT`: **misma forma** que la del `GET`. Los contadores y el estado se toman de
     * la entidad recién guardada —para que la respuesta refleje la escritura sin una segunda
     * consulta— y lo del evento, de la fila del puente ya leída. De la entidad **no** se lee ni el
     * correo, ni el teléfono, ni el `cancellationToken` que `confirmPositiveAttendance` acaba de
     * acuñar (`GuestAttendanceService.kt:111`): ese token no se expone nunca (contrato §0.4).
     *
     * No se toca `guest.invitation` de la entidad: es una asociación perezosa del módulo antiguo y
     * leerla montaría el grafo que el puente existe para evitar.
     */
    private fun respuesta(fila: RsvpGuestRow, guardado: InvitationGuestEntity) = PublicRsvpResponse(
        guest = PublicRsvpGuest(
            fullName = guardado.fullName ?: fila.fullName,
            adults = guardado.adultsCount ?: 0,
            children = guardado.childrenCount,
            young = guardado.youngCount,
            adultsConfirmed = guardado.adultsCountConfirmed,
            childrenConfirmed = guardado.childrenCountConfirmed,
            youngConfirmed = guardado.youngCountConfirmed,
            status = guardado.attendanceStatus.name,
            hasEmail = !guardado.email.isNullOrBlank(),
        ),
        event = evento(fila),
    )

    private fun evento(fila: RsvpGuestRow) = PublicRsvpEvent(
        publicToken = fila.publicToken,
        childrenAllowed = fila.childrenAllowed,
        youngAllowed = fila.youngAllowed,
        // La misma función que usa el rechazo al confirmar. Ver su KDoc: una sola definición.
        closed = GuestAttendanceService.eventoCerrado(fila.eventDate, fila.eventTime),
    )

    private companion object {
        /** `invitation_guest.confirmation_token VARCHAR(255)` (V8:18). */
        const val MAX_LONGITUD_TOKEN = 255

        /** El mismo tope que `ConfirmAttendanceRequest` declara con `@Size(max = 1000)`. */
        const val MAX_LONGITUD_MENSAJE = 1000
    }
}
