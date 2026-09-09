package mx.evolutiondev.invitaciones.modules.product

import mx.evolutiondev.invitaciones.modules.product.account.ProductContactProperties
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import mx.evolutiondev.invitaciones.modules.product.payments.ProductPaymentsProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * Registra los tres objetos de configuración del módulo `product` como beans inyectables.
 *
 * El repositorio ya usa `@EnableConfigurationProperties` (`MailerSendEmailStrategy.kt:40`), pero lo
 * cuelga de la clase que consume las propiedades. Aquí **todavía no hay consumidor**: el andamio se
 * entrega antes que la lógica, y una `data class` con `@ConfigurationProperties` que nadie habilita no
 * es un bean. Se centraliza en esta única clase para que E3 y E4 puedan inyectar sus propiedades desde
 * el primer día sin tocar `application.yml` ni este fichero.
 *
 * **Fichero congelado (5-0c).** Solo se toca para registrar una clase de propiedades **nueva**, y eso
 * es un cambio de una línea que hay que anunciar al orquestador porque las cuatro sesiones lo comparten.
 */
@Configuration
@EnableConfigurationProperties(
    ProductPaymentsProperties::class,
    ProductMailProperties::class,
    ProductContactProperties::class,
)
class ProductPropertiesConfig
