package mx.evolutiondev.invitaciones.modules.shared.whatsapp

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

/**
 * Configuracion del canal de WhatsApp (Meta Cloud API) y **compuerta de apagado del modulo**.
 *
 * Fase 5, bloque E3-C3; ADR-5-E3-C3-01; hallazgo **S-01** de `diseno/12-producto-completo.md A3`
 * (los dos secretos que `8a16ebb` dejo fuera) y hallazgos **S-06** y **S-09** del mismo documento.
 *
 * ANTES: el token de acceso de Meta estaba escrito en claro en `application.yml:134` y en
 * `docker-compose.yml:53`, y el `hub.verify_token` del webhook estaba escrito en el codigo
 * (`WhatsAppWebhookController.kt:13`). Los tres consumidores los leian con `@Value` + `lateinit`,
 * asi que el modulo daba por hecho que siempre habia credencial.
 *
 * AHORA: los dos salen del entorno (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`) y
 * **vacio significa funcion desactivada**, no "usa el valor de siempre". Es la convencion que
 * `application.yml` ya usa para Stripe y para `templates2.revalidate`.
 *
 * POR QUE ESTOS DOS **NO** VAN A `SecretosObligatorios` (y los cinco de ADR-5-E3-A3-01 SI):
 *  - los otros cuatro secretos son de sistemas sin los cuales el producto no existe (firma de
 *    sesion, base de datos, bucket de assets, correo transaccional): sin ellos no hay nada que
 *    servir, y negarse a arrancar es la respuesta correcta;
 *  - WhatsApp hoy es **solo click-to-chat** (`decisiones-dueno.md` D-04 / ADR-DUENO-02): no hay
 *    envio automatico y la API de Meta se decide mas adelante. Exigir el token para arrancar
 *    romperia todo despliegue que no lo usa y empujaria al operador a **inventarse un valor**, que
 *    es exactamente el defecto que ADR-5-E3-A3-01 vino a quitar;
 *  - y hay un argumento de seguridad a favor del apagado: `POST /api/whatsapp/send-masivo` es una
 *    pasarela abierta (**S-06**: cualquier cuenta `USER` manda a cualquier lista de telefonos con
 *    el numero de la empresa). Un despliegue sin token no tiene pasarela en absoluto. Apagado por
 *    defecto es MENOS superficie, no mas.
 *
 * Lo que este apagado **no** es: una excusa para dejar el valor en el repositorio. El valor salio.
 * Y sacarlo **no lo invalida**: sigue en el historico de git y sigue siendo valido hasta que el
 * dueno lo rote en Meta (ver ADR-5-E3-C3-01 y `preguntas-abiertas.md`).
 *
 * Los valores por defecto viven aqui **ademas** de en `application.yml` para que un contexto de
 * prueba acotado, que no carga el `yml` entero, pueda construir estos beans sin declarar nada.
 */
@Component
class WhatsAppConfiguracion(
    @Value("\${whatsapp.api-url:https://graph.facebook.com/v19.0}")
    val apiUrl: String,
    /** Identificador publico del numero dentro de la URL de Meta Graph. NO es un secreto. */
    @Value("\${whatsapp.phone-number-id:}")
    val phoneNumberId: String,
    /** SECRETO. Con el se manda WhatsApp desde el numero de la empresa (S-06). */
    @Value("\${whatsapp.access-token:}")
    val accessToken: String,
    /** SECRETO. `hub.verify_token` del alta del webhook en Meta. */
    @Value("\${whatsapp.webhook.verify-token:}")
    val verifyToken: String,
) {

    /** Hay con que llamar a Meta: token de acceso **y** numero. Sin las dos cosas no se envia nada. */
    val envioHabilitado: Boolean
        get() = accessToken.isNotBlank() && phoneNumberId.isNotBlank()

    /** Hay con que responder al alta del webhook. Sin token, la verificacion ni se intenta. */
    val webhookHabilitado: Boolean
        get() = verifyToken.isNotBlank()

    /**
     * Compara el `hub.verify_token` recibido con el configurado.
     *
     * Devuelve `false` **siempre** que no haya token configurado: sin esta guarda, un canal apagado
     * (token vacio) aceptaria el alta de cualquiera que mandase `hub.verify_token=` vacio.
     * La comparacion es de tiempo constante; no es imprescindible para un apreton de manos que se
     * hace una vez, pero cuesta lo mismo y evita que alguien la reintroduzca mal mas adelante.
     */
    fun verificaTokenDeWebhook(recibido: String): Boolean {
        if (!webhookHabilitado) return false
        val a = verifyToken.toByteArray(Charsets.UTF_8)
        val b = recibido.toByteArray(Charsets.UTF_8)
        return java.security.MessageDigest.isEqual(a, b)
    }

    companion object {
        /** Motivo unico que devuelven las rutas cuando el canal esta apagado. Nunca nombra el token. */
        const val MOTIVO_APAGADO: String =
            "El canal de WhatsApp no esta configurado en este despliegue. " +
                "Define WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y " +
                "WHATSAPP_WEBHOOK_VERIFY_TOKEN para activarlo."

        const val CODIGO_APAGADO: String = "WHATSAPP_NO_CONFIGURADO"
    }
}
