package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Un lote de la purga, en su **propia transacción** (`02 §5.1`: lotes de 5 000 filas para no tomar un
 * bloqueo largo). Clase aparte de [SnapshotRetentionJob] a propósito: `@Transactional` se aplica por
 * proxy, así que un bucle que se llamara a sí mismo dentro de la misma clase correría **fuera** de
 * transacción y el `@Modifying` fallaría con `no transaction is in progress`.
 */
@Service
class SnapshotRetention(private val snapshots: TplDocumentSnapshotQueryRepository) {

    @Transactional
    fun purgeBatch(dias: Int, retenidas: Int, lote: Int): Int = snapshots.purgar(dias, retenidas, lote)
}

/**
 * Purga diferida de snapshots (ADR-011, `02 §5.1`). Job diario a las 03:30.
 *
 * **Lo que nunca borra** (y está probado, no solo escrito):
 * - las últimas `retenidas` (200) revisiones de **cada** documento — la comparación es contra
 *   `max(revision) - 200` del propio documento, no un `LIMIT` global;
 * - nada de los últimos `dias` (30) días;
 * - **ninguna revisión que respalde un `tpl_release`**, esté activo o no. Un release es inmutable y
 *   auditable: borrar el snapshot de la revisión que publicó dejaría un release sin forma de saber
 *   qué documento lo produjo. `tpl_release` **jamás** se purga aquí (`02 §5.1` cierre).
 *
 * La ventana de retención es también la ventana de idempotencia del `OperationBatch` (`03 §8`): pasado
 * ese punto, el `clientBatchId` de un lote viejo ya no está y el lote se trataría como nuevo — lo para
 * entonces el chequeo de `baseRevision`.
 */
@Component
class SnapshotRetentionJob(
    private val retention: SnapshotRetention,
    @Value("\${templates2.retention.days:30}") private val dias: Int = DIAS_POR_DEFECTO,
    @Value("\${templates2.retention.keep-revisions:200}") private val retenidas: Int = REVISIONES_POR_DEFECTO,
    @Value("\${templates2.retention.batch-size:5000}") private val lote: Int = LOTE_POR_DEFECTO,
) {

    private val log = LoggerFactory.getLogger(SnapshotRetentionJob::class.java)

    /**
     * Itera por lotes hasta que no queda nada que borrar. El tope de iteraciones evita que un error de
     * consulta que devolviera siempre el mismo número dejara el job girando para siempre; si se
     * alcanza, se registra y el siguiente día continúa donde quedó.
     */
    @Scheduled(cron = "\${templates2.retention.cron:0 30 3 * * *}")
    fun purgar(): Int {
        var total = 0
        var vueltas = 0
        while (vueltas < MAX_VUELTAS) {
            val borradas = retention.purgeBatch(dias, retenidas, lote)
            total += borradas
            vueltas++
            if (borradas < lote) break
        }
        if (total > 0) log.info("templates2: purgadas {} snapshots en {} lote(s)", total, vueltas)
        if (vueltas >= MAX_VUELTAS) {
            log.warn("templates2: la purga alcanzó el tope de {} lotes; continúa en la próxima corrida", MAX_VUELTAS)
        }
        return total
    }

    companion object {
        const val DIAS_POR_DEFECTO = 30
        const val REVISIONES_POR_DEFECTO = 200
        const val LOTE_POR_DEFECTO = 5000
        const val MAX_VUELTAS = 200
    }
}

/**
 * Activa el planificador de Spring **desde el módulo nuevo**, sin tocar `InvitationsApplication`
 * (fuera del alcance de `templates2`, `contratos.md §1`).
 *
 * Verificado antes de añadirlo (`grep -rn "@Scheduled" src/main/kotlin`): fuera de `templates2` no hay
 * ningún `@Scheduled`, así que habilitar el planificador no despierta ninguna tarea dormida del módulo
 * antiguo. La propiedad permite apagarlo entero sin recompilar; con ella en `false` las tareas siguen
 * siendo invocables a mano, que es como las ejercitan las pruebas.
 *
 * **Aviso de alcance (2-ADV, objeción ADV-08).** Este `@EnableScheduling` es el **único** del
 * repositorio, así que `templates2.retention.enabled` gobierna **todas** las tareas periódicas del
 * módulo, no solo la purga: hoy son [SnapshotRetentionJob] (2-4) y `AssetGcJob` (2-5, `@Scheduled` en
 * `AssetGcJob.kt:69`). Apagar la retención apaga **también** el drenaje de `tpl_asset_gc`, que es el
 * mecanismo del derecho al olvido (`02 §5.3`, `§10.3`): los objetos de S3 de una invitación o de un
 * cliente borrados dejarían de retirarse, en silencio. El nombre de la propiedad no lo sugiere. La
 * corrección —una propiedad neutra para el planificador y una por tarea— es un cambio de contrato de
 * configuración y necesita ADR.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(name = ["templates2.retention.enabled"], havingValue = "true", matchIfMissing = true)
class Templates2SchedulingConfig
