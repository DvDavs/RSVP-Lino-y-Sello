package mx.evolutiondev.invitaciones.modules.user.invitations.service

import java.time.LocalDate
import java.util.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.DefaultContentTemplateNotFoundException
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.DefaultVisualTemplateNotFoundException
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultContentConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.*
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultContentConfigRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultVisualConfigRepository
import org.springframework.stereotype.Service

@Service
class DefaultConfigGeneratorService(
    private val defaultVisualConfigRepository: DefaultVisualConfigRepository,
    private val defaultContentConfigRepository: DefaultContentConfigRepository,
    private val invitationRepository: InvitationRepository,
    private val invitationPersonRepository: InvitationPersonRepository,
    private val invitationPhraseRepository: InvitationPhraseRepository,
    private val invitationItineraryRepository: InvitationItineraryRepository,
    private val invitationGalleryRepository: InvitationGalleryRepository,
    private val invitationGiftRegistryRepository: InvitationGiftRegistryRepository,
    private val invitationMusicRepository: InvitationMusicRepository,
    private val invitationParentRepository: InvitationParentRepository,
    private val invitationGodparentRepository: InvitationGodparentRepository,
    private val invitationStoryRepository: InvitationStoryRepository,
    private val invitationDressCodeRepository: InvitationDressCodeRepository,
    private val invitationActivityRepository: InvitationActivityRepository,
    private val invitationRecommendationRepository: InvitationRecommendationRepository,
 
) {

    fun generateInitialConfig(invitationId: Long): InvitationConfig {

        val invitation =
            invitationRepository.findById(invitationId).orElseThrow {
                IllegalArgumentException("La invitación con ID $invitationId no existe")
            }

        val templateId = invitation.template.id
        val eventTypeId = invitation.template.eventType.id
        val planId = invitation.template.invitationPlan.id

        val visualTemplate =
            defaultVisualConfigRepository
                .findByTemplateId(templateId)
                .orElseThrow {
                    DefaultVisualTemplateNotFoundException(
                        "No se encontró plantilla visual para templateId: $templateId"
                    )
                }
                .config

 
        // val contentTemplate =
        //     defaultContentConfigRepository.findByTemplateId(templateId)
        //         .orElseGet {
        //             defaultContentConfigRepository.findByEventTypeIdAndPlanId(eventTypeId, planId)
        //                 .orElseThrow {
        //                     DefaultContentTemplateNotFoundException(
        //                         "No se encontró contenido por defecto para templateId: $templateId " +
        //                             "ni para eventTypeId: $eventTypeId y planId: $planId"
        //                     )
        //                 }
        //         }
        val contentTemplate =
                defaultContentConfigRepository.findByTemplateId(templateId)
                    .orElseGet {
                        defaultContentConfigRepository.findFirstByEventTypeIdAndPlanId(eventTypeId, planId)
                            .orElseThrow {
                                DefaultContentTemplateNotFoundException(
                                    "No se encontró contenido por defecto para templateId: $templateId " +
                                    "ni para eventTypeId: $eventTypeId y planId: $planId"
                                )
                            }
                    }        

        val mergedConfig = mergeConfiguration(invitation, visualTemplate, contentTemplate)

        return mergedConfig.copy(
            templateId = templateId,
            eventId = eventTypeId,
            planId = planId
        )
    }

    private fun mergeConfiguration(
        invitation: InvitationEntity,
        visualTemplate: InvitationConfig,
        contentTemplate: DefaultContentConfig
    ): InvitationConfig {

        val extraModules = invitation.extraModulesIncluded

        return visualTemplate.copy(
            invitationId = invitation.id,
            settings = mergeSettings(invitation, visualTemplate.settings, contentTemplate),
            sectionCover =
            mergeCoverSection(invitation, visualTemplate.sectionCover, contentTemplate)
                ?.copy(visibility = true),
            sectionCouple =
            mergeCoupleSection(
                invitation,
                visualTemplate.sectionCouple,
                contentTemplate
            )
                ?.copy(visibility = true),
            sectionGallery =
            mergeGallerySection(
                invitation,
                visualTemplate.sectionGallery,
                contentTemplate
            )
                ?.copy(visibility = true),
            sectionEvent =
            mergeEventSection(invitation, visualTemplate.sectionEvent, contentTemplate)
                ?.copy(visibility = true),
            sectionGiftTable =
            mergeGiftTableSection(
                invitation,
                visualTemplate.sectionGiftTable,
                contentTemplate
            )
                ?.copy(visibility = true),
            sectionStory =
            if (extraModules.contains(ExtraModuleType.OUR_STORY)) {
                mergeStorySection(
                    invitation,
                    visualTemplate.sectionStory,
                    contentTemplate
                )
                    ?.copy(visibility = true)
            } else null,
            sectionDressCode =
            if (extraModules.contains(ExtraModuleType.DRESS_CODE)) {
                mergeDressCodeSection(
                    invitation,
                    visualTemplate.sectionDressCode,
                    contentTemplate
                )
                    ?.copy(visibility = true)
            } else null,
            sectionFamily =
            if (extraModules.contains(ExtraModuleType.PARENTS_AND_GODPARENTS)) {
                mergeFamilySection(
                    invitation,
                    visualTemplate.sectionFamily,
                    contentTemplate
                )
                    ?.copy(visibility = true)
            } else null,
            sectionSuggestions =
            if (extraModules.contains(ExtraModuleType.RECOMMENDATIONS)) {
                mergeSuggestionsSection(
                    invitation,
                    visualTemplate.sectionSuggestions,
                    contentTemplate
                )
                    ?.copy(visibility = true)
            } else null,
            sectionAmenities =
            if (extraModules.contains(ExtraModuleType.AMENITIES_AND_ACTIVITIES)) {
                mergeAmenitiesSection(
                    invitation,
                    visualTemplate.sectionAmenities,
                    contentTemplate
                )
                    ?.copy(visibility = true)
            } else null,
            sectionStarted = mergeStartedSection(
                invitation,
                visualTemplate.sectionStarted,
                contentTemplate
            )?.copy(visibility = true),
            sectionFooter = visualTemplate.sectionFooter
        )
    }

    private fun mergeSettings(
        invitation: InvitationEntity,
        visualSettings: ModelSettings?,
        contentTemplate: DefaultContentConfig
    ): ModelSettings? {
        if (visualSettings == null) return null

        val musicUrl =
            if (invitation.hasMusic) {
                invitationMusicRepository
                    .findAllByInvitationId(invitation.id)
                    .firstOrNull()
                    ?.url
                    ?: contentTemplate.music.url ?: visualSettings.music
            } else {
                ""
            }

        return visualSettings.copy(
            name = invitation.hashtag.takeIf { it.isNotBlank() }
                ?: (contentTemplate.hashtags as? List<*>)?.firstOrNull()?.toString() ?: visualSettings.name,
            child_friendly = invitation.childrenAllowed,
            young_friendly = invitation.youngAllowed,
            music = musicUrl
        )
    }

    private fun mergeCoverSection(
        invitation: InvitationEntity,
        visualCover: SectionCoverProps?,
        contentTemplate: DefaultContentConfig
    ): SectionCoverProps? {
        if (visualCover == null) return null

        val people = invitationPersonRepository.findAllByInvitationId(invitation.id)
        val titleContent =
            if (people.isNotEmpty()) {
                people.joinToString(" & ") { it.name }
            } else {
                "Nuestra Celebración"
            }

        return visualCover.copy(
            subtitle = visualCover.subtitle?.copy(
                content = contentTemplate.texts?.get("coverSubtitle") ?: visualCover.subtitle?.content
            ),
            title = visualCover.title.copy(content = titleContent),
            date =
            visualCover.date.copy(
                day = invitation.date.takeIf { it.isNotBlank() }
                    ?: visualCover.date.day,
                hours = invitation.time.takeIf { it.isNotBlank() }
                    ?: visualCover.date.hours
            ),
            coverImage =
            visualCover.coverImage.copy(
                content = invitation.coverPhotoUrl.takeIf { it.isNotBlank() }
                    ?: contentTemplate.images.coverPhoto
            )
        )
    }

    private fun mergeCoupleSection(
        invitation: InvitationEntity,
        visualCouple: SectionCoupleData?,
        contentTemplate: DefaultContentConfig
    ): SectionCoupleData? {
        if (visualCouple == null) return null

        val eventTypeId = invitation.template.eventType.id
        val people = invitationPersonRepository.findAllByInvitationId(invitation.id)
        val phrases = invitationPhraseRepository.findAllByInvitationId(invitation.id)

        val isWedding = eventTypeId == 1L

        return if (!isWedding) {
            val celebratedPerson = people.firstOrNull()
            val personPhrase = phrases.firstOrNull {
                it.gender.equals("intro", ignoreCase = true) ||
                        it.gender.equals("celebrated", ignoreCase = true) ||
                        it.gender.equals("quinceañera", ignoreCase = true) ||
                        it.gender.equals("festejado", ignoreCase = true)
            }

            visualCouple.copy(
                heading = visualCouple.heading.copy(
                    content = contentTemplate.texts?.get("coupleHeading") ?: visualCouple.heading.content ?: "Save the date!"
                ),
                datetime =
                visualCouple.datetime.copy(
                    content =
                    "${invitation.date} ${invitation.time}".trim().takeIf {
                        it.isNotBlank()
                    }
                        ?: visualCouple.datetime.content
                ),
                namePersonEvent =
                visualCouple.namePersonEvent?.copy(
                    content = celebratedPerson?.name?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.celebrantName?.takeIf { it.isNotBlank() }
                        ?: visualCouple.namePersonEvent?.content?.takeIf { 
                            it != null && it.isNotBlank() && it != "Nuestra Quinceañera" 
                        }
                        ?: "Nuestra Quinceañera"
                ),
                photoPersonEvent =
                visualCouple.photoPersonEvent?.copy(
                    content = celebratedPerson?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.images.people.getOrNull(0)
                        ?: visualCouple.photoPersonEvent?.content
                ),
                message =
                when {
                    personPhrase != null -> {
                        val phraseText = personPhrase.text.takeIf { it.isNotBlank() } ?: ""
                        (visualCouple.message ?: createDefaultEditText("")).copy(
                            content = phraseText
                        )
                    }
                    visualCouple.message != null -> visualCouple.message
                    else -> null
                },
                imageTopBg = (visualCouple.imageTopBg ?: createDefaultEditImage(null)).copy(
                    content = contentTemplate.images.backgrounds?.get("topBg")?.takeIf { it.isNotBlank() }
                        ?: visualCouple.imageTopBg?.content
                ),
                imageBottomBg = (visualCouple.imageBottomBg ?: createDefaultEditImage(null)).copy(
                    content = contentTemplate.images.backgrounds?.get("bottomBg")?.takeIf { it.isNotBlank() }
                        ?: visualCouple.imageBottomBg?.content
                )
            )
        } else {
            val groom = people.firstOrNull { it.gender.equals("male", ignoreCase = true) }
            val bride = people.firstOrNull { it.gender.equals("female", ignoreCase = true) }

            val groomPhrase =
                phrases.firstOrNull {
                    it.gender.equals("male", ignoreCase = true) ||
                            it.gender.equals("hombre", ignoreCase = true)
                }
            val bridePhrase =
                phrases.firstOrNull {
                    it.gender.equals("female", ignoreCase = true) ||
                            it.gender.equals("mujer", ignoreCase = true)
                }
            val couplePhrase = phrases.firstOrNull { it.gender.equals("Pareja", ignoreCase = true) }

            val defaultGroomPhrases =
                contentTemplate.phrases["hombre"] ?: contentTemplate.phrases["male"] ?: emptyList()
            val defaultBridePhrases =
                contentTemplate.phrases["mujer"] ?: contentTemplate.phrases["female"] ?: emptyList()
            val defaultCouplePhrases =
                contentTemplate.phrases["Pareja"]
                    ?: contentTemplate.phrases["pareja"] ?: emptyList()

            visualCouple.copy(
                heading = visualCouple.heading.copy(
                    content = contentTemplate.texts?.get("coupleHeading") ?: visualCouple.heading.content ?: "Save the date!"
                ),
                datetime =
                visualCouple.datetime.copy(
                    content =
                    "${invitation.date} ${invitation.time}".trim().takeIf {
                        it.isNotBlank()
                    }
                        ?: visualCouple.datetime.content
                ),
                groomName =
                visualCouple.groomName?.copy(
                    content = groom?.name ?: visualCouple.groomName?.content ?: ""
                ),
                brideName =
                visualCouple.brideName?.copy(
                    content = bride?.name ?: visualCouple.brideName?.content ?: ""
                ),
                groomPhoto =
                visualCouple.groomPhoto?.copy(
                    content = groom?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.images.people.getOrNull(0)
                        ?: visualCouple.groomPhoto?.content
                ),
                bridePhoto =
                visualCouple.bridePhoto?.copy(
                    content = bride?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.images.people.getOrNull(1)
                        ?: visualCouple.bridePhoto?.content
                ),
                groomText =
                visualCouple.groomText?.copy(
                    content = groomPhrase?.text
                        ?: defaultGroomPhrases.firstOrNull()
                        ?: visualCouple.groomText?.content ?: ""
                ),
                brideText =
                visualCouple.brideText?.copy(
                    content = bridePhrase?.text
                        ?: defaultBridePhrases.firstOrNull()
                        ?: visualCouple.brideText?.content ?: ""
                ),
                message =
                when {
                    couplePhrase != null -> {
                        val phraseText = couplePhrase.text.takeIf { it.isNotBlank() } ?: ""
                        (visualCouple.message ?: createDefaultEditText("")).copy(
                            content = phraseText
                        )
                    }
                    defaultCouplePhrases.isNotEmpty() -> {
                        (visualCouple.message ?: createDefaultEditText("")).copy(
                            content = defaultCouplePhrases.first()
                        )
                    }
                    visualCouple.message != null -> visualCouple.message
                    else -> null
                },
                imageTopBg = (visualCouple.imageTopBg ?: createDefaultEditImage(null)).copy(
                    content = contentTemplate.images.backgrounds?.get("topBg")?.takeIf { it.isNotBlank() }
                        ?: visualCouple.imageTopBg?.content
                ),
                imageBottomBg = (visualCouple.imageBottomBg ?: createDefaultEditImage(null)).copy(
                    content = contentTemplate.images.backgrounds?.get("bottomBg")?.takeIf { it.isNotBlank() }
                        ?: visualCouple.imageBottomBg?.content
                )
            )
        }
    }

    private fun mergeGallerySection(
        invitation: InvitationEntity,
        visualGallery: SectionGalleryData?,
        contentTemplate: DefaultContentConfig
    ): SectionGalleryData? {
        if (visualGallery == null) return null

        val templateId   = invitation.template.id
        val eventTypeId  = invitation.template.eventType.id
        val planId       = invitation.template.invitationPlan.id

        val isGraduacion = templateId == 14L && eventTypeId == 7L && planId == 2L

        val userGallery =
            if (invitation.hasGallery) {
                invitationGalleryRepository.findAllByInvitationId(invitation.id).map {
                    it.photoUrl
                }
            } else {
                emptyList()
            }

        val galleryUrls = userGallery.ifEmpty { contentTemplate.images.gallery }

        val templateItem = visualGallery.items?.firstOrNull()

        val galleryItems =
            galleryUrls.mapIndexed { index, url ->
                // Generate incremental ID: gallery-1, gallery-2, gallery-3, etc.
                val itemId = "gallery-${index + 1}"
                ModelEditImage(
                    id = itemId,
                    content = url,
                    md = templateItem?.md ?: createDefaultImageProperties(),
                    sm = templateItem?.sm ?: createDefaultImageProperties(),
                    xs = templateItem?.xs ?: createDefaultImageProperties(),
                    // Solo agrega label cuando es template 14, event 7, plan 2
                    label = if (isGraduacion) {
                        templateItem?.label?.copy(content = "")
                            ?: createDefaultEditText("")
                    } else {
                        null
                    }
                )
            }

        val updatedHashtags =
            if (invitation.hashtag.isNotBlank() && visualGallery.hashtags != null) {
                val formattedHashtag =
                    if (invitation.hashtag.startsWith("#")) {
                        invitation.hashtag
                    } else {
                        "#${invitation.hashtag}"
                    }

                visualGallery.hashtags.map { hashtagItem ->
                    hashtagItem.copy(content = formattedHashtag)
                }
            } else {
                visualGallery.hashtags
            }

        return visualGallery.copy(
            title = visualGallery.title.copy(
                content = contentTemplate.texts?.get("galleryTitle") ?: visualGallery.title.content ?: "Galería"
            ),
            intro = visualGallery.intro.copy(
                content = contentTemplate.texts?.get("galleryIntro") ?: visualGallery.intro.content ?: ""
            ),
            items = galleryItems,
            hashtags = updatedHashtags
        )
    }

    private fun mergeEventSection(
        invitation: InvitationEntity,
        visualEvent: SectionEventData?,
        contentTemplate: DefaultContentConfig
    ): SectionEventData? {
        if (visualEvent == null) return null

        val userItinerary = invitationItineraryRepository.findAllByInvitationId(invitation.id)

        val styleSourceItem = visualEvent.items?.firstOrNull()
        val styleSourceSingle = visualEvent.itemsSinglePlace?.firstOrNull()

        fun createStyledText(content: String, sourceText: ModelEditText?): ModelEditText {
            val base = sourceText ?: createDefaultEditText(content)
            return base.copy(content = content)
        }

        fun createStyledIcon(
            iconName: String,
            sourceIcon: ModelEditIcon?,
            sourceText: ModelEditText?
        ): ModelEditIcon {
            val defaultIcon = createDefaultEditIcon(iconName)

            if (sourceIcon != null) {
                return sourceIcon.copy(content = iconName)
            }

            if (sourceText != null) {
                return defaultIcon.copy(
                    content = iconName,
                    md = defaultIcon.md.copy(color = sourceText.md.color),
                    sm = defaultIcon.sm.copy(color = sourceText.sm.color),
                    xs = defaultIcon.xs.copy(color = sourceText.xs.color)
                )
            }
            return defaultIcon
        }

        val (formattedDateDay, formattedDateMonthYear) = formatEventDate(invitation.date)

        val items =
            if (userItinerary.isNotEmpty()) {
                userItinerary.mapIndexed { index, item ->
                    val template = visualEvent.items?.getOrNull(index)
                    EventCard(
                        id = template?.id ?: UUID.randomUUID().toString(),
                        title =
                        createStyledText(
                            item.eventName,
                            template?.title
                                ?: styleSourceItem?.title
                                ?: styleSourceSingle?.title
                        ),
                        date =
                        EventDate(
                            icon =
                            createStyledIcon(
                                "fas fa-clock",
                                template?.date?.icon
                                    ?: styleSourceItem
                                        ?.date
                                        ?.icon,
                                styleSourceSingle?.time
                            ),
                            timeStart =
                            createStyledText(
                                item.startTime?.takeIf {
                                    it.isNotBlank()
                                }
                                    ?: template?.date?.timeStart
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: styleSourceItem
                                        ?.date?.timeStart
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: "4:30 PM",
                                template?.date?.timeStart
                                    ?: styleSourceItem
                                        ?.date
                                        ?.timeStart
                                    ?: styleSourceSingle
                                        ?.time
                            ),
                            timeEnd =
                            createStyledText(
                                item.endTime?.takeIf {
                                    it.isNotBlank()
                                }
                                    ?: template?.date?.timeEnd
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: styleSourceItem
                                        ?.date?.timeEnd
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: "5:30 PM",
                                template?.date?.timeEnd
                                    ?: styleSourceItem
                                        ?.date
                                        ?.timeEnd
                                    ?: styleSourceSingle
                                        ?.time
                            )
                        ),
                        time =
                        EventTime(
                            icon =
                            createStyledIcon(
                                "fas fa-calendar",
                                template?.time?.icon
                                    ?: styleSourceItem
                                        ?.time
                                        ?.icon,
                                styleSourceSingle?.date
                            ),
                            dateDay =
                            createStyledText(
                                formattedDateDay,
                                template?.time?.dateDay
                                    ?: styleSourceItem
                                        ?.time
                                        ?.dateDay
                                    ?: styleSourceSingle
                                        ?.date
                            ),
                            dateMonthYear =
                            createStyledText(
                                formattedDateMonthYear,
                                template?.time?.dateMonthYear
                                    ?: styleSourceItem
                                        ?.time
                                        ?.dateMonthYear
                                    ?: styleSourceSingle
                                        ?.date
                            )
                        ),
                        locationText =
                        createStyledText(
                            if (item.eventLocation.contains(
                                    "(Dale clic"
                                )
                            )
                                item.eventLocation
                            else
                                "${item.eventLocation}",
                            template?.locationText
                                ?: styleSourceItem?.locationText
                                ?: styleSourceSingle
                                    ?.locationText
                        )
                            .copy(url = item.eventMapsUrl ?: ""),
                        locationButton = (template?.locationButton),
                        locationDatetime = (template?.locationDatetime),
                    )
                }
            } else {
                contentTemplate.itinerary.mapIndexed { index, item ->
                    val template = visualEvent.items?.getOrNull(index)
                    EventCard(
                        id = template?.id ?: UUID.randomUUID().toString(),
                        title =
                        createStyledText(
                            item.eventName,
                            template?.title
                                ?: styleSourceItem?.title
                                ?: styleSourceSingle?.title
                        ),
                        date =
                        EventDate(
                            icon =
                            createStyledIcon(
                                "fas fa-clock",
                                template?.date?.icon
                                    ?: styleSourceItem
                                        ?.date
                                        ?.icon,
                                styleSourceSingle?.time
                            ),
                            timeStart =
                            createStyledText(
                                item.startTime?.takeIf {
                                    it.isNotBlank()
                                }
                                    ?: template?.date?.timeStart
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: styleSourceItem
                                        ?.date?.timeStart
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: "4:30 PM",
                                template?.date?.timeStart
                                    ?: styleSourceItem
                                        ?.date
                                        ?.timeStart
                                    ?: styleSourceSingle
                                        ?.time
                            ),
                            timeEnd =
                            createStyledText(
                                item.endTime?.takeIf {
                                    it.isNotBlank()
                                }
                                    ?: template?.date?.timeEnd
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: styleSourceItem
                                        ?.date?.timeEnd
                                        ?.content?.takeIf {
                                        it.isNotBlank()
                                    }
                                    ?: "5:30 PM",
                                template?.date?.timeEnd
                                    ?: styleSourceItem
                                        ?.date
                                        ?.timeEnd
                                    ?: styleSourceSingle
                                        ?.time
                            )
                        ),
                        time =
                        EventTime(
                            icon =
                            createStyledIcon(
                                "fas fa-calendar",
                                template?.time?.icon
                                    ?: styleSourceItem
                                        ?.time
                                        ?.icon,
                                styleSourceSingle?.date
                            ),
                            dateDay =
                            createStyledText(
                                formattedDateDay,
                                template?.time?.dateDay
                                    ?: styleSourceItem
                                        ?.time
                                        ?.dateDay
                                    ?: styleSourceSingle
                                        ?.date
                            ),
                            dateMonthYear =
                            createStyledText(
                                formattedDateMonthYear,
                                template?.time?.dateMonthYear
                                    ?: styleSourceItem
                                        ?.time
                                        ?.dateMonthYear
                                    ?: styleSourceSingle
                                        ?.date
                            )
                        ),
                        locationText =
                        createStyledText(
                            if (item.eventLocation.contains(
                                    "(Dale clic"
                                )
                            )
                                item.eventLocation
                            else
                                "${item.eventLocation}",
                            template?.locationText
                                ?: styleSourceItem?.locationText
                                ?: styleSourceSingle
                                    ?.locationText
                        )
                            .copy(url = item.eventMapsUrl ?: ""),
                        locationButton = (template?.locationButton),
                        locationDatetime = (template?.locationDatetime),
                    )
                }
            }

        return visualEvent.copy(
            title = visualEvent.title.copy(
                content = contentTemplate.texts?.get("itineraryTitle") ?: visualEvent.title.content ?: "Itinerario"
            ),
            singleplace = invitation.allEventsSameLocation,
            items = items
        )
    }

    private fun buildTimeRange(startTime: String, endTime: String): String {
        return when {
            startTime.isNotBlank() && endTime.isNotBlank() -> {
                "$startTime - $endTime"
            }
            startTime.isNotBlank() -> startTime
            else -> ""
        }
    }

    private fun formatEventDate(dateString: String): Pair<String, String> {
        return try {
            val date = LocalDate.parse(dateString)

            val daysOfWeek =
                mapOf(
                    "MONDAY" to "Lunes",
                    "TUESDAY" to "Martes",
                    "WEDNESDAY" to "Miércoles",
                    "THURSDAY" to "Jueves",
                    "FRIDAY" to "Viernes",
                    "SATURDAY" to "Sábado",
                    "SUNDAY" to "Domingo"
                )

            val months =
                mapOf(
                    1 to "Enero",
                    2 to "Febrero",
                    3 to "Marzo",
                    4 to "Abril",
                    5 to "Mayo",
                    6 to "Junio",
                    7 to "Julio",
                    8 to "Agosto",
                    9 to "Septiembre",
                    10 to "Octubre",
                    11 to "Noviembre",
                    12 to "Diciembre"
                )

            val dayOfWeek = daysOfWeek[date.dayOfWeek.toString()] ?: ""
            val dayOfMonth = date.dayOfMonth
            val month = months[date.monthValue] ?: ""
            val year = date.year

            val dateDay = "$dayOfWeek $dayOfMonth"
            val dateMonthYear = "$month, $year"

            Pair(dateDay, dateMonthYear)
        } catch (e: Exception) {
            Pair(dateString, "")
        }
    }

    // private fun mergeGiftTableSection(
    //     invitation: InvitationEntity,
    //     visualGiftTable: SectionGifttableData?,
    //     contentTemplate: DefaultContentConfig
    // ): SectionGifttableData? {
    //     if (visualGiftTable == null) return null

    //     val userGiftRegistry = invitationGiftRegistryRepository.findAllByInvitationId(invitation.id)

    //     val items =
    //         if (userGiftRegistry.isNotEmpty()) {
    //             userGiftRegistry.mapIndexed { index, item ->
    //                 val template = visualGiftTable.items.getOrNull(index)
    //                 val bodyTemplate = template?.body ?: emptyList()
    //                 val defaultBody = if (bodyTemplate.isEmpty()) {
    //                     listOf(createDefaultEditText(""))
    //                 } else {
    //                     bodyTemplate
    //                 }

    //                 // Determinar el icono según el tipo de gift registry
    //                 val iconType = when (item.type.lowercase()) {
    //                     "cash", "bank", "deposit" -> "copy"
    //                     "store", "link" -> "open"
    //                     else -> ""
    //                 }

    //                 val bodyList = if (item.message?.isNotBlank() == true) {
    //                     val firstBody = defaultBody.firstOrNull()?.copy(
    //                         id = "msj1",
    //                         content = item.message,
    //                         icon = iconType,
    //                         url = if (item.type.lowercase() == "store" || item.type.lowercase() == "link") {
    //                             item.giftRegistryUrl ?: ""
    //                         } else {
    //                             ""
    //                         }
    //                     ) ?: createDefaultEditText("").copy(
    //                         id = "msj1",
    //                         content = item.message,
    //                         icon = iconType,
    //                         url = if (item.type.lowercase() == "store" || item.type.lowercase() == "link") {
    //                             item.giftRegistryUrl ?: ""
    //                         } else {
    //                             ""
    //                         }
    //                     )
    //                     listOf(firstBody) + defaultBody.drop(1).mapIndexed { idx, bodyItem ->
    //                         bodyItem.copy(id = bodyItem.id ?: "msj${idx + 2}")
    //                     }
    //                 } else {
    //                     defaultBody.mapIndexed { idx, bodyItem ->
    //                         bodyItem.copy(id = bodyItem.id ?: "msj${idx + 1}")
    //                     }
    //                 }

    //                 GifttableItem(
    //                     id = template?.id ?: UUID.randomUUID().toString(),
    //                     type = template?.type,
    //                     image =
    //                     (template?.image ?: createDefaultEditImage("")).copy(
    //                         content = item.photo?.takeIf { it.isNotBlank() }
    //                             ?: ""
    //                     ),
    //                     title =
    //                     (template?.title ?: createDefaultEditText("")).copy(
    //                         content = item.title ?: item.name ?: item.type
    //                     ),
    //                     body = bodyList,
    //                     linkHref = item.giftRegistryUrl ?: template?.linkHref
    //                 )
    //             }
    //         } else {
    //             contentTemplate.giftRegistry.mapIndexed { index, item ->
    //                 val template = visualGiftTable.items.getOrNull(index)
    //                 val bodyTemplate = template?.body ?: emptyList()
    //                 val defaultBody = if (bodyTemplate.isEmpty()) {
    //                     listOf(createDefaultEditText(""))
    //                 } else {
    //                     bodyTemplate
    //                 }

    //                 // Determinar el icono según el tipo de gift registry
    //                 val iconType = when (item.type.lowercase()) {
    //                     "cash", "bank", "deposit" -> "copy"
    //                     "store", "link" -> "open"
    //                     else -> item.icon ?: ""
    //                 }

    //                 val bodyList = if (item.message.isNotEmpty() && item.message.any { it.isNotBlank() }) {
    //                     val messageBodies = item.message.mapIndexed { idx, msg ->
    //                         if (msg.isNotBlank()) {
    //                             val baseBody = defaultBody.getOrNull(idx)?.copy(
    //                                 id = "msj${idx + 1}",
    //                                 content = msg,
    //                                 icon = iconType
    //                             ) ?: createDefaultEditText("").copy(
    //                                 id = "msj${idx + 1}",
    //                                 content = msg,
    //                                 icon = iconType
    //                             )
                                
    //                             // Para store/link, asignar la URL al primer elemento del body
    //                             if (idx == 0 && (item.type.lowercase() == "store" || item.type.lowercase() == "link") && item.url != null) {
    //                                 baseBody.copy(url = item.url)
    //                             } else {
    //                                 baseBody.copy(url = "")
    //                             }
    //                         } else null
    //                     }.filterNotNull()

    //                     val remainingBodies = if (defaultBody.size > item.message.size) {
    //                         defaultBody.drop(item.message.size).mapIndexed { idx, bodyItem ->
    //                             bodyItem.copy(id = bodyItem.id ?: "msj${item.message.size + idx + 1}")
    //                         }
    //                     } else emptyList()

    //                     messageBodies + remainingBodies
    //                 } else {
    //                     defaultBody.mapIndexed { idx, bodyItem ->
    //                         bodyItem.copy(id = bodyItem.id ?: "msj${idx + 1}")
    //                     }
    //                 }

    //                 GifttableItem(
    //                     id = template?.id ?: UUID.randomUUID().toString(),
    //                     type = template?.type,
    //                     image =
    //                     (template?.image ?: createDefaultEditImage("")).copy(
    //                         content = item.photo ?: ""
    //                     ),
    //                     title =
    //                     (template?.title ?: createDefaultEditText("")).copy(
    //                         content = item.name ?: item.type
    //                     ),
    //                     body = bodyList,
    //                     linkHref = item.url ?: template?.linkHref
    //                 )
    //             }
    //         }

    //     return visualGiftTable.copy(
    //         title = visualGiftTable.title.copy(
    //             content = contentTemplate.texts?.get("giftTableTitle") ?: visualGiftTable.title.content ?: "Mesa de Regalos"
    //         ),
    //         items = items
    //     )
    // }


private fun mergeGiftTableSection(
    invitation: InvitationEntity,
    visualGiftTable: SectionGifttableData?,
    contentTemplate: DefaultContentConfig
): SectionGifttableData? {

    if (visualGiftTable == null) return null

    val userGiftRegistry =
        invitationGiftRegistryRepository.findAllByInvitationId(invitation.id)

    fun normalizeGiftType(rawType: String?): String {
        val normalized = rawType?.lowercase()?.trim().orEmpty()
        return when (normalized) {
            "bankaccount", "cuenta", "bank" -> "bank"
            "fisico", "physical" -> "fisico"
            "digital" -> "digital"
            else -> normalized
        }
    }

    fun inferTemplateType(template: GifttableItem): String {
        val explicitType = normalizeGiftType(template.type)
        if (explicitType.isNotBlank()) return explicitType

        val bodyContent =
            template.body.joinToString(" ") { it.content?.lowercase()?.trim().orEmpty() }
        val hasLink =
            template.linkHref != null || template.body.any { !it.url.isNullOrBlank() }
        val hasBankHints =
            listOf("banco", "titular", "clabe", "tarjeta", "cuenta").any {
                bodyContent.contains(it)
            }
        val hasPhysicalHints =
            listOf("lluvia", "sobre", "obsequio", "regalo").any {
                bodyContent.contains(it)
            }

        return when {
            hasBankHints -> "bank"
            hasLink -> "digital"
            hasPhysicalHints -> "fisico"
            else -> ""
        }
    }

    fun usesSplitBankLayout(template: GifttableItem?): Boolean {
        return (template?.body?.size ?: 0) >= 6
    }

    fun resolveTemplate(itemType: String, index: Int): GifttableItem? {
        val matchedTemplate = visualGiftTable.items.firstOrNull {
            val templateType = inferTemplateType(it)
            templateType == itemType || (itemType == "fisico" && templateType == "otro")
        }

        if (matchedTemplate != null) {
            return matchedTemplate
        }

        if (itemType == "fisico") {
            val digitalTemplate = visualGiftTable.items.firstOrNull {
                inferTemplateType(it) == "digital"
            }

            if (digitalTemplate != null) {
                return digitalTemplate
            }
        }

        return visualGiftTable.items.getOrNull(index)
    }

    val items = userGiftRegistry.mapIndexed { index, item ->

        val type = normalizeGiftType(item.type)
        val template = resolveTemplate(type, index)

        fun bodyFromTemplate(
            bodyIndex: Int,
            content: String,
            icon: String? = null,
            url: String? = "",
            id: String = "msj${bodyIndex + 1}"
        ): ModelEditText {
            val base =
                template?.body?.getOrNull(bodyIndex)
                    ?: template?.body?.firstOrNull()
                    ?: createDefaultEditText("")

            return base.copy(
                id = id,
                icon = icon,
                content = content,
                url = url
            )
        }

        // =========================
        // IMAGE
        // =========================
        val imageContent =
            if (item.photo == "otro") "" else item.photo ?: ""

        // =========================
        // TITLE
        // =========================
        val titleContent = when (type) {

            "digital" -> {
                val name = if (item.name == "otro") {
                    item.customName ?: "MESA DIGITAL" // ⚠️ aquí no tienes customName en backend
                } else {
                    item.name ?: "MESA DIGITAL"
                }
                item.name ?: "Mesa de $name"
            }

            "bank" -> item.name ?: "DEPÓSITO O TRANSFERENCIA"

            "fisico" -> item.name ?: "LLUVIA DE SOBRES"

            else -> item.name ?: ""
        }

        // =========================
        // BODY
        // =========================
        val bodyList = when (type) {

            // -------------------------
            // DIGITAL
            // -------------------------
            "digital" -> {
                val isOtro = item.name == "otro"

                if (isOtro) {
                    listOf(
                        bodyFromTemplate(
                            bodyIndex = 0,
                            content = item.urlText ?: "",
                            icon = null,
                            url = item.giftRegistryUrl ?: "",
                            id = "msj1"
                        ),
                        bodyFromTemplate(
                            bodyIndex = 1,
                            content = item.message ?: "",
                            icon = null,
                            url = "",
                            id = "msj2"
                        )
                    )
                } else {
                    listOf(
                        bodyFromTemplate(
                            bodyIndex = 0,
                            content = item.message ?: "",
                            icon = null,
                            url = "",
                            id = "msj1"
                        ),
                        bodyFromTemplate(
                            bodyIndex = 1,
                            content = item.urlText ?: "",
                            icon = "fa-solid fa-link",
                            url = item.giftRegistryUrl ?: "",
                            id = "msj2"
                        )
                    )
                }
            }

            // -------------------------
            // BANK / CUENTA
            // -------------------------
            "bank" -> {
                if (usesSplitBankLayout(template)) {
                    listOf(
                        bodyFromTemplate(bodyIndex = 0, id = "msj1", content = item.message ?: "", icon = null, url = ""),
                        bodyFromTemplate(bodyIndex = 1, id = "msj2", content = "Banco:", icon = null, url = ""),
                        bodyFromTemplate(bodyIndex = 2, id = "msj3", content = item.bank ?: "", icon = "fas fa-copy", url = ""),

                        bodyFromTemplate(bodyIndex = 3, id = "msj4", content = "Titular:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 4,
                            id = "msj5",
                            content = item.accountHolder ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        ),

                        bodyFromTemplate(bodyIndex = 5, id = "msj6", content = "Cuenta CLABE:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 6,
                            id = "msj7",
                            content = item.accountNumber ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        ),

                        bodyFromTemplate(bodyIndex = 7, id = "msj8", content = "Número de tarjeta:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 8,
                            id = "msj9",
                            content = item.accountNumber ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        )
                    )
                } else {
                    listOf(
                        bodyFromTemplate(bodyIndex = 0, id = "msj1", content = item.message ?: "", icon = null, url = ""),
                        bodyFromTemplate(bodyIndex = 1, id = "msj2", content = "Banco:", icon = null, url = ""),
                        bodyFromTemplate(bodyIndex = 2, id = "msj3", content = item.bank ?: "", icon = "fas fa-copy", url = ""),

                        bodyFromTemplate(bodyIndex = 3, id = "msj4", content = "Titular:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 4,
                            id = "msj5",
                            content = item.accountHolder ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        ),

                        bodyFromTemplate(bodyIndex = 5, id = "msj6", content = "Cuenta CLABE:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 6,
                            id = "msj7",
                            content = item.accountNumber ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        ),

                        bodyFromTemplate(bodyIndex = 7, id = "msj8", content = "Número de tarjeta:", icon = null, url = ""),
                        bodyFromTemplate(
                            bodyIndex = 8,
                            id = "msj9",
                            content = item.accountNumber ?: "",
                            icon = "fas fa-copy",
                            url = ""
                        )
                        // bodyFromTemplate(
                        //     bodyIndex = 0,
                        //     id = "msj1",
                        //     content = "Banco: ${item.bank ?: ""}",
                        //     icon = null,
                        //     url = ""
                        // ),
                        // bodyFromTemplate(
                        //     bodyIndex = 1,
                        //     id = "msj2",
                        //     content = "Titular: ${item.accountHolder ?: ""}",
                        //     icon = null,
                        //     url = ""
                        // ),
                        // bodyFromTemplate(
                        //     bodyIndex = 2,
                        //     id = "msj3",
                        //     content = "Cuenta: ${item.accountNumber ?: ""}",
                        //     icon = null,
                        //     url = ""
                        // ),
                        // bodyFromTemplate(
                        //     bodyIndex = 3,
                        //     id = "msj4",
                        //     content = "Número de tarjeta: ${item.message ?: ""}",
                        //     icon = null,
                        //     url = ""
                        // )
                    )
                }
            }

            // -------------------------
            // FISICO
            // -------------------------
            "fisico" -> {
                listOf(
                    bodyFromTemplate(
                        bodyIndex = 0,
                        id = "msj1",
                        content = item.message ?: "",
                        icon = "fa-solid fa-gift",
                        url = ""
                    )
                )
            }

            else -> emptyList()
        }

        GifttableItem(
            id = template?.id ?: UUID.randomUUID().toString(),

            type = type,

            image = (template?.image ?: createDefaultEditImage("")).copy(
                content = imageContent
            ),

            title = (template?.title ?: createDefaultEditText("")).copy(
                content = titleContent
            ),

            body = bodyList,

            // ❌ eliminado completamente
            linkHref = null
        )
    }

    return visualGiftTable.copy(
        title = visualGiftTable.title.copy(
            content = contentTemplate.texts?.get("giftTableTitle")
                ?: "Mesa de Regalos"
        ),
        items = items
    )
}

   

// private fun mergeFamilySection(
//     invitation: InvitationEntity,
//     visualFamily: SectionFamilyData?,
//     contentTemplate: DefaultContentConfig
// ): SectionFamilyData? {
//     if (visualFamily == null) return null

//     val templateId = invitation.template.id
//     val userParents = invitationParentRepository.findAllByInvitationId(invitation.id)
//     val userGodparents = invitationGodparentRepository.findAllByInvitationId(invitation.id)
//     val phrases = invitationPhraseRepository.findAllByInvitationId(invitation.id)
    
//     val eventTypeId = invitation.template.eventType.id
//     val isWedding = eventTypeId == 1L

//     val introPhrase = phrases.firstOrNull { it.gender.equals("intro", ignoreCase = true) }
//     val introText = introPhrase?.text?.takeIf { it.isNotBlank() }
//         ?: contentTemplate.phrases?.get("intro")?.firstOrNull()
//         ?: contentTemplate.texts?.get("familyIntro")

//     val populatedIntro = if (introText != null && visualFamily.intro != null && visualFamily.intro.isNotEmpty()) {
//         visualFamily.intro.mapIndexed { index, introTemplate ->
//             if (index == 0) introTemplate.copy(content = introText) else introTemplate
//         }
//     } else {
//         visualFamily.intro
//     }

//     // Helper para obtener el template de un sub-item
//     fun getSubItemTemplate(groupIndex: Int, itemIndex: Int): FamilyItem? =
//         visualFamily.items.getOrNull(groupIndex)?.items?.getOrNull(itemIndex)
//             ?: visualFamily.items.getOrNull(groupIndex)?.items?.firstOrNull()

//     fun getGroupTemplate(index: Int): FamilyItem? = visualFamily.items.getOrNull(index)

//     // Sin usuarios: usar contenido por defecto
//     if (userParents.isEmpty() && userGodparents.isEmpty()) {
//         val defaultBrideParents = contentTemplate.parents?.bride
//         val defaultGroomParents = contentTemplate.parents?.groom

//         val groomGroup = getGroupTemplate(0)
//         val brideGroup = getGroupTemplate(1)

//         val populatedItems = listOfNotNull(
//             // Grupo 0: Padres del novio
//             groomGroup?.copy(
//                 id = UUID.randomUUID().toString(),
//                 title = groomGroup.title?.copy(
//                     content = if (templateId == 11L) "PADRES DEL NOVIO" else "Padres del novio"
//                 ),
//                 items = listOf(
//                     (getSubItemTemplate(0, 0) ?: createDefaultFamilyItem()).copy(
//                         id = UUID.randomUUID().toString(),
//                         label = getSubItemTemplate(0, 0)?.label?.copy(content = "Padre"),
//                         text = getSubItemTemplate(0, 0)?.text?.copy(
//                             content = defaultGroomParents?.names ?: "Nombre del padre"
//                         ),
//                         image = (getSubItemTemplate(0, 0)?.image ?: createDefaultEditImage(null))
//                             .copy(content = contentTemplate.images.parents?.get("father") ?: "")
//                     ),
//                     (getSubItemTemplate(0, 1) ?: createDefaultFamilyItem()).copy(
//                         id = UUID.randomUUID().toString(),
//                         label = getSubItemTemplate(0, 1)?.label?.copy(content = "Madre"),
//                         text = getSubItemTemplate(0, 1)?.text?.copy(
//                             content = defaultGroomParents?.names ?: "Nombre de la madre"
//                         ),
//                         image = (getSubItemTemplate(0, 1)?.image ?: createDefaultEditImage(null))
//                             .copy(content = contentTemplate.images.parents?.get("mother") ?: "")
//                     )
//                 )
//             ),
//             // Grupo 1: Padres de la novia
//             brideGroup?.copy(
//                 id = UUID.randomUUID().toString(),
//                 title = brideGroup.title?.copy(
//                     content = if (templateId == 11L) "PADRES DE LA NOVIA" else "Padres de la novia"
//                 ),
//                 items = listOf(
//                     (getSubItemTemplate(1, 0) ?: createDefaultFamilyItem()).copy(
//                         id = UUID.randomUUID().toString(),
//                         label = getSubItemTemplate(1, 0)?.label?.copy(content = "Padre"),
//                         text = getSubItemTemplate(1, 0)?.text?.copy(
//                             content = defaultBrideParents?.names ?: "Nombre del padre"
//                         ),
//                         image = (getSubItemTemplate(1, 0)?.image ?: createDefaultEditImage(null))
//                             .copy(content = contentTemplate.images.parents?.get("father") ?: "")
//                     ),
//                     (getSubItemTemplate(1, 1) ?: createDefaultFamilyItem()).copy(
//                         id = UUID.randomUUID().toString(),
//                         label = getSubItemTemplate(1, 1)?.label?.copy(content = "Madre"),
//                         text = getSubItemTemplate(1, 1)?.text?.copy(
//                             content = defaultBrideParents?.names ?: "Nombre de la madre"
//                         ),
//                         image = (getSubItemTemplate(1, 1)?.image ?: createDefaultEditImage(null))
//                             .copy(content = contentTemplate.images.parents?.get("mother") ?: "")
//                     )
//                 )
//             )
//         )

//         return visualFamily.copy(visibility = true, intro = populatedIntro, items = populatedItems)
//     }

//     // Con usuarios: estructura anidada por grupos
//     val people = invitationPersonRepository.findAllByInvitationId(invitation.id)

//     val groomMother = userParents.firstOrNull { it.type == "groom_mother" }
//     val groomFather = userParents.firstOrNull { it.type == "groom_father" }
//     val brideMother = userParents.firstOrNull { it.type == "bride_mother" }
//     val brideFather = userParents.firstOrNull { it.type == "bride_father" }

//     val familyGroups = mutableListOf<FamilyItem>()

//     // Grupo 0: Padres del novio
//     val groomParents = listOfNotNull(groomFather, groomMother)
//     if (groomParents.isNotEmpty()) {
//         val groomGroupTemplate = getGroupTemplate(0)
//         val groomSubItems = groomParents.mapIndexed { index, parent ->
//             val subTemplate = getSubItemTemplate(0, index)
//             val photo = parent.photoUrl?.takeIf { it.isNotBlank() }
//                 ?: when (parent.type) {
//                     "groom_father" -> contentTemplate.images.parents?.get("father")
//                     "groom_mother" -> contentTemplate.images.parents?.get("mother")
//                     else -> null
//                 }
//                 ?: contentTemplate.parents?.groom?.image?.takeIf { it.isNotBlank() }
//                 ?: ""
//             val labelText = when (parent.type) {
//                 "groom_father" -> "Padre"
//                 "groom_mother" -> "Madre"
//                 else -> parent.type.replaceFirstChar { it.uppercase() }
//             }
//             (subTemplate ?: createDefaultFamilyItem()).copy(
//                 id = UUID.randomUUID().toString(),
//                 label = (subTemplate?.label ?: createDefaultEditText("")).copy(content = labelText),
//                 text = (subTemplate?.text ?: createDefaultEditText("")).copy(content = parent.name),
//                 image = (subTemplate?.image ?: createDefaultEditImage(null)).copy(content = photo)
//             )
//         }
//         familyGroups.add(
//             (groomGroupTemplate ?: createDefaultFamilyGroup()).copy(
//                 id = UUID.randomUUID().toString(),
//                 title = groomGroupTemplate?.title?.copy(
//                     content = if (templateId == 11L) "PADRES DEL NOVIO" else "Padres del novio"
//                 ),
//                 items = groomSubItems
//             )
//         )
//     }

//     // Grupo 1: Padres de la novia
//     val brideParents = listOfNotNull(brideFather, brideMother)
//     if (brideParents.isNotEmpty()) {
//         val brideGroupTemplate = getGroupTemplate(1)
//         val brideSubItems = brideParents.mapIndexed { index, parent ->
//             val subTemplate = getSubItemTemplate(1, index)
//             val photo = parent.photoUrl?.takeIf { it.isNotBlank() }
//                 ?: when (parent.type) {
//                     "bride_father" -> contentTemplate.images.parents?.get("father")
//                     "bride_mother" -> contentTemplate.images.parents?.get("mother")
//                     else -> null
//                 }
//                 ?: contentTemplate.parents?.bride?.image?.takeIf { it.isNotBlank() }
//                 ?: ""
//             val labelText = when (parent.type) {
//                 "bride_father" -> "Padre"
//                 "bride_mother" -> "Madre"
//                 else -> parent.type.replaceFirstChar { it.uppercase() }
//             }
//             (subTemplate ?: createDefaultFamilyItem()).copy(
//                 id = UUID.randomUUID().toString(),
//                 label = (subTemplate?.label ?: createDefaultEditText("")).copy(content = labelText),
//                 text = (subTemplate?.text ?: createDefaultEditText("")).copy(content = parent.name),
//                 image = (subTemplate?.image ?: createDefaultEditImage(null)).copy(content = photo)
//             )
//         }
//         familyGroups.add(
//             (brideGroupTemplate ?: createDefaultFamilyGroup()).copy(
//                 id = UUID.randomUUID().toString(),
//                 title = brideGroupTemplate?.title?.copy(
//                     content = if (templateId == 11L) "PADRES DE LA NOVIA" else "Padres de la novia"
//                 ),
//                 items = brideSubItems
//             )
//         )
//     }

//     //OTROS EVENTOS
//     if (!isWedding) {
//     val parentsGroupTemplate = visualFamily.items.getOrNull(0)

//     val parentItems = userParents.mapIndexed { index, parent ->
//         val subTemplate = parentsGroupTemplate?.items?.getOrNull(index)
//             ?: parentsGroupTemplate?.items?.firstOrNull()

//         val photo = parent.photoUrl?.takeIf { it.isNotBlank() }
//             ?: when (parent.type.lowercase()) {
//                 "mother" -> contentTemplate.images.parents?.get("mother")
//                 "father" -> contentTemplate.images.parents?.get("father")
//                 else -> contentTemplate.images.parents?.get("mother")
//             }
//             ?: ""

//         val labelText = when (parent.type.lowercase()) {
//             "mother" -> "Madre"
//             "father" -> "Padre"
//             else -> parent.type.replaceFirstChar { it.uppercase() }
//         }

//         (subTemplate ?: createDefaultFamilyItem()).copy(
//             id = "p-$index",
//             label = (subTemplate?.label ?: createDefaultEditText("")).copy(content = labelText),
//             text = (subTemplate?.text ?: createDefaultEditText("")).copy(content = parent.name),
//             image = (subTemplate?.image ?: createDefaultEditImage(null)).copy(content = photo)
//         )
//     }

//     if (parentItems.isNotEmpty()) {
//         familyGroups.add(
//             (parentsGroupTemplate ?: createDefaultFamilyGroup()).copy(
//                 id = "parents-group",
//                 title = (parentsGroupTemplate?.title ?: createDefaultEditText("")).copy(
//                     content = contentTemplate.parents?.parents?.label ?: "Mis Padres"
//                 ),
//                 items = parentItems
//             )
//         )
//     }
// }

//     // Grupos de padrinos
//     val godparentItemsList = mutableListOf<FamilyItem>()

//     //val godparentGroupTemplates = visualFamily.items.drop(2)
//     val godparentGroupTemplates = if (isWedding) {
//         visualFamily.items.drop(2)
//     } else {
//         visualFamily.items.drop(1)
//     }
//     userGodparents.forEachIndexed { index, godparent ->
//         val groupTemplate = godparentGroupTemplates.getOrNull(index) ?: godparentGroupTemplates.firstOrNull()

//         val godparentPhoto = godparent.photoUrl?.takeIf { it.isNotBlank() }
//             ?: contentTemplate.images.godparents?.getOrNull(index)
//             ?: contentTemplate.images.godparents?.firstOrNull()
//             ?: ""

//         val subTemplate = groupTemplate?.items?.firstOrNull()

//         // ✅ 1. Title dinámico según género
//         val titleText = when (godparent.gender.lowercase()) {
//             "masculino" -> "Padrino de ${godparent.type}"
//             "femenino" -> "Madrina de ${godparent.type}"
//             "pareja" -> "Padrinos de ${godparent.type}"
//             else -> godparent.type
//         }
 


//         // ✅ 2. Construcción de items
//         val itemsList = if (godparent.gender.lowercase() == "pareja") {
//             val names = godparent.names.split("|").map { it.trim() }.filter { it.isNotEmpty() }

//             names.mapIndexed { subIndex, name ->
//                 (subTemplate ?: createDefaultFamilyItem()).copy(
//                     id = "f${2 + index}_$subIndex",
//                     label = (subTemplate?.label ?: createDefaultEditText("")).copy(
//                         content = "Padrino/a de ${godparent.type}"
//                     ),
//                     text = (subTemplate?.text ?: createDefaultEditText("")).copy(
//                         content = name
//                     ),
//                     image = (subTemplate?.image ?: createDefaultEditImage(null)).copy(
//                         content = godparentPhoto
//                     )
//                 )
//             }
//         } else {
//             val labelText = when (godparent.gender.lowercase()) {
//                 "masculino" -> "Padrino de ${godparent.type}"
//                 "femenino" -> "Madrina de ${godparent.type}"
//                 else -> godparent.type
//             }

//             listOf(
//                 (subTemplate ?: createDefaultFamilyItem()).copy(
//                     id = "f${2 + index}",
//                     label = (subTemplate?.label ?: createDefaultEditText("")).copy(
//                         content = labelText
//                     ),
//                     text = (subTemplate?.text ?: createDefaultEditText("")).copy(
//                         content = godparent.names
//                     ),
//                     image = (subTemplate?.image ?: createDefaultEditImage(null)).copy(
//                         content = godparentPhoto
//                     )
//                 )
//             )
//         }

//         if (isWedding) {
//                 familyGroups.add(
//                     (groupTemplate ?: createDefaultFamilyGroup()).copy(
//                         id = "gp-group-$index",
//                         title = groupTemplate?.title?.copy(content = titleText),
//                         items = itemsList
//                     )
//                 )
//         } else {
//              godparentItemsList.addAll(itemsList)
//         }

//     }


//     if (!isWedding) {
//     val groupTemplate = visualFamily.items.getOrNull(1)

//     familyGroups.add(
//         (groupTemplate ?: createDefaultFamilyGroup()).copy(
//             id = "godparents-group",
//             title = (groupTemplate?.title ?: createDefaultEditText("")).copy(
//                 content = contentTemplate.parents?.godparents?.label ?: "Mis Padrinos"
//             ),
//             items = godparentItemsList
//         )
//     )
// }

//     val sectionTitle = visualFamily.title?.copy(
//         content = visualFamily.title?.content ?: "Mi familia"
//     ) ?: createDefaultEditText("Mi familia")

//     return visualFamily.copy( title = sectionTitle, intro = populatedIntro, items = familyGroups)
// }


    private fun mergeFamilySection(
            invitation: InvitationEntity,
            visualFamily: SectionFamilyData?,
            contentTemplate: DefaultContentConfig
    ): SectionFamilyData? {
        if (visualFamily == null) return null

        val eventTypeId = invitation.template.eventType.id
        val userParents = invitationParentRepository.findAllByInvitationId(invitation.id)
        val userGodparents = invitationGodparentRepository.findAllByInvitationId(invitation.id)
        val familyIntro =
                invitationPhraseRepository.findAllByInvitationId(invitation.id)
                        .filter { it.gender.startsWith("family_intro_") }
                        .sortedBy {
                            it.gender.removePrefix("family_intro_").toIntOrNull() ?: Int.MAX_VALUE
                        }
                        .mapIndexed { index, phrase ->
                            val templateIntro =
                                    visualFamily.intro?.getOrNull(index)
                                            ?: visualFamily.intro?.firstOrNull()
                                            ?: createDefaultEditText("")
                            templateIntro.copy(
                                    id = templateIntro.id ?: "intro-$index",
                                    content = phrase.text
                            )
                        }
        //val mergedIntro = if (familyIntro.isNotEmpty()) familyIntro else visualFamily.intro
        val mergedIntro = if (familyIntro.isNotEmpty()) {
            familyIntro
        } else {
            // Aunque no haya frases family_intro_* en Postgres, garantizamos que cada
            // elemento tenga un id (igual que hace el camino "feliz" arriba).
            visualFamily.intro?.mapIndexed { index, introItem ->
                introItem.copy(id = introItem.id ?: "intro-$index")
            }
        }

        if (userParents.isEmpty() && userGodparents.isEmpty()) {
                return visualFamily.copy(visibility = true, intro = mergedIntro)
        }

        val isWedding = eventTypeId == 1L

        return if (!isWedding) {
            val populatedGroups = visualFamily.items.map { groupTemplate ->
                when {
                    groupTemplate.title?.content?.contains("Padre", ignoreCase = true) == true && userParents.isNotEmpty() -> {
                        val parentItems = userParents.mapIndexed { index, parent ->
                            val itemTemplate = groupTemplate.items?.getOrNull(index) ?: groupTemplate.items?.firstOrNull()
                            val parentPhoto = parent.photoUrl?.takeIf { it.isNotBlank() }
                                    ?: contentTemplate.parents?.parents?.image?.takeIf { it.isNotBlank() }
                                    ?: contentTemplate.images.parents?.get("mother") as? String
                                    ?: contentTemplate.images.parents?.get("father") as? String
                                    ?: ""
                            FamilyItem(
                                id = itemTemplate?.id ?: "p-$index",
                                showImage = true,
                                image = (itemTemplate?.image ?: createDefaultEditImage(null)).copy(content = parentPhoto),
                                label = (itemTemplate?.label ?: createDefaultEditText("")).copy(content = parent.type.replaceFirstChar { it.uppercase() }),
                                text = (itemTemplate?.text ?: createDefaultEditText("")).copy(content = parent.name)
                            )
                        }
                        groupTemplate.copy(items = parentItems)
                    }
                    groupTemplate.title?.content?.contains("Padrino", ignoreCase = true) == true && userGodparents.isNotEmpty() -> {
                        val godparentItems = userGodparents.mapIndexed { index, godparent ->
                            val itemTemplate = groupTemplate.items?.getOrNull(index) ?: groupTemplate.items?.firstOrNull()
                            val godparentPhoto = godparent.photoUrl?.takeIf { it.isNotBlank() }
                                    ?: contentTemplate.parents?.godparents?.image?.takeIf { it.isNotBlank() }
                                    ?: contentTemplate.images.godparents?.getOrNull(index)
                                    ?: contentTemplate.images.godparents?.firstOrNull()
                                    ?: ""
                            FamilyItem(
                                id = itemTemplate?.id ?: "gp-$index",
                                showImage = true,
                                image = (itemTemplate?.image ?: createDefaultEditImage(null)).copy(content = godparentPhoto),
                                label = (itemTemplate?.label ?: createDefaultEditText("")).copy(content = godparent.type),
                                text = (itemTemplate?.text ?: createDefaultEditText("")).copy(content = godparent.names)
                            )
                        }
                        groupTemplate.copy(items = godparentItems)
                    }
                    else -> groupTemplate
                }
            }
                        visualFamily.copy(items = populatedGroups, intro = mergedIntro)
        } else {
            val people = invitationPersonRepository.findAllByInvitationId(invitation.id)
            val groom = people.firstOrNull { it.gender.equals("male", ignoreCase = true) }
            val bride = people.firstOrNull { it.gender.equals("female", ignoreCase = true) }

            val groomMother = userParents.firstOrNull { it.type == "groom_mother" }
            val groomFather = userParents.firstOrNull { it.type == "groom_father" }
            val brideMother = userParents.firstOrNull { it.type == "bride_mother" }
            val brideFather = userParents.firstOrNull { it.type == "bride_father" }

            val groomParentsNames =
                    listOfNotNull(groomMother?.name, groomFather?.name)
                            .filter { it.isNotBlank() }
                            .joinToString(" & ")

            val brideParentsNames =
                    listOfNotNull(brideMother?.name, brideFather?.name)
                            .filter { it.isNotBlank() }
                            .joinToString(" & ")

            val familyItems = mutableListOf<FamilyItem>()

            if (visualFamily.items.size > 0 && groomParentsNames.isNotBlank()) {
                val templateItem = visualFamily.items[0]
                val groomName = groom?.name ?: "la pareja"
                val groomParentPhoto = (groomMother?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: groomFather?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.parents?.groom?.image?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.images.parents?.get("groom_mother") as? String
                        ?: contentTemplate.images.parents?.get("groom_father") as? String
                        ?: contentTemplate.images.parents?.get("mother") as? String
                        ?: contentTemplate.images.parents?.get("father") as? String
                        ?: "")
                val image = (templateItem.image ?: createDefaultEditImage(null)).copy(
                        content = groomParentPhoto
                )
                familyItems.add(
                        templateItem.copy(
                                label = templateItem.label?.copy(content = "Padres de $groomName"),
                                text = templateItem.text?.copy(content = groomParentsNames),
                                image = image,
                                showImage = true
                        )
                )
            } else if (visualFamily.items.size > 0) {
                familyItems.add(visualFamily.items[0])
            }

            if (visualFamily.items.size > 1 && brideParentsNames.isNotBlank()) {
                val templateItem = visualFamily.items[1]
                val brideName = bride?.name ?: "la pareja"
                val brideParentPhoto = (brideMother?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: brideFather?.photoUrl?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.parents?.bride?.image?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.images.parents?.get("bride_mother") as? String
                        ?: contentTemplate.images.parents?.get("bride_father") as? String
                        ?: contentTemplate.images.parents?.get("mother") as? String
                        ?: contentTemplate.images.parents?.get("father") as? String
                        ?: "")
                val image = (templateItem.image ?: createDefaultEditImage(null)).copy(
                        content = brideParentPhoto
                )
                familyItems.add(
                        templateItem.copy(
                                label = templateItem.label?.copy(content = "Padres de $brideName"),
                                text = templateItem.text?.copy(content = brideParentsNames),
                                image = image,
                                showImage = true
                        )
                )
            } else if (visualFamily.items.size > 1) {
                familyItems.add(visualFamily.items[1])
            }

            val godparentItems = visualFamily.items.drop(2)

            userGodparents.forEachIndexed { index, godparent ->
                val templateItem = godparentItems.getOrNull(index) ?: godparentItems.firstOrNull()
                if (templateItem != null) {
                    val godparentPhoto = godparent.photoUrl?.takeIf { it.isNotBlank() }
                            ?: contentTemplate.images.godparents?.getOrNull(index)
                            ?: contentTemplate.images.godparents?.firstOrNull()
                            ?: ""
                    val image = (templateItem.image ?: createDefaultEditImage(null)).copy(
                            content = godparentPhoto
                    )
                    familyItems.add(
                            templateItem.copy(
                                    id = "f${2 + index}",
                                    label = templateItem.label?.copy(content = godparent.type),
                                    text = templateItem.text?.copy(content = godparent.names),
                                    image = image,
                                    showImage = true
                            )
                    )
                }
            }
            
                        visualFamily.copy(items = familyItems, intro = mergedIntro)
        }
    }

// Helpers para crear items por defecto
private fun createDefaultFamilyItem(): FamilyItem =
    FamilyItem(
        id = UUID.randomUUID().toString(),
        label = createDefaultEditText(""),
        text = createDefaultEditText(""),
        image = createDefaultEditImage(null),
        showImage = true
    )

private fun createDefaultFamilyGroup(): FamilyItem =
    FamilyItem(
        id = UUID.randomUUID().toString(),
        title = createDefaultEditText(""),
        items = emptyList()
    )

   private fun getFallbackFamilyText(index: Int, contentTemplate: DefaultContentConfig): String? {
        return when (index) {
            0 -> contentTemplate.parents?.bride?.names
            1 -> contentTemplate.parents?.groom?.names
            else -> null
        }
    }

    private fun mergeAmenitiesSection(
        invitation: InvitationEntity,
        visualAmenities: SectionAmenitiesData?,
        contentTemplate: DefaultContentConfig
    ): SectionAmenitiesData? {
        if (visualAmenities == null) return null

        val userActivities = invitationActivityRepository.findAllByInvitationId(invitation.id)

        val items = if (userActivities.isNotEmpty()) {
            userActivities.mapIndexed { index, activity ->
                val templateItem =
                    visualAmenities.items.getOrNull(index)
                        ?: visualAmenities.items.firstOrNull()

                val bodyParts = mutableListOf<String>()
                if (activity.address.isNotBlank()) {
                    bodyParts.add(activity.address)
                }
                if (!activity.phone.isNullOrBlank()) {
                    bodyParts.add("Tel: ${activity.phone}")
                }
                if (!activity.description.isNullOrBlank()) {
                    bodyParts.add(activity.description)
                }
                val bodyContent = bodyParts.joinToString(" | ")

                // Generate incremental ID: amenities-1, amenities-2, amenities-3, etc.
                val itemId = "amenities-${index + 1}"

                SuggestionItem(
                    id = itemId,
                    image =
                    (templateItem?.image ?: createDefaultEditImage("")).copy(
                        content = activity.photoUrl?.takeIf { it.isNotBlank() }
                            ?: null
                    ),
                    title =
                    (templateItem?.title ?: createDefaultEditText("")).copy(
                        content = activity.name
                    ),
                    body =
                    (templateItem?.body?.firstOrNull() ?: createDefaultEditText("")).let { firstBody ->
                        listOf(
                            firstBody.copy(
                                content = bodyContent,
                                url = activity.url
                            )
                        )
                    },
                    linkHref = activity.url
                )
            }
        } else {
            
            // 1. Intentar usar la lista rica de objetos (amenities)
            if (!contentTemplate.amenities.isNullOrEmpty()) {
                contentTemplate.amenities.mapIndexed { index, item ->
                    val templateItem = visualAmenities.items.getOrNull(index) ?: visualAmenities.items.firstOrNull()
                    val itemId = "amenities-default-${index + 1}"
                    
                    // Construir el contenido del cuerpo
                    val bodyContent = item.name ?: item.description ?: ""
                    
                    // Definir título: Usar 'type' si existe, sino el título por defecto
                    val titleContent = item.type ?: "Amenidad"

                    SuggestionItem(
                        id = itemId,
                        image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = item.image),
                        title = (templateItem?.title ?: createDefaultEditText("")).copy(content = titleContent),
                        body = (templateItem?.body?.firstOrNull() ?: createDefaultEditText("")).let { firstBody ->
                             // Aquí rellenamos el content que antes salía null
                            listOf(firstBody.copy(content = bodyContent, url = item.url))
                        },
                        linkHref = item.url
                    )
                }
            } 
            // 2. Si no hay lista rica, intentar usar solo imágenes (Lógica anterior)
            else if (contentTemplate.images.amenities != null && contentTemplate.images.amenities.isNotEmpty()) {
                contentTemplate.images.amenities.mapIndexed { index, url ->
                    val templateItem = visualAmenities.items.getOrNull(index) ?: visualAmenities.items.firstOrNull()
                    val itemId = "amenities-img-${index + 1}"
                    SuggestionItem(
                        id = itemId,
                        image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = url),
                        title = (templateItem?.title ?: createDefaultEditText("")).copy(content = "Amenidad"),
                        body = templateItem?.body ?: emptyList(), // Esto dejará el null si el template es null, pero es el último recurso
                        linkHref = null
                    )
                }
            } else {
                visualAmenities.items
            }
        }

        return visualAmenities.copy(
            title = visualAmenities.title.copy(
                content = contentTemplate.texts?.get("amenitiesTitle") ?: visualAmenities.title.content ?: "Amenidades"
            ),
            items = items
        )
    }

    // private fun mergeSuggestionsSection(
    //     invitation: InvitationEntity,
    //     visualSuggestions: SectionSuggestionsData?,
    //     contentTemplate: DefaultContentConfig
    // ): SectionSuggestionsData? {
    //     if (visualSuggestions == null) return null

    //     val userRecommendations =
    //         invitationRecommendationRepository.findAllByInvitationId(invitation.id)

    //     val items = if (userRecommendations.isNotEmpty()) {
    //         userRecommendations.mapIndexed { index, recommendation ->
    //             val templateItem =
    //                 visualSuggestions.items.getOrNull(index)
    //                     ?: visualSuggestions.items.firstOrNull()

    //             val bodyParts = mutableListOf<String>()
    //             if (recommendation.address.isNotBlank()) {
    //                 bodyParts.add(recommendation.address)
    //             }
    //             if (!recommendation.phone.isNullOrBlank()) {
    //                 bodyParts.add("Tel: ${recommendation.phone}")
    //             }
    //             if (!recommendation.description.isNullOrBlank()) {
    //                 bodyParts.add(recommendation.description)
    //             }
    //             val bodyContent = bodyParts.joinToString(" | ")

    //             SuggestionItem(
    //                 id = templateItem?.id ?: UUID.randomUUID().toString(),
    //                 image =
    //                 (templateItem?.image ?: createDefaultEditImage("")).copy(
    //                     content =
    //                     recommendation.photoUrl?.takeIf {
    //                         it.isNotBlank()
    //                     } ?: null
    //                 ),
    //                 title =
    //                 (templateItem?.title ?: createDefaultEditText("")).copy(
    //                     content = recommendation.name
    //                 ),
    //                 body =
    //                 (templateItem?.body?.firstOrNull() ?: createDefaultEditText("")).let { firstBody ->
    //                     listOf(
    //                         firstBody.copy(
    //                             content = bodyContent,
    //                             url = recommendation.url
    //                         )
    //                     )
    //                 },
    //                 linkHref = recommendation.url // Set top-level linkHref as well
    //             )
    //         }
    //     } else {
    //         // FALLBACK MEJORADO
            
    //         // 1. Intentar usar la lista rica de objetos (recommendations)
    //         if (!contentTemplate.recommendations.isNullOrEmpty()) {
    //             contentTemplate.recommendations.mapIndexed { index, item ->
    //                 val templateItem = visualSuggestions.items.getOrNull(index) ?: visualSuggestions.items.firstOrNull()
    //                 val itemId = "rec-default-${index + 1}"
                    
    //                 // Construir el contenido del cuerpo
    //                 val bodyContent = item.name ?: item.description ?: ""
                    
    //                 // Definir título
    //                 val titleContent = item.type ?: "Recomendación"

    //                 SuggestionItem(
    //                     id = itemId,
    //                     image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = item.image),
    //                     title = (templateItem?.title ?: createDefaultEditText("")).copy(content = titleContent),
    //                     body = (templateItem?.body?.firstOrNull() ?: createDefaultEditText("")).let { firstBody ->
    //                         // Aquí rellenamos el content
    //                         listOf(firstBody.copy(content = bodyContent, url = item.url))
    //                     },
    //                     linkHref = item.url
    //                 )
    //             }
    //         }
    //         // 2. Si no hay lista rica, usar imágenes
    //         else if (contentTemplate.images.recommendations != null && contentTemplate.images.recommendations.isNotEmpty()) {
    //             contentTemplate.images.recommendations.mapIndexed { index, url ->
    //                 val templateItem = visualSuggestions.items.getOrNull(index) ?: visualSuggestions.items.firstOrNull()
    //                 SuggestionItem(
    //                     id = templateItem?.id ?: UUID.randomUUID().toString(),
    //                     image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = url),
    //                     title = (templateItem?.title ?: createDefaultEditText("")).copy(content = "Recomendación"),
    //                     body = templateItem?.body ?: emptyList(),
    //                     linkHref = null
    //                 )
    //             }
    //         } else {
    //             visualSuggestions.items
    //         }
    //     }

    //     return visualSuggestions.copy(
    //         title = visualSuggestions.title.copy(
    //             content = contentTemplate.texts?.get("recommendationsTitle") ?: visualSuggestions.title.content ?: "Recomendaciones"
    //         ),
    //         items = items
    //     )
    // }
    
    private fun mergeSuggestionsSection(
        invitation: InvitationEntity,
        visualSuggestions: SectionSuggestionsData?,
        contentTemplate: DefaultContentConfig
    ): SectionSuggestionsData? {
        if (visualSuggestions == null) return null

        val templateId = invitation.template.id               // ← AGREGAR
        val userRecommendations =
            invitationRecommendationRepository.findAllByInvitationId(invitation.id)

        // ── Helper: construye el segundo body solo para template 12 ──────────
        fun buildSecondBody(templateItem: SuggestionItem?): ModelEditText {
            val base = templateItem?.body?.getOrNull(1)
                ?: templateItem?.body?.firstOrNull()
                ?: createDefaultEditText("")
            return base.copy(
                id = "msj-2",
                icon = "",
                content = "Ver recomendación",
                url = "#",
                md = base.md.copy(
                    fontAlign = "center",
                    fontStyle = emptyList(),
                    fontSize = 16.0,
                    lineHeight = 27.0,
                    margin = listOf(10.0, 0.0, 10.0, 0.0),
                    color = listOf(192.0, 223.0, 250.0, 1.0),
                    background = listOf(65.0, 84.0, 116.0, 1.0)
                ),
                sm = base.sm.copy(
                    fontAlign = "center",
                    fontStyle = emptyList(),
                    fontSize = 16.0,
                    lineHeight = 18.0,
                    margin = listOf(10.0, 0.0, 10.0, 0.0),
                    color = listOf(192.0, 223.0, 250.0, 1.0),
                    background = listOf(65.0, 84.0, 116.0, 1.0)
                ),
                xs = base.xs.copy(
                    fontAlign = "center",
                    fontStyle = emptyList(),
                    fontSize = 16.0,
                    lineHeight = 18.0,
                    margin = listOf(10.0, 0.0, 10.0, 0.0),
                    color = listOf(192.0, 223.0, 250.0, 1.0),
                    background = listOf(65.0, 84.0, 116.0, 1.0)
                )
            )
        }

        val items = if (userRecommendations.isNotEmpty()) {
            userRecommendations.mapIndexed { index, recommendation ->
                val templateItem =
                    visualSuggestions.items.getOrNull(index)
                        ?: visualSuggestions.items.firstOrNull()

                val bodyParts = mutableListOf<String>()
                if (recommendation.address.isNotBlank()) bodyParts.add(recommendation.address)
                if (!recommendation.phone.isNullOrBlank()) bodyParts.add("Tel: ${recommendation.phone}")
                if (!recommendation.description.isNullOrBlank()) bodyParts.add(recommendation.description)
                val bodyContent = bodyParts.joinToString(" | ")

                val firstBody = (templateItem?.body?.firstOrNull() ?: createDefaultEditText(""))
                    .copy(content = bodyContent, url = recommendation.url)

                // ← Agregar msj-2 solo para template 12
                val bodyList = if (templateId == 12L) {
                    listOf(firstBody, buildSecondBody(templateItem))
                } else {
                    listOf(firstBody)
                }

                SuggestionItem(
                    id = templateItem?.id ?: UUID.randomUUID().toString(),
                    image = (templateItem?.image ?: createDefaultEditImage("")).copy(
                        content = recommendation.photoUrl?.takeIf { it.isNotBlank() } ?: null
                    ),
                    title = (templateItem?.title ?: createDefaultEditText("")).copy(
                        content = recommendation.name
                    ),
                    body = bodyList,
                    linkHref = recommendation.url
                )
            }
        } else {
            if (!contentTemplate.recommendations.isNullOrEmpty()) {
                contentTemplate.recommendations.mapIndexed { index, item ->
                    val templateItem = visualSuggestions.items.getOrNull(index) ?: visualSuggestions.items.firstOrNull()
                    val bodyContent = item.name ?: item.description ?: ""
                    val firstBody = (templateItem?.body?.firstOrNull() ?: createDefaultEditText(""))
                        .copy(content = bodyContent, url = item.url)

                    // ← Agregar msj-2 solo para template 12
                    val bodyList = if (templateId == 12L) {
                        listOf(firstBody, buildSecondBody(templateItem))
                    } else {
                        listOf(firstBody)
                    }

                    SuggestionItem(
                        id = "rec-default-${index + 1}",
                        image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = item.image),
                        title = (templateItem?.title ?: createDefaultEditText("")).copy(content = item.type ?: "Recomendación"),
                        body = bodyList,
                        linkHref = item.url
                    )
                }
            } else if (contentTemplate.images.recommendations != null && contentTemplate.images.recommendations.isNotEmpty()) {
                contentTemplate.images.recommendations.mapIndexed { index, url ->
                    val templateItem = visualSuggestions.items.getOrNull(index) ?: visualSuggestions.items.firstOrNull()
                    val firstBody = (templateItem?.body?.firstOrNull() ?: createDefaultEditText(""))
                        .copy(content = "", url = null)

                    // ← Agregar msj-2 solo para template 12
                    val bodyList = if (templateId == 12L) {
                        listOf(firstBody, buildSecondBody(templateItem))
                    } else {
                        listOf(firstBody)
                    }

                    SuggestionItem(
                        id = templateItem?.id ?: UUID.randomUUID().toString(),
                        image = (templateItem?.image ?: createDefaultEditImage("")).copy(content = url),
                        title = (templateItem?.title ?: createDefaultEditText("")).copy(content = "Recomendación"),
                        body = bodyList,
                        linkHref = null
                    )
                }
            } else {
                visualSuggestions.items
            }
        }

        return visualSuggestions.copy(
            title = visualSuggestions.title.copy(
                content = contentTemplate.texts?.get("recommendationsTitle") ?: visualSuggestions.title.content ?: "Recomendaciones"
            ),
            items = items
        )
    }
    private fun mergeStorySection(
        invitation: InvitationEntity,
        visualStory: SectionStoryData?,
        contentTemplate: DefaultContentConfig
    ): SectionStoryData? {
        if (visualStory == null) return null

        val userStory = invitationStoryRepository.findAllByInvitationId(invitation.id)

        if (userStory.isEmpty()) {
            return if (visualStory.visibility == true) visualStory else null
        }

        val items =
            if (userStory.isNotEmpty()) {
                userStory.mapIndexed { index, item ->
                    val template = visualStory.items.getOrNull(index)
                    StoryItem(
                        id = template?.id ?: UUID.randomUUID().toString(),
                        image =
                        (template?.image ?: createDefaultEditImage("")).copy(
                            content = item.photoUrl ?: ""
                        ),
                        title =
                        (template?.title ?: createDefaultEditText("")).copy(
                            content = item.title
                        ),
                        date =
                        (template?.date ?: createDefaultEditText("")).copy(
                            content = item.date
                        ),
                        body =
                        (template?.body ?: createDefaultEditText("")).copy(
                            content = item.description ?: ""
                        )
                    )
                }
            } else if (contentTemplate.story != null) {
                contentTemplate.story.mapIndexed { index, item ->
                    val template = visualStory.items.getOrNull(index)
                    val photoUrl = contentTemplate.images.story?.getOrNull(index) ?: ""
                    StoryItem(
                        id = template?.id ?: UUID.randomUUID().toString(),
                        image =
                        (template?.image ?: createDefaultEditImage("")).copy(
                            content = photoUrl
                        ),
                        title =
                        (template?.title ?: createDefaultEditText("")).copy(
                            content = item.title
                        ),
                        date =
                        (template?.date ?: createDefaultEditText("")).copy(
                            content = item.date
                        ),
                        body =
                        (template?.body ?: createDefaultEditText("")).copy(
                            content = item.description
                        )
                    )
                }
            } else {
                visualStory.items
            }

        return visualStory.copy(items = items)
    }

    private fun mergeDressCodeSection(
        invitation: InvitationEntity,
        visualDressCode: SectionDressCodeData?,
        contentTemplate: DefaultContentConfig
    ): SectionDressCodeData? {
        if (visualDressCode == null) return null

        val userDressCode =
            invitationDressCodeRepository.findAllByInvitationId(invitation.id).firstOrNull()

        if (userDressCode == null) {
            return if (visualDressCode.visibility == true) {
                // Si no hay datos del usuario pero la sección está visible,
                // usar datos del contentTemplate o valores por defecto de la plantilla visual
                val items = if (contentTemplate.dressCode != null) {
                    listOf(
                        DressCodeItem(
                            id = visualDressCode.items.getOrNull(0)?.id
                                ?: UUID.randomUUID().toString(),
                            image = (visualDressCode.items.getOrNull(0)?.image
                                ?: createDefaultEditImage(""))
                                .copy(content = contentTemplate.dressCode.women.image),
                            title = (visualDressCode.items.getOrNull(0)?.title
                                ?: createDefaultEditText(""))
                                .copy(content = contentTemplate.dressCode.women.title),
                            bullet = (visualDressCode.items.getOrNull(0)?.bullet
                                ?: createDefaultEditText(""))
                                .copy(content = contentTemplate.dressCode.women.description)
                        ),
                        DressCodeItem(
                            id = visualDressCode.items.getOrNull(1)?.id
                                ?: UUID.randomUUID().toString(),
                            image = (visualDressCode.items.getOrNull(1)?.image
                                ?: createDefaultEditImage(""))
                                .copy(content = contentTemplate.dressCode.men.image),
                            title = (visualDressCode.items.getOrNull(1)?.title
                                ?: createDefaultEditText(""))
                                .copy(content = contentTemplate.dressCode.men.title),
                            bullet = (visualDressCode.items.getOrNull(1)?.bullet
                                ?: createDefaultEditText(""))
                                .copy(content = contentTemplate.dressCode.men.description)
                        )
                    )
                } else {
                    visualDressCode.items
                }

                visualDressCode.copy(
                    title = visualDressCode.title.copy(
                        content = visualDressCode.title.content?.takeIf { it.isNotBlank() }
                            ?: contentTemplate.texts?.get("dressCodeTitle")
                            ?: "Código de Vestir"
                    ),
                    items = items
                )
            } else null
        }

        val updatedTitle =
            if (userDressCode?.name != null && userDressCode.name.isNotBlank()) {
                visualDressCode.title.copy(content = userDressCode.name)
            } else {
                visualDressCode.title.copy(
                    content = visualDressCode.title.content?.takeIf { it.isNotBlank() }
                        ?: contentTemplate.texts?.get("dressCodeTitle")
                        ?: "Código de Vestir"
                )
            }

        val items =
            if (userDressCode != null) {
                when (userDressCode.type) {
                    "link" -> {
                        listOf(
                            DressCodeItem(
                                id = visualDressCode.items.getOrNull(0)?.id
                                    ?: UUID.randomUUID().toString(),
                                image =
                                (visualDressCode.items.getOrNull(0)?.image
                                    ?: createDefaultEditImage(""))
                                    .copy(
                                        content =
                                        contentTemplate
                                            .dressCode
                                            ?.women
                                            ?.image
                                            ?: "https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/DRESSCODE-LINK.jpg"
                                    ),
                                title =
                                (visualDressCode.items.getOrNull(0)?.title
                                    ?: createDefaultEditText(""))
                                    .copy(
                                        content = userDressCode.name
                                            ?: "Código de Vestimenta"
                                    ),
                                bullet =
                                (visualDressCode.items.getOrNull(0)?.bullet
                                    ?: createDefaultEditText(""))
                                    .copy(
                                        content =
                                        userDressCode
                                            .description
                                            ?: "Haz clic en el botón para ver más detalles",
                                        url = userDressCode.url
                                    )
                            )
                        )
                    }
                    "predefined" -> {
                        val predefinedItems = listOfNotNull(
                            userDressCode.womanDescription?.let { womanDesc ->
                                val template = visualDressCode.items.getOrNull(0)
                                DressCodeItem(
                                    id = template?.id ?: UUID.randomUUID().toString(),
                                    image =
                                    (template?.image
                                        ?: createDefaultEditImage(
                                            ""
                                        ))
                                        .copy(
                                            content =
                                            userDressCode
                                                .womanPhotoUrl
                                                ?: ""
                                        ),
                                    title =
                                    (template?.title
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = "Mujeres"),
                                    bullet =
                                    (template?.bullet
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = womanDesc)
                                )
                            },
                            userDressCode.manDescription?.let { manDesc ->
                                val template = visualDressCode.items.getOrNull(1)
                                DressCodeItem(
                                    id = template?.id ?: UUID.randomUUID().toString(),
                                    image =
                                    (template?.image
                                        ?: createDefaultEditImage(
                                            ""
                                        ))
                                        .copy(
                                            content =
                                            userDressCode
                                                .manPhotoUrl
                                                ?: ""
                                        ),
                                    title =
                                    (template?.title
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = "Hombres"),
                                    bullet =
                                    (template?.bullet
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = manDesc)
                                )
                            }
                        )

                        // Si predefinedItems está vacío (usuario no seleccionó dresscode específico),
                        // usar contentTemplate o visualDressCode como fallback
                        if (predefinedItems.isEmpty()) {
                            if (contentTemplate.dressCode != null) {
                                listOf(
                                    DressCodeItem(
                                        id = visualDressCode.items.getOrNull(0)?.id
                                            ?: UUID.randomUUID().toString(),
                                        image = (visualDressCode.items.getOrNull(0)?.image
                                            ?: createDefaultEditImage(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.image
                                            ),
                                        title = (visualDressCode.items.getOrNull(0)?.title
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.title
                                            ),
                                        bullet = (visualDressCode.items.getOrNull(0)?.bullet
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.description
                                            )
                                    ),
                                    DressCodeItem(
                                        id = visualDressCode.items.getOrNull(1)?.id
                                            ?: UUID.randomUUID().toString(),
                                        image = (visualDressCode.items.getOrNull(1)?.image
                                            ?: createDefaultEditImage(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.image
                                            ),
                                        title = (visualDressCode.items.getOrNull(1)?.title
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.title
                                            ),
                                        bullet = (visualDressCode.items.getOrNull(1)?.bullet
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.description
                                            )
                                    )
                                )
                            } else {
                                visualDressCode.items
                            }
                        } else {
                            predefinedItems
                        }
                    }
                    "standard" -> {
                        val standardItems = listOfNotNull(
                            userDressCode.womanDescription?.let { womanDesc ->
                                val template = visualDressCode.items.getOrNull(0)
                                DressCodeItem(
                                    id = template?.id ?: UUID.randomUUID().toString(),
                                    image =
                                    (template?.image
                                        ?: createDefaultEditImage(
                                            ""
                                        ))
                                        .copy(
                                            content =
                                            userDressCode
                                                .womanPhotoUrl
                                                ?: ""
                                        ),
                                    title =
                                    (template?.title
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = "Mujeres"),
                                    bullet =
                                    (template?.bullet
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = womanDesc)
                                )
                            },
                            userDressCode.manDescription?.let { manDesc ->
                                val template = visualDressCode.items.getOrNull(1)
                                DressCodeItem(
                                    id = template?.id ?: UUID.randomUUID().toString(),
                                    image =
                                    (template?.image
                                        ?: createDefaultEditImage(
                                            ""
                                        ))
                                        .copy(
                                            content =
                                            userDressCode
                                                .manPhotoUrl
                                                ?: ""
                                        ),
                                    title =
                                    (template?.title
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = "Hombres"),
                                    bullet =
                                    (template?.bullet
                                        ?: createDefaultEditText(
                                            ""
                                        ))
                                        .copy(content = manDesc)
                                )
                            }
                        )

                        // Si standardItems está vacío, usar contentTemplate o visualDressCode como fallback
                        if (standardItems.isEmpty()) {
                            if (contentTemplate.dressCode != null) {
                                listOf(
                                    DressCodeItem(
                                        id = visualDressCode.items.getOrNull(0)?.id
                                            ?: UUID.randomUUID().toString(),
                                        image = (visualDressCode.items.getOrNull(0)?.image
                                            ?: createDefaultEditImage(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.image
                                            ),
                                        title = (visualDressCode.items.getOrNull(0)?.title
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.title
                                            ),
                                        bullet = (visualDressCode.items.getOrNull(0)?.bullet
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.women.description
                                            )
                                    ),
                                    DressCodeItem(
                                        id = visualDressCode.items.getOrNull(1)?.id
                                            ?: UUID.randomUUID().toString(),
                                        image = (visualDressCode.items.getOrNull(1)?.image
                                            ?: createDefaultEditImage(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.image
                                            ),
                                        title = (visualDressCode.items.getOrNull(1)?.title
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.title
                                            ),
                                        bullet = (visualDressCode.items.getOrNull(1)?.bullet
                                            ?: createDefaultEditText(""))
                                            .copy(
                                                content = contentTemplate.dressCode.men.description
                                            )
                                    )
                                )
                            } else {
                                visualDressCode.items
                            }
                        } else {
                            standardItems
                        }
                    }
                    else -> {
                        visualDressCode.items
                    }
                }
            } else if (contentTemplate.dressCode != null) {
                listOf(
                    DressCodeItem(
                        id = visualDressCode.items.getOrNull(0)?.id
                            ?: UUID.randomUUID().toString(),
                        image =
                        (visualDressCode.items.getOrNull(0)?.image
                            ?: createDefaultEditImage("")).copy(
                            content = contentTemplate.dressCode.women.image
                        ),
                        title =
                        (visualDressCode.items.getOrNull(0)?.title
                            ?: createDefaultEditText("")).copy(
                            content = contentTemplate.dressCode.women.title
                        ),
                        bullet =
                        (visualDressCode.items.getOrNull(0)?.bullet
                            ?: createDefaultEditText("")).copy(
                            content =
                            contentTemplate
                                .dressCode
                                .women
                                .description
                        )
                    ),
                    DressCodeItem(
                        id = visualDressCode.items.getOrNull(1)?.id
                            ?: UUID.randomUUID().toString(),
                        image =
                        (visualDressCode.items.getOrNull(1)?.image
                            ?: createDefaultEditImage("")).copy(
                            content = contentTemplate.dressCode.men.image
                        ),
                        title =
                        (visualDressCode.items.getOrNull(1)?.title
                            ?: createDefaultEditText("")).copy(
                            content = contentTemplate.dressCode.men.title
                        ),
                        bullet =
                        (visualDressCode.items.getOrNull(1)?.bullet
                            ?: createDefaultEditText("")).copy(
                            content =
                            contentTemplate
                                .dressCode
                                .men
                                .description
                        )
                    )
                )
            } else {
                visualDressCode.items
            }

        return visualDressCode.copy(title = updatedTitle, items = items)
    }

    private fun mergeStartedSection(
        invitation: InvitationEntity,
        visualStarted: SectionStartedData?,
        contentTemplate: DefaultContentConfig
    ): SectionStartedData? {
        if (visualStarted == null) return null

        return visualStarted.copy(
            title = visualStarted.title.copy(
                content = contentTemplate.texts?.get("rsvpTitle")
                    ?: visualStarted.title.content
                    ?: "Confirma tu asistencia"
            ),
            limitConfirm = visualStarted.limitConfirm.copy(
                content = (contentTemplate.rsvp?.get("message") as? String)
                    ?: visualStarted.limitConfirm.content
                    ?: "Por favor confirma tu asistencia antes del evento."
            ),
            note = visualStarted.note.copy(
                content = (contentTemplate.rsvp?.get("note") as? String)
                    ?: visualStarted.note.content
            ),
            background = visualStarted.background.copy(
                content = contentTemplate.images.backgrounds?.get("rsvpBg")
                    ?: visualStarted.background.content
            )
        )
    }

    private fun createDefaultImageProperties() =
        ModelPropertiesImage(
            width = 100.0,
            height = 100.0,
            alignHorizontal = "center",
            alignVertical = "center"
        )

    private fun createDefaultEditImage(content: String?) =
        ModelEditImage(
            content = content,
            md = createDefaultImageProperties(),
            sm = createDefaultImageProperties(),
            xs = createDefaultImageProperties()
        )

    private fun createDefaultTextProperties() =
        ModelPropertiesText(
            fontAlign = "center",
            fontStyle = emptyList(),
            fontSize = 16.0,
            lineHeight = 18.0,
            margin = listOf(0.0, 0.0, 0.0, 0.0),
            color = listOf(130.0, 130.0, 130.0, 1.0),
            background = listOf(255.0, 255.0, 255.0, 0.0)
        )

    private fun createDefaultEditText(content: String?, id: String? = null) =
        ModelEditText(
            id = id,
            content = content,
            fontFamily = "Poppins",
            md = createDefaultTextProperties(),
            sm = createDefaultTextProperties(),
            xs = createDefaultTextProperties()
        )

    private fun createDefaultIconProperties() =
        ModelPropertiesIcon(
            alignHorizontal = "center",
            color = listOf(0.0, 0.0, 0.0, 1.0),
            background = listOf(255.0, 255.0, 255.0, 0.0)
        )

    private fun createDefaultEditIcon(content: String) =
        ModelEditIcon(
            content = content,
            md = createDefaultIconProperties(),
            sm = createDefaultIconProperties(),
            xs = createDefaultIconProperties()
        )
}