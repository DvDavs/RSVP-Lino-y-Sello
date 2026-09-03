package mx.evolutiondev.invitaciones.core.util.validation.valueofenum

import jakarta.validation.Constraint
import jakarta.validation.Payload
import kotlin.reflect.KClass

@Target(AnnotationTarget.FIELD, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [ValueOfEnumValidator::class])
annotation class ValueOfEnum(
        val enumClass: KClass<out Enum<*>>,
        val acceptedValues: Array<String> = [], // ✅ Allows specifying allowed values
        val message: String = "Value must be one of {acceptedValues}",
        val groups: Array<KClass<*>> = [],
        val payload: Array<KClass<out Payload>> = []
)
