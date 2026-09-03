//
package mx.evolutiondev.invitaciones.modules.user.invitations.model.editor

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonProperty
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.index.Indexed
import org.springframework.data.mongodb.core.mapping.Document

@Document(collection = "invitation_configs")
data class InvitationConfig(
    @Id
    val id: String? = null,

    @Indexed(unique = true)
    val invitationId: Long,

    val templateId: Long? = null,
    val eventId: Long? = null,
    val planId: Long? = null,

    val settings: ModelSettings? = null,
    val sectionCover: SectionCoverProps? = null,
    val sectionCouple: SectionCoupleData? = null,
    val sectionEvent: SectionEventData? = null,
    val sectionGallery: SectionGalleryData? = null,
    @JsonProperty("sectionGifttable")
    val sectionGiftTable: SectionGifttableData? = null,
    val sectionSuggestions: SectionSuggestionsData? = null,
    val sectionAmenities: SectionAmenitiesData? = null,
    val sectionStarted: SectionStartedData? = null,
    val sectionFamily: SectionFamilyData? = null,
    val sectionStory: SectionStoryData? = null,
    @JsonProperty("sectionDresscode")
    val sectionDressCode: SectionDressCodeData? = null,
    val sectionFooter: SectionFooterData? = null
)

/**
 * Configuración general de la invitación.
 */
data class ModelSettings(
    val primaryColor: List<Double>,
    val secondaryColor: List<Double>,
    val music: String? = null,
    val child_friendly: Boolean,
    val young_friendly: Boolean,
    val name: String? = null
)

/**
 * Propiedades de texto responsive (mobile, tablet, desktop).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ModelPropertiesText(
    val fontAlign: String,
    val fontStyle: List<String>,
    val fontSize: Double,
    val lineHeight: Double,
    val margin: List<Double>,
    val color: List<Double>,
    val background: List<Double>
)

/**
 * Texto editable con propiedades responsive.
 * Incluye campo id para identificar elementos dentro de listas.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ModelEditText(
    val id: String? = null,
    val icon: String? = null,
    val fontFamily: String,
    val content: String? = null,
    val url: String? = null,
    val md: ModelPropertiesText,
    val sm: ModelPropertiesText,
    val xs: ModelPropertiesText
)

/**
 * Propiedades de imagen responsive.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ModelPropertiesImage(
    val width: Double,
    val height: Double,
    val alignHorizontal: String,
    val alignVertical: String,
    val imageBackPosition: String? = null,
    val imageBackRepeat: String? = null,
    val imageBackSize: String? = null
)

/**
 * Imagen editable con propiedades responsive.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ModelEditImage(
    val id: String? = null, 
    val content: String?,
    val md: ModelPropertiesImage,
    val sm: ModelPropertiesImage,
    val xs: ModelPropertiesImage,
    val label: ModelEditText? = null 
)

/**
 * Propiedades de iconos responsive.
 */
data class ModelPropertiesIcon(
    val iconSize: Double? = null,
    val width: Double? = null,
    val height: Double? = null,
    val alignHorizontal: String,
    val color: List<Double>,
    val background: List<Double>
)

/**
 * Icono editable con propiedades responsive.
 */
data class ModelEditIcon(
    val content: String,
    val md: ModelPropertiesIcon,
    val sm: ModelPropertiesIcon,
    val xs: ModelPropertiesIcon
)

/**
 * Propiedades de items (botones, elementos interactivos) responsive.
 */
data class ModelPropertiesItem(
    val fontSize: Double,
    val alignHorizontal: String,
    val width: Double,
    val height: Double,
    val color: List<Double>,
    val background: List<Double>
)

/**
 * Item editable con propiedades responsive.
 */
data class ModelEditItem(
    val id: String? = null,
    val icon: String? = null,
    val fontFamily: String? = null,
    val content: String? = null,
    val url: String? = null,
    val md: ModelPropertiesItem,
    val sm: ModelPropertiesItem,
    val xs: ModelPropertiesItem
)

/**
 * Color de fondo.
 */
data class BackgroundColor(
    val content: List<Double>
)

/**
 * Sección de portada de la invitación.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionCoverProps(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor? = null,
    val background: ModelEditImage? = null,
    val subtitle: ModelEditText? = null,
    val title: ModelEditText,
    val date: DateItem,
    val button: ModelEditItem,
    val coverImage: ModelEditImage
)

/**
 * Elemento de fecha para la portada.
 */
data class DateItem(
    val day: String? = null,
    val hours: String? = null,
    val md: ModelPropertiesItem,
    val sm: ModelPropertiesItem,
    val xs: ModelPropertiesItem
)

