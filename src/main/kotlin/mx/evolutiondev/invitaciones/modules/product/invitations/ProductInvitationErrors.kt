package mx.evolutiondev.invitaciones.modules.product.invitations

import org.springframework.http.HttpStatus

/**
 * Errores tipados del alta de invitación. Existen porque el `@RestControllerAdvice` de `templates2`
 * está acotado a `basePackages = ["…modules.templates2.api"]` (`Templates2ExceptionHandler.kt:55`) y
 * **no alcanza** a `modules.product`: sin estas excepciones y sin
 * [ProductInvitationsExceptionHandler], todo error de esta ruta saldría por `GeneralExceptionHandler`
 * con el cuerpo `ErrorMessage`, que **no tiene `code`** — el frontend tendría que leer el texto en
 * español para decidir qué hacer. Es la consecuencia que ADR-5-0C-01 dejó anotada y que ADR-5-E3-05
 * resuelve.
 *
 * Prefijo `PRD_` para no colisionar con el `TPL_` de `templates2`: cuando el asistente encadena las
 * dos llamadas, el prefijo dice de un vistazo cuál de los dos pasos falló.
 */
sealed class ProductInvitationException(
    val estado: HttpStatus,
    val code: String,
    override val message: String,
    val details: Map<String, Any?>? = null,
) : RuntimeException(message)

/** Falta un campo obligatorio o llegó vacío. `details.field` dice cuál. */
class CampoRequeridoException(campo: String) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_FIELD_REQUIRED",
    "Falta el campo obligatorio «$campo».",
    mapOf("field" to campo),
)

/** `eventKind` fuera del catálogo cerrado de ocho. Se devuelve la lista permitida (no es secreta). */
class EventKindInvalidoException(valor: String, permitidos: List<String>) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_EVENT_KIND_INVALID",
    "El tipo de evento «$valor» no existe. Elige uno de la lista.",
    mapOf("field" to "eventKind", "value" to valor, "allowed" to permitidos),
)

/** Fecha con formato distinto de `YYYY-MM-DD` o inexistente (`2027-02-30`). */
class FechaInvalidaException(valor: String) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_DATE_INVALID",
    "La fecha «$valor» no es válida. Usa el formato AAAA-MM-DD.",
    mapOf("field" to "eventDate", "value" to valor),
)

/** El evento ya pasó. Se compara contra el día de hoy en `America/Mexico_City`, no en UTC. */
class FechaEnElPasadoException(valor: String, hoy: String) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_DATE_IN_PAST",
    "La fecha del evento ya pasó. Elige una fecha a partir de hoy.",
    mapOf("field" to "eventDate", "value" to valor, "today" to hoy),
)

/** Fecha a más de diez años: casi siempre un dedazo en el año, y es mejor preguntarlo que guardarlo. */
class FechaDemasiadoLejanaException(valor: String, maxima: String) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_DATE_TOO_FAR",
    "La fecha del evento está demasiado lejos. Revisa el año.",
    mapOf("field" to "eventDate", "value" to valor, "maxDate" to maxima),
)

/** Hora con formato distinto de `HH:MM` en 24 h. */
class HoraInvalidaException(valor: String) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_TIME_INVALID",
    "La hora «$valor» no es válida. Usa el formato HH:MM de 24 horas.",
    mapOf("field" to "eventTime", "value" to valor),
)

/** `hashtag` de más de [ProductInvitationService.MAXIMO_HASHTAG] caracteres. */
class HashtagDemasiadoLargoException(maximo: Int) : ProductInvitationException(
    HttpStatus.BAD_REQUEST,
    "PRD_HASHTAG_TOO_LONG",
    "El hashtag no puede pasar de $maximo caracteres.",
    mapOf("field" to "hashtag", "max" to maximo),
)

/**
 * Tope de borradores por clienta. `409` y no `429`: no es un límite de frecuencia que se arregle
 * esperando, es un conflicto con el estado de su cuenta que ella resuelve publicando o borrando.
 * El mensaje dice **qué hacer**, no solo que no se puede.
 */
class LimiteDeBorradoresException(limite: Int, actuales: Int) : ProductInvitationException(
    HttpStatus.CONFLICT,
    "PRD_DRAFT_LIMIT_REACHED",
    "Ya tienes $limite invitaciones sin publicar. Publica una o elimina la que no vayas a usar " +
        "para crear otra.",
    mapOf("limit" to limite, "current" to actuales),
)

/**
 * No existe la fila puente de `V42` para ese `eventKind`: el entorno no está migrado. Es `500` y no
 * `400` porque la clienta no ha hecho nada mal y no hay nada que pueda cambiar en su petición.
 */
class PlantillaPuenteAusenteException(eventKind: String) : ProductInvitationException(
    HttpStatus.INTERNAL_SERVER_ERROR,
    "PRD_TEMPLATE_BRIDGE_MISSING",
    "No se pudo crear la invitación. Inténtalo de nuevo en unos minutos.",
    mapOf("eventKind" to eventKind),
)
