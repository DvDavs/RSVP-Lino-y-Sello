package mx.evolutiondev.invitaciones.core.util.validation.password

import jakarta.validation.Constraint
import jakarta.validation.Payload
import kotlin.reflect.KClass

/**
 * Validation annotation to enforce strong password policies.
 *
 * This annotation can be applied to String fields or methods to ensure that the password
 * meets defined criteria for strength, including length and character diversity requirements.
 * The default message outlines the basic requirements for a strong password.
 */
@Target(AnnotationTarget.FIELD) // Ensure it’s applied to fields only
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [StrongPasswordValidator::class])
@MustBeDocumented
annotation class StrongPassword(
        /**
         * The default validation message if password strength requirements are not met.
         *
         * @return A string detailing the password requirements.
         */
        val message: String = "Password must be 8 characters long and combination of uppercase letters, lowercase letters, numbers, special characters.",
        /**
         * Defines default groups for the constraint. Not used in this context but required by the validation API.
         *
         * @return Default group classes.
         */
        val groups: Array<KClass<*>> = [],
        /**
         * Can be used by clients to assign custom payload objects to a constraint. Not used in this context.
         *
         * @return Default payload classes.
         */
        val payload: Array<KClass<out Payload>> = []
)
