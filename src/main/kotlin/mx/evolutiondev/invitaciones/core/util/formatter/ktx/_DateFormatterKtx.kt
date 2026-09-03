package mx.evolutiondev.invitaciones.core.util.formatter.ktx

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

fun String.toStartInstantDate(format: String = "yyyy-MM-dd"): Instant? {
    val formatter = DateTimeFormatter.ofPattern(format)
    return try {
        LocalDate.parse(this, formatter).atStartOfDay(ZoneOffset.UTC).toInstant()
    } catch (e: DateTimeParseException) {
        null
    }
}

fun String.toEndInstantDate(format: String = "yyyy-MM-dd"): Instant? {
    val formatter = DateTimeFormatter.ofPattern(format)
    return try {
        LocalDate.parse(this, formatter).atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant()
    } catch (e: DateTimeParseException) {
        null
    }
}
