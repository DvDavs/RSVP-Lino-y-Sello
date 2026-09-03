package mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.index.Indexed
import org.springframework.data.mongodb.core.mapping.Document

/**
 * Represents default content configuration for a specific event type and plan combination.
 * This defines the default images, phrases, itineraries, and other content that will be used
 * when generating initial configurations for invitations.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Document(collection = "default_content_configs")
data class DefaultContentConfig(
    @Id
    val id: String? = null,

    /**
     * Optional template ID for template-specific content defaults.
     * When present, this configuration has priority over eventType/plan defaults.
     */
    @Indexed(sparse = true)
    val templateId: Long? = null,
    
    /**
     * The event type ID (e.g., Boda=1, XV Años=2, etc.)
     */
    @Indexed
    val eventTypeId: Long,
    
    /**
     * The plan ID (e.g., Básico=1, Premium=2, etc.)
     */
    @Indexed
    val planId: Long,
    
    /**
     * Default images for various sections of the invitation
     */
    val images: DefaultInvitationImages,
    
    /**
     * Default phrases organized by gender.
     * Key: gender ("male", "female"), Value: list of phrase strings
     */
    val phrases: Map<String, List<String>>,
    
    /**
     * Default itinerary items for the event
     */
    val itinerary: List<DefaultItineraryItem>,
    
    /**
     * Default gift registry items
     */
    val giftRegistry: List<DefaultGiftRegistryItem>,
    
    /**
     * Default music configuration
     */
    val music: DefaultMusic,
    
    /**
     * Default hashtags for social media (optional)
     * Can be List<String> or List<Map<String, Any>> depending on the JSON structure
     */
    val hashtags: Any? = null,
    
    /**
     * Default dress code information (optional)
     */
    val dressCode: DefaultDressCode? = null,
    
    /**
     * Default parents information (optional)
     */
    val parents: DefaultParents? = null,
    
    /**
     * Default story items for the couple's story section (optional)
     */
    val story: List<DefaultStoryItem>? = null,
    
    /**
     * Date string for the event (optional, used for display)
     */
    val date: String? = null,
    
    /**
     * Name of the celebrant (optional, for XV Años, birthdays, etc.)
     */
    val celebrantName: String? = null,
    
    /**
     * Default texts for various sections (optional)
     */
    val texts: Map<String, String>? = null,
    
    /**
     * Family information structure (optional, alternative to parents)
     */
    val family: Map<String, Any>? = null,
    
    /**
     * RSVP configuration (optional)
     */
    val rsvp: Map<String, Any>? = null,
    
    /**
     * Footer configuration (optional)
     */
    val footer: Map<String, Any>? = null,

    /**
     * Lista rica de recomendaciones (objeto con nombre, url, imagen, etc)
     */
    val recommendations: List<DefaultSuggestionConfig>? = null,

    /**
     * Lista rica de amenidades (objeto con nombre, url, imagen, etc)
     */
    val amenities: List<DefaultSuggestionConfig>? = null
)

/**
 * Default images for different sections of the invitation
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultInvitationImages(
    /**
     * URLs for people photos (bride, groom, etc.)
     */
    val people: List<String>,
    
    /**
     * URL for the cover photo
     */
    val coverPhoto: String,
    
    /**
     * URLs for gallery images
     */
    val gallery: List<String>,
    
    /**
     * Map for background images (topBg, bottomBg, rsvpBg, etc.)
     * Key: background type ("topBg", "bottomBg", "rsvpBg")
     */
    val backgrounds: Map<String, String>? = null,
    
    /**
     * URLs for parent photos, organized by type
     * Key: parent type ("bride_father", "bride_mother", etc.)
     */
    val parents: Map<String, String>? = null,
    
    /**
     * URLs for godparent photos
     */
    val godparents: List<String>? = null,
    
    /**
     * URLs for story section images
     */
    val story: List<String>? = null,
    
    /**
     * URLs for recommendation/suggestion images
     */
    val recommendations: List<String>? = null,
    
    /**
     * URLs for amenities images
     */
    val amenities: List<String>? = null
)

