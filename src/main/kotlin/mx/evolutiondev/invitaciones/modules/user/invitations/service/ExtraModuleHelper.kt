package mx.evolutiondev.invitaciones.modules.user.invitations.service

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.ExtraModulesRequest

object ExtraModuleHelper {

    fun resolveExtraModules(extra: ExtraModulesRequest?, template: InvitationTemplateEntity? = null): List<ExtraModuleType> {
        val isPremiumPlan = template?.invitationPlan?.isPremium == true
        
        if (isPremiumPlan) {
            return ExtraModuleType.values().toList()
        }
        
        return buildList { 
            if (extra?.dressCode != null) {
                add(ExtraModuleType.DRESS_CODE)
            }
            
            if (!extra?.recommendations.isNullOrEmpty()) add(ExtraModuleType.RECOMMENDATIONS)
            if (!extra?.ourStory.isNullOrEmpty()) add(ExtraModuleType.OUR_STORY)
            if (!extra?.amenitiesAndActivities.isNullOrEmpty()) add(ExtraModuleType.AMENITIES_AND_ACTIVITIES)
            if (extra?.parentsAndGodparents != null) add(ExtraModuleType.PARENTS_AND_GODPARENTS)
        }
    }
}