package mx.evolutiondev.invitaciones.modules.all.invitations.presentation.ktx

import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.model.DressCodeEntity
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.dresscode.DressCodeResponseDto
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.dresscode.GenderDressInfo

fun List<DressCodeEntity>.toDressCodeMap(): Map<String, DressCodeResponseDto> {
    return this.associateBy { it.name.uppercase() }
            .mapValues { (_, entity) ->
                DressCodeResponseDto(
                        id = entity.id,
                        name = entity.name,
                        woman = GenderDressInfo(
                                image = entity.womanImage,
                                description = entity.womanDescription
                        ),
                        man = GenderDressInfo(
                                image = entity.manImage,
                                description = entity.manDescription
                        )
                )
            }
}
