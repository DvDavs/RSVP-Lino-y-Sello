package mx.evolutiondev.invitaciones.core.util.validation.password

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext

/**
 * Validator for the [StrongPassword] annotation.
 *
 * Implements the logic to check if the annotated String field or method value meets the
 * strong password criteria. It checks for the presence of digits, lowercase and uppercase
 * letters, special characters, and a minimum length of 8 characters.
 */
class StrongPasswordValidator : ConstraintValidator<StrongPassword?, String> {
    /**
     * Validates that the input String meets the defined strong password criteria.
     *
     * @param value The String value to validate as a strong password.
     * @param context Provides context data and operation when applying the validator.
     * @return `true` if the value meets the strong password criteria, `false` otherwise.
     */
    override fun isValid(value: String, context: ConstraintValidatorContext): Boolean {
        // The regex checks for at least one digit, one lowercase letter, one uppercase letter,
        // one special character and ensures the password is at least 8 characters long.
        return value.matches("^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=!*()]).{8,}$".toRegex())
    }
}
