package mx.evolutiondev.invitaciones.modules.user.profile

import com.fasterxml.jackson.module.kotlin.readValue
import kotlin.test.assertEquals
import kotlin.test.assertNull
import mx.evolutiondev.invitaciones.modules.admin.users.service.model.UpdateProfileRequest
import mx.evolutiondev.invitaciones.modules.product.account.ChangeEmailRequest
import mx.evolutiondev.invitaciones.modules.product.account.ChangePasswordRequest
import mx.evolutiondev.invitaciones.modules.product.account.ResendVerificationRequest
import mx.evolutiondev.invitaciones.modules.product.account.VerifyEmailRequest
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration

/**
 * R1-09 · `PUT /user/profile` tiene que seguir aceptando el cuerpo que manda el frontend publicado.
 *
 * **Por qué esta prueba usa `Templates2Json.mapper` y no un `ObjectMapper()` recién hecho**: porque ese
 * es el mapper que usa la aplicación **entera**. `Templates2JsonConfig.kt:35-36` declara un bean
 * `ObjectMapper` que no es `@Primary` pero **es el único**, así que el
 * `@ConditionalOnMissingBean(ObjectMapper::class)` de [JacksonAutoConfiguration] retira el de Spring
 * Boot y el `MappingJackson2HttpMessageConverter` de Spring MVC se queda con el estricto, que trae
 * `FAIL_ON_UNKNOWN_PROPERTIES` (`Templates2Json.kt:29`). Un `ObjectMapper()` por defecto ignora lo
 * desconocido y por tanto **no reproduce nada**: la prueba pasaría con y sin el arreglo.
 *
 * El contrato publicado (`handoffs/5-E3-A2-contrato-cuenta.md §1`) promete que enviar `email` «no rompe
 * la petición, se ignora». Sin `@JsonIgnoreProperties` esa promesa era falsa: era un `400`.
 */
class PerfilCuerpoDelFrontendTest {

    /** El mapper real de la aplicación. */
    private val mapper = Templates2Json.mapper

    /** El cuerpo tal cual lo manda hoy el frontend de `/perfil`: con `email` dentro. */
    private val cuerpoDelFrontend = """
        {
          "name": "Ana",
          "lastName": "Ruiz",
          "email": "ana@ejemplo.mx",
          "phone": "+525512345678",
          "birthdate": "1990-04-12",
          "address": "Calle Falsa 123",
          "city": "Puebla",
          "postalCode": "72000",
          "state": "Puebla"
        }
    """.trimIndent()

    @Test
    @DisplayName("R1-09: el mapper de la aplicacion es el ESTRICTO — si no, esta prueba no prueba nada")
    fun elMapperDeLaAplicacionEsElEstricto() {
        assertEquals(
            true,
            mapper.deserializationConfig.isEnabled(
                com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
            ),
            "si esto deja de ser cierto, el resto de la clase pierde sentido y hay que reescribirla",
        )
    }

    @Test
    @DisplayName("R1-09: el cuerpo del frontend, con `email`, se lee sin romper y el correo se ignora")
    fun elCuerpoConEmailNoRompeYSeIgnora() {
        val leido: UpdateProfileRequest = mapper.readValue(cuerpoDelFrontend)

        assertEquals("Ana", leido.name)
        assertEquals("Ruiz", leido.lastName)
        assertEquals("+525512345678", leido.phone)
        assertEquals("Puebla", leido.city)
        // No hay dónde meter el correo: el DTO no lo tiene y el cambio vive en `POST /user/account/email`.
        assertNull(
            UpdateProfileRequest::class.java.declaredFields.firstOrNull { it.name == "email" },
            "el DTO NO puede recuperar el campo `email`: ese es el agujero que cerro ADR-5-E3-06",
        )
    }

    @Test
    @DisplayName("R1-09: los cuatro DTO de cuenta tampoco revientan con una clave de mas")
    fun losDtoDeCuentaToleranClavesDeMas() {
        // `confirmPassword` y `_csrf` son las dos que un formulario real cuela sin querer.
        mapper.readValue<VerifyEmailRequest>("""{"token":"t","_csrf":"x"}""").also {
            assertEquals("t", it.token)
        }
        mapper.readValue<ResendVerificationRequest>("""{"email":"a@b.mx","captcha":"z"}""").also {
            assertEquals("a@b.mx", it.email)
        }
        mapper.readValue<ChangePasswordRequest>(
            """{"currentPassword":"a","newPassword":"b","confirmPassword":"b"}""",
        ).also { assertEquals("b", it.newPassword) }
        mapper.readValue<ChangeEmailRequest>(
            """{"email":"a@b.mx","password":"p","confirmEmail":"a@b.mx"}""",
        ).also { assertEquals("a@b.mx", it.email) }
    }
}