/**
 * Represents a default itinerary item for the event schedule
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultItineraryItem(
    /**
     * Name of the event (e.g., "Ceremonia", "Recepción")
     */
    val eventName: String,
    
    /**
     * Location of the event
     */
    val eventLocation: String,
    
    /**
     * Start time in HH:mm format (optional)
     */
    val startTime: String?,
    
    /**
     * End time in HH:mm format (optional)
     */
    val endTime: String?,
    
    /**
     * Google Maps URL for the event location (optional)
     */
    val eventMapsUrl: String? = null,
    
    /**
     * Icon name for the event (optional)
     */
    val icon: String? = null,
    
    /**
     * Formatted date string (optional)
     */
    val date: String? = null
)

/**
 * Represents a default gift registry item
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultGiftRegistryItem(
    /**
     * Type of gift registry (e.g., "store", "bank", "cash")
     */
    val type: String,
    
    /**
     * Name of the store or bank (optional)
     */
    val name: String?,
    
    /**
     * Messages to display for this gift option (list of strings)
     */
    val message: List<String>,
    
    /**
     * URL of the photo to display
     */
    val photo: String,
    
    /**
     * Icon name for the gift registry (optional)
     */
    val icon: String? = null,
    
    /**
     * URL for the gift registry (optional)
     */
    val url: String? = null
)

/**
 * Default music configuration
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultMusic(
    /**
     * Type of music (e.g., "spotify", "youtube", "soundcloud")
     */
    val type: String,
    
    /**
     * Whether music is enabled by default
     */
    val enabled: Boolean,
    
    /**
     * URL of the music track (optional)
     */
    val url: String?
)

/**
 * Default dress code information
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultDressCode(
    /**
     * Dress code details for women
     */
    val women: DressCodeDetail,
    
    /**
     * Dress code details for men
     */
    val men: DressCodeDetail
)

/**
 * Details for dress code by gender
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DressCodeDetail(
    /**
     * Title/name of the dress code (e.g., "Formal", "Cocktail")
     */
    val title: String,
    
    /**
     * Description of the dress code
     */
    val description: String,
    
    /**
     * URL of the image showing the dress code
     */
    val image: String,
    
    /**
     * Icon name for the dress code (optional)
     */
    val icon: String? = null
)

/**
 * Default parents information
 * CORRECCIÓN: Hacemos los campos nullable y añadimos los campos de XV Años.
 * La anotación ignora campos que no coincidan en los diferentes JSONs.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultParents(
    // Campos para Bodas
    val bride: ParentDetail? = null,
    val groom: ParentDetail? = null,
    
    // Campos para XV Años / Genéricos
    val parents: ParentDetail? = null,
    val godparents: ParentDetail? = null
)

/**
 * Details for a parent entry
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ParentDetail(
    /**
     * Label to display (e.g., "Padres de la Novia")
     */
    val label: String,
    
    /**
     * Names of the parents
     */
    val names: String,
    
    /**
     * URL of the image for the parents (optional)
     */
    val image: String? = null
)

/**
 * Represents a default story item for the couple's story
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultStoryItem(
    /**
     * Title of the story moment (e.g., "Nos conocimos")
     */
    val title: String,
    
    /**
     * Date of the story moment
     */
    val date: String,
    
    /**
     * Description of the story moment
     */
    val description: String
)

/**
 * Nueva clase para mapear los objetos dentro de "recommendations" y "amenities" del JSON
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DefaultSuggestionConfig(
    val type: String?,  // Ej: "Hotel", "Salón de belleza"
    val name: String?,  // Ej: "City Express", "Marck Luga"
    val url: String? = null,
    val image: String? = null,
    val description: String? = null,
    val address: String? = null,
    val phone: String? = null
)
