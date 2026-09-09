package mx.evolutiondev.invitaciones.modules.product.guests.panel

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.ConcurrentHashMap
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * ¿Está publicada esta invitación? Es lo que decide si tiene sentido mandarle a alguien su enlace:
 * `GET /public/` + `r/{token}` exige un `tpl_release` activo (`RsvpGuestReader`), así que un correo
 * enviado antes de publicar lleva a la invitada a un `404`.
 *
 * Consulta nativa de solo lectura, del mismo estilo que el puente del RSVP y que
 * `Templates2FlagRepository`: no monta el grafo de entidades y no toca `modules/templates2`.
 */
@Component
class GuestReleaseReader(
    @PersistenceContext private val entityManager: EntityManager,
) {

    internal val sql = """
        SELECT 1
        FROM tpl_release r
        WHERE r.invitation_id = :invitationId
          AND r.is_active
    """.trimIndent()

    fun tieneReleaseActivo(invitationId: Long): Boolean =
        entityManager.createNativeQuery(sql)
            .setParameter("invitationId", invitationId)
            .resultList
            .isNotEmpty()
}

/**
 * Tope de correos de enlace **por invitación y día**, como pide el contrato `5-2` §1.
 *
 * ### Por qué el contador vive aquí y no en `invitation_guest_notification`
 * El límite que cita el contrato (`EmailGuestNotifier.kt:114-120`) cuenta filas de esa tabla, pero
 * **una fila ahí significa «ya se notificó a toda la invitación hoy»**: escribir una por cada envío
 * individual dejaría a la clienta sin la notificación masiva heredada el resto del día, es decir,
 * este arreglo rompería una ruta de otro módulo. Y la tabla no tiene columna para distinguir los dos
 * tipos de aviso; añadírsela sería una migración sobre esquema compartido, fuera del territorio de
 * esta sesión.
 *
 * Así que el contador es de proceso, con la misma disciplina —y las mismas limitaciones asumidas—
 * que [RsvpThrottleService]: ventana en un `ConcurrentHashMap`, defecto en código porque
 * `application.yml` es fichero compartido, y poda acotada. Se reinicia al reiniciar el backend; para
 * lo que protege —que nadie use el producto como remitente de correo en masa contra una dirección—
 * es suficiente, y queda anotado por si el orquestador quiere un contador durable.
 */
@Component
class GuestEmailDailyLimit(
    @Value("\${producto.guests.email.max-por-invitacion-y-dia:50}") private val maxPorDia: Int = 50,
    @Value("\${producto.guests.email.max-entradas:20000}") private val maxEntradas: Int = 20_000,
) {

    private data class Ventana(val dia: Long, val enviados: Int)

    private val porInvitacion = ConcurrentHashMap<Long, Ventana>()

    /** Inyectable **solo** desde las pruebas, para cambiar de día sin esperar a mañana. */
    internal var reloj: () -> Instant = Instant::now

    /**
     * Suma uno y devuelve `false` cuando la invitación ya agotó su cuota del día. Contar el intento
     * aunque se rechace es deliberado: si no, reintentar en bucle saldría gratis.
     */
    fun consumir(invitationId: Long): Boolean {
        val hoy = reloj().atZone(ZONA).toLocalDate().toEpochDay()
        podar(hoy)
        val actualizada = porInvitacion.compute(invitationId) { _, actual ->
            if (actual == null || actual.dia != hoy) Ventana(hoy, 1) else actual.copy(enviados = actual.enviados + 1)
        }
        return (actualizada?.enviados ?: 1) <= maxPorDia
    }

    private fun podar(hoy: Long) {
        if (porInvitacion.size < maxEntradas) return
        porInvitacion.values.removeIf { it.dia != hoy }
    }

    private companion object {
        /** El día natural del servidor, la misma referencia que usa `isToday()` en el motor. */
        val ZONA: ZoneId = ZoneId.systemDefault()
    }
}
