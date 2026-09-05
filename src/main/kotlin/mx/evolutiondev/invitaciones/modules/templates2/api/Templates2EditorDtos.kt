package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.Obj
import java.time.Instant

/**
 * DTO de las rutas 2-6 y 10-14 de `03 §2`.
 *
 * **Las peticiones se leen como `JsonNode` y se decodifican a mano** con el lector estricto [Obj] de
 * 2-0b (equivalente a `z.strictObject`), no con `@RequestBody ChooseTemplateRequest`. Motivo
 * verificado: el `ObjectMapper` con `FAIL_ON_UNKNOWN_PROPERTIES` de `templates2` **no es `@Primary`**
 * (`02 §8.1`, ADR-1R-B-06), así que el que usa Spring MVC para vincular un `@RequestBody` es el del
 * núcleo — y con él, `{"invitationId": 200, …}` se descartaría **en silencio**, que es justo el ataque
 * de `03 §9.2` fila 2 y una violación directa de P1. Decodificando con [Obj] la clave desconocida sale
 * como `400 TPL_MALFORMED_JSON` con su `path`.
 *
 * Las **respuestas** sí son data classes normales: los tres campos grandes (`document`, `composed`,
 * `report`) viajan como `JsonNode` ya codificados por `DomainJson.encode`, para que el cuerpo sea
 * exactamente el del esquema compartido y no lo que Jackson infiera del dominio Kotlin.
 */
object EditorRequests {

    /** `03 §3.2`: `{templateSlug, templateVersion, baseRevision?}`. */
    data class ChooseTemplateRequest(
        val templateSlug: String,
        val templateVersion: String,
        /** obligatorio si el documento ya existe; se omite en la primera creación (ADR-1R-B-11) */
        val baseRevision: Long?,
    )

    /** `03 §3.6`: `{revision, baseRevision}` — las dos obligatorias (`02 §11.3`). */
    data class RestoreRequest(val revision: Long, val baseRevision: Long)

    /** `03 §3.12`: `{baseRevision}`. */
    data class PublishRequest(val baseRevision: Long)

    /**
     * `03 §3.20`: `{date, time?}` del `PUT …/event` (I-06, `ADR-3B-I06-01`).
     *
     * `date` es obligatoria porque es el verbo de la ruta ("cambiar la fecha de mi evento"). `time`
     * es **opcional** y su ausencia significa "no toques la hora", no "bórrala": la plantilla
     * `boda-clasica@1.0.0` no declara ningún bloque con `businessField: "invitation.time"`, así que
     * el editor no puede mostrar ni conservar un valor que nunca recibe — exigirla obligaría al
     * cliente a inventarse una hora, que es justo el dato fabricado que P1 prohíbe. Un cuerpo
     * `{date, time}` completo (el que fija el encargo) se acepta y escribe las dos columnas.
     */
    data class EventRequest(val date: String, val time: String?)

    fun chooseTemplate(node: JsonNode): ChooseTemplateRequest {
        val o = Obj(node, "body")
        val slug = o.texto("templateSlug")
        val version = o.texto("templateVersion")
        val base = o.bruto("baseRevision")?.let { enteroLargo(it, "body.baseRevision") }
        o.fin()
        return ChooseTemplateRequest(slug, version, base)
    }

    fun restore(node: JsonNode): RestoreRequest {
        val o = Obj(node, "body")
        val revision = o.largo("revision")
        val base = o.largo("baseRevision")
        o.fin()
        return RestoreRequest(revision, base)
    }

    fun publish(node: JsonNode): PublishRequest {
        val o = Obj(node, "body")
        val base = o.largo("baseRevision")
        o.fin()
        return PublishRequest(base)
    }

    fun event(node: JsonNode): EventRequest {
        val o = Obj(node, "body")
        val date = o.texto("date")
        val time = o.textoOpcional("time")
        o.fin()
        return EventRequest(date, time)
    }

    private fun enteroLargo(node: JsonNode, path: String): Long {
        if (!node.isIntegralNumber) throw Templates2Exception.MalformedJson(
            "$path: se esperaba un entero", mapOf("path" to path),
        )
        return node.longValue()
    }
}

/** `slug@version` de la versión de plantilla vigente del documento (`03 §3.3`). */
data class TemplateVersionRef(val slug: String, val version: String, val status: String)

