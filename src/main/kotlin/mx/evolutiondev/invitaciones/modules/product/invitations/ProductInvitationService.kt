package mx.evolutiondev.invitaciones.modules.product.invitations

import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException

/** Qué devolver: [creada] `false` significa que se reconoció un doble clic y no se insertó nada. */
data class ResultadoAlta(val respuesta: InvitacionCreadaResponse, val creada: Boolean)

/**
 * Alta de invitación por el rol `USER` (bloque 5-1b; contrato en
 * `memoria/handoffs/5-1b-contrato-alta.md`).
 *
 * **Por qué existe.** ADR-5-0B-01 decidió que editar y previsualizar son gratis y que la puerta de
 * pago está en publicar. Eso obliga a que la invitación pueda **nacer sin pagar**, y hoy la única
 * alta del sistema es `POST /admin/invitations/create`, de rol `ADMIN` (`SecurityConfig.kt:42`), con
 * su DTO en `modules/user/invitations`, que es módulo prohibido (ADR-5-0C-01). Sin esta ruta, "editar
 * gratis" no existe porque no hay nada que editar.
 *
 * **Lo que NO hace.** No aplica plantilla: eso es `POST /editor/invitations/{id}/document:choose-template`
 * (`EditorDocumentController.kt:36-41`), el único creador del documento (ADR-1R-X-03). No cobra, no
 * crea invitados, no publica y no manda correo. Una responsabilidad por endpoint: si el alta
 * encadenara la plantilla, un fallo del segundo paso dejaría una invitación a medias y sin manera de
 * saber en cuál de los dos falló (ADR-5-E3-04).
 */
