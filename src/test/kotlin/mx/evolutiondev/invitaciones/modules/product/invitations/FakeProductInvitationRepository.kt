package mx.evolutiondev.invitaciones.modules.product.invitations

import java.time.Instant

/**
 * Doble de prueba del puerto de persistencia del alta. Guarda en memoria lo que se le pide insertar
 * para que las pruebas puedan afirmar **quien queda de dueño** y con que estado nace la fila, sin
 * base de datos ni contexto de Spring (mismo estilo sin contexto que `CatalogControllerTest.kt:28-32`).
 *
 * **Lo que este doble NO puede demostrar es la carrera del tope de borradores**: la serializacion la
 * da el `SELECT … FOR UPDATE` de PostgreSQL, no el Kotlin. Esa prueba es
 * `ProductInvitationConcurrencyIT`, contra una base real.
 */
class FakeProductInvitationRepository(
    /** Las ocho filas puente que siembra `V42`, por `eventKind`. */
    private val puentes: Map<String, Long> = PUENTES,
    /** Borradores que se le atribuyen a cada clienta antes de la llamada. */
    var borradoresPorCliente: MutableMap<Long, Int> = mutableMapOf(),
) : ProductInvitationRepository {

    val insertadas: MutableList<NuevaInvitacion> = mutableListOf()
    val bloqueadas: MutableList<Long> = mutableListOf()
    val borradas: MutableList<Long> = mutableListOf()

    /** Estado que devuelve [buscarPropia], por id de invitacion. */
    var propias: MutableMap<Long, BorradorPropio> = mutableMapOf()

    private var siguienteId = 100L

    override fun bloquearCliente(customerId: Long): Boolean {
        bloqueadas.add(customerId)
        return true
    }

    override fun plantillaPuente(eventKind: String): Long? = puentes[eventKind]

    override fun contarBorradores(customerId: Long): Int = borradoresPorCliente[customerId] ?: 0

    /**
     * Reproduce la ventana de 60 s con la igualdad **del cuerpo entero** (R1-11): mismo dueno, misma
     * plantilla, misma fecha, hora, hashtag y los dos permisos, y sin documento.
     */
    override fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        hashtag: String,
        childrenAllowed: Boolean,
        youngAllowed: Boolean,
        desde: Instant,
    ): InvitacionExistente? {
        val indice = insertadas.indexOfLast {
            it.customerId == customerId && it.templateId == templateId &&
                it.fecha == fecha && it.hora == hora && it.hashtag == hashtag &&
                it.childrenAllowed == childrenAllowed && it.youngAllowed == youngAllowed &&
                !it.creadaEn.isBefore(desde)
        }
        if (indice < 0) return null
        val fila = insertadas[indice]
        // Se devuelve lo GUARDADO, como hace la consulta real: si la prueba cambia el cuerpo de la
        // peticion, aqui se sigue viendo la fila previa.
        return InvitacionExistente(
            id = idsInsertados[indice],
            fecha = fila.fecha,
            hora = fila.hora,
            hashtag = fila.hashtag,
            childrenAllowed = fila.childrenAllowed,
            youngAllowed = fila.youngAllowed,
            isPaid = false,
            isEnabled = true,
            isFinished = false,
            creadaEn = fila.creadaEn,
        )
    }

    override fun insertar(nueva: NuevaInvitacion): InvitacionCreada {
        val id = siguienteId++
        insertadas.add(nueva)
        idsInsertados.add(id)
        borradoresPorCliente[nueva.customerId] = (borradoresPorCliente[nueva.customerId] ?: 0) + 1
        propias[id] = BorradorPropio(id, isPaid = false, usaTemplates2 = true, publicadaAlgunaVez = false)
        duenos[id] = nueva.customerId
        return InvitacionCreada(id, nueva.creadaEn)
    }

    override fun buscarPropia(customerId: Long, invitationId: Long): BorradorPropio? {
        if (duenos[invitationId] != null && duenos[invitationId] != customerId) return null
        return propias[invitationId]
    }

    override fun borrar(customerId: Long, invitationId: Long): Int {
        if (propias.remove(invitationId) == null) return 0
        borradas.add(invitationId)
        val indice = idsInsertados.indexOf(invitationId)
        if (indice >= 0) {
            val dueno = insertadas[indice].customerId
            borradoresPorCliente[dueno] = ((borradoresPorCliente[dueno] ?: 1) - 1).coerceAtLeast(0)
        }
        return 1
    }

    private val idsInsertados: MutableList<Long> = mutableListOf()
    private val duenos: MutableMap<Long, Long> = mutableMapOf()

    companion object {
        /** Los ocho `eventKind` del esquema; ids de la banda reservada de `V42` (901-908). */
        val PUENTES: Map<String, Long> = mapOf(
            "wedding" to 901L, "quince" to 902L, "baptism" to 903L, "communion" to 904L,
            "confirmation" to 905L, "birthday" to 906L, "graduation" to 907L, "generic" to 908L,
        )
    }
}
