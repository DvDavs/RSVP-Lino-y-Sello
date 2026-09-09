package mx.evolutiondev.invitaciones.core.email

import mx.evolutiondev.invitaciones.modules.product.account.ProductContactProperties
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import org.springframework.stereotype.Service

data class EmailContent(
    val subject: String,
    val htmlBody: String,
    val textBody: String
)

/**
 * Marca de los correos (fase 5, E3; D-02 y `ADR-5-E3-07`).
 *
 * Los datos de marca —nombre, correo de soporte— entran **por configuración**
 * ([ProductMailProperties], [ProductContactProperties]), no escritos en el código: es lo que pedía
 * ADR-5-0C-01 al dejar esas dos clases creadas y sin consumidor. Los valores por defecto de los
 * parámetros permiten construir el generador sin contexto de Spring en las pruebas.
 *
 * **El arte de las plantillas no se rehace aquí**: solo cambian el nombre de la marca y las
 * direcciones. Rehacerlo con la identidad de Lino & Sello es otro encargo.
 */
@Service
class EmailContentGenerator(
    private val mailProperties: ProductMailProperties = ProductMailProperties(),
    private val contactProperties: ProductContactProperties = ProductContactProperties(),
) {

    /** «Lino & Sello» salvo que `producto.correo.remitente-nombre` diga otra cosa. */
    private val marca: String get() = mailProperties.remitenteNombre

    fun generate(emailType: String, variables: Map<String, Any>): EmailContent {
        return when (emailType) {
            "welcome" -> generateWelcomeContent(variables)
            "invitation" -> generateInvitationContent(variables)
            "admin-invitation-notification" -> generateAdminInvitationNotificationContent(variables)
            "password-reset" -> generatePasswordResetContent(variables)
            "guest-notification" -> generateGuestNotificationContent(variables)
            "guest-confirmation-success" -> generateGuestConfirmationSuccessContent(variables)
            "guest-decline-confirmation" -> generateGuestDeclineConfirmationContent(variables)
            "host-guest-confirmed-notification" -> generateHostGuestConfirmedNotificationContent(variables)
            "host-guest-declined-notification" -> generateHostGuestDeclinedNotificationContent(variables)
            "email-verification" -> generateEmailVerificationContent(variables)
            "email-change-notice" -> generateEmailChangeNoticeContent(variables)
            else -> throw IllegalArgumentException("Unknown email type: $emailType")
        }
    }

    private fun generateWelcomeContent(variables: Map<String, Any>): EmailContent {
        val customerName = variables["customerName"] as? String ?: "Usuario"
        val companyName = variables["companyName"] as? String ?: marca
        val isAdminCreated = variables["isAdminCreated"] as? Boolean ?: false
        val temporaryPassword = variables["temporaryPassword"] as? String
        val userEmail = variables["userEmail"] as? String
        val roleDisplayName = variables["roleDisplayName"] as? String
        val isAdminRole = variables["isAdminRole"] as? Boolean ?: false

        val subject = "¡Bienvenido a $companyName - Tu cuenta ha sido creada!"

        val (htmlBody, textBody) = if (isAdminCreated && temporaryPassword != null) {
            if (isAdminRole && roleDisplayName != null) {
                // Welcome email for admin/master users
                val html = """
                    <h1>¡Hola, $customerName!</h1>
                    <p>Tu cuenta de <strong>$roleDisplayName</strong> ha sido creada exitosamente en $companyName.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Credenciales de acceso:</h3>
                        <p><strong>Email:</strong> $userEmail</p>
                        <p><strong>Contraseña temporal:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">$temporaryPassword</code></p>
                    </div>
                    <p>Por seguridad, te recomendamos cambiar tu contraseña lo antes posible una vez que inicies sesión.</p>
                    <p>Como ${roleDisplayName.lowercase()}, tendrás acceso a funcionalidades administrativas de la plataforma.</p>
                    <p><strong>¡Bienvenido al equipo!</strong></p>
                """.trimIndent()
                val text = """
                    ¡Hola $customerName!
                    
                    Tu cuenta de $roleDisplayName ha sido creada exitosamente en $companyName.
                    
                    Credenciales de acceso:
                    Email: $userEmail
                    Contraseña temporal: $temporaryPassword
                    
                    Por seguridad, te recomendamos cambiar tu contraseña lo antes posible una vez que inicies sesión.
                    
                    Como ${roleDisplayName.lowercase()}, tendrás acceso a funcionalidades administrativas de la plataforma.
                    
                    ¡Bienvenido al equipo!
                    
                    Saludos,
                    El equipo de $companyName
                """.trimIndent()
                html to text
            } else {
                // Welcome email for regular admin-created users
                val html = """
                    <h1>¡Hola, $customerName!</h1>
                    <p>Tu cuenta ha sido creada exitosamente por un administrador en $companyName.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Credenciales de acceso:</h3>
                        <p><strong>Email:</strong> $userEmail</p>
                        <p><strong>Contraseña temporal:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">$temporaryPassword</code></p>
                    </div>
                    <p>Por seguridad, te recomendamos cambiar tu contraseña lo antes posible una vez que inicies sesión.</p>
                    <p><strong>¡Bienvenido a nuestra plataforma!</strong></p>
                """.trimIndent()
                val text = """
                    ¡Hola $customerName!
                    
                    Tu cuenta ha sido creada exitosamente por un administrador en $companyName.
                    
                    Credenciales de acceso:
                    Email: $userEmail
                    Contraseña temporal: $temporaryPassword
                    
                    Por seguridad, te recomendamos cambiar tu contraseña lo antes posible una vez que inicies sesión.
                    
                    ¡Bienvenido a nuestra plataforma!
                    
                    Saludos,
                    El equipo de $companyName
                """.trimIndent()
                html to text
            }
        } else {
            // Welcome email for self-registered users
            val html = """
                <h1>¡Bienvenido $customerName!</h1>
                <p>Nos complace darte la bienvenida a <strong>$companyName</strong>.</p>
                <p>Tu cuenta ha sido creada exitosamente y ya puedes comenzar a usar nuestros servicios.</p>
                <p>Podrás crear invitaciones personalizadas, gestionar eventos y mucho más.</p>
                <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                <p><strong>¡Gracias por elegirnos para tus eventos especiales!</strong></p>
            """.trimIndent()
            val text = """
                ¡Bienvenido $customerName!
                
                Nos complace darte la bienvenida a $companyName.
                
                Tu cuenta ha sido creada exitosamente y ya puedes comenzar a usar nuestros servicios.
                
                Podrás crear invitaciones personalizadas, gestionar eventos y mucho más.
                
                Si tienes alguna pregunta, no dudes en contactarnos.
                
                ¡Gracias por elegirnos para tus eventos especiales!
                
                Saludos,
                El equipo de $companyName
            """.trimIndent()
            html to text
        }
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateInvitationContent(variables: Map<String, Any>): EmailContent {
        val customerName = variables["customerName"] as? String ?: "Usuario"
        val eventName = variables["eventName"] as? String ?: "Evento"
        val planName = variables["planName"] as? String ?: "Plan"
        val extraModules = variables["extraModules"] as? String ?: ""
        val hasExtras = variables["hasExtras"] as? Boolean ?: false
        val isPremium = variables["isPremium"] as? Boolean ?: false
        val isWedding = variables["isWedding"] as? Boolean ?: false
        val basePrice = variables["basePrice"] as? Double ?: 0.0
        @Suppress("UNCHECKED_CAST")
        val extraModulesPrice = variables["extraModulesPrice"] as? Map<String, Double> ?: emptyMap()
        val totalPrice = variables["totalPrice"] as? Double ?: basePrice
        val isPaid = variables["isPaid"] as? Boolean ?: false
        
        val subject = if (isPaid) {
            "Tu invitación para '$eventName' ha sido creada y activada"
        } else {
            "Tu invitación para '$eventName' ha sido creada"
        }
        
        val extraModulesHtml = if (hasExtras) {
            "<div style='background-color: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0;'><strong>Módulos extras incluidos:</strong><br>$extraModules</div>"
        } else ""
        
        val priceBreakdownHtml = buildString {
            append("<div style='background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;'>")
            append("<h3 style='margin-top: 0;'>💰 Desglose de Precios:</h3>")
            append("<ul style='list-style: none; padding: 0;'>")
            append("<li style='margin-bottom: 8px;'>📋 <strong>Plan $planName:</strong> $${"%.2f".format(basePrice)}</li>")
            
            if (extraModulesPrice.isNotEmpty()) {
                extraModulesPrice.forEach { (moduleName, price) ->
                    append("<li style='margin-bottom: 8px;'>✨ <strong>$moduleName:</strong> $${"%.2f".format(price)}</li>")
                }
            }
            
            append("<li style='margin-top: 12px; padding-top: 12px; border-top: 2px solid #ffc107; font-size: 1.1em;'>")
            append("<strong>Total:</strong> <span style='color: #28a745; font-weight: bold;'>$${"%.2f".format(totalPrice)}</span>")
            append("</li>")
            append("</ul>")
            append("</div>")
        }
        
        val planDetails = if (isPremium) "Plan Premium" else "Plan Básico"
        val eventTypeText = if (isWedding) "boda" else "evento"
        
        val statusMessageHtml = if (isPaid) {
            "<p>Tu invitación ha sido creada y <strong style='color: #28a745;'>activada exitosamente</strong>. Ya está lista para que la personalices y la compartas con tus invitados.</p>"
        } else {
            "<p>Tu borrador de invitación ha sido guardado exitosamente. El siguiente paso es completar el pago para activarla.</p>"
        }
        
        val nextStepsHtml = if (isPaid) {
            "<p>Ahora puedes personalizar los detalles finales y comenzar a enviar las invitaciones a tus invitados.</p>"
        } else {
            "<p>Una vez completado el pago, tu invitación estará lista para enviar a tus invitados.</p>"
        }
        
        val htmlBody = """
            <h1>🎉 Hola $customerName,</h1>
            $statusMessageHtml
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Detalles de tu $eventTypeText:</h3>
                <ul style="list-style: none; padding: 0;">
                    <li>📅 <strong>Evento:</strong> $eventName</li>
                    <li>💎 <strong>Plan:</strong> $planName ($planDetails)</li>
                </ul>
                $extraModulesHtml
            </div>
            
            $priceBreakdownHtml
            
            $nextStepsHtml
            <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
            <p><strong>¡Gracias por elegirnos para tu evento especial!</strong></p>
        """.trimIndent()
        
        val extraModulesText = if (hasExtras) {
            "\n\nMódulos extras incluidos:\n$extraModules"
        } else ""
        
        val priceBreakdownText = buildString {
            append("\n\nDesglose de Precios:\n")
            append("• Plan $planName: $${"%.2f".format(basePrice)}\n")
            
            if (extraModulesPrice.isNotEmpty()) {
                extraModulesPrice.forEach { (moduleName, price) ->
                    append("• $moduleName: $${"%.2f".format(price)}\n")
                }
            }
            
            append("\nTotal: $${"%.2f".format(totalPrice)}")
        }
        
        val statusMessageText = if (isPaid) {
            "Tu invitación ha sido creada y activada exitosamente. Ya está lista para que la personalices y la compartas con tus invitados."
        } else {
            "Tu borrador de invitación ha sido guardado exitosamente. El siguiente paso es completar el pago para activarla."
        }
        
        val nextStepsText = if (isPaid) {
            "Ahora puedes personalizar los detalles finales y comenzar a enviar las invitaciones a tus invitados."
        } else {
            "Una vez completado el pago, tu invitación estará lista para enviar a tus invitados."
        }
        
        val textBody = """
            Hola $customerName,
            
            $statusMessageText
            
            Detalles de tu $eventTypeText:
            • Evento: $eventName
            • Plan: $planName ($planDetails)$extraModulesText
            $priceBreakdownText
            
            $nextStepsText
            
            Si tienes alguna pregunta, no dudes en contactarnos.
            
            ¡Gracias por elegirnos para tu evento especial!
            
            Saludos,
            El equipo de $marca
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateAdminInvitationNotificationContent(variables: Map<String, Any>): EmailContent {
        val userName = variables["userName"] as? String ?: "Usuario Desconocido"
        val userEmail = variables["userEmail"] as? String ?: "email@desconocido.com"
        val eventName = variables["eventName"] as? String ?: "Evento"
        val planName = variables["planName"] as? String ?: "Plan"
        val extras = variables["extras"] as? String ?: ""
        val basePrice = variables["basePrice"] as? Double ?: 0.0
        @Suppress("UNCHECKED_CAST")
        val extraModulesPrice = variables["extraModulesPrice"] as? Map<String, Double> ?: emptyMap()
        val totalPrice = variables["totalPrice"] as? Double ?: basePrice
        
        val subject = "Nueva invitación creada por $userName"
        
        val extrasHtml = if (extras.isNotEmpty()) {
            "<div style='background-color: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0;'><strong>Módulos extras:</strong><br>$extras</div>"
        } else ""
        
        val priceBreakdownHtml = buildString {
            append("<div style='background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;'>")
            append("<h3 style='margin-top: 0;'>💰 Desglose de Precios:</h3>")
            append("<ul style='list-style: none; padding: 0;'>")
            append("<li style='margin-bottom: 8px;'>📋 <strong>Plan $planName:</strong> $${"%.2f".format(basePrice)}</li>")
            
            if (extraModulesPrice.isNotEmpty()) {
                extraModulesPrice.forEach { (moduleName, price) ->
                    append("<li style='margin-bottom: 8px;'>✨ <strong>$moduleName:</strong> $${"%.2f".format(price)}</li>")
                }
            }
            
            append("<li style='margin-top: 12px; padding-top: 12px; border-top: 2px solid #28a745; font-size: 1.1em;'>")
            append("<strong>Total:</strong> <span style='color: #28a745; font-weight: bold;'>$${"%.2f".format(totalPrice)}</span>")
            append("</li>")
            append("</ul>")
            append("</div>")
        }
        
        val htmlBody = """
            <h1>🔔 Nueva Invitación en el Sistema</h1>
            <p>El usuario <strong>$userName</strong> ha generado una nueva invitación:</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <ul style="list-style: none; padding: 0;">
                    <li>👤 <strong>Correo del usuario:</strong> $userEmail</li>
                    <li>📅 <strong>Evento:</strong> $eventName</li>
                    <li>💎 <strong>Plan:</strong> $planName</li>
                </ul>
                $extrasHtml
            </div>
            
            $priceBreakdownHtml
            
            <p>Por favor, revisa los detalles en el panel de administración.</p>
        """.trimIndent()
        
        val extrasText = if (extras.isNotEmpty()) {
            "\n\nMódulos extras:\n$extras"
        } else ""
        
        val priceBreakdownText = buildString {
            append("\n\nDesglose de Precios:\n")
            append("• Plan $planName: $${"%.2f".format(basePrice)}\n")
            
            if (extraModulesPrice.isNotEmpty()) {
                extraModulesPrice.forEach { (moduleName, price) ->
                    append("• $moduleName: $${"%.2f".format(price)}\n")
                }
            }
            
            append("\nTotal: $${"%.2f".format(totalPrice)}")
        }
        
        val textBody = """
            Nueva invitación creada en el sistema
            
            El usuario $userName ha generado una nueva invitación:
            
            Correo del usuario: $userEmail
            Evento: $eventName
            Plan: $planName$extrasText
            $priceBreakdownText
            
            Por favor, revisa los detalles en el panel de administración.
            
            ---
            Sistema de Notificaciones Automáticas
            Invitaciones Platform
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }
    
    private fun generatePasswordResetContent(variables: Map<String, Any>): EmailContent {
        val customerName = variables["customerName"] as? String ?: "Usuario"
        val resetUrl = variables["resetUrl"] as? String ?: "#"

        val subject = "Restablecimiento de tu contraseña"
        
        val htmlBody = """
            <h1>Hola $customerName,</h1>
            <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
            <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="$resetUrl" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Restablecer Contraseña</a>
            </div>
            
            <p><strong>Este enlace expirará en 24 horas por razones de seguridad.</strong></p>
            <p>Si no solicitaste este restablecimiento, puedes ignorar este correo de forma segura.</p>
        """.trimIndent()
        
        val textBody = """
            Hola $customerName,
            
            Hemos recibido una solicitud para restablecer tu contraseña.
            
            Para restablecer tu contraseña, haz clic en el siguiente enlace:
            $resetUrl
            
            Este enlace expirará en 24 horas por razones de seguridad.
            
            Si no solicitaste este restablecimiento, puedes ignorar este correo de forma segura.
            
            Saludos,
            El equipo de $marca
        """.trimIndent()

        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateGuestNotificationContent(variables: Map<String, Any>): EmailContent {
        val guestName = variables["guestName"] as? String ?: "Estimado invitado"
        val graduatesName = variables["graduatesName"] as? String ?: ""
        val eventName = variables["eventName"] as? String ?: "nuestro evento"
        val eventDate = variables["eventDate"] as? String ?: ""
        val eventTime = variables["eventTime"] as? String ?: ""
        val confirmationUrl = variables["confirmationUrl"] as? String ?: "#"
        
        val subject = "¡Estás invitado! Confirma tu asistencia"
        
        val dateTimeInfo = if (eventDate.isNotEmpty() && eventTime.isNotEmpty()) {
            """
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 16px;"><strong>📅 Fecha:</strong> $eventDate</p>
                <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>🕐 Hora:</strong> $eventTime</p>
            </div>
            """.trimIndent()
        } else ""
        
        val htmlBody = """
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4a5568; margin: 0;">🎉 ¡Estás Invitado!</h1>
            </div>
            
            <p style="font-size: 16px;">Hola <strong>$guestName</strong>,</p>
            
            <p style="font-size: 16px;">Te recordamos que aún no has confirmado tu asistencia a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }.</p>
            
            $dateTimeInfo
            
            <p style="font-size: 16px;">Tu presencia es muy importante para nosotros. Por favor, responde lo antes posible para ayudarnos con la organización del evento.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="$confirmationUrl" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Responder Invitación</a>
            </div>
            
            <p style="font-size: 14px; color: #666; text-align: center; font-style: italic;">Podrás indicarnos si asistirás o no podrás acompañarnos</p>
            
            <p style="font-size: 14px; color: #666;">Si tienes alguna pregunta, no dudes en contactar a los anfitriones.</p>
            
            <p style="font-size: 16px; margin-top: 30px;"><strong>¡Gracias y esperamos verte pronto!</strong></p>
            
            <p style="font-size: 14px; color: #999; margin-top: 20px;">Con cariño,<br>Los anfitriones del evento</p>
        """.trimIndent()
        
        val textBody = """
            ¡Estás Invitado!
            
            Hola $guestName,
            
            Te recordamos que aún no has confirmado tu asistencia a ${if (graduatesName.isNotEmpty()) "\nla Graduación de $graduatesName\n" else "$eventName" }.
            ${if (eventDate.isNotEmpty() && eventTime.isNotEmpty()) "\nFecha: $eventDate\nHora: $eventTime\n" else ""}
            Tu presencia es muy importante para nosotros. Por favor, responde lo antes posible para ayudarnos con la organización del evento.
            
            Responde a la invitación en el siguiente enlace (podrás indicarnos si asistirás o no):
            $confirmationUrl
            
            Si tienes alguna pregunta, no dudes en contactar a los anfitriones.
            
            ¡Gracias y esperamos verte pronto!
            
            Con cariño,
            Los anfitriones del evento
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateGuestConfirmationSuccessContent(variables: Map<String, Any>): EmailContent {
        val guestName = variables["guestName"] as? String ?: "Invitado"
        val graduatesName = variables["graduatesName"] as? String ?: ""
        val eventName = variables["eventName"] as? String ?: "el evento"
        val eventDate = variables["eventDate"] as? String ?: ""
        val eventTime = variables["eventTime"] as? String ?: ""
        val adultsConfirmed = variables["adultsConfirmed"] as? Int ?: 0
        val childrenConfirmed = variables["childrenConfirmed"] as? Int ?: 0
        val youngConfirmed = variables["youngConfirmed"] as? Int ?: 0
        val cancellationUrl = variables["cancellationUrl"] as? String ?: ""
        val confirmationUrl = variables["confirmationUrl"] as? String ?: "#"

        val subject = "✅ Confirmación de Asistencia - $eventName"
        
        val dateTimeInfo = if (eventDate.isNotEmpty() && eventTime.isNotEmpty()) {
            """
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 16px;"><strong>📅 Fecha:</strong> $eventDate</p>
                <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>🕐 Hora:</strong> $eventTime</p>
            </div>
            """.trimIndent()
        } else ""
        
        val attendanceInfo = """
            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #2e7d32; margin-top: 0;">Detalles de tu confirmación:</h3>
                <p style="margin: 5px 0;"><strong>Adultos:</strong> $adultsConfirmed</p>
                ${if (youngConfirmed > 0) "<p style=\"margin: 5px 0;\"><strong>Jóvenes:</strong> $youngConfirmed</p>" else ""}
                ${if (childrenConfirmed > 0) "<p style=\"margin: 5px 0;\"><strong>Niños:</strong> $childrenConfirmed</p>" else ""}
                ${if (graduatesName.isNotEmpty()) "<p style=\"margin: 5px 0;\"><strong>Graduado:</strong> $graduatesName</p>" else "" }
            </div>
        """.trimIndent()
        
        val htmlBody = """
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4a5568; margin: 0;">✅ ¡Confirmación Exitosa!</h1>
            </div>
            
            <p style="font-size: 16px;">Hola <strong>$guestName</strong>,</p>
            
            <p style="font-size: 16px;">¡Gracias por confirmar tu asistencia a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }! Hemos registrado tu confirmación exitosamente.</p>
            
            $dateTimeInfo
            
            $attendanceInfo
            

            <div style="text-align: center; margin: 30px 0;">
                <a href="$confirmationUrl" style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Ver Invitación</a>
            </div>

            <p style="font-size: 16px;">Estamos muy emocionados de que nos acompañes. Te esperamos en el evento.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>¿Necesitas cancelar tu asistencia?</strong><br>
                    Si por algún motivo no puedes asistir, puedes cancelar tu confirmación.
                    Ingresando a la invitación y en el apartado del formulario encontrarás el enlace de cancelar invitación, usa el siguiente enlace:
                </p>
                <div style="text-align: center; margin-top: 10px;">
                    <a href="$cancellationUrl" style="color: #d32f2f; text-decoration: underline; font-size: 14px;">Cancelar mi asistencia</a>
                </div>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px;"><strong>¡Nos vemos pronto!</strong></p>
            
            <p style="font-size: 14px; color: #999; margin-top: 20px;">Con cariño,<br>Los anfitriones del evento</p>
        """.trimIndent()
        
        val textBody = """
            ¡Confirmación Exitosa!
            
            Hola $guestName,
            
            ¡Gracias por confirmar tu asistencia a ${if (eventName === "Eventos") "la Graduación de $graduatesName" else "$eventName" }! Hemos registrado tu confirmación exitosamente.
            ${if (eventDate.isNotEmpty() && eventTime.isNotEmpty()) "\nFecha: $eventDate\nHora: $eventTime\n" else ""}
            Detalles de tu confirmación:
            - Adultos: $adultsConfirmed
            ${if (youngConfirmed > 0) "- Jóvenes: $youngConfirmed" else ""}
            ${if (childrenConfirmed > 0) "- Niños: $childrenConfirmed" else ""}
            ${if (graduatesName.isNotEmpty()) "- Graduado: $graduatesName" else "" }
            
            Estamos muy emocionados de que nos acompañes. Te esperamos en el evento.
            
            ¿Necesitas cancelar tu asistencia?
            Si por algún motivo no puedes asistir, puedes cancelar tu confirmación usando el siguiente enlace:
            $cancellationUrl
            
            ¡Nos vemos pronto!
            
            Con cariño,
            Los anfitriones del evento
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateGuestDeclineConfirmationContent(variables: Map<String, Any>): EmailContent {
        val guestName = variables["guestName"] as? String ?: "Invitado"
        val graduatesName = variables["graduatesName"] as? String ?: ""
        val eventName = variables["eventName"] as? String ?: "el evento"
        val eventDate = variables["eventDate"] as? String ?: ""
        val wasConfirmed = variables["wasConfirmed"] as? Boolean ?: false
        
        val actionText = if (wasConfirmed) "cancelado tu asistencia" else "indicado que no podrás asistir"
        val subject = "Confirmación de respuesta - $eventName"
        
        val htmlBody = """
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4a5568; margin: 0;">Respuesta Recibida</h1>
            </div>
            
            <p style="font-size: 16px;">Hola <strong>$guestName</strong>,</p>
            
            <p style="font-size: 16px;">Hemos recibido tu respuesta y has <strong>$actionText</strong> a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }.</p>
            
            ${if (eventDate.isNotEmpty()) "<p style=\"font-size: 16px;\"><strong>Fecha del evento:</strong> $eventDate</p>" else ""}
            
            <p style="font-size: 16px;">Lamentamos que no puedas acompañarnos en esta ocasión especial. Tu respuesta ha sido registrada y los anfitriones han sido notificados.</p>
            
            <p style="font-size: 16px;">Si tienes alguna pregunta o si tu situación cambia, no dudes en contactar directamente a los anfitriones.</p>
            
            <p style="font-size: 16px; margin-top: 30px;"><strong>Gracias por tu respuesta.</strong></p>
            
            <p style="font-size: 14px; color: #999; margin-top: 20px;">Con cariño,<br>Los anfitriones del evento</p>
        """.trimIndent()
        
        val textBody = """
            Respuesta Recibida
            
            Hola $guestName,
            
            Hemos recibido tu respuesta y has $actionText a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }.
            ${if (eventDate.isNotEmpty()) "\nFecha del evento: $eventDate\n" else ""}
            Lamentamos que no puedas acompañarnos en esta ocasión especial. Tu respuesta ha sido registrada y los anfitriones han sido notificados.
            
            Si tienes alguna pregunta o si tu situación cambia, no dudes en contactar directamente a los anfitriones.
            
            Gracias por tu respuesta.
            
            Con cariño,
            Los anfitriones del evento
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateHostGuestDeclinedNotificationContent(variables: Map<String, Any>): EmailContent {
        val hostName = variables["hostName"] as? String ?: "Anfitrión"
        val guestName = variables["guestName"] as? String ?: "Un invitado"
        val eventName = variables["eventName"] as? String ?: "tu evento"
        val messageType = variables["messageType"] as? String ?: "declinado"
        val graduatesName = variables["graduatesName"] as? String ?: ""
        
        val subject = "⚠️ Respuesta de invitado - $eventName"
        
        val htmlBody = """
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4a5568; margin: 0;">⚠️ Actualización de Invitado</h1>
            </div>
            
            <p style="font-size: 16px;">Hola <strong>$hostName</strong>,</p>
            
            <p style="font-size: 16px;"><strong>$guestName</strong> ha <strong>$messageType</strong> su asistencia a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }.</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <p style="margin: 0; font-size: 16px;">Este invitado no asistirá al evento.</p>
            </div>
            
            <p style="font-size: 16px;">Puedes revisar el estado de todos tus invitados en tu panel de control.</p>
            
            <p style="font-size: 14px; color: #999; margin-top: 20px;">Saludos,<br>El equipo de $marca</p>
        """.trimIndent()
        
        val textBody = """
            Actualización de Invitado
            
            Hola $hostName,
            
            $guestName ha $messageType su asistencia a ${if (graduatesName.isNotEmpty()) "la <strong>Graduación de $graduatesName</strong>" else "<strong>$eventName</strong>" }.
            
            Este invitado no asistirá al evento.
            
            Puedes revisar el estado de todos tus invitados en tu panel de control.
            
            Saludos,
            El equipo de $marca
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    private fun generateHostGuestConfirmedNotificationContent(variables: Map<String, Any>): EmailContent {
        val hostName = variables["hostName"] as? String ?: "Anfitrión"
        val guestName = variables["guestName"] as? String ?: "Un invitado"
        val eventName = variables["eventName"] as? String ?: "tu evento"
        val graduatesName = variables["graduatesName"] as? String ?: ""
        val adultsConfirmed = variables["adultsConfirmed"] as? Int ?: 0
        val childrenConfirmed = variables["childrenConfirmed"] as? Int ?: 0
        val youngConfirmed = variables["youngConfirmed"] as? Int ?: 0
        val congratulationsMessage = variables["congratulationsMessage"] as? String
        
        val subject = "🎉 Nueva confirmación de asistencia - $eventName"
        
        val totalGuests = adultsConfirmed + childrenConfirmed + youngConfirmed
        
        val attendanceInfo = """
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">Detalles de la confirmación:</h3>
                <p style="margin: 5px 0;"><strong>Adultos:</strong> $adultsConfirmed</p>
                ${if (youngConfirmed > 0) "<p style=\"margin: 5px 0;\"><strong>Jóvenes:</strong> $youngConfirmed</p>" else ""}
                ${if (childrenConfirmed > 0) "<p style=\"margin: 5px 0;\"><strong>Niños:</strong> $childrenConfirmed</p>" else ""}
                ${if (graduatesName.isNotEmpty()) "<p style=\"margin: 5px 0;\"><strong>Graduado:</strong> $graduatesName</p>" else "" }
                <p style="margin: 10px 0 0 0; font-weight: bold;"><strong>Total de invitados:</strong> $totalGuests</p>
            </div>
        """.trimIndent()
        
        val messageSection = if (!congratulationsMessage.isNullOrBlank()) {
            """
            <div style="background-color: #fce4ec; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #c2185b; margin-top: 0;">💌 Mensaje de felicitación:</h3>
                <p style="margin: 0; font-style: italic;">"$congratulationsMessage"</p>
            </div>
            """.trimIndent()
        } else ""
        
        val htmlBody = """
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #4a5568; margin: 0;">🎉 Nueva Confirmación de Asistencia</h1>
            </div>
            
            <p style="font-size: 16px;">Hola <strong>$hostName</strong>,</p>
            
            <p style="font-size: 16px;"><strong>$guestName</strong> ha confirmado su asistencia a  ${if (graduatesName.isNotEmpty()) "<strong>Gradución de $graduatesName</strong>" else "<strong>$eventName</strong>" }.</p>
            
            $attendanceInfo
            
            $messageSection
            
            <p style="font-size: 16px;">Puedes revisar todos los detalles de tus invitados confirmados en tu panel de control.</p>
            
            <p style="font-size: 16px; margin-top: 30px;"><strong>¡Cada confirmación nos acerca más al gran día!</strong></p>
            
            <p style="font-size: 14px; color: #999; margin-top: 20px;">Saludos,<br>El equipo de $marca</p>
        """.trimIndent()
        
        val textBody = """
            Nueva Confirmación de Asistencia
            
            Hola $hostName,
            
            $guestName ha confirmado su asistencia a $eventName.
            
            Detalles de la confirmación:
            - Adultos: $adultsConfirmed
            ${if (youngConfirmed > 0) "- Jóvenes: $youngConfirmed" else ""}
            ${if (childrenConfirmed > 0) "- Niños: $childrenConfirmed" else ""}
            ${if (graduatesName.isNotEmpty()) "- Graduado: $graduatesName" else "" }
            Total de invitados: $totalGuests
            
            ${if (!congratulationsMessage.isNullOrBlank()) "Mensaje de felicitación:\n\"$congratulationsMessage\"\n" else ""}
            Puedes revisar todos los detalles de tus invitados confirmados en tu panel de control.
            
            ¡Cada confirmación nos acerca más al gran día!
            
            Saludos,
            El equipo de $marca
        """.trimIndent()
        
        return EmailContent(subject, buildHtmlTemplate(subject, htmlBody), textBody)
    }

    /**
     * Verificación del correo de acceso (fase 5, E3). Sirve para el alta y para el cambio de correo:
     * los dos prueban lo mismo, que quien abre el enlace lee ese buzón.
     *
     * `verificationUrl` viene ya construida con `app.frontend.url`
     * (`EmailVerificationService.urlDeVerificacion`): esta clase **no** arma URLs, que es como nació
     * el hallazgo S-08.
     */
    private fun generateEmailVerificationContent(variables: Map<String, Any>): EmailContent {
        val customerName = variables["customerName"] as? String ?: "Usuario"
        val companyName = variables["companyName"] as? String ?: marca
        val verificationUrl = variables["verificationUrl"] as? String ?: ""

        val subject = "Confirma tu correo en $companyName"

        val html = """
            <h1>Hola, $customerName</h1>
            <p>Confirma que este correo es tuyo para terminar de activar tu cuenta en <strong>$companyName</strong>.</p>
            <p style="margin: 28px 0;">
                <a href="$verificationUrl" style="background-color: #1f1f1f; color: #ffffff; padding: 12px 22px; border-radius: 6px; text-decoration: none; display: inline-block;">Confirmar mi correo</a>
            </p>
            <p style="font-size: 13px; color: #666;">Si el botón no funciona, copia y pega esta dirección en tu navegador:<br>$verificationUrl</p>
            <p style="font-size: 13px; color: #666;">El enlace caduca en 24 horas. Si no creaste esta cuenta, ignora este correo.</p>
        """.trimIndent()

        val text = """
            Hola, $customerName

            Confirma que este correo es tuyo para terminar de activar tu cuenta en $companyName.

            $verificationUrl

            El enlace caduca en 24 horas. Si no creaste esta cuenta, ignora este correo.

            Saludos,
            El equipo de $companyName
        """.trimIndent()

        return EmailContent(subject, buildHtmlTemplate(subject, html), text)
    }

    /**
     * Aviso al correo **anterior** cuando alguien pide cambiar el correo de acceso. Es la mitad que
     * faltaba: sin este correo, un cambio de correo es silencioso para quien pierde la cuenta.
     */
    private fun generateEmailChangeNoticeContent(variables: Map<String, Any>): EmailContent {
        val customerName = variables["customerName"] as? String ?: "Usuario"
        val companyName = variables["companyName"] as? String ?: marca
        val newEmail = variables["newEmail"] as? String ?: ""
        val supportEmail = variables["supportEmail"] as? String ?: contactProperties.soporte

        val subject = "Pidieron cambiar el correo de tu cuenta en $companyName"

        // El contacto de soporte solo se pinta si está configurado: un correo de ayuda inventado es
        // peor que no poner ninguno (`ProductContactProperties`).
        val ayudaHtml = if (supportEmail.isBlank()) "" else
            """<p style="font-size: 13px; color: #666;">Si no fuiste tú, escríbenos a <a href="mailto:$supportEmail">$supportEmail</a> y cambia tu contraseña.</p>"""
        val ayudaTexto = if (supportEmail.isBlank()) "" else
            "Si no fuiste tú, escríbenos a $supportEmail y cambia tu contraseña."

        val html = """
            <h1>Hola, $customerName</h1>
            <p>Se pidió cambiar el correo de acceso de tu cuenta de <strong>$companyName</strong> a <strong>$newEmail</strong>.</p>
            <p>El cambio <strong>todavía no se ha hecho</strong>: solo ocurrirá cuando se confirme desde ese buzón.</p>
            $ayudaHtml
        """.trimIndent()

        val text = """
            Hola, $customerName

            Se pidió cambiar el correo de acceso de tu cuenta de $companyName a $newEmail.

            El cambio todavía no se ha hecho: solo ocurrirá cuando se confirme desde ese buzón.

            $ayudaTexto

            Saludos,
            El equipo de $companyName
        """.trimIndent()

        return EmailContent(subject, buildHtmlTemplate(subject, html), text)
    }

    private fun buildHtmlTemplate(title: String, content: String): String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>$title</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                $content
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">Este es un correo automático.</p>
            </div>
        </body>
        </html>
        """.trimIndent()
    }
}
