package mx.evolutiondev.invitaciones.modules.product.admin

/**
 * Validación de los parámetros de consulta de `/product/admin/` + `**` (contrato §2, §3, §5).
 *
 * **Regla dura del contrato: nada se ignora en silencio.** Un `pagina` negativo, un `tamano` fuera de
 * `[1,100]` o un filtro con un valor que no está en la lista responden **400 con cuerpo de error**, no
 * se recortan al valor más cercano ni se descartan. Recortar en silencio es lo que hace que una
 * consola muestre un número que nadie pidió y que quien la mira se lo crea.
 *
 * El 400 y su cuerpo los produce `core/error/GeneralExceptionHandler.kt:69-79`, que ya convierte
 * `IllegalArgumentException` en `ErrorMessage(timestamp, statusCode, errors)`. No se inventa una
 * excepción nueva: una segunda forma de decir «parámetro malo» es una segunda forma de responder.
 *
 * Los mensajes citan el nombre del parámetro y el valor recibido, y **nunca** dicen nada del estado
 * de la base ni de qué existe: son parámetros propios de quien llama, no un oráculo (S-02).
 */
object ParametrosDeAdministracion {

    const val TAMANO_POR_DEFECTO = 20
    const val TAMANO_MINIMO = 1
    const val TAMANO_MAXIMO = 100

    const val ESTADO_PUBLICADA = "publicada"
    const val ESTADO_EN_EDICION = "en-edicion"
    const val ESTADO_DESHABILITADA = "deshabilitada"

    const val PAGO_PAGADA = "pagada"
    const val PAGO_PENDIENTE = "pendiente"

    const val PAGO_ESTADO_PAGADO = "pagado"
    const val PAGO_ESTADO_PENDIENTE = "pendiente"

    /**
     * `devuelto` es un valor **válido** del contrato §5 que la fuente de hoy nunca produce: no hay
     * dónde registrar una devolución (`12-producto-completo.md §A5.2`: `is_paid` es un booleano y ahí
     * acaba el modelo de pago). Se acepta y devuelve cero elementos; rechazarlo obligaría al frontend
     * a cambiar cuando E4 aterrice, que es justo lo que un contrato existe para evitar.
     */
    const val PAGO_ESTADO_DEVUELTO = "devuelto"

    val ESTADOS_DE_INVITACION = listOf(ESTADO_PUBLICADA, ESTADO_EN_EDICION, ESTADO_DESHABILITADA)
    val FILTROS_DE_PAGO = listOf(PAGO_PAGADA, PAGO_PENDIENTE)
    val ESTADOS_DE_PAGO = listOf(PAGO_ESTADO_PAGADO, PAGO_ESTADO_PENDIENTE, PAGO_ESTADO_DEVUELTO)

    fun pagina(valor: Int): Int {
        require(valor >= 0) { "El parámetro 'pagina' es un entero mayor o igual que 0; se recibió $valor" }
        return valor
    }

    fun tamano(valor: Int): Int {
        require(valor in TAMANO_MINIMO..TAMANO_MAXIMO) {
            "El parámetro 'tamano' está entre $TAMANO_MINIMO y $TAMANO_MAXIMO; se recibió $valor"
        }
        return valor
    }

    /** Filtro opcional de lista cerrada: `null` o vacío = sin filtro; valor desconocido = 400. */
    fun opcion(nombre: String, valor: String?, permitidos: List<String>): String? {
        if (valor.isNullOrBlank()) return null
        require(valor in permitidos) {
            "El parámetro '$nombre' admite ${permitidos.joinToString(", ")}; se recibió '$valor'"
        }
        return valor
    }

    /**
     * Filtro `plan` de §3: **el id numérico** de `invitation_plan`, no su nombre.
     *
     * **Por qué el id y no el nombre.** `invitation_plan.name` es texto libre y editable en caliente
     * por `PUT /master/plans/{id}` (`…/modules/master/plans/presentation/MasterPlansController.kt`):
     * renombrar «Premium» a «Fiesta» rompería en silencio cualquier enlace guardado, cualquier marcador
     * y cualquier prueba que filtrara por nombre. El id es estable, es único —`name` no tiene `UNIQUE`
     * en la tabla (`V1__initial_schema.sql`, `public.invitation_plan`), así que dos planes podrían
     * llamarse igual y el filtro por nombre sería ambiguo— y no obliga a decidir si la comparación es
     * sensible a mayúsculas o a acentos («Básico» con y sin tilde). Además la pantalla ya tiene lo que
     * necesita: `GET /product/admin/planes` devuelve `id` **y** `nombre`, así que el desplegable enseña
     * el nombre y manda el id.
     *
     * Dos errores distintos, los dos **400 con cuerpo**:
     * - no es un número → el parámetro está mal formado;
     * - es un número que no está en el catálogo → el plan no existe.
     * Ninguno de los dos se ignora en silencio, que es la regla del contrato.
     */
    fun planSolicitado(valor: String?): Long? {
        if (valor.isNullOrBlank()) return null
        val id = valor.trim().toLongOrNull()
        require(id != null && id > 0) {
            "El parámetro 'plan' es el id numérico de un plan del catálogo " +
                "(los devuelve GET /product/admin/planes); se recibió '$valor'"
        }
        return id
    }

    /** Mensaje del `plan` que sí es un número pero no está en el catálogo. */
    fun planDesconocido(id: Long): String =
        "El parámetro 'plan' no corresponde a ningún plan del catálogo; se recibió '$id'"

    /** Texto de búsqueda → patrón `LIKE` en minúsculas. Vacío o ausente = `%`, que casa con todo. */
    fun patron(buscar: String?): String = "%" + (buscar?.trim()?.lowercase() ?: "") + "%"
}
