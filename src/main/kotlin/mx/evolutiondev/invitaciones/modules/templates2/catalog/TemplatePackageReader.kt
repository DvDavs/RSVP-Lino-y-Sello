package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import java.io.File
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * Lee un paquete de plantilla desde un **directorio**, un **ZIP** o las **partes de un multipart**
 * (`03 §3.17`) y lo normaliza al `ruta → bytes` de [RawTemplatePackage] (`01 §2.1`).
 *
 * Es la puerta donde muere el "nada se descarta en silencio" (P1) del formato de paquete: cualquier
 * archivo, parte o entrada de ZIP que no esté en el árbol de `01 §2.1` **rechaza el registro entero**,
 * nombrándolo. `01 §2.1` llama a ese caso `TPL_PACKAGE_UNEXPECTED_FILE`, que **no** existe en el
 * catálogo cerrado de `03 §5` ni en `domain.TplErrorCode`; hasta que una ADR lo añada se reporta como
 * `TPL_MANIFEST_INVALID` con `details.packageError = "TPL_PACKAGE_UNEXPECTED_FILE"` y la lista de
 * rutas, de modo que el autor de la plantilla ve exactamente qué sobra (ADR-2-3-02).
 *
 * Puro y sin Spring: `MultipartFile` se convierte a [PackagePart] en el controlador, no aquí.
 */
object TemplatePackageReader {

    /** Directorio `templates/<slug>/<version>/`. Recorre recursivamente y rechaza lo que no toca. */
    fun fromDirectory(dir: File): RawTemplatePackage {
        if (!dir.isDirectory) throw Templates2Exception.ManifestInvalid(
            "el paquete no es un directorio: ${dir.absolutePath}",
            mapOf("packageError" to "TPL_PACKAGE_NOT_FOUND", "path" to dir.absolutePath),
        )
        val raiz = dir.absoluteFile
        val encontrados = LinkedHashMap<String, ByteArray>()
        val inesperados = mutableListOf<String>()
        raiz.walkTopDown().forEach { f ->
            if (f.isFile) {
                val rel = f.absoluteFile.relativeTo(raiz).path.replace(File.separatorChar, '/')
                if (esRutaDePaquete(rel)) encontrados[rel] = f.readBytes() else inesperados.add(rel)
            }
        }
        rechazarInesperados(inesperados)
        val version = raiz.name
        val slug = raiz.parentFile?.name
        val esArbolCanonico = raiz.parentFile?.parentFile?.name == "templates"
        return construir(
            encontrados,
            if (esArbolCanonico) slug else null,
            if (esArbolCanonico) version else null,
        )
    }

