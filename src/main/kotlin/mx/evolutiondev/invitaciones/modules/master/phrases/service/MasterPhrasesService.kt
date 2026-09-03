package mx.evolutiondev.invitaciones.modules.master.phrases.service

import jakarta.transaction.Transactional
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.CustomPhraseRepository
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.PhraseOptionRepository
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.CustomPhraseEntity
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseGenre
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOptionEntity
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOrientation
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.CustomPhrasesSaveRequest
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.CustomPhraseResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.PublicCustomPhraseResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.UpdateCustomPhrasesRequest
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.toResponse
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterPhrasesService(
        private val customPhraseRepository: CustomPhraseRepository,
        private val phraseOptionRepository: PhraseOptionRepository,
        private val invitationPlanRepository: InvitationPlanRepository,
        private val eventTypeRepository: EventTypeRepository
) {

    fun createPhrase(request: CustomPhrasesSaveRequest, userId: Long): GeneralMessageResponse {
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }

        val event = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El evento proporcionado no es válido") }
        
        if (!event.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }

        val genre = PhraseGenre.values().firstOrNull { it.name == request.genre }
                ?: throw IllegalArgumentException("El género proporcionado es inválido: ${request.genre}")

        val orientation = PhraseOrientation.values().firstOrNull { it.name == request.orientation }
                ?: throw IllegalArgumentException("La orientación proporcionada es inválida: ${request.orientation}")

        if (!event.isWedding && orientation == PhraseOrientation.GUESTS && genre != PhraseGenre.ANY) {
            throw IllegalArgumentException("Estas asignando frases dirigidas a los invitados por lo que es necesario enviar un género de tipo ANY")
        }

        if (event.isWedding && !plan.isPremium && genre != PhraseGenre.ANY) {
            throw IllegalArgumentException("Si una boda no pertenece a un plan premium únicamente puedes enviar un género de tipo ANY")
        }

        if (event.isWedding && plan.isPremium && (orientation == PhraseOrientation.CELEBRATED || orientation == PhraseOrientation.GUESTS)) {
            throw IllegalArgumentException("Las frases usadas en una boda no pueden tener una orientación CELEBRATED (Festejado) o GUESTS (Invitados)")
        }

        val customPhrase = customPhraseRepository.save(
                CustomPhraseEntity(
                        genre = genre,
                        genreOrientation = orientation,
                        invitationPlan = plan,
                        eventType = event,
                        createdBy = userId
                )
        )

        val options = request.phrases.map {
            PhraseOptionEntity(text = it, customPhrase = customPhrase, createdBy = userId)
        }

        phraseOptionRepository.saveAll(options)
        
        return GeneralMessageResponse("Frases añadidas correctamente")
    }

    fun listPhrases(
            page: Int,
            planId: Long?,
            eventId: Long?,
            genre: String?,
            orientation: String?,
            isEnable: Boolean?
    ): PaginatedResponse<CustomPhraseResponse> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val genreEnum = genre?.let { 
            try { PhraseGenre.valueOf(it.uppercase()) } 
            catch (e: IllegalArgumentException) { null }
        }
        val orientationEnum = orientation?.let { 
            try { PhraseOrientation.valueOf(it.uppercase()) } 
            catch (e: IllegalArgumentException) { null }
        }
        
        val resultPage = customPhraseRepository.findAllByFilters(
                planId, eventId, genreEnum, orientationEnum, isEnable, pageable
        )
        
        val phraseIds = resultPage.content.map { it.id }
        val phraseOptions = if (phraseIds.isNotEmpty()) {
            phraseOptionRepository.findAllByCustomPhraseIdIn(phraseIds)
                    .groupBy { it.customPhrase.id }
        } else {
            emptyMap()
        }
        
        val responses = resultPage.content.map { customPhrase ->
            customPhrase.toResponse(phraseOptions[customPhrase.id] ?: emptyList())
        }
        
        return PaginatedResponse(
                content = responses,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getPhraseById(id: Long): CustomPhraseResponse {
        val customPhrase = customPhraseRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El conjunto de frases con ID $id no existe") }
        
        val phraseOptions = phraseOptionRepository.findAllByCustomPhraseId(id)
        
        return customPhrase.toResponse(phraseOptions)
    }
 
    @Transactional
    fun updatePhrase(id: Long, request: UpdateCustomPhrasesRequest, userId: Long): GeneralMessageResponse {
        val customPhrase = customPhraseRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El conjunto de frases con ID $id no existe") }
        
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }
        
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El tipo de evento proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }
        
        if (!eventType.isWedding && request.genreOrientation == PhraseOrientation.GUESTS && request.genre != PhraseGenre.ANY) {
            throw IllegalArgumentException("Estas asignando frases dirigidas a los invitados por lo que es necesario enviar un género de tipo ANY")
        }

        if (eventType.isWedding && !plan.isPremium && request.genre != PhraseGenre.ANY) {
            throw IllegalArgumentException("Si una boda no pertenece a un plan premium únicamente puedes enviar un género de tipo ANY")
        }

        if (eventType.isWedding && plan.isPremium && (request.genreOrientation == PhraseOrientation.CELEBRATED || request.genreOrientation == PhraseOrientation.GUESTS)) {
            throw IllegalArgumentException("Las frases usadas en una boda no pueden tener una orientación CELEBRATED (Festejado) o GUESTS (Invitados)")
        }
        
        customPhrase.genre = request.genre
        customPhrase.genreOrientation = request.genreOrientation
        customPhrase.invitationPlan = plan
        customPhrase.eventType = eventType
        customPhrase.updatedBy = userId
        customPhraseRepository.save(customPhrase)
        
        val existingOptions = phraseOptionRepository.findAllByCustomPhraseId(id)
        phraseOptionRepository.deleteAll(existingOptions)
        
        request.phraseTexts.forEach { text ->
            phraseOptionRepository.save(
                    PhraseOptionEntity(
                            text = text,
                            customPhrase = customPhrase,
                            createdBy = userId
                    )
            )
        }
        
        return GeneralMessageResponse("Frases actualizadas correctamente")
    }

    @Transactional
    fun deactivatePhrase(id: Long, userId: Long): GeneralMessageResponse {
        val customPhrase = customPhraseRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El conjunto de frases con ID $id no existe")
        
        if (!customPhrase.isEnabled) {
            return GeneralMessageResponse("El conjunto de frases ya está desactivado")
        }
        
        customPhrase.isEnabled = false
        customPhrase.deletedBy = userId
        customPhraseRepository.save(customPhrase)
        
        phraseOptionRepository.deactivateAllByCustomPhraseId(id)
        
        return GeneralMessageResponse("Conjunto de frases desactivado correctamente")
    }

    @Transactional
    fun activatePhrase(id: Long, userId: Long): GeneralMessageResponse {
        val customPhrase = customPhraseRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El conjunto de frases con ID $id no existe")

        if (customPhrase.isEnabled) {
            return GeneralMessageResponse("El conjunto de frases ya está activo")
        }

        customPhrase.isEnabled = true
        customPhrase.updatedBy = userId
        customPhrase.deletedBy = null
        customPhraseRepository.save(customPhrase)

        val options = phraseOptionRepository.findAllByCustomPhraseId(id)
        options.forEach { it.isEnabled = true }
        phraseOptionRepository.saveAll(options)

        return GeneralMessageResponse("Conjunto de frases activado correctamente")
    }

    fun getPhrases(
            planId: Long,
            eventId: Long,
            genreId: Long? = null,
            orientationId: Long? = null
    ): List<PublicCustomPhraseResponse> {
        val plan = invitationPlanRepository.findById(planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }

        val event = eventTypeRepository.findById(eventId)
                .orElseThrow { IllegalArgumentException("El evento proporcionado no es válido") }

        val orientationFilter: PhraseOrientation? = orientationId?.let {
            PhraseOrientation.values().firstOrNull { o -> o.code.toLong() == it }
                    ?: throw IllegalArgumentException("El orientationId proporcionado es inválido: $it")
        }

        val genreFilter: PhraseGenre? = genreId?.let {
            PhraseGenre.values().firstOrNull { g -> g.code.toLong() == it }
                    ?: throw IllegalArgumentException("El genreId proporcionado es inválido: $it")
        }

        val phrases = customPhraseRepository
                .findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(planId, eventId)
                .filter { phrase ->
                    (orientationFilter == null || phrase.genreOrientation == orientationFilter) &&
                            (genreFilter == null || phrase.genre == genreFilter)
                }

        if (phrases.isEmpty()) return emptyList()

        val phraseOptions = phraseOptionRepository.findAllByCustomPhraseIdInAndIsEnabledTrue(phrases.map { it.id })

        return phrases.map { phrase ->
            val genreTranslated = when (phrase.genre) {
                PhraseGenre.MALE -> "Hombre"
                PhraseGenre.FEMALE -> "Mujer"
                PhraseGenre.OTHER -> "Otro"
                PhraseGenre.ANY -> "Cualquiera"
            }

            val orientationTranslated = when (phrase.genreOrientation) {
                PhraseOrientation.HETEROSEXUAL -> "Hetero"
                PhraseOrientation.GAY -> "Gay"
                PhraseOrientation.LESBIAN -> "Lesbico"
                PhraseOrientation.OTHER -> "Lgtb+"
                PhraseOrientation.CELEBRATED -> "Festejado"
                PhraseOrientation.GUESTS -> "Invitados"
            }

            PublicCustomPhraseResponse(
                    plan = plan.name,
                    event = event.name,
                    orientation = orientationTranslated,
                    genre = genreTranslated,
                    phrases = phraseOptions
                            .filter { it.customPhrase.id == phrase.id }
                            .map { it.text }
            )
        }
    }
}

