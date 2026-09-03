package mx.evolutiondev.invitaciones.core.util.formatter

import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.*

fun String.isValidEmail(): Boolean {
    return this.matches(Regex(Patterns.EMAIL_PATTERN))
}

fun String.isValidDateFormat(format: String = "yyyy-MM-dd"): Boolean {
    return try {
        val formatter = DateTimeFormatter.ofPattern(format, Locale.getDefault())
        formatter.parse(this)
        true
    } catch (e: DateTimeParseException) {
        false
    }
}

fun String.toDate(format: String = "yyyy-MM-dd HH:mm"): Date {
    return try {
        return SimpleDateFormat(format).parse(this)
    } catch (e: Exception) {
        Date()
    }
}

fun Date.isAtLeastOneDayBefore(other: Date): Boolean {
    val thisDate = this.toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
    val otherDate = other.toInstant().atZone(ZoneId.systemDefault()).toLocalDate()
    return thisDate.isBefore(otherDate)
}

fun Instant.isToday(): Boolean {
    val today = LocalDate.now(ZoneId.systemDefault())
    val instantDate = this.atZone(ZoneId.systemDefault()).toLocalDate()
    return today == instantDate
}