    /** ZIP con el árbol de `01 §2.1`, con o sin carpeta raíz que lo envuelva. */
    fun fromZip(input: InputStream): RawTemplatePackage {
        val crudas = LinkedHashMap<String, ByteArray>()
        ZipInputStream(input).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    val nombre = entry.name.replace('\\', '/')
                    if (nombre.split("/").any { it == ".." } || nombre.startsWith("/")) {
                        throw Templates2Exception.ManifestInvalid(
                            "entrada de ZIP con ruta peligrosa: \"$nombre\"",
                            mapOf("packageError" to "TPL_PACKAGE_UNEXPECTED_FILE", "path" to nombre),
                        )
                    }
                    if (crudas.containsKey(nombre)) throw Templates2Exception.ManifestInvalid(
                        "entrada de ZIP duplicada: \"$nombre\"",
                        mapOf("packageError" to "TPL_PACKAGE_UNEXPECTED_FILE", "path" to nombre),
                    )
                    crudas[nombre] = zip.readBytes()
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }
        val anclaje = crudas.keys.filter { it == RawTemplatePackage.MANIFEST || it.endsWith("/" + RawTemplatePackage.MANIFEST) }
            .minByOrNull { it.length }
            ?: throw Templates2Exception.ManifestInvalid(
                "el ZIP no contiene ${RawTemplatePackage.MANIFEST} (01 §2.1)",
                mapOf("packageError" to "TPL_PACKAGE_UNEXPECTED_FILE", "entries" to crudas.keys.sorted()),
            )
        val prefijo = anclaje.removeSuffix(RawTemplatePackage.MANIFEST)
        val encontrados = LinkedHashMap<String, ByteArray>()
        val inesperados = mutableListOf<String>()
        for ((nombre, bytes) in crudas) {
            if (!nombre.startsWith(prefijo)) { inesperados.add(nombre); continue }
            val rel = nombre.removePrefix(prefijo)
            if (esRutaDePaquete(rel)) encontrados[rel] = bytes else inesperados.add(nombre)
        }
        rechazarInesperados(inesperados)
        val segmentos = prefijo.trim('/').split("/").filter { it.isNotEmpty() }
        val canonico = segmentos.size >= 3 && segmentos[segmentos.size - 3] == "templates"
        return construir(
            encontrados,
            if (canonico) segmentos[segmentos.size - 2] else null,
            if (canonico) segmentos[segmentos.size - 1] else null,
        )
    }

    /**
     * Partes de `multipart/form-data` (`03 §3.17`): `template`, `theme`, `defaults`, `migrations`
     * (0..n) y `assets` (0..200). El nombre de parte de un asset puede ser ya la ruta relativa
     * (`assets/fondo.webp`) o el literal `assets`, en cuyo caso la ruta se compone con el nombre de
     * archivo original. Cualquier otro nombre de parte se rechaza nombrándolo.
     */
    fun fromParts(parts: List<PackagePart>): RawTemplatePackage {
        val encontrados = LinkedHashMap<String, ByteArray>()
        val inesperados = mutableListOf<String>()
        for (p in parts) {
            val ruta = rutaDeParte(p)
            if (ruta == null || !esRutaDePaquete(ruta)) { inesperados.add(p.partName + (p.fileName?.let { " ($it)" } ?: "")); continue }
            if (encontrados.containsKey(ruta)) throw Templates2Exception.ManifestInvalid(
                "dos partes del multipart apuntan al mismo archivo del paquete: \"$ruta\"",
                mapOf("packageError" to "TPL_PACKAGE_UNEXPECTED_FILE", "path" to ruta),
            )
            encontrados[ruta] = p.bytes
        }
        rechazarInesperados(inesperados)
        return construir(encontrados, null, null)
    }

    private fun rutaDeParte(p: PackagePart): String? {
        val nombre = p.partName.replace('\\', '/').trim()
        val archivo = p.fileName?.replace('\\', '/')?.substringAfterLast('/')?.trim()
        return when {
            nombre == "template" -> RawTemplatePackage.MANIFEST
            nombre == "theme" -> RawTemplatePackage.THEME
            nombre == "defaults" -> RawTemplatePackage.DEFAULTS
            nombre == "migrations" -> archivo?.let { RawTemplatePackage.MIGRATIONS_DIR + it }
            nombre == "assets" -> archivo?.let { RawTemplatePackage.ASSETS_DIR + it }
            nombre == RawTemplatePackage.MANIFEST || nombre == RawTemplatePackage.THEME ||
                nombre == RawTemplatePackage.DEFAULTS -> nombre
            nombre.startsWith(RawTemplatePackage.ASSETS_DIR) ||
                nombre.startsWith(RawTemplatePackage.MIGRATIONS_DIR) -> nombre
            else -> null
        }
    }

    /** El árbol **exacto** de `01 §2.1`: nada más se acepta. */
    private fun esRutaDePaquete(rel: String): Boolean {
        if (rel.isEmpty() || rel.startsWith("/") || rel.contains("//")) return false
        if (rel.split("/").any { it == "." || it == ".." || it.isEmpty() }) return false
        if (rel in RawTemplatePackage.OBLIGATORIOS) return true
        if (rel.startsWith(RawTemplatePackage.ASSETS_DIR)) {
            val nombre = rel.removePrefix(RawTemplatePackage.ASSETS_DIR)
            return !nombre.contains("/") && PackageLimits.ASSET_NAME.matches(nombre)
        }
        if (rel.startsWith(RawTemplatePackage.MIGRATIONS_DIR)) {
            val nombre = rel.removePrefix(RawTemplatePackage.MIGRATIONS_DIR)
            return !nombre.contains("/") && PackageLimits.MIGRATION_NAME.matches(nombre)
        }
        return false
    }

    private fun rechazarInesperados(inesperados: List<String>) {
        if (inesperados.isEmpty()) return
        throw Templates2Exception.ManifestInvalid(
            "el paquete trae ${inesperados.size} archivo(s) fuera del árbol de 01 §2.1: " +
                inesperados.sorted().joinToString(", "),
            mapOf("packageError" to "TPL_PACKAGE_UNEXPECTED_FILE", "unexpected" to inesperados.sorted()),
        )
    }

    /** Comprueba presencia de los tres obligatorios y los límites de `03 §8` antes de devolver. */
    private fun construir(files: Map<String, ByteArray>, slug: String?, version: String?): RawTemplatePackage {
        val faltan = RawTemplatePackage.OBLIGATORIOS.filter { !files.containsKey(it) }
        if (faltan.isNotEmpty()) throw Templates2Exception.ManifestInvalid(
            "faltan archivos obligatorios del paquete: ${faltan.joinToString(", ")} (01 §2.1)",
            mapOf("packageError" to "TPL_PACKAGE_INCOMPLETE", "missing" to faltan),
        )
        val assets = files.filterKeys { it.startsWith(RawTemplatePackage.ASSETS_DIR) }
        if (assets.size > PackageLimits.MAX_ASSETS) throw Templates2Exception.ManifestInvalid(
            "el paquete trae ${assets.size} assets; el máximo es ${PackageLimits.MAX_ASSETS} (03 §8)",
            mapOf("packageError" to "TPL_PACKAGE_TOO_MANY_ASSETS", "count" to assets.size),
        )
        val grande = assets.entries.firstOrNull { it.value.size > PackageLimits.MAX_ASSET_BYTES }
        if (grande != null) throw AssetTooLargeException(
            "\"${grande.key}\" pesa ${grande.value.size} B; el máximo por asset es ${PackageLimits.MAX_ASSET_BYTES} B",
            mapOf("path" to grande.key, "bytes" to grande.value.size, "maxBytes" to PackageLimits.MAX_ASSET_BYTES),
        )
        val bytesJson = files.filterKeys { !it.startsWith(RawTemplatePackage.ASSETS_DIR) }.values.sumOf { it.size }
        if (bytesJson > PackageLimits.MAX_JSON_BYTES) throw PackageTooLargeException(
            "los JSON del paquete suman $bytesJson B; el máximo es ${PackageLimits.MAX_JSON_BYTES} B (03 §8)",
            mapOf("bytes" to bytesJson, "maxBytes" to PackageLimits.MAX_JSON_BYTES),
        )
        return RawTemplatePackage(files.toSortedMap(), slug, version)
    }
}