@Service
class ProductInvitationService(
    private val repositorio: ProductInvitationRepository,
) {

    /**
     * [customerId] sale **siempre** de `authentication.userId()`; la petición no puede influir en él.
     *
     * Transaccional: el conteo de borradores y la inserción tienen que ver la misma foto. No hay
     * bloqueo pesimista, así que dos peticiones simultáneas de la misma clienta podrían dejar cuatro
     * borradores en lugar de tres; es un tope de producto, no una compuerta de seguridad, y el coste
     * de bloquear su fila en cada alta no lo vale (anotado en `preguntas-abiertas.md`).
     */
    @Transactional
    fun crear(customerId: Long, peticion: CrearInvitacionRequest): ResultadoAlta {
        val eventKind = validarEventKind(peticion.eventKind)
        val fecha = validarFecha(peticion.eventDate)
        val hora = validarHora(peticion.eventTime)
        val hashtag = validarHashtag(peticion.hashtag)
        val ninos = peticion.childrenAllowed ?: true
        val jovenes = peticion.youngAllowed ?: true

        val plantilla = repositorio.plantillaPuente(eventKind.wire)
            ?: throw PlantillaPuenteAusenteException(eventKind.wire)

        val ahora = Instant.now(reloj)

        // Red del doble clic: mismo dueño, mismos tres campos, borrador sin documento y menos de un
        // minuto. Se devuelve la que ya existe con `200`, en vez de gastarle un hueco de los tres.
        repositorio.borradorIdenticoReciente(
            customerId = customerId,
            templateId = plantilla,
            fecha = fecha,
            hora = hora,
            desde = ahora.minusSeconds(VENTANA_DOBLE_CLIC_SEGUNDOS),
        )?.let { previa ->
            return ResultadoAlta(
                respuesta(previa, eventKind, fecha, hora, hashtag, ninos, jovenes),
                creada = false,
            )
        }

        val borradores = repositorio.contarBorradores(customerId)
        if (borradores >= MAXIMO_BORRADORES) {
            throw LimiteDeBorradoresException(MAXIMO_BORRADORES, borradores)
        }

        val creada = repositorio.insertar(
            NuevaInvitacion(
                customerId = customerId,
                templateId = plantilla,
                fecha = fecha,
                hora = hora,
                hashtag = hashtag,
                childrenAllowed = ninos,
                youngAllowed = jovenes,
                creadaEn = ahora,
            ),
        )
        return ResultadoAlta(respuesta(creada, eventKind, fecha, hora, hashtag, ninos, jovenes), creada = true)
    }

    private fun respuesta(
        fila: InvitacionCreada,
        eventKind: EventKind,
        fecha: String,
        hora: String,
        hashtag: String,
        ninos: Boolean,
        jovenes: Boolean,
    ) = InvitacionCreadaResponse(
        invitationId = fila.id,
        eventKind = eventKind.wire,
        eventDate = fecha,
        eventTime = hora,
        childrenAllowed = ninos,
        youngAllowed = jovenes,
        hashtag = hashtag,
        isPaid = false,
        isEnabled = true,
        isFinished = false,
        usesTemplates2 = true,
        createdAt = fila.creadaEn.toString(),
    )

    /** Catálogo cerrado de ocho, espejo de `frontend/packages/schema/src/common.ts:61-63`. */
    private fun validarEventKind(valor: String?): EventKind {
        val texto = valor?.trim().orEmpty()
        if (texto.isEmpty()) throw CampoRequeridoException("eventKind")
        return EventKind.of(texto) ?: throw EventKindInvalidoException(texto, PERMITIDOS)
    }

    private fun validarFecha(valor: String?): String {
        val texto = valor?.trim().orEmpty()
        if (texto.isEmpty()) throw CampoRequeridoException("eventDate")
        if (!PATRON_FECHA.matches(texto)) throw FechaInvalidaException(texto)
        val fecha = try {
            LocalDate.parse(texto)
        } catch (e: DateTimeParseException) {
            throw FechaInvalidaException(texto)
        }
        val hoy = LocalDate.now(reloj.withZone(ZONA))
        if (fecha.isBefore(hoy)) throw FechaEnElPasadoException(texto, hoy.toString())
        val maxima = hoy.plusYears(ANIOS_MAXIMOS)
        if (fecha.isAfter(maxima)) throw FechaDemasiadoLejanaException(texto, maxima.toString())
        return texto
    }

    private fun validarHora(valor: String?): String {
        val texto = valor?.trim().orEmpty()
        if (texto.isEmpty()) throw CampoRequeridoException("eventTime")
        if (!PATRON_HORA.matches(texto)) throw HoraInvalidaException(texto)
        return texto
    }

    private fun validarHashtag(valor: String?): String {
        val texto = valor?.trim().orEmpty()
        if (texto.length > MAXIMO_HASHTAG) throw HashtagDemasiadoLargoException(MAXIMO_HASHTAG)
        return texto
    }

    /**
     * Reloj sustituible **solo** en pruebas (las de fecha necesitan un "hoy" fijo). En producción es
     * el del sistema y nadie lo toca; no se declara como parámetro del constructor para no exigir un
     * bean `Clock` que este proyecto no tiene.
     */
    internal var reloj: Clock = Clock.system(ZONA)

    companion object {
        /** Zona del negocio: el producto vende en México (ADR-DUENO-02). Nunca UTC para "hoy". */
        val ZONA: ZoneId = ZoneId.of("America/Mexico_City")

        /**
         * Tope conservador de borradores por clienta. No es una compuerta de seguridad: es el freno
         * que evita que una cuenta (o un guion) llene la tabla de invitaciones vacías, y el número
         * sale de que nadie organiza más de tres eventos a la vez. Se sube con una ADR, no con un
         * parche.
         */
        const val MAXIMO_BORRADORES = 3
        const val MAXIMO_HASHTAG = 100
        const val ANIOS_MAXIMOS = 10L
        const val VENTANA_DOBLE_CLIC_SEGUNDOS = 60L

        /** Espejo de `IsoDate` e `IsoTime` de `frontend/packages/schema/src/common.ts:66-69`. */
        private val PATRON_FECHA = Regex("""^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$""")
        private val PATRON_HORA = Regex("""^([01]\d|2[0-3]):[0-5]\d$""")

        private val PERMITIDOS: List<String> = EventKind.entries.map { it.wire }
    }
}
