package mx.evolutiondev.invitaciones.core.util.validation.valueofenum

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext

class ValueOfEnumValidator : ConstraintValidator<ValueOfEnum, String> {

    private lateinit var acceptedValues: Set<String>

    override fun initialize(annotation: ValueOfEnum) {
        val allEnumValues = annotation.enumClass.java.enumConstants
                .map { it.name }
                .toSet()

        acceptedValues = if (annotation.acceptedValues.isNotEmpty()) {
            annotation.acceptedValues.toSet()
        } else {
            allEnumValues
        }
    }

    override fun isValid(value: String?, context: ConstraintValidatorContext): Boolean {
        return value != null && acceptedValues.contains(value)
    }
}
