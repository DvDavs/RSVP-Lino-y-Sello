package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * El catálogo de venta (`GET /public/plans`, contrato §2.1).
 *
 * Funciona **sin** clave de Stripe: enseñar precios no es cobrar. Lo que la falta de clave cambia es
 * [CatalogoDePlanesDto.pagoEnLinea], que el frontend usa para decir la verdad en `/precios` en vez de
 * ofrecer un botón que no puede llevar a ninguna parte.
 *
 * Nada de esta clase calcula un precio: los importes salen tal cual de `product_plan` (V42).
 */
@Service
class PlanCatalogService(
    private val planes: ProductPlanRepository,
    private val propiedades: ProductPaymentsProperties,
    private val json: ObjectMapper,
) {

    @Transactional(readOnly = true)
    fun catalogo(): CatalogoDePlanesDto = CatalogoDePlanesDto(
        moneda = propiedades.moneda,
        planes = planes.findByActivoTrueOrderByOrdenAscIdAsc().map(::dto),
        pagoEnLinea = propiedades.configurado,
    )

    /** El plan activo de ese código, o [PlanNotFoundException]. Un plan dado de baja **no** se vende. */
    @Transactional(readOnly = true)
    fun exigirActivo(codigo: String): ProductPlanEntity =
        planes.findByCodigoAndActivoTrue(codigo)
            ?: throw PlanNotFoundException(
                "no hay ningún plan activo con el código indicado",
                mapOf("planCodigo" to codigo),
            )

    fun dto(plan: ProductPlanEntity) = PlanDto(
        codigo = plan.codigo,
        nombre = plan.nombre,
        descripcion = plan.descripcion,
        precioCentavos = plan.precioCentavos,
        moneda = plan.moneda,
        invitadosMax = plan.invitadosMax,
        incluye = incluye(plan.incluye),
        recomendado = plan.recomendado,
        orden = plan.orden,
    )

    /**
     * `product_plan.incluye` es un `jsonb` con un array de frases. Si alguna vez trae algo que no es
     * un array de textos, se devuelve vacío en vez de reventar la pantalla de precios: un plan sin
     * viñetas se sigue pudiendo comprar.
     */
    private fun incluye(crudo: String): List<String> = runCatching {
        val nodo = json.readTree(crudo)
        if (!nodo.isArray) emptyList() else nodo.mapNotNull { it.takeIf { n -> n.isTextual }?.asText() }
    }.getOrDefault(emptyList())
}
