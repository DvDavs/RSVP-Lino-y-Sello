package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.PublicToken
import org.springframework.stereotype.Component
import java.security.SecureRandom

/**
 * Acuña el `public_token` del render público (`02 §2` V32, `03 §3.10`) con **`SecureRandom` fresco en
 * cada llamada**, nunca con el [UlidGenerator] monótono (ADR-2-ORQ-01, aceptada).
 *
 * **Por qué no vale el ULID monótono.** [UlidGenerator] incrementa en 1 la parte aleatoria cuando dos
 * llamadas caen en el mismo milisegundo (spec "Monotonicity"): dentro de ese milisegundo el token
 * siguiente es **exactamente el anterior + 1**. Eso es inofensivo para un `assetId` o un `itemId`
 * —identificadores que solo se usan dentro de un documento ya autorizado— y es **fatal** para
 * `public_token`, que es una **URL-capacidad**: el render público la sirve sin autenticación
 * (`03 §2` fila 15), así que adivinarla *es* el acceso. Con el generador monótono, quien tenga un
 * token puede probar el `+1` y caer en la invitación de otro cliente creada en el mismo milisegundo.
 * Viola P8 y los "80 bits imprevisibles" que `contratos.md §5` promete.
 *
 * **Formato**: `pub_` + 26 símbolos Crockford base32, el que exige `ck_tpl_document_public_token`
 * (`^pub_[0-9A-HJKMNP-TV-Z]{26}$`) y valida [PublicToken]. Los 26 símbolos se sortean **uno a uno**
 * con [SecureRandom.nextInt] sobre un alfabeto de 32 (potencia de dos: reparto uniforme exacto, sin
 * el sesgo del módulo), de modo que la entropía es de 26 × 5 = **130 bits** enteros — no 80, porque
 * aquí no hay 48 bits de marca de tiempo que regalar.
 *
 * `@Component` sin estado: `SecureRandom` es seguro entre hilos y el bean no guarda nada del token
 * anterior — no hay nada que correlacionar entre dos llamadas, ni siquiera dentro de la misma
 * instancia.
 */
@Component
class PublicTokenGenerator(private val random: SecureRandom = SecureRandom()) {

    /** Un token nuevo, sin relación alguna con el anterior. */
    fun next(): PublicToken = PublicToken.of(sufijo())

    /** Los 26 símbolos Crockford; público para que las pruebas midan la entropía sin el prefijo. */
    fun sufijo(): String {
        val chars = CharArray(LONGITUD)
        for (i in 0 until LONGITUD) chars[i] = ALFABETO[random.nextInt(ALFABETO.length)]
        return String(chars)
    }

    companion object {
        /** Crockford base32 (sin I, L, O ni U), el mismo alfabeto que `Patterns.ULID`. */
        const val ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

        /** 26 símbolos = 130 bits. `VARCHAR(30)` con el prefijo `pub_` (`02 §2` V32). */
        const val LONGITUD = 26
    }
}