/**
 * Release activo tal como lo ve el editor (`03 §3.3`). `stale` se calcula comparando el
 * `business_snapshot` **congelado** del release contra el actual, **sin recomponer** — que es
 * exactamente para lo que `02 §2` V34 congela esa columna (ADR-007).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ActiveReleaseRef(
    val releaseId: Long,
    val publishedAt: Instant?,
    val contentHash: String,
    val documentRevision: Long,
    val stale: Boolean,
    val staleReason: List<String>,
)

/** `03 §3.2`. `201` si creó el documento, `200` si ya existía. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ChooseTemplateResponse(
    val revision: Long,
    val created: Boolean,
    val changed: Boolean,
    val document: JsonNode,
    val composed: JsonNode,
    val report: JsonNode,
    val movedToAttic: List<String>,
    val templateVersion: TemplateVersionRef,
    val publicToken: String,
    val publicUrl: String,
)

/**
 * `03 §3.3`.
 *
 * `manifest` y `theme` son el paquete de la versión de plantilla que **esta** invitación usa, tal cual
 * lo guardan `tpl_template_version.manifest` y `.theme` (ADR-3-4b-01). Sin ellos el editor no podía
 * editar, sólo pintar: el [composed] lleva `label`, `role`, `type`, `provenance` y `value` por bloque,
 * pero **no** `BlockSpec.constraints` (`maxLength`, `multiline` — escenario U-17 de `04 §20.1`), ni las
 * opciones de un bloque `choice`, ni `SectionSpec.required` (U-18: sin él, ocultar una sección
 * obligatoria sólo se descubría fallando con `TPL_SECTION_REQUIRED`), ni `SectionSpec.variants`, ni el
 * catálogo de paletas y conjuntos tipográficos — `composed.theme` es el tema **ya resuelto**, no los
 * presets entre los que elegir. Duplicar el manifiesto en el frontend habría reintroducido H-27 y roto
 * P4 (añadir una plantilla no debe tocar el frontend).
 *
 * Son **campos aditivos**, no una ruta nueva: siguen siendo 19 rutas y `Templates2RouteInventoryTest`
 * no cambia. Van aquí y no en `GET /editor/templates2/catalog` porque el editor necesita el manifiesto
 * de la plantilla de esta invitación, no el catálogo entero.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class DocumentResponse(
    val document: JsonNode,
    val revision: Long,
    val templateVersion: TemplateVersionRef,
    /** `template.json` de la versión vigente, completo y sin recortar (P1, P3). */
    val manifest: JsonNode,
    /** `theme.json` de la versión vigente: las paletas y los conjuntos tipográficos entre los que elegir. */
    val theme: JsonNode,
    val composed: JsonNode,
    val report: JsonNode,
    val publicToken: String,
    val publicUrl: String,
    val activeRelease: ActiveReleaseRef?,
)

/**
 * `03 §3.4`. `applied = false` es la respuesta al **reintento** de un lote que ya se aplicó
 * (`ux_tpl_document_snapshot_batch`, ADR-1R-B-03): `revision` es la que ese lote produjo, no la actual.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class OperationBatchResponse(
    val revision: Long,
    val applied: Boolean,
    val idMap: Map<String, String>,
    val composed: JsonNode,
    val report: JsonNode,
)

/** Una fila del historial (`03 §3.5`). Nunca lleva el `doc` completo: para eso está `restore`. */
data class HistoryItemResponse(
    val revision: Long,
    val createdAt: Instant?,
    val clientBatchId: String?,
    val origin: String,
    val createdBy: Long?,
)

/** `03 §3.5`. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class HistoryPageResponse(val items: List<HistoryItemResponse>, val nextCursor: String?)

/** `03 §3.6`. `restore` crea una revisión **nueva**; nunca reescribe la historia (ADR-029). */
data class RestoreResponse(
    val revision: Long,
    val composed: JsonNode,
    val report: JsonNode,
    val movedToAttic: List<String>,
)

/** Un bloqueo o un aviso del preflight (`03 §3.11`). */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class PreflightFinding(
    val code: String,
    val blockIds: List<String>? = null,
    val sectionKeys: List<String>? = null,
)

/** `03 §3.11`. Lectura pura: no publica ni escribe nada. */
data class PreflightResponse(
    val canPublish: Boolean,
    val blockers: List<PreflightFinding>,
    val warnings: List<PreflightFinding>,
    val report: JsonNode,
    val contentHash: String,
    val sameAsActiveRelease: Boolean,
)

/** `03 §3.12`. `201` si insertó release; `200` con `reusedActiveRelease = true` si el hash no cambió. */
data class ReleaseResponse(
    val releaseId: Long,
    val contentHash: String,
    val documentRevision: Long,
    val publishedAt: Instant?,
    val publicToken: String,
    val publicUrl: String,
    val reusedActiveRelease: Boolean,
)

/** Una fila del historial de publicaciones (`03 §3.14`). Nunca lleva `composed`. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ReleaseItemResponse(
    val releaseId: Long,
    val publishedAt: Instant?,
    val unpublishedAt: Instant?,
    val contentHash: String,
    val documentRevision: Long,
    val templateVersion: TemplateVersionRef?,
    val isActive: Boolean,
    val publishedBy: Long?,
)

/** `03 §3.14`. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class ReleaseListResponse(val items: List<ReleaseItemResponse>, val nextCursor: String?)

/** `03 §3.10`. Rotar es explícito y **no** es idempotente: cada llamada revoca el enlace anterior. */
data class PublicTokenResponse(val publicToken: String, val publicUrl: String, val rotatedAt: Instant)

/**
 * `03 §3.20`. Lo que quedó guardado en `invitation`, releído del propio `BusinessSnapshot` tras la
 * escritura: la respuesta es la verdad de Postgres, nunca el eco del cuerpo que llegó.
 *
 * `releaseStale` dice si la invitación publicada quedó **desactualizada** por este cambio. No se
 * invalida nada de forma automática (`ADR-3B-I06-01`): la fecha del release está congelada en
 * `tpl_release.business_snapshot` y el mecanismo que ya existe para eso es
 * `EditorDocumentService.razonesDeStale` — el editor lo lee y la clienta vuelve a publicar cuando
 * quiera. `staleReason` es esa misma lista (`["business.date"]`, y `"business.time"` si cambió).
 */
data class EventResponse(
    val invitationId: Long,
    val date: String?,
    val time: String?,
    val releaseStale: Boolean,
    val staleReason: List<String>,
)
