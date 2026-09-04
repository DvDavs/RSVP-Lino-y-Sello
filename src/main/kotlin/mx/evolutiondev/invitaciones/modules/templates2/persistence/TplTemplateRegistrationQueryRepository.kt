package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

/**
 * Lectura de la auditoría `tpl_template_registration` para `recentRegistrations` de `03 §3.18`: la
 * lista de los últimos intentos, **incluidos los rechazados**, que es lo que convierte "se descartó en
 * silencio" en un hecho visible desde la API (P1, `02 §2` V35).
 *
 * Interfaz aparte por el mismo motivo que `TplTemplateVersionQueryRepository`: no tocar el archivo de
 * 2-1 mientras otros bloques trabajan en el mismo paquete.
 */
@Repository
interface TplTemplateRegistrationQueryRepository : JpaRepository<TplTemplateRegistrationEntity, Long> {

    fun findAllByOrderByCreatedAtDescIdDesc(pageable: Pageable): List<TplTemplateRegistrationEntity>

    fun findByTemplateSlugOrderByCreatedAtDescIdDesc(
        templateSlug: String,
        pageable: Pageable,
    ): List<TplTemplateRegistrationEntity>
}
