package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.DuplicateGuestException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestsCreationRequest
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

/**
 * La lógica del panel de invitados de la clienta (contrato `5-2` §1).
 *
 * **No reimplementa el motor de invitados.** El alta, la edición, la baja, los contadores y —lo más
 * importante— la comprobación de propiedad de la invitación siguen siendo los de
 * `InvitationGuestsService`, que es el mismo servicio que usa `/admin/` + `**`. Lo que esta clase
 * añade es la superficie que el rol `USER` no tenía y tres cosas que el motor no hace:
 *
 * 1. **Traduce los fallos** del servicio compartido a [GuestPanelException], con mensajes escritos
 *    aquí en es-MX. Los del motor mencionan ids y reglas internas y, con
 *    `server.error.include-message: always` (hallazgo S-02), reenviarlos sería regalar un oráculo.
 * 2. **Traduce las entidades** a [GuestItem], que no lleva `confirmationToken` ni
 *    `cancellationToken` (hallazgo S-13).
 * 3. **Pagina y filtra** como pide el contrato (base 0, `size` hasta 200, búsqueda insensible a
 *    acentos), cosa que `InvitationGuestsService.getGuests` no ofrece: tiene el tamaño de página fijo
 *    en 20 (`InvitationGuestsService.kt:176`) y base 1.
 *
 * **Invitación ajena e invitación inexistente responden lo mismo** (`INVITATION_NOT_FOUND`), y lo
 * mismo vale para el invitado: quien no es dueño no puede distinguir «no existe» de «no es tuyo», que
 * es lo que impide enumerar ids ajenos.
 */
