package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.modules.product.payments.ProductPaymentsProperties
import org.springframework.stereotype.Component

/**
 * **La costura por la que E4 entrará sin romper esta ruta** (contrato §5).
 *
 * `GET /product/admin/pagos` tiene que existir hoy, y hoy **no hay pagos**: la sesión E4 escribe
 * `modules/product/payments` en paralelo y todavía no ha entregado. Este subpaquete no puede esperar
 * a esa entrega ni puede adelantarla —crear aquí una tabla `product_payment` duplicaría la migración
 * de E4 y rompería el merge de E6—, así que la ruta se apoya en esta interfaz y hoy la sirve
 * [PagosDesdeInvitaciones], que proyecta lo único que el esquema de hoy sabe de un pago.
 *
 * Cuando E4 aterrice, E6 registra la implementación real, `origen` pasa de `"invitaciones"` a
 * `"pagos"` y **el contrato JSON no cambia**: es exactamente para eso que `origen` va en el cuerpo.
 */
interface FuenteDePagosDeAdministracion {

    /** Etiqueta que el cuerpo devuelve en `origen`, para que el frontend sepa qué está mirando. */
    val origen: String

    /**
     * `pagina` y `tamano` llegan ya validados por [ConsolaDeAdministracionService.pagos], pero el
     * desplazamiento **no se calcula a mano**: quien implemente esto usa
     * [ParametrosDeAdministracion.desplazamiento], que lo hace en `Long` y responde 400 cuando el
     * producto no cabe en un `Int`. Multiplicar aquí `pagina * tamano` es lo que producía un `OFFSET`
     * negativo y un 500 con el SQL entero en la traza.
     */
    fun pagina(
        alcance: AlcanceDeAdministracion,
        estado: String?,
        pagina: Int,
        tamano: Int,
    ): PaginaDePagos
}

/**
 * Única implementación hoy: proyecta `invitation.is_paid`, `invitation.total_amount` y el plan que
 * cuelga de la plantilla heredada (`12-producto-completo.md §A5.2`, `§A5.1`).
 *
 * **Qué NO hace, a propósito**: no escribe nada, no crea ninguna tabla, no toca
 * `modules/product/payments` —que es de E4— y no toca `application.yml`. La moneda se **lee** del bean
 * `producto.pagos.stripe.moneda` que los cimientos ya dejaron puesto
 * (`modules/product/payments/ProductPaymentsProperties.kt:21-25`, `application.yml:148`
 * `${STRIPE_MONEDA:MXN}`); leer una propiedad ajena es distinto de escribir en el paquete ajeno.
 *
 * `estado`:
 * - `"pagado"` → `is_paid = true`; `"pendiente"` → `is_paid = false`; ausente → sin filtro.
 * - `"devuelto"` es válido en el contrato y **esta fuente no puede producirlo**: no hay dónde
 *   registrar una devolución. Devuelve una página vacía en vez de un 400, para que el frontend que
 *   ya ofrece el filtro no tenga que cambiar cuando E4 lo llene de verdad.
 */
@Component
class PagosDesdeInvitaciones(
    private val consultas: ConsultasDeAdministracion,
    private val propiedades: ProductPaymentsProperties,
) : FuenteDePagosDeAdministracion {

    override val origen: String = ORIGEN

    override fun pagina(
        alcance: AlcanceDeAdministracion,
        estado: String?,
        pagina: Int,
        tamano: Int,
    ): PaginaDePagos {
        // Lo primero, antes incluso del atajo de `devuelto`: un desplazamiento que no cabe es 400 en
        // las tres rutas paginadas por igual, y sin llegar a la base.
        val desplazamiento = ParametrosDeAdministracion.desplazamiento(pagina, tamano)
        if (estado == ParametrosDeAdministracion.PAGO_ESTADO_DEVUELTO) {
            return PaginaDePagos(total = 0, pagina = pagina, tamano = tamano, origen = origen, elementos = emptyList())
        }
        val filtro = when (estado) {
            ParametrosDeAdministracion.PAGO_ESTADO_PAGADO -> 1
            ParametrosDeAdministracion.PAGO_ESTADO_PENDIENTE -> 2
            else -> 0
        }
        val total = consultas.contarPagos(alcance, filtro)
        val elementos = consultas.pagos(alcance, filtro, tamano, desplazamiento)
            .map { consultas.leerPago(it, propiedades.moneda) }
        return PaginaDePagos(total = total, pagina = pagina, tamano = tamano, origen = origen, elementos = elementos)
    }

    companion object {
        const val ORIGEN = "invitaciones"
    }
}
