package mx.evolutiondev.invitaciones.modules.templates2.catalog

/**
 * El paquete **tal como llegó**, ya normalizado a `ruta relativa → bytes` con la disposición exacta de
 * `01 §2.1`:
 *
 * ```
 * templates/<slug>/<version>/
 *   template.json      theme.json      defaults.json
 *   assets/<nombre>.<ext>              migrations/<from>-to-<version>.json
 * ```
 *
 * Las rutas van con `/`, sin `./`, sin `..` y sin prefijo: `template.json`, `assets/preview.webp`,
 * `migrations/0.9.0-to-1.0.0.json`. Es la **única** forma que consume [TemplatePackageParser], venga
 * el paquete de un directorio, de un ZIP o de un `multipart/form-data` — así el registro por HTTP y
 * el de línea de comandos recorren exactamente el mismo código (P4).
 *
 * `slugDeclarado`/`versionDeclarada` solo los rellena el lector de directorio/ZIP cuando el árbol trae
 * `templates/<slug>/<version>/`: si están, el parser comprueba que coinciden con el manifiesto y
 * rechaza si no (P1: un paquete guardado en la carpeta equivocada no se registra en silencio).
 */
class RawTemplatePackage(
    val files: Map<String, ByteArray>,
    val slugDeclarado: String? = null,
    val versionDeclarada: String? = null,
) {
    val assetPaths: List<String> get() = files.keys.filter { it.startsWith(ASSETS_DIR) }.sorted()
    val migrationPaths: List<String> get() = files.keys.filter { it.startsWith(MIGRATIONS_DIR) }.sorted()

    fun bytes(path: String): ByteArray? = files[path]

    companion object {
        const val MANIFEST = "template.json"
        const val THEME = "theme.json"
        const val DEFAULTS = "defaults.json"
        const val ASSETS_DIR = "assets/"
        const val MIGRATIONS_DIR = "migrations/"

        /** Los tres `.json` obligatorios de `01 §2.1`. */
        val OBLIGATORIOS = listOf(MANIFEST, THEME, DEFAULTS)
    }
}

/**
 * Una parte de `multipart/form-data` (`03 §3.17`) o una entrada de ZIP, antes de normalizar la ruta.
 * `partName` es el nombre de la parte (`template`, `theme`, `defaults`, `migrations`, `assets`, o ya
 * la ruta relativa `assets/<archivo>`); `fileName` es el nombre de archivo original, si lo hay.
 */
data class PackagePart(val partName: String, val fileName: String?, val bytes: ByteArray) {
    override fun equals(other: Any?): Boolean =
        other is PackagePart && other.partName == partName && other.fileName == fileName &&
            other.bytes.contentEquals(bytes)

    override fun hashCode(): Int = (31 * partName.hashCode() + (fileName?.hashCode() ?: 0)) * 31 + bytes.size
}

/** Límites del paquete de plantilla (`03 §8`, fila "Paquete de plantilla"; `03 §3.17`). */
object PackageLimits {
    /** `manifest.ts` `AssetEntry.bytes` y `ck_tpl_asset_bytes` de `02 §2` V31. */
    const val MAX_ASSET_BYTES: Int = 15_728_640

    /** `manifest.ts` `TemplateManifest.assets`. */
    const val MAX_ASSETS: Int = 200

    /** `template` + `theme` + `defaults` + `migrations` sumados. */
    const val MAX_JSON_BYTES: Int = 2 * 1024 * 1024

    /** `^assets/[a-z0-9][a-z0-9._-]{0,99}$` (`01 §2.1`). */
    val ASSET_NAME: Regex = Regex("^[a-z0-9][a-z0-9._-]{0,99}$")

    /** `migrations/<from>-to-<version>.json`; el nombre exacto lo comprueba el parser. */
    val MIGRATION_NAME: Regex = Regex("^[0-9a-z.\\-]{1,60}\\.json$")
}
