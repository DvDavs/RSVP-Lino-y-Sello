package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.springframework.stereotype.Component

/**
 * Lee el texto que la clienta pega en el panel: **un invitado por renglón**, con el orden
 * `nombre, adultos, niños, jóvenes, teléfono, correo` y solo el nombre obligatorio (contrato `5-2`
 * §1).
 *
 * **No toca la base de datos ni conoce la invitación**: analiza texto y devuelve dos listas. Eso lo
 * hace comprobable con una tabla de renglones buenos y malos, sin contexto de Spring, y permite que
 * `:preview` y `:import` compartan exactamente el mismo criterio — si el análisis fuera distinto en
 * cada ruta, la vista previa dejaría de ser una promesa.
 *
 * **Los mensajes sugieren la corrección.** Un «formato inválido» a secas deja a la clienta mirando
 * un renglón sin saber qué tocar; cada problema trae `message` (qué pasa) y `hint` (qué escribir).
 */
@Component
class GuestPasteReader {

    /** Lo que el lector entiende de un pegado: renglones listos y renglones con problema. */
    data class Resultado(
        val listos: List<Fila>,
        val problemas: List<GuestProblem>,
    )

    /** Un renglón entendido, con el número de renglón por si la clienta quiere localizarlo. */
    data class Fila(val line: Int, val raw: String, val draft: GuestDraft)

    /**
     * ### Topes de tamaño — hallazgo de la revisión adversarial de E2
     * Este método no tenía ninguno, y el coste no es lineal. Medido contra el backend vivo:
     * `:preview` con **200 000** renglones (3,9 MB de cuerpo) devolvía `200` con **12,9 MB** de JSON,
     * y `:import` de **1 500** renglones ocupaba **26,6 segundos** de un hilo de petición, porque el
     * panel relee todos los invitados de la invitación por cada renglón dado de alta
     * (`GuestPanelService.recienGuardado`). Con un cuerpo de unos pocos megas, cualquier cuenta
     * registrada —el alta es pública— dejaba el backend ocupado durante minutos.
     *
     * Por eso el texto se acota **antes** de analizarlo, en dos ejes: longitud total y número de
     * renglones. Los dos topes están muy por encima de una lista de boda real (500 renglones son unas
     * 1 500 personas) y lo que sobra no se descarta en silencio: sale como **un** problema, con el
     * número del primer renglón ignorado, para que la clienta sepa que tiene que pegar por partes.
     */
    fun leer(texto: String?): Resultado {
        val contenido = texto.orEmpty()
        if (contenido.isBlank()) return Resultado(emptyList(), emptyList())

        val listos = mutableListOf<Fila>()
        val problemas = mutableListOf<GuestProblem>()
        val correosVistos = mutableMapOf<String, Int>()

        val recortado = contenido.length > MAX_TEXTO
        val renglones = contenido.take(MAX_TEXTO).split(SALTOS)
        val sobran = renglones.size > MAX_RENGLONES

        if (recortado || sobran) {
            problemas += problema(
                minOf(renglones.size, MAX_RENGLONES + 1),
                "",
                GuestPanelErrorCode.GUEST_INVALID,
                "La lista es demasiado larga y no la pudimos leer entera.",
                "Pega hasta $MAX_RENGLONES renglones cada vez; el resto, en una segunda tanda.",
            )
        }

        renglones.take(MAX_RENGLONES).forEachIndexed { indice, renglon ->
            val numero = indice + 1
            if (renglon.isBlank()) return@forEachIndexed

            when (val leido = leerRenglon(numero, renglon)) {
                is Leido.Problema -> problemas += leido.problema
                is Leido.Listo -> {
                    val correo = leido.fila.draft.email?.lowercase()
                    val repetido = correo?.let { correosVistos[it] }
                    if (correo != null && repetido != null) {
                        problemas += problema(
                            numero,
                            renglon,
                            GuestPanelErrorCode.GUEST_DUPLICATE,
                            "Este correo ya aparece en el renglón $repetido.",
                            "Deja al invitado una sola vez o escribe un correo distinto.",
                        )
                    } else {
                        if (correo != null) correosVistos[correo] = numero
                        listos += leido.fila
                    }
                }
            }
        }

        return Resultado(listos, problemas)
    }

    private sealed interface Leido {
        data class Listo(val fila: Fila) : Leido
        data class Problema(val problema: GuestProblem) : Leido
    }

