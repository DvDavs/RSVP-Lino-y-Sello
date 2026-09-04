package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional

/**
 * Escribe `tpl_template_registration` (`02 §2` V35): auditoría **append-only** de **cada** intento de
 * registrar una plantilla, éxito o fallo. Mata H-16/H-17 en su forma silenciosa — "la app arrancó sin
 * plantillas" deja de ser posible sin una fila que lo explique.
 *
 * **Dos propagaciones distintas, y la diferencia es el objeto de la objeción B-04 de `02 §2` V35:**
 *
 * - [auditarRechazo] va con `REQUIRES_NEW`: **commit propio**. Un `INSERT` de auditoría dentro de la
 *   transacción que se va a revertir desaparece con el rollback y la auditoría no audita nada. Con
 *   transacción propia, la fila `rejected` sobrevive y el autor de la plantilla ve por qué falló.
 * - [auditarAlta] y [auditarNoop] van en la transacción **en curso** (`02 §4` pasos 4 y 7): si el
 *   commit del registro falla, tampoco debe quedar una fila diciendo que se creó algo que no existe.
 *
 * `REQUIRES_NEW` exige que la llamada venga de **otro bean** (el proxy de Spring no intercepta las
 * llamadas internas de una clase a sí misma): por eso esto es un `@Service` aparte y no un método de
 * `TemplateRegistrar`.
 */
@Service
class TemplateRegistrationAuditor(private val repo: TplTemplateRegistrationRepository) {

    /** Transacción propia: la fila sobrevive al rollback de la principal (objeción B-04). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun auditarRechazo(
        slug: String,
        version: String,
        requestedHash: String,
        code: TplErrorCode,
        detail: Map<String, Any?>? = null,
        requesterId: Long? = null,
    ): Long = insertar(slug, version, requestedHash, RECHAZADO, code.name, detail, null, requesterId)

    /** Misma transacción que el `INSERT` de la versión (`02 §4` paso 7). */
    @Transactional(propagation = Propagation.REQUIRED)
    fun auditarAlta(
        slug: String,
        version: String,
        requestedHash: String,
        templateVersionId: Long,
        detail: Map<String, Any?>? = null,
        requesterId: Long? = null,
    ): Long = insertar(slug, version, requestedHash, CREADO, null, detail, templateVersionId, requesterId)

    /** Misma transacción; aquí no hay rollback que temer (`02 §4` paso 4). */
    @Transactional(propagation = Propagation.REQUIRED)
    fun auditarNoop(
        slug: String,
        version: String,
        requestedHash: String,
        templateVersionId: Long,
        requesterId: Long? = null,
    ): Long = insertar(slug, version, requestedHash, NOOP, null, null, templateVersionId, requesterId)

    private fun insertar(
        slug: String,
        version: String,
        requestedHash: String,
        result: String,
        errorCode: String?,
        detail: Map<String, Any?>?,
        templateVersionId: Long?,
        requesterId: Long?,
    ): Long = repo.save(
        TplTemplateRegistrationEntity(
            templateSlug = slug.take(40),
            version = version.take(20),
            requestedHash = requestedHash,
            result = result,
            errorCode = errorCode?.take(60),
            detail = detail?.let { Templates2Json.mapper.valueToTree<JsonNode>(it) },
            templateVersionId = templateVersionId,
            requestedBy = requesterId,
        ),
    ).id

    companion object {
        /** Los tres literales de `ck_tpl_template_registration_result` (`02 §2` V35). */
        const val CREADO = "created"
        const val NOOP = "noop_same_hash"
        const val RECHAZADO = "rejected"
    }
}
