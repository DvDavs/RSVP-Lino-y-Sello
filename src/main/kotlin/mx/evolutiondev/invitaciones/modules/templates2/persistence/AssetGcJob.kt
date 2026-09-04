package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Un paso de la cola, en su **propia transacción**. Clase aparte de [AssetGcJob] por el mismo motivo
 * que `SnapshotRetention`: `@Transactional` se aplica por proxy, así que un método que se llamara a sí
 * mismo dentro de la misma clase correría **fuera** de transacción y el `@Modifying` fallaría con
 * `no transaction is in progress` (aviso de `handoffs/2-1.md`).
 */
@Service
class AssetGcQueue(private val cola: TplAssetGcRepository) {

    @Transactional(readOnly = true)
    fun pendientes(lote: Int): List<TplAssetGcEntity> = cola.pollPending(PageRequest.of(0, lote))

    @Transactional
    fun marcarBorrado(id: Long): Int = cola.markDeleted(id)

    @Transactional
    fun marcarFallo(id: Long, error: String): Int = cola.markFailed(id, error.take(MAX_ERROR))

    companion object {
        /** `tpl_asset_gc.last_error VARCHAR(500)` (`02 §2` V37). */
        const val MAX_ERROR = 500
    }
}

/**
 * Recolección de los objetos de S3 cuya fila ya no existe (`02 §10.3`, ADR-1R-B-03).
 *
 * **Por qué existe la cola y no basta con borrar en S3 desde la ruta HTTP** (objeción B-02, severidad
 * alta): `tpl_asset` se borra por tres caminos y **solo uno** pasa por código de `templates2`. Los
 * otros dos son la cascada de `DELETE FROM invitation` y la de `DELETE FROM customer`, que ejecuta hoy
 * la administración del módulo antiguo (`InvitationRepository.kt:42-43`) y que este módulo no puede
 * tocar. Solo un trigger de base de datos captura los tres, y sin él borrar una invitación dejaba los
 * objetos huérfanos **y sin rastro de su clave**, lo que hace imposible un derecho al olvido real.
 *
 * **Nunca se borra una fila de la cola.** Un fallo incrementa `attempts` y guarda `last_error`; a
 * partir de [MAX_INTENTOS] se deja de reintentar y se registra a nivel `ERROR` para intervención
 * manual. Perder la clave es perder la posibilidad de cumplir el borrado, así que la fila se queda
 * como registro de lo que falta por borrar.
 *
 * **Lo que este job NO hace**: el barrido semanal de huérfanos de `02 §10.3` (listar `templates2/` en
 * S3 y borrar lo que no tenga fila) **no está implementado**. `core/s3/S3Service` no expone ninguna
 * operación de listado y ampliarlo es tocar el núcleo; además sería una operación destructiva sobre un
 * bucket real, imposible de probar en este entorno. Queda anotado en `preguntas-abiertas.md` y en
 * `bitacora/2-5.md`: hoy, un objeto subido cuyo `INSERT` falló (paso 9 de `02 §10.1`) permanece en S3
 * hasta que alguien lo retire a mano. La clave es determinista, así que el reintento del cliente lo
 * reescribe en vez de acumular copias.
 */
@Component
class AssetGcJob(
    private val cola: AssetGcQueue,
    private val almacen: InvitationAssetStorage,
    @Value("\${templates2.assets.gc.batch-size:500}") private val lote: Int = LOTE_POR_DEFECTO,
    @Value("\${templates2.assets.gc.max-attempts:10}") private val maxIntentos: Int = MAX_INTENTOS,
) {

    private val log = LoggerFactory.getLogger(AssetGcJob::class.java)

    /** Cada hora al minuto 15 (`02 §10.3`). Devuelve cuántos objetos se borraron de verdad. */
    @Scheduled(cron = "\${templates2.assets.gc.cron:0 15 * * * *}")
    fun recolectar(): Int {
        var borrados = 0
        for (fila in cola.pendientes(lote)) {
            if (fila.attempts >= maxIntentos) {
                log.error(
                    "templates2: la clave {}/{} (asset {}) lleva {} intentos fallidos de borrado en S3; " +
                        "hace falta intervención manual. Último error: {}",
                    fila.bucket, fila.s3Key, fila.publicId, fila.attempts, fila.lastError,
                )
                continue
            }
            try {
                almacen.delete(fila.bucket, fila.s3Key)
                cola.marcarBorrado(fila.id)
                borrados++
            } catch (e: Exception) {
                // Un fallo de S3 no puede tumbar el job ni perder las claves que quedan por borrar.
                cola.marcarFallo(fila.id, "${e::class.java.simpleName}: ${e.message}")
                log.warn("templates2: no se pudo borrar {}/{} en S3; se reintentará", fila.bucket, fila.s3Key, e)
            }
        }
        if (borrados > 0) log.info("templates2: {} objetos borrados de S3 desde tpl_asset_gc", borrados)
        return borrados
    }

    companion object {
        const val LOTE_POR_DEFECTO = 500
        const val MAX_INTENTOS = 10
    }
}
