package mx.evolutiondev.invitaciones.core.util.formatter

import org.springframework.stereotype.Component
import java.text.SimpleDateFormat
import java.util.*

/**
 * Implementation of the [DateFormatter] interface, providing utility methods
 * for date formatting.
 *
 * This component is responsible for converting date objects into formatted
 * string representations according to specified patterns. It is designed to
 * work with the current system date but can be extended or modified for more
 * generalized date formatting tasks.
 */
@Component
class DateFormatterImpl: DateFormatter {

    /**
     * Formats the current date into a string based on the provided format pattern.
     *
     * Utilizes [SimpleDateFormat] for formatting, which supports various date and
     * time patterns like "dd/MM/yyyy", "yyyy-MM-dd HH:mm:ss", etc. In case of an
     * invalid format pattern or any other issue during formatting, this method
     * will catch the exception and return an empty string, avoiding application
     * crashes due to formatting errors.
     *
     * @param format A string representing the desired date format pattern.
     * @return A formatted string representing the current date. Returns an empty
     *         string if formatting fails due to an invalid pattern or any other issue.
     */
    override fun parseCurrentDate(format: String): String {
        return try {
            val dateFormat = SimpleDateFormat(format)
            dateFormat.format(Date())
        } catch (ex: Exception) {
            ""
        }
    }
}