/**
 * Sección de la pareja (novios) o persona celebrada.
 * Se usan campos nullable para soportar tanto Boda como XV/Bautizo.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionCoupleData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val heading: ModelEditText,
    val datetime: ModelEditText,
    
    val subheading: ModelEditText? = null,
    val icon: ModelEditIcon? = null,
    
    // Campos Boda
    val groomName: ModelEditText? = null,
    val brideName: ModelEditText? = null,
    val groomPhoto: ModelEditImage? = null,
    val bridePhoto: ModelEditImage? = null,
    val groomText: ModelEditText? = null,
    val brideText: ModelEditText? = null,
    val message: ModelEditText? = null,
    
    // Campos XV/Otros
    val namePersonEvent: ModelEditText? = null,
    val photoPersonEvent: ModelEditImage? = null,
    val imageTopBg: ModelEditImage? = null,
    val imageBottomBg: ModelEditImage? = null
)

/**
 * Sección de eventos.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionEventData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor? = null,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val singleplace: Boolean,
    val locationText: ModelEditText? = null,
    val items: List<EventCard>? = null,
    @get:JsonIgnore
    val itemsSinglePlace: List<EventSinglePlaceCard>? = null
)

/**
 * Tarjeta de evento.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class EventCard(
    val id: String? = null,
    val title: ModelEditText,
    val date: EventDate,
    val time: EventTime,
    val locationText: ModelEditText,
    val locationButton: ModelEditItem? = null,
    val locationDatetime: ModelEditText? = null
)

/**
 * Tarjeta de evento single place.
 */
data class EventSinglePlaceCard(
    val id: String? = null,
    val title: ModelEditText,
    val date: ModelEditText,
    val time: ModelEditText,
    val locationText: ModelEditText? = null
)

/**
 * Fecha del evento.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class EventDate(
    val icon: ModelEditIcon? = null,
    val timeStart: ModelEditText,
    val timeEnd: ModelEditText
)

/**
 * Hora del evento.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class EventTime(
    val icon: ModelEditIcon? = null,
    val dateDay: ModelEditText,
    val dateMonthYear: ModelEditText
)

/**
 * Sección de galería.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionGalleryData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val intro: ModelEditText,
    val items: List<ModelEditImage>? = null,
    val hashtags: List<Hashtag>? = null
)

/**
 * Hashtag.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class Hashtag(
    val url: String? = null,
    val icon: String? = null,
    val content: String? = null,
    val fontFamily: String,
    val md: ModelPropertiesText,
    val sm: ModelPropertiesText,
    val xs: ModelPropertiesText
)

/**
 * Sección de sugerencias.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionGifttableData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val items: List<GifttableItem>
)

/**
 * items de gifttable.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class GifttableItem(
    val id: String,
    val type: String?,
    val image: ModelEditImage?,
    val title: ModelEditText,
    val body: List<ModelEditText>,
    val linkHref: String? = null
)

/**
 * Sección de sugerencias.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionSuggestionsData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val items: List<SuggestionItem>
)

/**
 * Item de sugerencia.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SuggestionItem(
    val id: String? = null,
    val image: ModelEditImage,
    val title: ModelEditText,
    val body: List<ModelEditText>,
    val linkHref: String? = null
)

/**
 * Sección de amenidades.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionAmenitiesData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val items: List<SuggestionItem>
)

/**
 * Sección de confirmación.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionStartedData(
    val visibility: Boolean = true,
    val backgroundColor: BackgroundColor? = null,
    @JsonProperty("limit_confirm")
    val limitConfirm: ModelEditText,
    val background: ModelEditImage,
    val title: ModelEditText,
    val note: ModelEditText
)

/**
 * Sección de familia (padres, padrinos).
 * Se estandariza 'intro' como una lista nullable.
 * El JSON de bodas debe actualizarse para enviar intro como [ { ... } ].
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionFamilyData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText? = null,
    val intro: List<ModelEditText>?,
    val items: List<FamilyItem>
)
/**
 * Item de familia.
 * Soporta recursividad para grupos (XV Años) y estructura plana (Bodas).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class FamilyItem(
    val id: String? = null,
    val label: ModelEditText? = null,
    val text: ModelEditText? = null,
    val title: ModelEditText? = null,
    val image: ModelEditImage? = null,
    val items: List<FamilyItem>? = null,
    val showImage: Boolean? = null   
)


/**
 * Item de familia.
 * Soporta recursividad para grupos (XV Años) y estructura plana (Bodas).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
data class FamilySubItem(
    val id: String? = null,
    val label: ModelEditText? = null,
    val text: ModelEditText? = null,
    // val title: ModelEditText? = null,
    val image: ModelEditImage? = null,
    // val items: List<FamilyItem>? = null
)

/**
 * Sección de historia.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionStoryData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val items: List<StoryItem>
)

/**
 * Item de historia.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class StoryItem(
    val id: String? = null,
    val image: ModelEditImage,
    val title: ModelEditText,
    val date: ModelEditText,
    val body: ModelEditText
)

/**
 * Sección de código de vestimenta.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionDressCodeData(
    val visibility: Boolean,
    val backgroundColor: BackgroundColor,
    val background: ModelEditImage? = null,
    val title: ModelEditText,
    val items: List<DressCodeItem>
)

/**
 * Item de código de vestimenta.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class DressCodeItem(
    val id: String? = null,
    val image: ModelEditImage,
    val title: ModelEditText,
    val bullet: ModelEditText
)

/**
 * Sección de pie de página.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SectionFooterData(
    val logoUrl: String? = null,
    val linkHref: String? = null,
    val smallText: SmallText
)

/**
 * Texto pequeño del footer.
 */
data class SmallText(
    val fontFamily: String,
    val content: String? = null
)