    private fun leerRenglon(numero: Int, renglon: String): Leido {
        val campos = renglon.split(",").map { it.trim() }

        if (campos.size > COLUMNAS) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "Este renglón trae más datos de los que esperamos.",
                    "El orden es: nombre, adultos, niños, jóvenes, teléfono, correo.",
                ),
            )
        }

        val nombre = campos.getOrNull(0).orEmpty()
        if (nombre.isBlank()) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "Falta el nombre.",
                    "Escríbelo antes de la primera coma.",
                ),
            )
        }
        if (nombre.length > MAX_NOMBRE) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "El nombre es demasiado largo.",
                    "Déjalo en $MAX_NOMBRE caracteres o menos, por ejemplo solo nombre y apellido.",
                ),
            )
        }

        val adultos = numero(campos.getOrNull(1), "adultos")
        if (adultos is Cifra.Error) return Leido.Problema(adultos.aProblema(numero, renglon))
        val ninos = numero(campos.getOrNull(2), "niños")
        if (ninos is Cifra.Error) return Leido.Problema(ninos.aProblema(numero, renglon))
        val jovenes = numero(campos.getOrNull(3), "jóvenes")
        if (jovenes is Cifra.Error) return Leido.Problema(jovenes.aProblema(numero, renglon))

        // Tolerancia deliberada: si el quinto campo trae arroba y el sexto viene vacío, la clienta
        // saltó el teléfono. Es el error de tecleo más común del formato y adivinarlo no es ambiguo.
        val quinto = campos.getOrNull(4).orEmpty()
        val sexto = campos.getOrNull(5).orEmpty()
        val telefono = if (quinto.contains("@") && sexto.isBlank()) "" else quinto
        val correo = if (quinto.contains("@") && sexto.isBlank()) quinto else sexto

        if (telefono.isNotBlank() && !TELEFONO.matches(telefono)) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "El teléfono no se entiende.",
                    "Escribe solo números, con o sin el prefijo +52. Déjalo vacío si no lo tienes.",
                ),
            )
        }
        if (correo.isNotBlank() && !CORREO.matches(correo)) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "El correo no se entiende.",
                    "Revisa que tenga arroba y dominio, como nombre@correo.com. Déjalo vacío si no lo tienes.",
                ),
            )
        }

        val a = (adultos as Cifra.Valor).valor
        val n = (ninos as Cifra.Valor).valor
        val j = (jovenes as Cifra.Valor).valor

        // Sin ninguna cifra escrita, la lectura natural de «Ana Ruiz» es una persona, no cero.
        val sinCifras = a == null && n == null && j == null
        val adultosFinal = a ?: if (sinCifras) 1 else 0
        val ninosFinal = n ?: 0
        val jovenesFinal = j ?: 0

        if (adultosFinal + ninosFinal + jovenesFinal == 0) {
            return Leido.Problema(
                problema(
                    numero,
                    renglon,
                    GuestPanelErrorCode.GUEST_INVALID,
                    "Este renglón no incluye a ninguna persona.",
                    "Escribe al menos un adulto, un niño o un joven después del nombre.",
                ),
            )
        }

        return Leido.Listo(
            Fila(
                line = numero,
                raw = renglon,
                draft = GuestDraft(
                    fullName = nombre,
                    email = correo.ifBlank { null },
                    phone = telefono.ifBlank { null },
                    tableNumber = null,
                    adults = adultosFinal,
                    children = ninosFinal,
                    young = jovenesFinal,
                ),
            ),
        )
    }

    private sealed interface Cifra {
        data class Valor(val valor: Int?) : Cifra
        data class Error(val campo: String, val escrito: String) : Cifra {
            fun aProblema(numero: Int, renglon: String) = problemaDe(
                numero,
                renglon,
                "El número de $campo no se entiende.",
                "Escribe solo dígitos, por ejemplo 2. Déjalo vacío si no aplica.",
            )
        }
    }

    private fun numero(escrito: String?, campo: String): Cifra {
        val texto = escrito?.trim().orEmpty()
        if (texto.isBlank()) return Cifra.Valor(null)
        val valor = texto.toIntOrNull()
        if (valor == null || valor < 0 || valor > MAX_PERSONAS) return Cifra.Error(campo, texto)
        return Cifra.Valor(valor)
    }

    private fun problema(
        line: Int,
        raw: String,
        code: GuestPanelErrorCode,
        message: String,
        hint: String,
    ) = GuestProblem(line = line, raw = recortar(raw), code = code.name, message = message, hint = hint)

    companion object {
        /** El contrato fija seis columnas: nombre, adultos, niños, jóvenes, teléfono, correo. */
        const val COLUMNAS = 6

        /** Tope del `full_name` real de la tabla (`invitation_guest.full_name VARCHAR(255)`). */
        const val MAX_NOMBRE = 255

        /** Tope de sensatez por cupo: un renglón con 5000 adultos es un error de tecleo. */
        const val MAX_PERSONAS = 999

        /** Lo que se devuelve de `raw`: suficiente para que la clienta localice el renglón. */
        const val MAX_RAW = 200

        /**
         * Renglones que se analizan como mucho. 500 renglones son del orden de 1 500 personas: por
         * encima de cualquier lista real y por debajo de lo que convierte `:import` en una petición
         * de minutos. Ver la nota de [leer].
         */
        const val MAX_RENGLONES = 500

        /**
         * Caracteres del pegado que se analizan como mucho: 500 renglones muy generosos. Acota el
         * trabajo aunque el cuerpo venga en un solo renglón enorme. Ver la nota de [leer].
         */
        const val MAX_TEXTO = 200_000

        internal val SALTOS = Regex("\\r\\n|\\r|\\n")
        internal val TELEFONO = Regex("^[+]?[0-9][0-9 ()\\-.]{4,24}$")
        internal val CORREO = Regex("^[^@\\s,;]+@[^@\\s,;.]+(\\.[^@\\s,;.]+)+$")
    }
}

/** Recorta el `raw` que se devuelve: basta con que la clienta localice el renglón. */
private fun recortar(raw: String): String {
    val limpio = raw.trim()
    return if (limpio.length <= GuestPasteReader.MAX_RAW) limpio else limpio.take(GuestPasteReader.MAX_RAW)
}

private fun problemaDe(line: Int, raw: String, message: String, hint: String) = GuestProblem(
    line = line,
    raw = recortar(raw),
    code = GuestPanelErrorCode.GUEST_INVALID.name,
    message = message,
    hint = hint,
)
