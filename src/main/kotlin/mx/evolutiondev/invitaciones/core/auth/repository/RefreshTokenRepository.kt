package mx.evolutiondev.invitaciones.core.auth.repository

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface RefreshTokenRepository : JpaRepository<RefreshTokenEntity, Long> {
    fun findByCustomer(customer: CustomerEntity): RefreshTokenEntity?
    fun findByToken(token: String): RefreshTokenEntity?

    /**
     * Revoca **todas** las sesiones de refresco de una cuenta y devuelve cuántas borró.
     *
     * Es la pieza que le faltaba a tres caminos de la fase 5 (`12-producto-completo.md §A2.1`):
     * el reset de contraseña —que hasta ahora dejaba dentro a quien tuviera un token de refresco
     * robado—, el cambio de contraseña desde la cuenta y el cierre de sesión global.
     *
     * Borrado en bloque a propósito: un `deleteBy…` derivado carga las filas una a una y aquí solo
     * interesa que no quede ninguna.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM RefreshTokenEntity r WHERE r.customer.id = :customerId")
    fun deleteAllByCustomerId(@Param("customerId") customerId: Long): Int
}
