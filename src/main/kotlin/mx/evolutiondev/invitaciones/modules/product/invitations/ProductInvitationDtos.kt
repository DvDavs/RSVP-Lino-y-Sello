package mx.evolutiondev.invitaciones.modules.product.invitations

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

/**
 * Cuerpos de `POST /product/invitations` (contrato completo en
 * `memoria/handoffs/5-1b-contrato-alta.md`).
 *
 * **Todos los campos de la petición son anulables a propósito.** Si se declararan no anulables, un
 * cuerpo al que le falte uno lo rechazaría Jackson con `MissingKotlinParameterException`, que acaba
 * en el `400` genérico de `GeneralExceptionHandler` **sin `code`** — exactamente el defecto H-14 que
 * `contratos.md §4` obliga a no repetir. Aquí llega `null` y lo rechaza el servicio con un código
 * estable (`PRD_FIELD_REQUIRED`).
 *
 * **El dueño no está en el payload y no puede estarlo**, y `@JsonIgnoreProperties(ignoreUnknown)`
 * es lo que garantiza que un `{"customerId": 200}` se **ignore** — ni se acepte ni se rechace — en vez
 * de depender de qué `ObjectMapper` gane.
 *
 * **Medido contra el backend real, y no es lo que dice la documentación heredada.** `templates2`
 * declara su mapper estricto como bean sin `@Primary` creyendo que así no cambia el del resto de la
 * aplicación (`Templates2JsonConfig.kt:14-19`), pero `JacksonAutoConfiguration` crea el suyo con
 * `@ConditionalOnMissingBean(ObjectMapper)`: al existir ese bean, **se retira**, y el convertidor de
 * mensajes de Spring MVC acaba usando el estricto para TODA la aplicación. Verificado el 2026-09-09
 * contra `:6003`: sin esta anotación, `POST /product/invitations` con `customerId` respondía
 * `400 PRD_MALFORMED_JSON` («Unrecognized field "customerId" … not marked as ignorable», en
 * `build/dev/backend.log`). Es un aviso para E2, E4 y E5: **todo DTO de petición de `modules/product`
 * necesita esta anotación** o rechazará campos que el contrato promete ignorar.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class CrearInvitacionRequest(
    val eventKind: String? = null,
    val eventDate: String? = null,
    val eventTime: String? = null,
    val childrenAllowed: Boolean? = null,
    val youngAllowed: Boolean? = null,
    val hashtag: String? = null,
)

/**
 * Respuesta del alta. **Solo datos de la invitación recién creada**: ningún identificador ajeno,
 * ningún conteo global, ninguna lista — un cuerpo que dijera "llevas 2 de 3" ya sería un contador
 * que no hace falta enseñar, y uno que devolviera ids vecinos sería enumeración regalada.
 *
 * No lleva `publicToken` porque todavía no existe: lo crea el primer `:choose-template`
 * (`contratos.md §4`, ADR-1R-X-03).
 */
data class InvitacionCreadaResponse(
    val invitationId: Long,
    val eventKind: String,
    val eventDate: String,
    val eventTime: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val hashtag: String,
    val isPaid: Boolean,
    val isEnabled: Boolean,
    val isFinished: Boolean,
    val usesTemplates2: Boolean,
    val createdAt: String,
)

/**
 * Cuerpo de error del subpaquete. Misma forma que `TplErrorResponse` (`contratos.md §4`) para que el
 * frontend tenga **un** lector de errores tipados y no dos: `timestamp`, `statusCode`, `code`,
 * `message`, `details`. El `code` es estable y el `message` es es-MX y puede cambiar sin aviso.
 */
data class ProductErrorResponse(
    val timestamp: String,
    val statusCode: Int,
    val code: String,
    val message: String,
    val details: Map<String, Any?>? = null,
)
