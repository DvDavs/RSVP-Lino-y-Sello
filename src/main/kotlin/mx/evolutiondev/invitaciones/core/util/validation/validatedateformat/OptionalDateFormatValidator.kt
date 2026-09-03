package mx.evolutiondev.invitaciones.core.util.validation.validatedateformat

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

class OptionalDateFormatValidator : ConstraintValidator<OptionalValidDateFormat, String> {
    private lateinit var dateFormatter: DateTimeFormatter

    override fun initialize(annotation: OptionalValidDateFormat) {
        dateFormatter = DateTimeFormatter.ofPattern(annotation.format)
    }

    override fun isValid(value: String?, context: ConstraintValidatorContext?): Boolean {
        if (value.isNullOrEmpty()) return true
        return try {
            LocalDate.parse(value, dateFormatter)
            true
        } catch (e: DateTimeParseException) {
            false
        }
    }
}