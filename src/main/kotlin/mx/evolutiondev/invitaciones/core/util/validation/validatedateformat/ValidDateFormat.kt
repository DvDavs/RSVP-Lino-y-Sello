package mx.evolutiondev.invitaciones.core.util.validation.validatedateformat

import jakarta.validation.Constraint
import jakarta.validation.Payload
import kotlin.reflect.KClass

@Target(AnnotationTarget.FIELD, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [DateFormatValidator::class])
annotation class ValidDateFormat(
        val format: String = "dd/MM/yyyy", // ✅ Dynamic format
        val message: String = "Fecha inválida, debe ser una fecha real en formato especificado",
        val groups: Array<KClass<*>> = [],
        val payload: Array<KClass<out Payload>> = []
)

