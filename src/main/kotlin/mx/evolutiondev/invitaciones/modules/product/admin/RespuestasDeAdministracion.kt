package mx.evolutiondev.invitaciones.modules.product.admin

import com.fasterxml.jackson.annotation.JsonInclude

/**
 * Cuerpos JSON de `/product/admin/` + `**` (contrato `contrato-admin.md` §1, §2, §3, §5, §6, §7).
 *
 * **Claves en español** porque es la convención del producto nuevo; el backend heredado usa inglés y
 * no se toca (`12-producto-completo.md §A2.5`).
 *
 * **Cero presentación** (P3, `brief-comun.md`): ni colores, ni etiquetas de interfaz, ni fechas
 * formateadas para humanos. Los instantes salen como texto ISO-8601 en UTC —lo que da
 * `java.time.Instant.toString()`, p. ej. `2026-03-02T10:00:00Z`— convertidos **aquí y a mano**, no por
 * la configuración de Jackson: un cambio de `spring.jackson.*` no puede alterar un contrato de API.
 * `fecha` y `hora` de una invitación salen tal cual están en la base, que ya son texto
 * (`invitation.date` y `invitation."time"` son `character varying`, `V1__initial_schema.sql`).
 */
data class MetricasDeAdministracion(
    val clientas: Long,
    val invitaciones: Long,
    val publicadas: Long,
    val pagadas: Long,
    val rsvpUltimos7Dias: Long,
)

/** §2. `nombre` viene ya compuesto como `name + " " + lastName` (`core/auth/model/CustomerEntity.kt:20-21`). */
/**
 * `@JsonInclude(ALWAYS)` en los tres DTO con campos anulables: **verificado contra el backend real**
 * que, con la configuración de Jackson de esta aplicación, un campo `null` se omite del cuerpo. El
 * contrato dice `"enlacePublico": null`, no «sin la clave»: un frontend tipado que espera la
 * propiedad no debe tener que distinguir «ausente» de «nula». La anotación fija la forma aquí, en el
 * DTO, y no depende de ninguna propiedad global que otra sesión pueda cambiar.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class ClientaDeAdministracion(
    val id: Long,
    val nombre: String,
    val correo: String,
    val rol: String,
    val habilitada: Boolean,
    val invitaciones: Long,
    val altaEn: String?,
)

data class PaginaDeClientas(
    val total: Long,
    val pagina: Int,
    val tamano: Int,
    val elementos: List<ClientaDeAdministracion>,
)

/**
 * §3. `estado` ∈ `publicada | en-edicion | deshabilitada`, decidido **en SQL**, no en memoria.
 * `enlacePublico` es `tpl_document.public_token` y solo aparece cuando hay `tpl_release` activo:
 * el token de una invitación no publicada no sale nunca de esta ruta.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class InvitacionDeAdministracion(
    val id: Long,
    val evento: String?,
    val fecha: String?,
    val hora: String?,
    val clientaId: Long,
    val clienta: String,
    val plan: String?,
    val pagada: Boolean,
    val importe: Double,
    val estado: String,
    val enlacePublico: String?,
    val usaTemplates2: Boolean,
    val creadaEn: String?,
)

data class PaginaDeInvitaciones(
    val total: Long,
    val pagina: Int,
    val tamano: Int,
    val elementos: List<InvitacionDeAdministracion>,
)

/** §5. `id` es sintético (`inv-<id de invitación>`) mientras la fuente sea `invitaciones`. */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class PagoDeAdministracion(
    val id: String,
    val invitacionId: Long,
    val clientaId: Long,
    val clienta: String,
    val plan: String?,
    val importe: Double,
    val moneda: String,
    val estado: String,
    val fecha: String?,
)

data class PaginaDePagos(
    val total: Long,
    val pagina: Int,
    val tamano: Int,
    /** `"invitaciones"` hoy; `"pagos"` cuando E4 aterrice su fuente real (contrato §5). */
    val origen: String,
    val elementos: List<PagoDeAdministracion>,
)

/** §6. Catálogo heredado `invitation_plan`; solo lectura, el alta sigue siendo `/master/plans`. */
data class PlanDeAdministracion(
    val id: Long,
    val nombre: String,
    val invitaciones: Long,
)

data class CatalogoDePlanes(val elementos: List<PlanDeAdministracion>)

/** §7. Una fila por versión registrada de plantilla nueva (`tpl_template_version` + `tpl_template`). */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class PlantillaDeAdministracion(
    val slug: String,
    val version: String,
    val estado: String,
    val tiposDeEvento: List<String>,
    val registradaEn: String?,
    val invitaciones: Long,
)

data class CatalogoDePlantillas(
    val total: Int,
    val elementos: List<PlantillaDeAdministracion>,
)
