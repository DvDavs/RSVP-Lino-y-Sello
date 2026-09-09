package mx.evolutiondev.invitaciones.modules.product.guests.panel

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Manda a **un** invitado su enlace personal por correo (contrato `5-2` §1,
 * `POST …/guests/{guestId}:send-email`).
 *
 * ### Por qué es una interfaz
 * Para que [GuestPanelService] dependa del **acto de enviar** y no de `core/email`, y para que las
 * pruebas ejerciten la ruta entera con un doble que captura el mensaje. Es lo que permite comprobar
 * lo que de verdad importa de este correo —que lleva el enlace correcto y que **no** lleva el nombre
 * ni la dirección de ningún otro invitado— sin un servidor de correo delante.
 */
interface GuestLinkMailer {

    /**
     * Encola el correo del invitado. No espera a que salga: la ruta responde `202` porque el envío es
     * asíncrono, igual que el resto de correos del backend (`EmailGuestNotifier` usa el mismo
     * patrón de `scope.launch`).
     */
    fun enviar(destinatario: String, nombre: String?, url: String)
}

/**
 * El emisor de verdad, sobre `core/email`.
 *
 * ### Por qué el texto se escribe aquí y no se reutiliza la plantilla `guest-notification`
 * `EmailGuestNotifier` compone ese correo con `invitation.template.eventType.name` y
 * `invitation.people` (`EmailGuestNotifier.kt:139-145`), que son datos del **módulo antiguo**: una
 * invitación de `templates2` puede no tenerlos, y tocar `EmailContentGenerator` para añadir una
 * plantilla nueva sería entrar en `core/email`, que no es territorio de esta sesión. Lo que sí se
 * reutiliza es lo que importa: el enlace lo arma [GuestShareLinkBuilder] con `app.frontend.url`,
 * exactamente la misma forma `<frontendUrl>/r/<confirmationToken>` que dejó el arreglo de **S-08**, y
 * el remitente de marca sale de `producto.correo.*`. **Ningún dominio escrito en el código.**
 *
 * ### Qué NO lleva el mensaje
 * Ni el nombre ni el correo de ningún otro invitado, ni la lista de la invitación, ni contadores del
 * anfitrión, ni el `cancellationToken` (contrato §0.4). Solo el nombre de pila de quien lo recibe y
 * su propio enlace. Y **sin emojis**, en es-MX.
 *
 * ### Si no hay credenciales de transporte
 * En este entorno `core/email` no puede entregar nada: `MailConfig.kt:23-30` declara el
 * `JavaMailSender` con la cuenta escrita en el código (hallazgo **S-01**) y no hay salida SMTP. El
 * fallo del envío **no** se convierte en un fallo de la ruta —el correo va en segundo plano y el
 * `202` significa «aceptado», no «entregado»— y se registra sin la dirección del invitado dentro.
 * Para que en producción salga de verdad hacen falta las credenciales del remitente por entorno; el
 * nombre de la variable de marca es `MAIL_FROM` (`application.yml:151`, hoy vacía = desactivada).
 */
@Component
class DefaultGuestLinkMailer(
    private val emailService: EmailService,
    private val propiedades: ProductMailProperties,
) : GuestLinkMailer {

    private val log = LoggerFactory.getLogger(DefaultGuestLinkMailer::class.java)

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun enviar(destinatario: String, nombre: String?, url: String) {
        val texto = GuestLinkEmailText.componer(nombre, url, propiedades.remitenteNombre)
        scope.launch {
            try {
                emailService.sendCustomEmail(
                    to = destinatario,
                    subject = texto.asunto,
                    htmlBody = texto.html,
                    textBody = texto.plano,
                )
            } catch (e: Exception) {
                // Sin la dirección dentro: un registro no es sitio para datos personales.
                log.warn("product.guests.panel: no se pudo enviar el enlace ({})", e.javaClass.simpleName)
            }
        }
    }
}

/** Las tres piezas de un correo ya redactado. */
data class GuestLinkEmail(val asunto: String, val html: String, val plano: String)

/**
 * El texto del correo, en **es-MX**, cálido y **sin emojis**, con la marca «Lino & Sello».
 *
 * Está separado del emisor para poder comprobarlo palabra por palabra en una prueba: que saluda por
 * el nombre de pila, que lleva el enlace una sola vez en cada cuerpo y que **no** menciona a nadie
 * más.
 */
object GuestLinkEmailText {

    fun componer(nombre: String?, url: String, marca: String): GuestLinkEmail {
        val pila = nombre?.trim()?.takeIf { it.isNotEmpty() }?.split(" ")?.first()
        val saludo = if (pila == null) "Hola" else "Hola, $pila"

        val asunto = "Tu invitación personal | $marca"

        val html = """
            <p>$saludo:</p>
            <p>Te compartimos tu invitación. Ábrela cuando quieras para ver todos los detalles y
            confirmar tu asistencia; puedes cambiar tu respuesta después si te hace falta.</p>
            <p><a href="$url">Abrir mi invitación</a></p>
            <p>Si el enlace no abre, copia esta dirección en tu navegador:<br>$url</p>
            <p>Este enlace es solo tuyo. Te pedimos no compartirlo.</p>
            <p>Con cariño,<br>$marca</p>
        """.trimIndent()

        val plano = """
            $saludo:

            Te compartimos tu invitación. Ábrela cuando quieras para ver todos los detalles y
            confirmar tu asistencia; puedes cambiar tu respuesta después si te hace falta.

            $url

            Este enlace es solo tuyo. Te pedimos no compartirlo.

            Con cariño,
            $marca
        """.trimIndent()

        return GuestLinkEmail(asunto, html, plano)
    }
}
