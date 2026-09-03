package mx.evolutiondev.invitaciones.core.email.strategy

import mx.evolutiondev.invitaciones.core.email.model.EmailRequest

interface EmailSenderStrategy {
    
    suspend fun send(request: EmailRequest)
    
    fun getStrategyName(): String
}
