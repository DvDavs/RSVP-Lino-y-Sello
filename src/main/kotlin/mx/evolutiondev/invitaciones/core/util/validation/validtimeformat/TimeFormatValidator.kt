package mx.evolutiondev.invitaciones.core.util.validation.validtimeformat

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

class TimeFormatValidator : ConstraintValidator<ValidTimeFormat, String> {
    private lateinit var timeFormatter: DateTimeFormatter

    override fun initialize(annotation: ValidTimeFormat) {
        timeFormatter = DateTimeFormatter.ofPattern(annotation.format) // ✅ Use dynamic format
    }

    override fun isValid(value: String?, context: ConstraintValidatorContext?): Boolean {
        if (value.isNullOrBlank()) return false
        return try {
            LocalTime.parse(value.uppercase(), timeFormatter) // ✅ Ensures it's a real time
            true
        } catch (e: DateTimeParseException) {
            false
        }
    }
}
