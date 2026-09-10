package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.modules.product.admin.ParametrosDeAdministracion.ESTADOS_DE_INVITACION
import mx.evolutiondev.invitaciones.modules.product.admin.ParametrosDeAdministracion.ESTADOS_DE_PAGO
import mx.evolutiondev.invitaciones.modules.product.admin.ParametrosDeAdministracion.FILTROS_DE_PAGO
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Las seis lecturas del contrato `/product/admin`, atadas: validar parámetros → consultar con el
 * alcance del solicitante → componer la página.
 *
 * **La capa donde NO se filtra.** Aquí no hay ni un `filter {}` sobre resultados: el alcance por rol
 * lo aplica [ConsultasDeAdministracion] dentro del `WHERE` (contrato §0). Si esta clase tuviera que
 * descartar filas ya traídas, `total` mentiría y la paginación devolvería páginas cortas — que es
 * como se detecta desde fuera que alguien está filtrando en memoria.
 *
 * `@Transactional(readOnly = true)`: las siete consultas son de lectura y así lo declara la conexión.
 */
@Service
@Transactional(readOnly = true)
class ConsolaDeAdministracionService(
    private val consultas: ConsultasDeAdministracion,
    private val pagos: FuenteDePagosDeAdministracion,
) {

    /** §1. */
    fun metricas(alcance: AlcanceDeAdministracion): MetricasDeAdministracion = consultas.metricas(alcance)

    /** §2. */
    fun clientas(alcance: AlcanceDeAdministracion, pagina: Int, tamano: Int, buscar: String?): PaginaDeClientas {
        val p = ParametrosDeAdministracion.pagina(pagina)
        val t = ParametrosDeAdministracion.tamano(tamano)
        val patron = ParametrosDeAdministracion.patron(buscar)
        return PaginaDeClientas(
            total = consultas.contarClientas(alcance, patron),
            pagina = p,
            tamano = t,
            elementos = consultas.clientas(alcance, patron, t, p * t),
        )
    }

    /** §3. */
    fun invitaciones(
        alcance: AlcanceDeAdministracion,
        pagina: Int,
        tamano: Int,
        buscar: String?,
        estado: String?,
        pago: String?,
        plan: String?,
    ): PaginaDeInvitaciones {
        val p = ParametrosDeAdministracion.pagina(pagina)
        val t = ParametrosDeAdministracion.tamano(tamano)
        val patron = ParametrosDeAdministracion.patron(buscar)
        val codigoEstado = when (ParametrosDeAdministracion.opcion("estado", estado, ESTADOS_DE_INVITACION)) {
            ParametrosDeAdministracion.ESTADO_PUBLICADA -> 1
            ParametrosDeAdministracion.ESTADO_EN_EDICION -> 2
            ParametrosDeAdministracion.ESTADO_DESHABILITADA -> 3
            else -> 0
        }
        val codigoPago = when (ParametrosDeAdministracion.opcion("pago", pago, FILTROS_DE_PAGO)) {
            ParametrosDeAdministracion.PAGO_PAGADA -> 1
            ParametrosDeAdministracion.PAGO_PENDIENTE -> 2
            else -> 0
        }
        // El plan se valida contra el catálogo ANTES de consultar: un id que no existe es 400, no una
        // lista vacía. Una lista vacía sería indistinguible de «ese plan no tiene invitaciones», y
        // quien mira la consola se creería el cero.
        val codigoPlan = ParametrosDeAdministracion.planSolicitado(plan)?.also {
            require(consultas.planExiste(it)) { ParametrosDeAdministracion.planDesconocido(it) }
        } ?: ConsultasDeAdministracion.SIN_FILTRO_DE_PLAN
        return PaginaDeInvitaciones(
            total = consultas.contarInvitaciones(alcance, patron, codigoEstado, codigoPago, codigoPlan),
            pagina = p,
            tamano = t,
            elementos = consultas.invitaciones(alcance, patron, codigoEstado, codigoPago, t, p * t, codigoPlan),
        )
    }

    /** §5. Delega en la fuente inyectada; hoy [PagosDesdeInvitaciones], mañana la de E4. */
    fun pagos(alcance: AlcanceDeAdministracion, pagina: Int, tamano: Int, estado: String?): PaginaDePagos {
        val p = ParametrosDeAdministracion.pagina(pagina)
        val t = ParametrosDeAdministracion.tamano(tamano)
        val e = ParametrosDeAdministracion.opcion("estado", estado, ESTADOS_DE_PAGO)
        return pagos.pagina(alcance, e, p, t)
    }

    /** §6. Sin paginar: son pocas filas y el contrato no las pagina. */
    fun planes(alcance: AlcanceDeAdministracion): CatalogoDePlanes = CatalogoDePlanes(consultas.planes(alcance))

    /** §7. `total` es el número de filas devueltas, nunca una cifra codificada. */
    fun plantillas(alcance: AlcanceDeAdministracion): CatalogoDePlantillas {
        val elementos = consultas.plantillas(alcance)
        return CatalogoDePlantillas(total = elementos.size, elementos = elementos)
    }
}
