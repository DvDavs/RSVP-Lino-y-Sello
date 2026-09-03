package mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo

import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface InvitationConfigRepository : MongoRepository<InvitationConfig, String> {

    fun findByInvitationId(invitationId: Long): Optional<InvitationConfig>
}

