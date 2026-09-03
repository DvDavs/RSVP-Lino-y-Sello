package mx.evolutiondev.invitaciones.core.util.validation.validatedateformat

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

class DateFormatValidator : ConstraintValidator<ValidDateFormat, String> {
    private lateinit var dateFormatter: DateTimeFormatter

    override fun initialize(annotation: ValidDateFormat) {
        dateFormatter = DateTimeFormatter.ofPattern(annotation.format) // ✅ Use dynamic format
    }

    override fun isValid(value: String?, context: ConstraintValidatorContext?): Boolean {
        if (value.isNullOrBlank()) return false
        return try {
            LocalDate.parse(value, dateFormatter) // ✅ Ensures it's a real date
            true
        } catch (e: DateTimeParseException) {
            false
        }
    }
}
