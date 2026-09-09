package mx.evolutiondev.invitaciones.modules.admin.users.service.model

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.validatedateformat.OptionalValidDateFormat

/**
 * Cuerpo de `PUT /user/profile`.
 *
 * **El campo `email` se sacó de aquí en la fase 5** (`12-producto-completo.md §A2.1`, `ADR-5-E3-06`):
 * cambiaba el correo de acceso sin verificar el nuevo ni avisar al antiguo, y su comprobación de
 * unicidad solo miraba las cuentas habilitadas, así que el correo de una cuenta deshabilitada
 * reventaba contra el índice único (`CustomerEntity.kt:23`) con un `500`. El cambio de correo vive
 * ahora en `POST /user/account/email`, con contraseña, verificación del buzón nuevo y aviso al viejo.
 *
 * **`@JsonIgnoreProperties(ignoreUnknown = true)` no es decoración (R1-09).** El `ObjectMapper` de la
 * aplicación es el estricto de `templates2` —no es `@Primary`, pero es el **único**, así que por
 * `@ConditionalOnMissingBean` el de `JacksonAutoConfiguration` se retira y el convertidor de Spring MVC
 * usa ese (`Templates2JsonConfig.kt:35-36`, `Templates2Json.kt:29`)— y trae
 * `FAIL_ON_UNKNOWN_PROPERTIES` activado. Sacar `email` de este DTO **no lo volvió «ignorado»: lo volvió
 * `400`**, y el frontend publicado sigue mandándolo (`handoffs/5-E3-A2-contrato-cuenta.md §1`). Con esta
 * anotación el contrato vuelve a ser cierto: enviar `email` no rompe la petición y no cambia nada. Es la
 * misma trampa que `ProductInvitationDtos.kt:19-26` midió y esquivó.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class UpdateProfileRequest(
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "Los apellidos solo pueden contener caracteres especiales como Ñ y acentos")
        val lastName: String,
        @field:Pattern(regexp = Patterns.PHONE_NUMBER_PATTERN, message = Patterns.PHONE_NUMBER_MESSAGE)
        val phone: String?,
        // @field:OptionalValidDateFormat(
        //         format = "yyyy-MM-dd",
        //         message = "Fecha inválida, debe estar en formato yyyy-MM-dd y ser válida"
        // )
        val birthdate: String?,
        val address: String?,
        val city: String?,
        val postalCode: String?,
        val state: String?
)
