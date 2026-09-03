package mx.evolutiondev.invitaciones.core.util.validation.passwordmatching

import jakarta.validation.Constraint
import kotlin.reflect.KClass

/**
 * Validation annotation to ensure that two password fields match.
 *
 * Apply this annotation to a class to specify two fields that must contain matching values.
 * Typically used for password and confirm password validation in form submissions.
 */
@Constraint(validatedBy = [PasswordMatchingValidator::class])
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class PasswordMatching(
        /**
         * @return The name of the password field.
         */
        val password: String,
        /**
         * @return The name of the confirm password field.
         */
        val confirmPassword: String,
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
        val payload: Array<KClass<out Any>> = [],
        /**
         * The default message that is used when the password fields do not match.
         *
         * @return The error message.
         */
        val message: String = "Passwords must match!") {
    /**
     * Allows the annotation to be used as a repeatable annotation.
     */
    @Target(AnnotationTarget.CLASS)
    @Retention(AnnotationRetention.RUNTIME)
    annotation class List(vararg val value: PasswordMatching)
}
