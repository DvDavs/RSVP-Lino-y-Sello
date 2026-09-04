package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

/**
 * R6, punto 2 del determinismo (`01 §5.2`): tablas de meses literales, **sin `Intl` ni
 * `java.time.format`**. Estas comprobaciones son redundantes con `golden/compose/r6-*` a propósito:
 * los golden fijan la paridad con TypeScript y esto fija las ramas una a una, incluidas las que
 * ninguna plantilla real produce todavía.
 */
class DateFormattingTest {

    @Test
    fun `los cinco formatId`() {
        assertEquals("31 de enero de 2027", DateFormatting.formatDate("2027-01-31", "long", Locale.ES_MX))
        assertEquals("julio de 2027", DateFormatting.formatDate("2027-07-04", "month-year", Locale.ES_MX))
        assertEquals("2027-12-25", DateFormatting.formatDate("2027-12-25", "iso", Locale.ES_MX))
        assertEquals("1:05 pm", DateFormatting.formatDate("13:05", "h12", Locale.ES_MX))
        // Un `formatId` desconocido cae a `long` y no rompe nada.
        assertEquals("28 de febrero de 2027", DateFormatting.formatDate("2027-02-28", "no-existe", Locale.ES_MX))
    }

    @Test
    fun `en-US invierte el orden y usa los meses en ingles`() {
        assertEquals("January 31, 2027", DateFormatting.formatDate("2027-01-31", "long", Locale.EN_US))
        assertEquals("July 2027", DateFormatting.formatDate("2027-07-04", "month-year", Locale.EN_US))
        assertEquals("31 de enero de 2027", DateFormatting.formatDate("2027-01-31", "long", Locale.ES_ES))
    }

    /** `H % 12 === 0` → 12. La medianoche y el mediodía son las dos ramas que se olvidan siempre. */
    @Test
    fun `la medianoche y el mediodia de h12`() {
        assertEquals("12:00 am", DateFormatting.formatDate("00:00", "h12", Locale.ES_MX))
        assertEquals("12:07 am", DateFormatting.formatDate("00:07", "h12", Locale.ES_MX))
        assertEquals("12:00 pm", DateFormatting.formatDate("12:00", "h12", Locale.ES_MX))
        assertEquals("11:59 am", DateFormatting.formatDate("11:59", "h12", Locale.ES_MX))
        assertEquals("11:59 pm", DateFormatting.formatDate("23:59", "h12", Locale.ES_MX))
        assertEquals("1:05 am", DateFormatting.formatDate("01:05", "h12", Locale.ES_MX))
    }

    @Test
    fun `las tres formas de formatRange`() {
        assertEquals(
            "1 de mayo de 2027, 4:00 pm",
            DateFormatting.formatRange("2027-05-01T16:00", null, "long-h12", Locale.ES_MX),
        )
        assertEquals(
            "1 de mayo de 2027, 4:00 pm – 11:30 pm",
            DateFormatting.formatRange("2027-05-01T16:00", "2027-05-01T23:30", "long-h12", Locale.ES_MX),
        )
        assertEquals(
            "1 de mayo de 2027, 10:00 pm – 2 de mayo de 2027, 2:15 am",
            DateFormatting.formatRange("2027-05-01T22:00", "2027-05-02T02:15", "long-h12", Locale.ES_MX),
        )
    }

    /**
     * Guarda de paridad: `formatId` es un `Ident` libre, así que un `DateSpec` puede declarar `h12`
     * con datos válidos. JavaScript producía `"NaN:undefined pm"` y Kotlin lanzaría
     * `NumberFormatException` sobre el MISMO documento; ambos devuelven ahora el valor crudo.
     */
    @Test
    fun `entrada fuera de forma devuelve el valor crudo en vez de romper`() {
        assertEquals("2027-01-31", DateFormatting.formatDate("2027-01-31", "h12", Locale.ES_MX))
        assertEquals("13:45", DateFormatting.formatDate("13:45", "long", Locale.ES_MX))
        assertEquals("13:45", DateFormatting.formatDate("13:45", "month-year", Locale.ES_MX))
        assertEquals("2027-13-01", DateFormatting.formatDate("2027-13-01", "long", Locale.ES_MX), "mes fuera de 1..12")
        assertEquals("2027-00-01", DateFormatting.formatDate("2027-00-01", "month-year", Locale.ES_MX))
        assertEquals("xx:yy", DateFormatting.formatDate("xx:yy", "h12", Locale.ES_MX))
        assertEquals("a-b-c", DateFormatting.formatDate("a-b-c", "long", Locale.ES_MX))
        assertEquals("a-b-c", DateFormatting.formatDate("a-b-c", "month-year", Locale.ES_MX))
        assertEquals("sin-hora", DateFormatting.formatRange("sin-hora", null, "long-h12", Locale.ES_MX))
        assertEquals(
            "1 de mayo de 2027, 4:00 pm",
            DateFormatting.formatRange("2027-05-01T16:00", "final-mal", "long-h12", Locale.ES_MX),
        )
        assertEquals(
            "1 de mayo de 2027, 4:00 pm",
            DateFormatting.formatRange("2027-05-01T16:00", "", "long-h12", Locale.ES_MX),
        )
    }
}
