package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

/**
 * `tpl_template_registration` (`02 §7.4`). Auditoría append-only. `insertAudit` es `save()` heredado
 * de `JpaRepository`: la tabla no tiene índice de idempotencia ni `ON CONFLICT`, así que un `INSERT`
 * plano basta. La parte que **sí** importa (que la fila `rejected` sobreviva al rollback de la
 * transacción principal, objeción B-04) es responsabilidad del llamador
 * (`TemplateRegistrationAuditor`, bloque posterior) vía `@Transactional(propagation = REQUIRES_NEW)`,
 * no de este repositorio.
 */
@Repository
interface TplTemplateRegistrationRepository : JpaRepository<TplTemplateRegistrationEntity, Long> {

    fun findByTemplateSlugOrderByCreatedAtDesc(templateSlug: String): List<TplTemplateRegistrationEntity>
}