@Service
class GuestPanelService(
    private val guestsService: InvitationGuestsService,
    private val guestsRepository: InvitationGuestsRepository,
    private val pasteReader: GuestPasteReader,
    private val linkBuilder: GuestShareLinkBuilder,
    private val csvWriter: GuestCsvWriter,
    private val mailer: GuestLinkMailer,
    private val releaseReader: GuestReleaseReader,
    private val limiteDiario: GuestEmailDailyLimit,
) {

    // =============================================================================================
    // Listado, resumen y exportación
    // =============================================================================================

    fun listar(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
        search: String?,
        status: String?,
        page: Int?,
        size: Int?,
    ): GuestPage {
        autorizar(userId, appRole, invitationId)

        val estado = estadoDe(status)
        val indice = (page ?: 0).coerceAtLeast(0)
        val tamano = (size ?: TAMANO_POR_DEFECTO).coerceIn(1, TAMANO_MAXIMO)
        val pageable = PageRequest.of(indice, tamano, Sort.by(Sort.Direction.DESC, "createdAt"))

        val pagina = guestsRepository.findAll(
            GuestPanelQueries.delPanel(invitationId, estado, search),
            pageable,
        )

        return GuestPage(
            content = pagina.content.map { it.toPanelItem() },
            page = indice,
            size = tamano,
            totalElements = pagina.totalElements,
            totalPages = pagina.totalPages,
        )
    }

    /**
     * Los contadores en vivo. Las 16 cifras de cupos las calcula `getAllGuests`
     * (`InvitationGuestsService.kt:207-250`) y se reutilizan tal cual; lo que ese método **no**
     * devuelve es el recuento de personas invitadas (cabezas, no asientos), que se cuenta aquí.
     */
    fun resumen(userId: Long, appRole: AppRole, invitationId: Long): GuestSummaryResponse {
        val invitacion = autorizar(userId, appRole, invitationId)
        val cupos = traducirFallos { guestsService.getAllGuests(userId, appRole, invitationId) }
        val invitados = guestsRepository.findByInvitationIdAndIsEnabledTrue(invitationId)

        return GuestSummaryResponse(
            guests = GuestCounts(
                total = invitados.size,
                pending = invitados.count { it.attendanceStatus == AttendanceStatus.PENDING },
                confirmed = invitados.count { it.attendanceStatus == AttendanceStatus.CONFIRMED },
                declined = invitados.count { it.attendanceStatus == AttendanceStatus.DECLINED },
            ),
            seats = SeatCounts(
                adults = SeatPair(cupos.totalAdultosInvitados, cupos.totalAdultosConfirmados),
                children = SeatPair(cupos.totalNinosInvitados, cupos.totalNinosConfirmados),
                young = SeatPair(cupos.totalJovenesInvitados, cupos.totalJovenesConfirmados),
                totalInvited = cupos.totalInvitados,
                totalConfirmed = cupos.totalConfirmados,
            ),
            rules = EventRules(
                childrenAllowed = invitacion.childrenAllowed,
                youngAllowed = invitacion.youngAllowed,
            ),
        )
    }

    /** CSV con BOM UTF-8, encabezados en es-MX y **sin tokens**. */
    fun exportarCsv(userId: Long, appRole: AppRole, invitationId: Long): ByteArray {
        autorizar(userId, appRole, invitationId)
        val invitados = guestsRepository.findByInvitationIdAndIsEnabledTrue(invitationId)
            .sortedBy { it.fullName?.lowercase() ?: "" }
            .map { it.toPanelItem() }
        return csvWriter.escribir(invitados)
    }

    // =============================================================================================
    // Alta, edición y baja
    // =============================================================================================

    fun crear(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
        request: GuestUpsertRequest,
    ): GuestItem {
        autorizar(userId, appRole, invitationId)
        val peticion = peticionDelMotor(request)

        traducirFallos { guestsService.appendGuest(userId, appRole, invitationId, peticion) }

        return recienGuardado(invitationId, peticion)?.toPanelItem()
            ?: throw GuestPanelException.Internal("Guardamos al invitado pero no pudimos leerlo de vuelta")
    }

    fun actualizar(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
        guestId: Long,
        request: GuestUpsertRequest,
    ): GuestItem {
        autorizar(userId, appRole, invitationId)

        traducirFallos {
            guestsService.updateGuest(userId, appRole, guestId, invitationId, peticionDelMotor(request))
        }

        return traducirFallos { guestsService.getGuest(userId, appRole, guestId, invitationId) }.toPanelItem()
    }

    /**
     * Baja. Se lee antes con `getGuest`, que desde el arreglo de **S-04** exige que el invitado
     * pertenezca a `invitationId`; `deleteGuest` no recibe la invitación en su firma y, desde el
     * arreglo de **S-05**, comprueba la jerarquía por su cuenta. Las dos puertas, no una.
     */
    fun eliminar(userId: Long, appRole: AppRole, invitationId: Long, guestId: Long) {
        autorizar(userId, appRole, invitationId)
        traducirFallos { guestsService.getGuest(userId, appRole, guestId, invitationId) }
        traducirFallos { guestsService.deleteGuest(userId, appRole, guestId) }
    }

    // =============================================================================================
    // Pegado: vista previa e importación
    // =============================================================================================

    /** Analiza el texto pegado y **no escribe nada**. */
    fun analizar(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
        texto: String?,
    ): GuestPasteResponse {
        autorizar(userId, appRole, invitationId)
        val leido = pasteReader.leer(texto)
        return GuestPasteResponse(
            ready = leido.listos.map { it.draft },
            problems = leido.problemas,
        )
    }

    /**
     * Da de alta **solo los renglones válidos**. Un renglón que el motor rechaza (correo repetido,
     * cupo no permitido) se convierte en un problema más de la lista: la importación nunca falla
     * entera por un renglón malo, que es lo que obliga a la clienta a rehacer el pegado completo.
     */
    fun importar(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
        texto: String?,
    ): GuestImportResponse {
        autorizar(userId, appRole, invitationId)
        val leido = pasteReader.leer(texto)

        val creados = mutableListOf<GuestItem>()
        val problemas = leido.problemas.toMutableList()

        leido.listos.forEach { fila ->
            try {
                val peticion = peticionDelMotor(
                    GuestUpsertRequest(
                        fullName = fila.draft.fullName,
                        email = fila.draft.email,
                        phone = fila.draft.phone,
                        tableNumber = fila.draft.tableNumber,
                        adults = fila.draft.adults,
                        children = fila.draft.children,
                        young = fila.draft.young,
                    ),
                )
                guestsService.appendGuest(userId, appRole, invitationId, peticion)
                recienGuardado(invitationId, peticion)?.let { creados += it.toPanelItem() }
            } catch (e: GuestPanelException) {
                // Un renglón rechazado no puede tumbar la importación entera (contrato §1).
                if (e.code == GuestPanelErrorCode.INVITATION_NOT_FOUND) throw e
                problemas += GuestProblem(
                    line = fila.line,
                    raw = fila.raw,
                    code = e.code.name,
                    message = e.message.orEmpty(),
                    hint = pistaDe(e.code),
                )
            } catch (e: DuplicateGuestException) {
                problemas += GuestProblem(
                    line = fila.line,
                    raw = fila.raw,
                    code = GuestPanelErrorCode.GUEST_DUPLICATE.name,
                    message = "Ya tienes un invitado con este correo.",
                    hint = "Quita este renglón o escribe un correo distinto.",
                )
            } catch (e: IllegalArgumentException) {
                val traducido = traducirIllegalArgument(e)
                problemas += GuestProblem(
                    line = fila.line,
                    raw = fila.raw,
                    code = traducido.code.name,
                    message = traducido.message.orEmpty(),
                    hint = pistaDe(traducido.code),
                )
            }
        }

        return GuestImportResponse(ready = creados, problems = problemas.sortedBy { it.line })
    }

    // =============================================================================================
    // Compartir
    // =============================================================================================

    /**
     * La **única** operación del panel que revela un token, y lo devuelve ya montado en la URL final
     * (contrato §0.3). El origen sale de `app.frontend.url`, nunca de una constante en el código
     * (hallazgo S-08).
     */
    fun enlace(userId: Long, appRole: AppRole, invitationId: Long, guestId: Long): GuestLinkResponse {
        autorizar(userId, appRole, invitationId)
        val invitado = traducirFallos { guestsService.getGuest(userId, appRole, guestId, invitationId) }

        val token = invitado.confirmationToken?.takeIf { it.isNotBlank() }
            ?: throw GuestPanelException.GuestInvalid(
                "Este invitado todavía no tiene un enlace personal. Vuelve a guardarlo para generarlo",
            )

        val url = linkBuilder.enlace(token)
        val texto = linkBuilder.texto(invitado.fullName, url)

        return GuestLinkResponse(
            url = url,
            whatsappUrl = linkBuilder.whatsapp(invitado.phone, texto),
            shareText = texto,
        )
    }

    /**
     * `POST …/guests/{guestId}:send-email` (contrato `5-2` §1): manda a **ese** invitado su enlace
     * personal por correo. Devuelve cuando el correo queda **encolado**, no cuando sale; por eso la
     * ruta responde `202`.
     *
     * Las cuatro puertas, en este orden y todas antes de tocar el correo:
     *
     * 1. **Propiedad de la invitación**, la misma de todo el panel ([autorizar]).
     * 2. **Pertenencia del invitado a esa invitación**, vía `getGuest`, que es donde vive el arreglo
     *    de S-04. Sin esto, `:send-email` sería una forma de mandar el enlace de un invitado ajeno a
     *    su propia dirección — es decir, el IDOR otra vez, con acuse de recibo.
     * 3. **Hay a dónde mandarlo y sirve de algo**: el invitado tiene correo y la invitación tiene
     *    release activo. Sin release, `GET /public/` + `r/{token}` responde `404` y el correo llevaría
     *    a la invitada a una puerta cerrada. Las dos cosas responden `409 RSVP_CLOSED` con el motivo,
     *    como pide el contrato.
     * 4. **Tope por invitación y día** ([GuestEmailDailyLimit]): que el producto no se pueda usar como
     *    remitente en masa contra una dirección que alguien escriba en la lista.
     */
    fun enviarCorreo(userId: Long, appRole: AppRole, invitationId: Long, guestId: Long) {
        autorizar(userId, appRole, invitationId)
        val invitado = traducirFallos { guestsService.getGuest(userId, appRole, guestId, invitationId) }

        val correo = invitado.email?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw GuestPanelException.RsvpClosed(
                "Este invitado no tiene correo. Agrégaselo o comparte su enlace por WhatsApp",
            )

        val token = invitado.confirmationToken?.takeIf { it.isNotBlank() }
            ?: throw GuestPanelException.GuestInvalid(
                "Este invitado todavía no tiene un enlace personal. Vuelve a guardarlo para generarlo",
            )

        if (!releaseReader.tieneReleaseActivo(invitationId)) {
            throw GuestPanelException.RsvpClosed(
                "Publica tu invitación antes de enviarla: por ahora el enlace no abriría nada",
            )
        }

        if (!limiteDiario.consumir(invitationId)) {
            throw GuestPanelException.RsvpClosed(
                "Ya enviaste muchos correos de esta invitación hoy. Inténtalo de nuevo mañana",
            )
        }

        mailer.enviar(destinatario = correo, nombre = invitado.fullName, url = linkBuilder.enlace(token))
    }

    // =============================================================================================
    // Interno
    // =============================================================================================

    /** La puerta de propiedad, una sola y compartida con `/admin/` + `**` (contrato §0.1). */
    private fun autorizar(userId: Long, appRole: AppRole, invitationId: Long) =
        traducirFallos { guestsService.validateInvitation(userId, appRole, invitationId) }

    private fun estadoDe(status: String?): AttendanceStatus? {
        val texto = status?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return when (texto.uppercase()) {
            "PENDING" -> AttendanceStatus.PENDING
            "CONFIRMED" -> AttendanceStatus.CONFIRMED
            "DECLINED" -> AttendanceStatus.DECLINED
            // Ignorar un filtro que no se entendió devolvería una lista que no es la que se pidió.
            else -> throw GuestPanelException.GuestInvalid(
                "El estado que pediste no existe. Usa PENDING, CONFIRMED o DECLINED",
            )
        }
    }

    /**
     * Traduce el DTO del panel al del motor. `GuestsCreationRequest` exige `String` no nulos en
     * `email`, `phone` y `graduatesName` (`GuestsCreationRequest.kt:220-226`), así que lo que la
     * clienta deja vacío viaja como cadena vacía, que es como el motor ya trataba esos campos.
     */
    private fun peticionDelMotor(request: GuestUpsertRequest): GuestsCreationRequest {
        val nombre = request.fullName?.trim().orEmpty()
        if (nombre.isEmpty()) {
            throw GuestPanelException.GuestInvalid("Escribe el nombre del invitado")
        }
        if (nombre.length > GuestPasteReader.MAX_NOMBRE) {
            throw GuestPanelException.GuestInvalid("El nombre del invitado es demasiado largo")
        }

        val correo = request.email?.trim().orEmpty()
        if (correo.isNotEmpty() && !GuestPasteReader.CORREO.matches(correo)) {
            throw GuestPanelException.GuestInvalid("El correo no parece correcto. Revisa la arroba y el dominio")
        }
        val telefono = request.phone?.trim().orEmpty()
        if (telefono.isNotEmpty() && !GuestPasteReader.TELEFONO.matches(telefono)) {
            throw GuestPanelException.GuestInvalid("El teléfono no parece correcto. Escribe solo números")
        }

        val adultos = request.adults ?: 0
        val ninos = request.children ?: 0
        val jovenes = request.young ?: 0
        if (adultos < 0 || ninos < 0 || jovenes < 0) {
            throw GuestPanelException.GuestInvalid("Los cupos no pueden ser negativos")
        }
        if (adultos + ninos + jovenes == 0) {
            throw GuestPanelException.GuestInvalid("Indica al menos una persona: un adulto, un niño o un joven")
        }
        if (request.tableNumber != null && request.tableNumber < 0) {
            throw GuestPanelException.GuestInvalid("El número de mesa no puede ser negativo")
        }

        return GuestsCreationRequest(
            fullName = nombre,
            email = correo,
            graduatesName = "",
            phone = telefono,
            adultsCount = adultos,
            childrenCount = ninos,
            youngCount = jovenes,
            tableNumber = request.tableNumber,
            whatsappSent = null,
        )
    }

    /**
     * `appendGuest` no devuelve el invitado creado (`InvitationGuestsService.kt:52-112` termina en un
     * `save` sin retorno), así que la respuesta del contrato —un [GuestItem] con su `id`— se lee de
     * vuelta. Se busca entre los invitados vivos de **esa** invitación y se toma el de id mayor, que
     * es el que se acaba de escribir.
     */
    private fun recienGuardado(
        invitationId: Long,
        peticion: GuestsCreationRequest,
    ): InvitationGuestEntity? = guestsRepository.findByInvitationIdAndIsEnabledTrue(invitationId)
        .filter {
            it.fullName == peticion.fullName &&
                it.email.orEmpty() == peticion.email &&
                it.phone.orEmpty() == peticion.phone
        }
        .maxByOrNull { it.id }

    /**
     * Convierte lo que lanza el motor en un fallo del panel. **Nunca** se reenvía el mensaje
     * original: el del motor menciona ids de invitación, nombres de regla y, en el caso del permiso,
     * distingue «no existe» de «no tienes acceso», que es justo el oráculo que hay que borrar.
     */
    private fun <T> traducirFallos(bloque: () -> T): T = try {
        bloque()
    } catch (e: GuestNotFoundException) {
        throw GuestPanelException.GuestNotFound()
    } catch (e: DuplicateGuestException) {
        throw GuestPanelException.GuestDuplicate("Ya tienes un invitado con este correo en esta invitación")
    } catch (e: IllegalArgumentException) {
        throw traducirIllegalArgument(e)
    }

    /**
     * El motor usa `IllegalArgumentException` para cosas muy distintas —invitación ajena, cupo no
     * permitido, cifra negativa—, así que hay que separarlas por el texto. Es frágil por diseño
     * ajeno, y por eso el caso por defecto es el más conservador: `GUEST_INVALID` con un mensaje
     * genérico, sin filtrar el original.
     */
    private fun traducirIllegalArgument(e: IllegalArgumentException): GuestPanelException {
        val texto = e.message.orEmpty().lowercase()
        return when {
            texto.contains("no tienes permisos") || texto.contains("la invitación con el id") ->
                GuestPanelException.InvitationNotFound()

            texto.contains("no se permiten agregar invitados con niños") ->
                GuestPanelException.QuotaExceeded("Esta invitación no permite niños")

            texto.contains("no se permiten agregar invitados con jóvenes") ->
                GuestPanelException.QuotaExceeded("Esta invitación no permite jóvenes")

            texto.contains("no permite niños ni jóvenes") ->
                GuestPanelException.QuotaExceeded("Esta invitación solo admite adultos: indica al menos uno")

            texto.contains("debe haber al menos una persona") ->
                GuestPanelException.GuestInvalid("Indica al menos una persona: un adulto, un niño o un joven")

            texto.contains("no puede ser negativo") ->
                GuestPanelException.GuestInvalid("Los cupos no pueden ser negativos")

            else -> GuestPanelException.GuestInvalid("No pudimos guardar estos datos. Revísalos e inténtalo de nuevo")
        }
    }

    private fun pistaDe(code: GuestPanelErrorCode): String = when (code) {
        GuestPanelErrorCode.GUEST_QUOTA_EXCEEDED ->
            "Ajusta los cupos de este renglón o cambia las reglas del evento."
        GuestPanelErrorCode.GUEST_DUPLICATE ->
            "Quita este renglón o escribe un correo distinto."
        else -> "Revisa este renglón: el orden es nombre, adultos, niños, jóvenes, teléfono, correo."
    }

    companion object {
        const val TAMANO_POR_DEFECTO = 25

        /** Tope del contrato §1: una página más grande es una descarga, y para eso está el CSV. */
        const val TAMANO_MAXIMO = 200
    }
}
