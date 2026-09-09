package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets

/**
 * Vuelca la lista de invitados a CSV para que la clienta la abra en Excel o en Google Sheets
 * (contrato `5-2` §1, `GET …/guests/export.csv`).
 *
 * Dos decisiones que parecen detalles y no lo son:
 *
 * 1. **BOM UTF-8 al principio.** Excel en Windows abre un CSV sin BOM como Windows-1252 y rompe
 *    todos los acentos y las eñes de una lista de invitados mexicana. El BOM es la única señal que
 *    Excel respeta sin pasar por el asistente de importación.
 * 2. **Sin tokens.** Las mismas columnas que ve el panel y ni una más: un CSV se reenvía por correo
 *    y por WhatsApp con mucha más ligereza que una respuesta HTTP, así que es el último sitio donde
 *    debería viajar un `confirmationToken` (hallazgo S-13).
 */
@Component
class GuestCsvWriter {

    fun escribir(invitados: List<GuestItem>): ByteArray {
        val texto = buildString {
            append(BOM)
            append(ENCABEZADOS.joinToString(SEPARADOR))
            append(SALTO)
            invitados.forEach { invitado ->
                append(
                    listOf(
                        invitado.fullName.orEmpty(),
                        invitado.email.orEmpty(),
                        invitado.phone.orEmpty(),
                        invitado.tableNumber?.toString().orEmpty(),
                        invitado.adults.toString(),
                        invitado.children.toString(),
                        invitado.young.toString(),
                        invitado.adultsConfirmed.toString(),
                        invitado.childrenConfirmed.toString(),
                        invitado.youngConfirmed.toString(),
                        estadoEnEspanol(invitado.status),
                        invitado.message.orEmpty(),
                    ).joinToString(SEPARADOR) { celda(it) },
                )
                append(SALTO)
            }
        }
        return texto.toByteArray(StandardCharsets.UTF_8)
    }

    /** Entrecomilla solo cuando hace falta y duplica las comillas de dentro, como manda el RFC 4180. */
    private fun celda(valor: String): String {
        val limpio = valor.replace("\r\n", " ").replace('\n', ' ').replace('\r', ' ')
        val necesitaComillas = limpio.contains(SEPARADOR) || limpio.contains('"')
        return if (necesitaComillas) "\"${limpio.replace("\"", "\"\"")}\"" else limpio
    }

    private fun estadoEnEspanol(estado: String): String = when (estado) {
        "CONFIRMED" -> "Confirmado"
        "DECLINED" -> "No asistirá"
        "PENDING" -> "Pendiente"
        else -> estado
    }

    companion object {
        /** Marca de orden de bytes: es lo que hace que Excel lea el archivo como UTF-8. */
        const val BOM = "\uFEFF"
        const val SEPARADOR = ","
        const val SALTO = "\r\n"

        val ENCABEZADOS = listOf(
            "Nombre",
            "Correo",
            "Teléfono",
            "Mesa",
            "Adultos",
            "Niños",
            "Jóvenes",
            "Adultos confirmados",
            "Niños confirmados",
            "Jóvenes confirmados",
            "Estado",
            "Mensaje",
        )
    }
}
