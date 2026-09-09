package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.web.reactive.function.client.WebClient

/**
 * Los dos secretos de WhatsApp salen del repositorio y el canal se apaga solo cuando faltan.
 *
 * Fase 5, E3-C3 · ADR-5-E3-C3-01 · hallazgo **S-01** (`diseno/12-producto-completo.md §A3`,
 * los dos secretos que `8a16ebb` dejo fuera) y **R1-03** de `bitacora/5-E3-R1-seguridad.md`.
 *
 * Lo que vigila:
 *  1. con el canal apagado NADIE llama a Meta y las rutas responden `503` con un cuerpo honesto,
 *     no un `500` ni un `200` que afirme un envio que no ocurrio;
 *  2. **la trampa que de verdad importa**: con el `verify_token` vacio, el alta del webhook NO se
 *     acepta mandando `hub.verify_token=` vacio. Una comparacion `token == VERIFY_TOKEN` ingenua
 *     sobre una cadena vacia le regalaria el webhook a cualquiera;
 *  3. con los valores puestos, el canal se enciende y el `verify_token` correcto vale (y solo ese).
 *
 * Lo que **no** puede vigilar y queda declarado: que el webhook siga funcionando contra Meta de
 * verdad. Eso exige el alta real en Meta con un token real y no se prueba aqui ni se probara.
 */
@DisplayName("WhatsApp: canal apagado cuando faltan los secretos (ADR-5-E3-C3-01)")
class WhatsAppCanalApagadoTest {

    private fun configuracion(
        numero: String = "",
        acceso: String = "",
        verificacion: String = "",
    ) = WhatsAppConfiguracion(
        apiUrl = "https://graph.facebook.com/v19.0",
        phoneNumberId = numero,
        accessToken = acceso,
        verifyToken = verificacion,
    )

    private val apagada = configuracion()
    private val encendida = configuracion(
        numero = "1000000000000",
        acceso = "token-de-acceso-de-prueba-inservible",
        verificacion = "token-de-verificacion-de-prueba",
    )

    // --- 1. Estado del canal ------------------------------------------------------------------

    @Test
    fun `sin token de acceso el envio esta apagado`() {
        assertFalse(apagada.envioHabilitado)
        assertFalse(configuracion(numero = "1000000000000").envioHabilitado)
    }

    @Test
    fun `sin numero tampoco se envia aunque haya token`() {
        assertFalse(configuracion(acceso = "algo").envioHabilitado)
    }

    @Test
    fun `con numero y token el envio esta encendido`() {
        assertTrue(encendida.envioHabilitado)
    }

    // --- 2. El agujero del token de verificacion vacio ------------------------------------------

    @Test
    fun `con el verify_token vacio NO se acepta un verify_token vacio`() {
        assertFalse(apagada.webhookHabilitado)
        assertFalse(apagada.verificaTokenDeWebhook(""))
        assertFalse(apagada.verificaTokenDeWebhook("lo-que-sea"))
    }

    @Test
    fun `con el verify_token puesto solo vale ese`() {
        assertTrue(encendida.webhookHabilitado)
        assertTrue(encendida.verificaTokenDeWebhook("token-de-verificacion-de-prueba"))
        assertFalse(encendida.verificaTokenDeWebhook("token-de-verificacion-de-prueb"))
        assertFalse(encendida.verificaTokenDeWebhook(""))
    }

    // --- 3. Las rutas responden algo honesto, no un 500 -----------------------------------------

    @Test
    fun `send-masivo apagado responde 503 y no cuenta ningun envio`() {
        val controlador = WhatsAppController(WhatsAppService(WebClient.builder(), apagada))
        val respuesta = controlador.sendMasivo(
            MasivoRequest(listOf(GuestWhatsAppDTO("+525512345678", "Ana", "https://ejemplo.invalido/i/x")))
        )
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, respuesta.statusCode)
        assertEquals(WhatsAppConfiguracion.CODIGO_APAGADO, respuesta.body?.get("code"))
        // El cuerpo nombra las variables que faltan; nunca un valor.
        val mensaje = respuesta.body?.get("message") as String
        assertTrue(mensaje.contains("WHATSAPP_ACCESS_TOKEN"))
    }

    @Test
    fun `el servicio apagado devuelve ERROR y no intenta la llamada`() {
        val servicio = WhatsAppService(WebClient.builder(), apagada)
        val resultado = servicio.sendMasivo(
            listOf(GuestWhatsAppDTO("+525512345678", "Ana", "https://ejemplo.invalido/i/x"))
        )
        assertEquals(1, resultado.size)
        assertTrue(resultado.single().startsWith("ERROR"))
    }

    @Test
    fun `la verificacion del webhook apagado responde 503, no 403 ni 200`() {
        val controlador = WhatsAppWebhookController(apagada)
        val respuesta = controlador.verifyWebhook("subscribe", "", "desafio")
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, respuesta.statusCode)
        assertTrue(respuesta.body!!.contains("WHATSAPP_WEBHOOK_VERIFY_TOKEN"))
    }

    @Test
    fun `la verificacion del webhook encendido devuelve el desafio solo con el token correcto`() {
        val controlador = WhatsAppWebhookController(encendida)
        assertEquals(
            "desafio",
            controlador.verifyWebhook("subscribe", "token-de-verificacion-de-prueba", "desafio").body,
        )
        assertEquals(
            HttpStatus.FORBIDDEN,
            controlador.verifyWebhook("subscribe", "otro", "desafio").statusCode,
        )
        assertEquals(
            HttpStatus.FORBIDDEN,
            controlador.verifyWebhook("otro-modo", "token-de-verificacion-de-prueba", "desafio").statusCode,
        )
    }

    @Test
    fun `la recepcion de mensajes con el canal apagado no procesa nada`() {
        val controlador = WhatsAppWebhookController(apagada)
        val respuesta = controlador.receiveMessage(
            mapOf(
                "entry" to listOf(
                    mapOf("changes" to listOf(mapOf("value" to mapOf("messages" to listOf(mapOf("from" to "5210000000000"))))))
                )
            )
        )
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, respuesta.statusCode)
    }
}
