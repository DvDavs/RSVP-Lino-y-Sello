package mx.evolutiondev.invitaciones.core.util.validation.passwordmatching

import jakarta.validation.ConstraintValidator
import jakarta.validation.ConstraintValidatorContext
import org.springframework.beans.BeanWrapperImpl

/**
 * Validator for the [PasswordMatching] annotation.
 *
 * Implements the logic to compare values of two fields in an object to ensure they match.
 * This validator can be applied to any class containing fields that need to match, such as
 * password and confirm password fields in a form.
 */
class PasswordMatchingValidator : ConstraintValidator<PasswordMatching, Any?> {
    private var password: String? = null
    private var confirmPassword: String? = null

    /**
     * Initializes the validator with the names of the fields to be compared.
     *
     * @param matching The annotation instance containing the fields to compare.
     */
    override fun initialize(matching: PasswordMatching) {
        password = matching.password
        confirmPassword = matching.confirmPassword
    }

    /**
     * Validates that the specified fields in the given object match.
     *
     * @param value The object containing the fields to compare.
     * @param constraintValidatorContext The context in which the constraint is evaluated.
     * @return `true` if the fields match, `false` otherwise.
     */
    override fun isValid(value: Any?, constraintValidatorContext: ConstraintValidatorContext): Boolean {
        val passwordValue = BeanWrapperImpl(value!!).getPropertyValue(password!!)!!
        val confirmPasswordValue = BeanWrapperImpl(value).getPropertyValue(confirmPassword!!)!!
        return passwordValue == confirmPasswordValue
    }
}
