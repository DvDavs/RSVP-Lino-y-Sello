package mx.evolutiondev.invitaciones.modules.user.invitations.service

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.*
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.*
import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.DressCodeRepository
import org.springframework.stereotype.Component

@Component
class ExtraModulesHandler(
        private val recommendationRepository: InvitationRecommendationRepository,
        private val storyRepository: InvitationStoryRepository,
        private val activityRepository: InvitationActivityRepository,
        private val parentRepository: InvitationParentRepository,
        private val godparentRepository: InvitationGodparentRepository,
         private val phraseRepository: InvitationPhraseRepository,
        private val dressCodeRepository: InvitationDressCodeRepository,
        private val masterDressCodeRepository: DressCodeRepository
) {

    fun save(invitation: InvitationEntity, extra: ExtraModulesRequest) {
        extra.recommendations?.let {
            recommendationRepository.saveAll(
                    it.map { req ->
                        InvitationRecommendationEntity(
                                invitation = invitation,
                                name = req.name,
                                address = req.address,
                                phone = req.phone,
                                url = req.url,
                                description = req.description,
                                photoUrl = req.photoUrl
                        )
                    }
            )
        }

        extra.ourStory?.let {
            storyRepository.saveAll(
                    it.map { req ->
                        InvitationStoryEntity(
                                invitation = invitation,
                                title = req.title,
                                date = req.date,
                                description = req.description,
                                photoUrl = req.photoUrl
                        )
                    }
            )
        }

        extra.amenitiesAndActivities?.let {
            activityRepository.saveAll(
                    it.map { req ->
                        InvitationActivityEntity(
                                invitation = invitation,
                                name = req.name,
                                address = req.address,
                                phone = req.phone,
                                url = req.url,
                                description = req.description,
                                photoUrl = req.photoUrl
                        )
                    }
            )
        }

        extra.parentsAndGodparents?.let { parentsAndGodparents ->
            val introPhrases =
                    parentsAndGodparents.intro
                            .filter { it.content.isNotBlank() }
                            .mapIndexed { index, introItem ->
                                InvitationPhraseEntity(
                                        invitation = invitation,
                                        gender = "family_intro_$index",
                                        text = introItem.content
                                )
                            }

            if (introPhrases.isNotEmpty()) {
                phraseRepository.saveAll(introPhrases)
            }
            val parentsToSave = mutableListOf<InvitationParentEntity>()
            parentsAndGodparents.parents?.let { parents ->
                parents.mother?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "mother",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
                parents.father?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "father",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
            }
            
            parentsAndGodparents.brideParents?.let { brideParents ->
                brideParents.mother?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "bride_mother",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
                brideParents.father?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "bride_father",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
            }
            
            parentsAndGodparents.groomParents?.let { groomParents ->
                groomParents.mother?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "groom_mother",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
                groomParents.father?.let {
                    parentsToSave.add(
                            InvitationParentEntity(
                                    invitation = invitation,
                                    type = "groom_father",
                                    name = it.name,
                                    photoUrl = it.photoUrl.orEmpty()
                            )
                    )
                }
            }
            
            if (parentsToSave.isNotEmpty()) {
                parentRepository.saveAll(parentsToSave)
            }
        }

        extra.parentsAndGodparents?.godparents?.let {
            godparentRepository.saveAll(
                    it.map { req ->
                        InvitationGodparentEntity(
                                invitation = invitation,
                                type = req.type,
                                isCouple = req.isCouple,
                                gender = req.gender,
                                names = req.names,
                                photoUrl = req.photoUrl,
                                isPrimary = req.isPrimary
                        )
                    }
            )
        }

        extra.dressCode?.let { dressCode ->
            val womanDescription: String?
            val womanPhotoUrl: String?
            val manDescription: String?
            val manPhotoUrl: String?
            val dressCodeName: String?
            
            if (dressCode.type == "predefined") {
                val womanDressCode = dressCode.data.womanId?.let { 
                    masterDressCodeRepository.findById(it).orElse(null) 
                }
                val manDressCode = dressCode.data.manId?.let { 
                    masterDressCodeRepository.findById(it).orElse(null) 
                }
                
                womanDescription = womanDressCode?.womanDescription
                womanPhotoUrl = womanDressCode?.womanImage
                manDescription = manDressCode?.manDescription
                manPhotoUrl = manDressCode?.manImage
                dressCodeName = womanDressCode?.name ?: manDressCode?.name
            } else {
                womanDescription = dressCode.data.womanDescription
                womanPhotoUrl = dressCode.data.womanPhotoUrl
                manDescription = dressCode.data.manDescription
                manPhotoUrl = dressCode.data.manPhotoUrl
                dressCodeName = dressCode.data.name
            }
            
            dressCodeRepository.save(
                    InvitationDressCodeEntity(
                            invitation = invitation,
                            type = dressCode.type,
                            womanId = dressCode.data.womanId,
                            manId = dressCode.data.manId,
                            name = dressCodeName,
                            womanDescription = womanDescription,
                            womanPhotoUrl = womanPhotoUrl,
                            manDescription = manDescription,
                            manPhotoUrl = manPhotoUrl,
                            url = dressCode.data.url,
                            description = dressCode.data.description
                    )
            )
        }
    }


    fun getExtraModulesOrNull(invitation: InvitationEntity): InvitationExtraModulesResponseItem? {
        if (invitation.hasExtraModules) {
            val dressCode = if (
                    invitation.extraModulesIncluded.find { it == ExtraModuleType.DRESS_CODE } != null
            ) {
                dressCodeRepository.findAllByInvitationId(invitation.id).firstOrNull()
                        ?.toInvitationDressCodeResponseItem() ?: InvitationDressCodeResponseItem()
            } else {
                InvitationDressCodeResponseItem()
            }

            val recommendations = if (
                    invitation.extraModulesIncluded.find { it == ExtraModuleType.RECOMMENDATIONS } != null
            ) {
                recommendationRepository.findAllByInvitationId(invitation.id).map {
                    it.toInvitationRecommendationResponseItem()
                }
            } else {
                null
            }

            val ourStory = if (invitation.extraModulesIncluded.find { it == ExtraModuleType.OUR_STORY } != null) {
                storyRepository.findAllByInvitationId(invitation.id).map {
                    it.toInvitationStoryResponseItem()
                }
            } else {
                null
            }

            val amenitiesAndActivities = if (
                    invitation.extraModulesIncluded.find { it == ExtraModuleType.AMENITIES_AND_ACTIVITIES } != null
            ) {
                activityRepository.findAllByInvitationId(invitation.id).map {
                    it.toInvitationAmenityOrActivityResponseItem()
                }
            } else {
                null
            }

            val parentsAndGodparents = if (
                invitation.extraModulesIncluded.find { it == ExtraModuleType.PARENTS_AND_GODPARENTS } != null
            ) {
                getParentsAndGodParents(invitation.id)
            } else {
                null
            }

            return InvitationExtraModulesResponseItem(
                    dressCode = dressCode,
                    recommendations = recommendations,
                    ourStory = ourStory,
                    amenitiesAndActivities = amenitiesAndActivities,
                    parentsAndGodparents = parentsAndGodparents
            )
        }

        return null
    }


    fun getParentsAndGodParents(invitationId: Long): InvitationParentsAndGodparentsResponseItem {
        val parents = parentRepository.findAllByInvitationId(invitationId)
        val godparents = godparentRepository.findAllByInvitationId(invitationId)

        val intro = phraseRepository.findAllByInvitationId(invitationId)
                        .filter { it.gender.startsWith("family_intro_") }
                        .sortedBy {
                            it.gender.removePrefix("family_intro_").toIntOrNull() ?: Int.MAX_VALUE
                        }
                        .mapIndexed { index, phrase ->
                            InvitationParentsAndGodparentsIntroResponseItem(
                                    id = "intro-$index",
                                    content = phrase.text
                            )
                        }
                        
        val godparentsResponse = godparents.map {
            InvitationGodparentResponseItem(
                    type = it.type,
                    isCouple = it.isCouple,
                    gender = it.gender,
                    names = it.names,
                    photoUrl = it.photoUrl,
                    isPrimary = it.isPrimary
            )
        }

        val hasBrideParents = parents.any { it.type.startsWith("bride_") }
        val hasGroomParents = parents.any { it.type.startsWith("groom_") }
        
        return if (hasBrideParents || hasGroomParents) {
            val brideMother = parents.firstOrNull { it.type.lowercase() == "bride_mother" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            val brideFather = parents.firstOrNull { it.type.lowercase() == "bride_father" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            val groomMother = parents.firstOrNull { it.type.lowercase() == "groom_mother" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            val groomFather = parents.firstOrNull { it.type.lowercase() == "groom_father" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            
            InvitationParentsAndGodparentsResponseItem(
                    intro = intro,
                    parents = null,
                    brideParents = if (brideMother != null || brideFather != null) {
                        InvitationParentsResponseItem(mother = brideMother, father = brideFather)
                    } else null,
                    groomParents = if (groomMother != null || groomFather != null) {
                        InvitationParentsResponseItem(mother = groomMother, father = groomFather)
                    } else null,
                    godparents = godparentsResponse
            )
        } else {
            val mother = parents.firstOrNull { it.type.lowercase() == "mother" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            val father = parents.firstOrNull { it.type.lowercase() == "father" }?.let {
                InvitationParentResponseItem(name = it.name, photoUrl = it.photoUrl)
            }
            
            InvitationParentsAndGodparentsResponseItem(
                    intro = intro,
                    parents = InvitationParentsResponseItem(
                            mother = mother,
                            father = father
                    ),
                    brideParents = null,
                    groomParents = null,
                    godparents = godparentsResponse
            )
        }
    }
}
