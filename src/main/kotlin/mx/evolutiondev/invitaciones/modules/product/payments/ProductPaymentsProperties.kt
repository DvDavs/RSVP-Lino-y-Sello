package mx.evolutiondev.invitaciones.modules.product.payments

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * `producto.pagos.*` de `application.yml`, en un solo objeto tipado para la sesión **E4**.
 *
 * Existe por una razón muy concreta de esta fase: cuatro sesiones escriben el backend **en paralelo**
 * y `application.yml` es un fichero compartido. Con este bean, E4 añade lógica de pagos sin volver a
 * abrir el YAML, y por tanto sin chocar con E3, E2 ni E5. Sigue el patrón que ya usa el repositorio
 * (`MailerSendProperties`, `core/email/strategy/MailerSendEmailStrategy.kt:31-35`): `data class` con
 * valores por defecto, registrada con `@EnableConfigurationProperties`
 * ([mx.evolutiondev.invitaciones.modules.product.ProductPropertiesConfig]).
 *
 * **Los tres valores nacen vacíos a propósito.** [claveSecreta] y [secretoWebhook] son secretos: no se
 * escriben en el YAML ni se registran en un log, llegan del entorno (`STRIPE_SECRET_KEY`,
 * `STRIPE_WEBHOOK_SECRET`). Vacío significa **pagos desactivados**, no "usa el valor de siempre": es
 * decisión de E4 fallar al arrancar o degradar el flujo de compra, pero jamás cobrar contra una clave
 * adivinada. [moneda] sí trae `MXN` por defecto porque el producto vende en México (ADR-DUENO-02).
 */
@ConfigurationProperties(prefix = "producto.pagos.stripe")
data class ProductPaymentsProperties(
    val claveSecreta: String = "",
    val secretoWebhook: String = "",
    val moneda: String = MONEDA_POR_DEFECTO,
) {
    /** `true` cuando hay con qué hablarle a Stripe. E4 decide qué hacer cuando es `false`. */
    val configurado: Boolean get() = claveSecreta.isNotBlank()

    companion object {
        const val MONEDA_POR_DEFECTO = "MXN"
    }
}
