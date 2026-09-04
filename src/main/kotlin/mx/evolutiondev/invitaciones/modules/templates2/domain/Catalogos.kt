package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Enumerados cerrados espejo de `frontend/packages/schema/src/common.ts`, `blocks.ts` y `manifest.ts`.
 * `wire` es el literal que viaja en JSON; el nombre Kotlin nunca se serializa.
 */
interface WireEnum { val wire: String }

/** Espejo de `common.ts` `Locale`. Ampliar solo por ADR. */
enum class Locale(override val wire: String) : WireEnum {
    ES_MX("es-MX"), ES_ES("es-ES"), EN_US("en-US");
    companion object { fun of(w: String): Locale? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `common.ts` `EventKind` (sustituye a `eventTypeId == 1L`, H-20). */
enum class EventKind(override val wire: String) : WireEnum {
    WEDDING("wedding"), QUINCE("quince"), BAPTISM("baptism"), COMMUNION("communion"),
    CONFIRMATION("confirmation"), BIRTHDAY("birthday"), GRADUATION("graduation"), GENERIC("generic");
    companion object { fun of(w: String): EventKind? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `manifest.ts` `SectionType` — catálogo cerrado de 12 (`01 §3.1`). */
enum class SectionType(override val wire: String) : WireEnum {
    COVER("cover"), CELEBRANT("celebrant"), EVENT("event"), GALLERY("gallery"), GIFT_TABLE("giftTable"),
    SUGGESTIONS("suggestions"), AMENITIES("amenities"), RSVP("rsvp"), FAMILY("family"), STORY("story"),
    DRESS_CODE("dressCode"), FOOTER("footer");
    companion object { fun of(w: String): SectionType? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `manifest.ts` `Capability`. Nunca un `templateId` mágico (H-11). */
enum class Capability(override val wire: String) : WireEnum {
    SINGLE_PLACE("singlePlace"), STORY("story"), HASHTAGS("hashtags"), MUSIC("music"), COUNTDOWN("countdown");
    companion object { fun of(w: String): Capability? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `blocks.ts` `BlockKind` — catálogo cerrado de 14 (`01 §3.2`). */
enum class BlockKind(override val wire: String) : WireEnum {
    TEXT("text"), RICH_TEXT("richText"), LIST_TEXT("listText"), IMAGE("image"), AUDIO("audio"),
    DATE("date"), TIME("time"), DATE_TIME_RANGE("dateTimeRange"), LINK("link"), LOCATION("location"),
    CHOICE("choice"), BOOLEAN("boolean"), PERSON("person"), GROUP("group");
    companion object { fun of(w: String): BlockKind? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `blocks.ts` `SpecBase.source`: enum de TRES valores, nunca `"business:<campo>"` (contratos §3). */
enum class BlockSource(override val wire: String) : WireEnum {
    USER("user"), BUSINESS("business"), FIXED("fixed");
    companion object { fun of(w: String): BlockSource? = entries.firstOrNull { it.wire == w } }
}

/**
 * Espejo de `blocks.ts` `BusinessField`. `expectedType` es la tabla `BUSINESS_TYPE` de `invariants.ts`,
 * que I-06 usa para exigir el tipo de bloque correcto.
 */
enum class BusinessField(override val wire: String, val expectedType: BlockKind) : WireEnum {
    INVITATION_DATE("invitation.date", BlockKind.DATE),
    INVITATION_TIME("invitation.time", BlockKind.TIME),
    INVITATION_HASHTAG("invitation.hashtag", BlockKind.TEXT),
    INVITATION_COVER_PHOTO_URL("invitation.coverPhotoUrl", BlockKind.IMAGE),
    INVITATION_CHILDREN_ALLOWED("invitation.childrenAllowed", BlockKind.BOOLEAN),
    INVITATION_YOUNG_ALLOWED("invitation.youngAllowed", BlockKind.BOOLEAN);
    companion object { fun of(w: String): BusinessField? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `composed.ts` `Provenance` (R3 de `01 §5.2`). */
enum class Provenance(override val wire: String) : WireEnum {
    USER("user"), DEFAULT("default"), BUSINESS("business"), FIXED("fixed"), EMPTY("empty");
    companion object { fun of(w: String): Provenance? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `blocks.ts` `RichSpan.marks`. */
enum class RichMark(override val wire: String) : WireEnum {
    BOLD("bold"), ITALIC("italic");
    companion object { fun of(w: String): RichMark? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `blocks.ts` `ImageSpec.constraints.aspect`. Se verifica en el reductor (X-06), no aquí. */
enum class ImageAspect(override val wire: String) : WireEnum {
    FREE("free"), SQUARE("square"), PORTRAIT("portrait"), LANDSCAPE("landscape"), WIDE("wide");
    companion object { fun of(w: String): ImageAspect? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `manifest.ts` `AssetEntry.contentType`. */
enum class AssetContentType(override val wire: String) : WireEnum {
    IMAGE_WEBP("image/webp"), IMAGE_PNG("image/png"), IMAGE_JPEG("image/jpeg"),
    IMAGE_SVG("image/svg+xml"), AUDIO_MPEG("audio/mpeg"), FONT_WOFF2("font/woff2");
    companion object { fun of(w: String): AssetContentType? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `manifest.ts` `FontFace.source`. Autoalojada siempre; `google` solo con lista blanca (ADR-1R-F-07). */
enum class FontSource(override val wire: String) : WireEnum {
    GOOGLE("google"), BUNDLED("bundled");
    companion object { fun of(w: String): FontSource? = entries.firstOrNull { it.wire == w } }
}

/** Espejo de `manifest.ts` `MigrationOp.changeBlockType.converterId`. */
enum class ConverterId(override val wire: String) : WireEnum {
    TEXT_TO_RICH_TEXT("textToRichText"), RICH_TEXT_TO_TEXT("richTextToText"),
    TEXT_TO_LIST_TEXT("textToListText"), LIST_TEXT_TO_TEXT("listTextToText");
    companion object { fun of(w: String): ConverterId? = entries.firstOrNull { it.wire == w } }
}

/**
 * Espejo **literal** de `blocks.ts` `BlockRole`. La fuente normativa de los roles es `blocks.ts`,
 * no la prosa de `01 §3.3` (contratos.md §3).
 */
enum class BlockRole(override val wire: String) : WireEnum {
    COVER_TITLE("coverTitle"), COVER_SUBTITLE("coverSubtitle"), COVER_DATE("coverDate"),
    COVER_IMAGE("coverImage"), COVER_BUTTON_LABEL("coverButtonLabel"), COVER_BACKGROUND("coverBackground"),
    CELEBRANT_A("celebrantA"), CELEBRANT_B("celebrantB"), HONOREE("honoree"),
    CELEBRANT_A_PHOTO("celebrantAPhoto"), CELEBRANT_B_PHOTO("celebrantBPhoto"), HONOREE_PHOTO("honoreePhoto"),
    CELEBRANT_A_TEXT("celebrantAText"), CELEBRANT_B_TEXT("celebrantBText"), HONOREE_MESSAGE("honoreeMessage"),
    CELEBRANTS_HEADING("celebrantsHeading"), CELEBRANTS_DATE("celebrantsDate"),
    FAMILY_INTRO("familyIntro"), PARENT_A1("parentA1"), PARENT_A2("parentA2"), PARENT_B1("parentB1"),
    PARENT_B2("parentB2"), GODPARENT_A("godparentA"), GODPARENT_B("godparentB"),
    PERSON_NAME("personName"), PERSON_PHOTO("personPhoto"), PERSON_LABEL("personLabel"),
    FAMILY_GROUP_TITLE("familyGroupTitle"),
    EVENT_TITLE("eventTitle"), EVENT_WHEN("eventWhen"), EVENT_DATE("eventDate"), EVENT_TIME("eventTime"),
    EVENT_PLACE("eventPlace"), EVENT_MAP_LINK("eventMapLink"), EVENT_NOTE("eventNote"),
    GALLERY_PHOTO("galleryPhoto"), GALLERY_INTRO("galleryIntro"), HASHTAG("hashtag"), HASHTAG_LINK("hashtagLink"),
    GIFT_OPTION_TITLE("giftOptionTitle"), GIFT_OPTION_DETAIL("giftOptionDetail"),
    GIFT_OPTION_IMAGE("giftOptionImage"), GIFT_OPTION_LINK("giftOptionLink"), GIFT_OPTION_KIND("giftOptionKind"),
    SUGGESTION_NAME("suggestionName"), SUGGESTION_DETAIL("suggestionDetail"),
    SUGGESTION_IMAGE("suggestionImage"), SUGGESTION_LINK("suggestionLink"),
    AMENITY_NAME("amenityName"), AMENITY_DETAIL("amenityDetail"),
    AMENITY_IMAGE("amenityImage"), AMENITY_LINK("amenityLink"),
    STORY_TITLE("storyTitle"), STORY_DATE("storyDate"), STORY_BODY("storyBody"), STORY_IMAGE("storyImage"),
    DRESS_CODE_TITLE("dressCodeTitle"), DRESS_CODE_DETAIL("dressCodeDetail"), DRESS_CODE_IMAGE("dressCodeImage"),
    RSVP_DEADLINE("rsvpDeadline"), RSVP_NOTE("rsvpNote"), RSVP_BACKGROUND("rsvpBackground"),
    FOOTER_NOTE("footerNote"), FOOTER_LOGO("footerLogo"), FOOTER_LINK("footerLink"),
    BACKGROUND_MUSIC("backgroundMusic"), BACKGROUND_MUSIC_ENABLED("backgroundMusicEnabled"),
    SECTION_TITLE("sectionTitle"), SECTION_INTRO("sectionIntro"),
    SECTION_BACKGROUND("sectionBackground"), DECORATIVE("decorative"),
    WITNESS("witness"), CELEBRANTS_MESSAGE("celebrantsMessage"), COVER_BUTTON_LINK("coverButtonLink"),
    HASHTAG_PLATFORM("hashtagPlatform"), RSVP_KIDS_NOTE("rsvpKidsNote"),
    RSVP_CHILDREN_ALLOWED("rsvpChildrenAllowed"), RSVP_YOUNG_ALLOWED("rsvpYoungAllowed"),
    PERSON_PHOTO_VISIBLE("personPhotoVisible"), EVENT_LOCATION_NOTE("eventLocationNote"),
    // ROLES DE GRUPO (I-25): solo un bloque `group` puede llevarlos.
    FAMILY_GROUP("familyGroup"), EVENT_CARDS("eventCards"), GALLERY_PHOTOS("galleryPhotos"),
    STORY_MILESTONES("storyMilestones"), GIFT_OPTIONS("giftOptions"), SUGGESTION_LIST("suggestionList"),
    AMENITY_LIST("amenityList"), DRESS_CODE_RULES("dressCodeRules"), HASHTAG_LIST("hashtagList"),
    PERSON_LIST("personList");

    companion object {
        fun of(w: String): BlockRole? = entries.firstOrNull { it.wire == w }

        /** `blocks.ts` `GROUP_ROLES` — roles reservados a bloques `group` (I-25). */
        val GROUP_ROLES: Set<BlockRole> = setOf(
            FAMILY_GROUP, EVENT_CARDS, GALLERY_PHOTOS, STORY_MILESTONES, GIFT_OPTIONS,
            SUGGESTION_LIST, AMENITY_LIST, DRESS_CODE_RULES, HASHTAG_LIST, PERSON_LIST,
        )

        /** `blocks.ts` `SINGLETON_ROLES` — como mucho un bloque por manifiesto puede llevarlos (I-26). */
        val SINGLETON_ROLES: Set<BlockRole> = setOf(
            CELEBRANT_A, CELEBRANT_B, HONOREE, CELEBRANT_A_PHOTO, CELEBRANT_B_PHOTO, HONOREE_PHOTO,
            PARENT_A1, PARENT_A2, PARENT_B1, PARENT_B2,
            COVER_TITLE, COVER_SUBTITLE, COVER_DATE, COVER_IMAGE,
            RSVP_DEADLINE, BACKGROUND_MUSIC, HASHTAG,
        )
    }
}

/**
 * Espejo de `common.ts` `LocalizedText`: al menos `es-MX`. Se modela como mapa porque I-27 comprueba
 * la presencia de cada `Locale` que declara el manifiesto (`typeof t[loc] !== "string"`).
 */
@JvmInline
value class LocalizedText(val byLocale: Map<Locale, String>) {
    operator fun get(locale: Locale): String? = byLocale[locale]
    /** Texto en el locale pedido, con caída a `es-MX` (la caída la registra I-27, nunca es silenciosa). */
    fun resolve(locale: Locale): String = byLocale[locale] ?: byLocale[Locale.ES_MX] ?: ""
}
