package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import java.time.Instant

/**
 * `tpl_template` (`02 §2` V29). Fila creada la primera vez que se registra cualquier versión de un
 * `slug`. Nunca se borra desde la API. `PhysicalNamingStrategyStandardImpl` está activo
 * (`application.yml:34`), así que **todo** nombre de columna se anota explícitamente: Hibernate no
 * convierte `camelCase` a `snake_case` por sí solo.
 */
@Entity
@Table(name = "tpl_template")
class TplTemplateEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    /** `TemplateSlug.value` (`domain.TemplateSlug`), ya validado antes de llegar aquí. */
    @Column(name = "slug", nullable = false, length = 40)
    var slug: String = "",

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
)
