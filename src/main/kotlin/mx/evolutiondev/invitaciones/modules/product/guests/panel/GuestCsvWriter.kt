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
        val limpio = neutralizarFormula(
            valor.replace("\r\n", " ").replace('\n', ' ').replace('\r', ' '),
        )
        val necesitaComillas = limpio.contains(SEPARADOR) || limpio.contains('"')
        return if (necesitaComillas) "\"${limpio.replace("\"", "\"\"")}\"" else limpio
    }

    /**
     * **Inyección de fórmulas (CSV injection), cerrada.** Excel, LibreOffice y Google Sheets evalúan
     * el contenido de una celda que empieza por `=`, `+`, `-` o `@` como **fórmula**, y el
     * entrecomillado del RFC 4180 no lo impide: es sintaxis del CSV, no del evaluador. `=cmd|'/c
     * calc'!A1` en una celda abre una petición DDE al abrir el archivo.
     *
     * No es teórico y no depende de que la clienta se ataque a sí misma: se reprodujo con un invitado
     * **anónimo** que escribió `=HYPERLINK("http://…","Felicidades")` en el `message` de
     * `PUT /public/` + `r/{token}`; ese texto viaja a la columna «Mensaje» del CSV que la clienta
     * descarga y abre. Es decir, la superficie más expuesta del producto llegaba hasta la máquina de
     * la clienta.
     *
     * El arreglo es el estándar: se antepone un apóstrofo, que las tres hojas de cálculo tratan como
     * «esto es texto» y no pintan en la celda. Se cubren también el tabulador y el retorno de carro,
     * que algunas versiones aceptan como preámbulo de fórmula.
     */
    private fun neutralizarFormula(valor: String): String =
        if (valor.isNotEmpty() && valor.first() in PREFIJOS_DE_FORMULA) "'$valor" else valor

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

        /** Caracteres con los que una hoja de cálculo empieza a leer una fórmula. Ver [celda]. */
        val PREFIJOS_DE_FORMULA = setOf('=', '+', '-', '@', '\t', '\r')

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
