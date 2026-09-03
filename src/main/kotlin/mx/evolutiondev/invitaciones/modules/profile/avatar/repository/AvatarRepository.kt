package mx.evolutiondev.invitaciones.modules.profile.avatar.repository

import mx.evolutiondev.invitaciones.modules.profile.avatar.repository.model.AvatarEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface AvatarRepository : JpaRepository<AvatarEntity, Long>

