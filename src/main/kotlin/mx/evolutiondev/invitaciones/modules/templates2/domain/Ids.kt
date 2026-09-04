package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Patrones espejo de `frontend/packages/schema/src/common.ts`. Son la **misma** expresión regular,
 * transcrita literalmente; cualquier cambio aquí sin cambiarla allí rompe P1.
 */
object Patterns {
    /** `common.ts` `BLOCK_ID_PATTERN` */
    val BLOCK_ID = Regex("^[a-z][a-zA-Z0-9]{0,29}(\\.[a-z][a-zA-Z0-9]{0,29}){0,3}$")
    /** `common.ts` `SECTION_KEY_PATTERN` */
    val SECTION_KEY = Regex("^[a-z][a-zA-Z0-9]{0,39}$")
    /** `common.ts` `TemplateSlug` */
    val TEMPLATE_SLUG = Regex("^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$")
    /** `common.ts` `Semver` (sin prerelease ni build) */
    val SEMVER = Regex("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$")
    /** `common.ts` `ULID_PATTERN` (Crockford base32 en mayúsculas) */
    val ULID = Regex("^[0-9A-HJKMNP-TV-Z]{26}$")
    /** `common.ts` `AssetId` */
    val ASSET_ID = Regex("^as_[0-9A-HJKMNP-TV-Z]{26}$")
    /** `common.ts` `TempId` */
    val TEMP_ID = Regex("^tmp:[A-Za-z0-9_-]{8,64}$")
    /** `common.ts` `Ident` */
    val IDENT = Regex("^[a-z][a-z0-9-]{0,39}$")
    /** `document.ts` `AtticKey` — `<slug>@<semver>` con las mismas reglas que slug y semver */
    val ATTIC_KEY = Regex("^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])@(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$")
    /** `02 §2` — `public_token` del render público: prefijo + ULID */
    val PUBLIC_TOKEN = Regex("^pub_[0-9A-HJKMNP-TV-Z]{26}$")
    /** `common.ts` `HttpUrl` */
    val HTTP_URL = Regex("^https?://[^\\s/$.?#].[^\\s]*$", RegexOption.IGNORE_CASE)
    /** `common.ts` `HexColor` */
    val HEX_COLOR = Regex("^#[0-9a-fA-F]{6}$")
    /** `manifest.ts` `AssetEntry.sha256` — digesto de archivo suelto, sin prefijo de algoritmo */
    val SHA256_HEX = Regex("^[a-f0-9]{64}$")
    /** `02 §2` — hash con prefijo de algoritmo (`package_hash`, `content_hash`), decisión X-01/X-02 */
    val PREFIXED_SHA256 = Regex("^sha256:[0-9a-f]{64}$")
}

private fun exigir(patron: Regex, valor: String, tipo: String): String {
    if (!patron.matches(valor)) throw Templates2Exception.MalformedJson(
        "$tipo inválido: \"$valor\" no casa con ${patron.pattern}",
        mapOf("type" to tipo, "value" to valor),
    )
    return valor
}

/** Espejo de `common.ts` `TemplateSlug`. Rechaza en el constructor (`02 §7.1`). */
@JvmInline
value class TemplateSlug(val value: String) {
    init { exigir(Patterns.TEMPLATE_SLUG, value, "TemplateSlug") }
    override fun toString(): String = value
}

/** Espejo de `common.ts` `BlockId`. */
@JvmInline
value class BlockId(val value: String) {
    init { exigir(Patterns.BLOCK_ID, value, "BlockId") }
    override fun toString(): String = value
}

/** Espejo de `common.ts` `SectionKey`. */
@JvmInline
value class SectionKey(val value: String) {
    init { exigir(Patterns.SECTION_KEY, value, "SectionKey") }
    override fun toString(): String = value
}

/** Espejo de `common.ts` `AssetId` (`as_<ULID>`). Nunca una URL dentro del documento (ADR-021). */
@JvmInline
value class AssetId(val value: String) {
    init { exigir(Patterns.ASSET_ID, value, "AssetId") }
    override fun toString(): String = value
    companion object {
        /** `AssetId.of(ulid)` — construye el id a partir del ULID que genera `UlidGenerator` (P8). */
        fun of(ulid: String): AssetId = AssetId("as_$ulid")
    }
}

/** Token público estable del render (`02 §2` V32, `pub_<ULID>`). 80 bits de entropía (ULID). */
@JvmInline
value class PublicToken(val value: String) {
    init { exigir(Patterns.PUBLIC_TOKEN, value, "PublicToken") }
    override fun toString(): String = value
    companion object { fun of(ulid: String): PublicToken = PublicToken("pub_$ulid") }
}

/** Espejo de `common.ts` `ItemId` — ULID definitivo de un ítem de grupo. El cliente nunca lo aporta (ADR-020). */
@JvmInline
value class ItemId(val value: String) {
    init { exigir(Patterns.ULID, value, "ItemId") }
    override fun toString(): String = value
}

/** Revisión optimista de `tpl_document` (ADR-014). No negativa. */
@JvmInline
value class Revision(val value: Long) {
    init {
        if (value < 0) throw Templates2Exception.MalformedJson(
            "Revision inválida: $value (no puede ser negativa)", mapOf("value" to value),
        )
    }
    fun next(): Revision = Revision(value + 1)
    override fun toString(): String = value.toString()
}

/**
 * Espejo de `common.ts` `Semver`: versión publicada, sin prerelease ni build (`02 §7.1`).
 * Comparable para poder ordenar las versiones de una plantilla en el catálogo.
 */
data class SemverVersion(val major: Int, val minor: Int, val patch: Int) : Comparable<SemverVersion> {
    override fun compareTo(other: SemverVersion): Int =
        compareValuesBy(this, other, { it.major }, { it.minor }, { it.patch })

    override fun toString(): String = "$major.$minor.$patch"

    companion object {
        fun parse(texto: String): SemverVersion {
            exigir(Patterns.SEMVER, texto, "SemverVersion")
            val p = texto.split(".")
            return SemverVersion(p[0].toInt(), p[1].toInt(), p[2].toInt())
        }
    }
}
