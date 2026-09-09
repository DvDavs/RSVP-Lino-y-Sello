package mx.evolutiondev.invitaciones.modules.product.payments

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Las dos rutas de solo lectura del contrato: el plan de una invitación (§2.2) y el historial de la
 * clienta (§2.3).
 *
 * **Las dos filtran por propiedad y las dos responden lo mismo ante un id ajeno que ante uno
 * inexistente**: `404 PAY_INVITATION_NOT_FOUND` (contrato §3). Distinguirlos convertiría la ruta en
 * un oráculo con el que enumerar las invitaciones de otras cuentas.
 */
@Service
class PaymentsQueryService(
    private val jerarquia: HierarchyValidationService,
    private val invitaciones: InvitationPaymentInfoReader,
    private val pagos: ProductPaymentRepository,
    private val planes: ProductPlanRepository,
    private val catalogo: PlanCatalogService,
    private val propiedades: ProductPaymentsProperties,
) {

    /**
     * Comprobación de propiedad **antes** de leer nada (P8). Se apoya en
     * `HierarchyValidationService.validateInvitationAccess`, que es la misma que usa el editor
     * (`EditorDocumentService`), para que no haya dos definiciones distintas de "esta invitación es
     * tuya" en el mismo producto.
     */
    fun exigirAcceso(requesterId: Long, invitationId: Long): DatosDeInvitacion {
        if (!jerarquia.validateInvitationAccess(requesterId, invitationId)) {
            throw InvitationNotFoundException(
                "no encontramos esa invitación",
                mapOf("invitationId" to invitationId),
            )
        }
        return invitaciones.leer(invitationId) ?: throw InvitationNotFoundException(
            "no encontramos esa invitación",
            mapOf("invitationId" to invitationId),
        )
    }

    @Transactional(readOnly = true)
    fun planDeInvitacion(requesterId: Long, invitationId: Long): PlanDeInvitacionDto {
        val datos = exigirAcceso(requesterId, invitationId)
        val filas = pagos.findByInvitationIdOrderByIdDesc(invitationId)
        val porPlan = planesDe(filas)
        val pagado = filas.firstOrNull { it.estado == EstadoDePago.PAGADO }
        return PlanDeInvitacionDto(
            invitationId = invitationId,
            pagada = datos.pagada,
            nombreEvento = datos.nombreEvento,
            // Sin cobro registrado, `plan` es `null` aunque la invitación esté pagada: es el caso de
            // la marcada a mano por un ADMIN o sembrada, y el frontend lo pinta como «Plan activo»
            // sin importe en vez de inventarse uno (contrato §2.2).
            plan = pagado?.let { porPlan[it.productPlanId] }?.let(catalogo::dto),
            pagadoEn = pagado?.pagadoEn,
            pagos = filas.map { dto(it, porPlan, datos.nombreEvento) },
            pagoEnLinea = propiedades.configurado,
        )
    }

    /** Historial de la clienta. La consulta ya filtra por `customer_id`: no hay nada que descartar después. */
    @Transactional(readOnly = true)
    fun misPagos(requesterId: Long): HistorialDePagosDto {
        val filas = pagos.findByCustomerIdOrderByIdDesc(requesterId)
        val porPlan = planesDe(filas)
        val nombres = invitaciones.nombresDeEvento(filas.map { it.invitationId })
        return HistorialDePagosDto(filas.map { dto(it, porPlan, nombres[it.invitationId]) })
    }

    private fun planesDe(filas: List<ProductPaymentEntity>): Map<Long, ProductPlanEntity> =
        if (filas.isEmpty()) emptyMap()
        else planes.findAllById(filas.map { it.productPlanId }.distinct()).associateBy { it.id }

    private fun dto(
        pago: ProductPaymentEntity,
        porPlan: Map<Long, ProductPlanEntity>,
        nombreEvento: String?,
    ): PagoDto {
        val plan = porPlan[pago.productPlanId]
        return PagoDto(
            id = pago.id,
            estado = pago.estado.name,
            invitationId = pago.invitationId,
            nombreEvento = nombreEvento,
            planCodigo = plan?.codigo,
            planNombre = plan?.nombre,
            importeCentavos = pago.importeCentavos,
            moneda = pago.moneda,
            creadoEn = pago.createdAt,
            pagadoEn = pago.pagadoEn,
            comprobanteUrl = pago.comprobanteUrl,
        )
    }
}
