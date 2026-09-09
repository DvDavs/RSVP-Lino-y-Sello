package mx.evolutiondev.invitaciones.modules.product

/**
 * Cuerpo de las cuatro rutas de salud del módulo `product` (`_12c-modulo-product.md`, ADR-5-0C-01).
 *
 * **Deliberadamente vacío de información.** Solo el nombre del subpaquete y `"ok"`: ni versión, ni
 * `commit`, ni estado de la base, ni nombres de bean. Una ruta de salud que enumera dependencias es
 * un mapa del sistema regalado a quien la consulte, y estas cuatro existen únicamente para que el
 * andamio del módulo se pueda ejercitar con una prueba real antes de que exista lógica alguna.
 *
 * **Fichero congelado (5-0c).** Las sesiones E2, E3, E4 y E5 lo *consumen*, no lo editan: es el único
 * fichero del módulo que comparten las cuatro y por eso su forma no cambia. Quien necesite otra forma
 * de respuesta la declara en su propio subpaquete.
 */
data class ProductHealthResponse(
    val module: String,
    val status: String = ESTADO_OK,
) {
    companion object {
        const val ESTADO_OK = "ok"

        /** `de("account")` → `{"module":"product.account","status":"ok"}`. */
        fun de(subpaquete: String) = ProductHealthResponse("product.$subpaquete")
    }
}
