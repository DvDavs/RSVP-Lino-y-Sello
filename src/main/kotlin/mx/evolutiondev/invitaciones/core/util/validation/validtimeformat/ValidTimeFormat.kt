package mx.evolutiondev.invitaciones.core.util.validation.validtimeformat

import jakarta.validation.Constraint
import jakarta.validation.Payload
import kotlin.reflect.KClass

@Target(AnnotationTarget.FIELD, AnnotationTarget.PROPERTY, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [TimeFormatValidator::class])
annotation class ValidTimeFormat(
        val format: String = "hh:mm a", // ✅ Dynamic format
        val message: String = "Hora inválida, debe estar en el formato especificado y ser válida",
        val groups: Array<KClass<*>> = [],
        val payload: Array<KClass<out Payload>> = []
)

