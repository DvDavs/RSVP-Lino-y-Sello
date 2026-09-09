package mx.evolutiondev.invitaciones.modules.product.invitations

import java.time.Instant

/**
 * Doble de prueba del puerto de persistencia del alta. Guarda en memoria lo que se le pide insertar
 * para que las pruebas puedan afirmar **quien queda de dueño** y con que estado nace la fila, sin
 * base de datos ni contexto de Spring (mismo estilo sin contexto que `CatalogControllerTest.kt:28-32`).
 */
class FakeProductInvitationRepository(
    /** Las ocho filas puente que siembra `V42`, por `eventKind`. */
    private val puentes: Map<String, Long> = PUENTES,
    /** Borradores que se le atribuyen a cada clienta antes de la llamada. */
    var borradoresPorCliente: MutableMap<Long, Int> = mutableMapOf(),
) : ProductInvitationRepository {

    val insertadas: MutableList<NuevaInvitacion> = mutableListOf()
    private var siguienteId = 100L

    override fun plantillaPuente(eventKind: String): Long? = puentes[eventKind]

    override fun contarBorradores(customerId: Long): Int = borradoresPorCliente[customerId] ?: 0

    /** Reproduce la ventana de 60 s: mismo dueno, misma plantilla, misma fecha y hora, sin documento. */
    override fun borradorIdenticoReciente(
        customerId: Long,
        templateId: Long,
        fecha: String,
        hora: String,
        desde: Instant,
    ): InvitacionCreada? {
        val indice = insertadas.indexOfLast {
            it.customerId == customerId && it.templateId == templateId &&
                it.fecha == fecha && it.hora == hora && !it.creadaEn.isBefore(desde)
        }
        if (indice < 0) return null
        return InvitacionCreada(idsInsertados[indice], insertadas[indice].creadaEn)
    }

    override fun insertar(nueva: NuevaInvitacion): InvitacionCreada {
        val id = siguienteId++
        insertadas.add(nueva)
        idsInsertados.add(id)
        borradoresPorCliente[nueva.customerId] = (borradoresPorCliente[nueva.customerId] ?: 0) + 1
        return InvitacionCreada(id, nueva.creadaEn)
    }

    private val idsInsertados: MutableList<Long> = mutableListOf()

    companion object {
        /** Los ocho `eventKind` del esquema; ids de la banda reservada de `V42` (901-908). */
        val PUENTES: Map<String, Long> = mapOf(
            "wedding" to 901L, "quince" to 902L, "baptism" to 903L, "communion" to 904L,
            "confirmation" to 905L, "birthday" to 906L, "graduation" to 907L, "generic" to 908L,
        )
    }
}
