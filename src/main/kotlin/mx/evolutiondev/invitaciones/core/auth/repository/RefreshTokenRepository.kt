package mx.evolutiondev.invitaciones.core.auth.repository

import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

@Repository
interface RefreshTokenRepository : JpaRepository<RefreshTokenEntity, Long> {
    fun findByToken(token: String): RefreshTokenEntity?

    /**
     * Quema **un** token de refresco y devuelve cuántas filas borró: 1 si este canje se lo llevó, 0
     * si ya no estaba (R1-07).
     *
     * Ese número es la pieza que faltaba. `delete(entidad)` carga la fila y la borra sin mirar si
     * seguía ahí, de modo que dos canjes simultáneos del mismo token pasaban los dos y emitían dos
     * refrescos válidos. Con un `DELETE … WHERE token = ?` la base de datos serializa los dos
     * canjes —la fila solo se puede borrar una vez— y el testigo de quién ganó es la cuenta de
     * filas afectadas: solo quien recibe 1 tiene derecho a emitir token nuevo.
     *
     * Va en bloque (`@Modifying`) a propósito: no interesa la entidad, interesa el número.
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM RefreshTokenEntity r WHERE r.token = :token")
    fun deleteByToken(@Param("token") token: String): Int

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
