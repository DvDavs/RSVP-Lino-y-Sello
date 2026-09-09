package mx.evolutiondev.invitaciones.core.util.patterns

/**
 * Utility class containing predefined regular expression patterns for validation.
 *
 * This class provides a centralized repository of regex patterns used throughout
 * the application for validating different types of input, such as integers, email
 * addresses, and one-time passwords (OTPs).
 */
object Patterns {
    /**
     * Regex pattern for validating integer values.
     *
     * This pattern matches a sequence of one or more digits, ensuring that the
     * entire input string is a valid non-negative integer without leading zeros.
     */
    const val INTEGER = "^\\d+$"

    /**
     * Regex pattern for validating email addresses.
     *
     * This pattern ensures that the input string conforms to a standard email format,
     * supporting most common email id conventions including usage of ".", "_", "+", "&", "*",
     * and "-" within the user name part, and restricting the domain part to alphanumeric characters
     * with a domain suffix of 2 to 7 letters to cover most valid domain names and TLDs.
     */
    const val EMAIL_PATTERN = "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$"

    /**
     * Regex pattern for validating a 6-digit one-time password (OTP).
     *
     * This pattern matches exactly 6 digits, ensuring that the input string
     * is a valid OTP. This format is commonly used for OTPs in various authentication systems.
     */
    const val OTP_PATTERN = "^\\d{6}$"

    /**
     * This pattern is used to validate phone numbers that are exactly 10 digits long.
     * The regular expression consists of:
     * - ^: Asserts that the match must start at the beginning of the string.
     * - \\d: Matches any digit (equivalent to [0-9]).
     * - {10}: Specifies that exactly 10 digits must be matched.
     * - $: Asserts that the match must end at the end of the string.
     *
     * Example valid phone numbers:
     * - "9234567890"
     * - "1234567890"
     * - "0123456789"
     *
     * Example invalid phone numbers:
     * - "123456789" (less than 10 digits)
     * - "12345678901" (more than 10 digits)
     * - "123-456-7890" (contains dashes)
     * - "abcdefghij" (contains letters)
     */
    const val PHONE_NUMBER_PATTERN = "^\\+52\\d{10}$"

    /**
     * Mensaje de [PHONE_NUMBER_PATTERN], en un solo sitio (fase 5, E3; `ADR-5-E3-05`).
     *
     * El texto anterior —«un número telefónico válido de 10 digitos numéricos»— **omitía el prefijo**
     * que el patrón exige desde que se le añadió `+52`, así que el intento evidente («5512345678»)
     * fallaba sin decir por qué. Ahora dice el formato completo y trae un ejemplo. Es `const` para que
     * pueda usarse dentro de `@Pattern`, que solo admite constantes de compilación.
     */
    const val PHONE_NUMBER_MESSAGE =
            "El teléfono debe llevar la lada de México: +52 y 10 dígitos, sin espacios ni guiones. Por ejemplo: +525512345678"

    const val TAX_PAYER_ID_PATTERN = "^[a-zA-Z0-9]{12,13}$"

    const val USER_ID_PATTERN = "^[a-zA-Z0-9]{18}$"

    const val POSTAL_CODE = "^\\d{5}\$"

    const val ALPHABETIC_SPECIAL_CHARACTERS = "^[A-Za-zÑñáéíóúÁÉÍÓÚ\\s]+$"

    const val ALPHANUMERIC_SPECIAL_CHARACTERS = "^[A-Za-z0-9Ññ#áéíóúÁÉÍÓÚ\\-\\s]+$"

    const val STREET_NUMBER = "^[A-Za-z0-9#-]+$"

}
