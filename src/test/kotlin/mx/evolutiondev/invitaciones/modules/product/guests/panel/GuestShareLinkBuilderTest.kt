package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * El enlace que la clienta comparte.
 *
 * La prueba que de verdad importa aquí es la del **origen**: sale de `app.frontend.url`, nunca de una
 * constante escrita en el código. Ése es exactamente el hallazgo **S-08**, que hoy sigue vivo en
 * `EmailGuestNotifier.kt:68` con un dominio del producto antiguo compilado dentro del binario.
 */
class GuestShareLinkBuilderTest {

    @Test
    fun `la url se arma con el origen configurado`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test")

        assertEquals("https://linoysello.test/r/abc123", constructor.enlace("abc123"))
    }

    @Test
    fun `una barra de mas en la configuracion no duplica la barra del enlace`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test/")

        assertEquals("https://linoysello.test/r/abc123", constructor.enlace("abc123"))
    }

    /** Sin origen configurado no se adivina un dominio: se falla y se dice. */
    @Test
    fun `sin origen configurado la ruta falla en vez de inventarse un host`() {
        val constructor = GuestShareLinkBuilder("")

        val fallo = assertThrows<GuestPanelException> { constructor.enlace("abc123") }

        assertEquals(GuestPanelErrorCode.GUEST_INTERNAL, fallo.code)
        assertFalse(fallo.message.orEmpty().contains("http"), "el mensaje al cliente no habla de configuración")
    }

    @Test
    fun `el enlace de whatsapp lleva el numero sin prefijo ni espacios y el texto codificado`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test")

        val url = constructor.whatsapp("+52 55 1234 5678", "Hola María, te esperamos")

        assertTrue(url!!.startsWith("https://wa.me/525512345678?text="), "número en crudo: $url")
        assertFalse(url.contains(" "), "el texto viaja codificado")
        assertTrue(url.contains("Mar%C3%ADa"), "los acentos se codifican en UTF-8: $url")
    }

    @Test
    fun `sin telefono no hay enlace de whatsapp`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test")

        assertNull(constructor.whatsapp(null, "Hola"))
        assertNull(constructor.whatsapp("", "Hola"))
        assertNull(constructor.whatsapp("55-12", "Hola"), "un número incompleto daría un wa.me roto")
    }

    @Test
    fun `el texto para compartir saluda por el nombre, en es-MX y sin emojis`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test")

        val texto = constructor.texto("María Fernanda Cruz", "https://linoysello.test/r/abc123")

        assertTrue(texto.startsWith("María, "), "saluda por el primer nombre: $texto")
        assertTrue(texto.contains("https://linoysello.test/r/abc123"))
        assertTrue(texto.none { it.code > 0x2100 }, "sin emojis: $texto")
    }

    @Test
    fun `sin nombre el texto sigue siendo una frase bien formada`() {
        val constructor = GuestShareLinkBuilder("https://linoysello.test")

        val texto = constructor.texto(null, "https://linoysello.test/r/abc123")

        assertTrue(texto.startsWith("Te compartimos"), "empieza en mayúscula: $texto")
    }
}
