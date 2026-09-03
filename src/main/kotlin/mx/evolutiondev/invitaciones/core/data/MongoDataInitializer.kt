//
package mx.evolutiondev.invitaciones.core.data

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultContentConfigRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultVisualConfigRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultContentConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultVisualConfig
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.core.io.ResourceLoader
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.index.Index
import org.springframework.stereotype.Component
import org.springframework.data.domain.Sort

@Component
class MongoDataInitializer(
    private val visualConfigRepo: DefaultVisualConfigRepository,
    private val contentConfigRepo: DefaultContentConfigRepository,
    private val resourceLoader: ResourceLoader,
    private val mongoTemplate: MongoTemplate
) : CommandLineRunner {

    private val logger = LoggerFactory.getLogger(MongoDataInitializer::class.java)
    private val objectMapper = jacksonObjectMapper()

    override fun run(vararg args: String?) {
        logger.info("Iniciando la siembra de datos de configuración de MongoDB...")
        
        ensureUniqueIndexes()

        val visualTemplates = listOf(
            "default_visual_boda_premium.json",
            // "default_visual_boda_premium_2.json",
            "default_visual_boda_basico.json",
            "default_visual_xv_premium.json",
            "default_visual_bautizo.json",
            "default_visual_comunion.json",
            "default_visual_confirmacion.json",
            "default_visual_cumpleanos.json",
            "default_visual_evento.json"
        )

        visualTemplates.forEach { loadAndSaveVisualConfig("data/mongo/$it") }

        val contentTemplates = listOf(
            "default_content_boda_premium.json",
            // "default_content_boda_premium_2.json",
            "default_content_boda_basico.json",
            "default_content_xv_premium.json",
            "default_content_bautizo.json",
            "default_content_comunion.json",
            "default_content_confirmacion.json",
            "default_content_cumpleanos.json",
            "default_content_evento.json"
        )

        contentTemplates.forEach { loadAndSaveContentConfig("data/mongo/$it") }

        logger.info("Siembra de datos de MongoDB completada.")
    }

    private fun ensureUniqueIndexes() {
        try {
            val indexOps = mongoTemplate.indexOps("invitation_configs")
            try { indexOps.dropIndex("invitationId") } catch (e: Exception) {}
            val index = Index().on("invitationId", Sort.Direction.ASC).unique()
            indexOps.ensureIndex(index)
        } catch (e: Exception) {}
    }

    private fun loadAndSaveVisualConfig(filePath: String) {
        try {
            val resource = resourceLoader.getResource("classpath:$filePath")
            if (!resource.exists()) {
                logger.warn("El archivo $filePath no existe, saltando carga.")
                return
            }
            val config: DefaultVisualConfig = objectMapper.readValue(resource.inputStream)

            visualConfigRepo.findByTemplateId(config.templateId).ifPresentOrElse({ existing ->
                val updatedConfig = config.copy(id = existing.id)
                visualConfigRepo.save(updatedConfig)
                logger.info("Plantilla visual para templateId {} actualizada.", config.templateId)
            },{
                visualConfigRepo.save(config)
                logger.info("Plantilla visual para templateId {} guardada.", config.templateId)
            })
        } catch (e: Exception) {
            logger.error("Error al cargar la plantilla visual desde $filePath: ${e.message}")
        }
    }

    private fun loadAndSaveContentConfig(filePath: String) {
        try {
            val resource = resourceLoader.getResource("classpath:$filePath")
            if (!resource.exists()) {
                logger.warn("El archivo $filePath no existe, saltando carga.")
                return
            }
            val config: DefaultContentConfig = objectMapper.readValue(resource.inputStream)

            // Prefer template-specific upsert when templateId is present.
            if (config.templateId != null) {
                contentConfigRepo.findByTemplateId(config.templateId).ifPresentOrElse({ existing ->
                    val updatedConfig = config.copy(id = existing.id)
                    contentConfigRepo.save(updatedConfig)
                    logger.info("Contenido por defecto para templateId {} actualizado.", config.templateId)
                }, {
                    contentConfigRepo.save(config)
                    logger.info("Contenido por defecto para templateId {} guardado.", config.templateId)
                })
                return
            }

            contentConfigRepo.findByEventTypeIdAndPlanId(config.eventTypeId, config.planId).ifPresentOrElse({ existing ->
                logger.info("El contenido por defecto para eventTypeId {} y planId {} ya existe. Omitiendo.", existing.eventTypeId, existing.planId)
            }, {
                contentConfigRepo.save(config)
                logger.info("Contenido por defecto para eventTypeId {} y planId {} guardado.", config.eventTypeId, config.planId)
            })
        } catch (e: Exception) {
            logger.error("Error al cargar la plantilla de contenido desde $filePath: ${e.message}")
        }
    }
}