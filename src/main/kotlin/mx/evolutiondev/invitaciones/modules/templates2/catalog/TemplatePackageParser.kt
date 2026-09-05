package mx.evolutiondev.invitaciones.modules.templates2.catalog

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.DefaultsFile
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateManifest
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.PackageHasher
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import mx.evolutiondev.invitaciones.modules.templates2.schema.Violation
import org.springframework.stereotype.Service

/** Un asset del paquete, con su digesto real ya calculado sobre los bytes subidos. */
class PackageAsset(
    val path: String,
    val bytes: ByteArray,
    val sha256: String,
    val contentType: AssetContentType,
) {
    val nombre: String get() = path.removePrefix(RawTemplatePackage.ASSETS_DIR)
    val size: Int get() = bytes.size
}

/**
 * Paquete ya validado contra el JSON Schema **y** contra las invariantes, con su `package_hash`
 * calculado por [PackageHasher] (`01 §2.1`). Es lo único que acepta `TemplateRegistrar`.
 *
 * Se conservan los `JsonNode` **crudos** además del dominio decodificado: son los que se guardan en
 * `tpl_template_version.manifest/theme/defaults/migration_plans`, de modo que recalcular el
 * `package_hash` desde la fila de la base da el mismo valor (el hash usa el JSON canónico, y `jsonb`
 * no preserva el orden de claves — ADR-1R-B-07).
 */
class ValidatedTemplatePackage(
    val pkg: TemplatePackage,
    val manifestNode: JsonNode,
    val themeNode: JsonNode,
    val defaultsNode: JsonNode,
    /** indexados por nombre de archivo dentro de `migrations/` */
    val migrationNodes: Map<String, JsonNode>,
    val assets: List<PackageAsset>,
    val packageHash: String,
) {
    val manifest: TemplateManifest get() = pkg.manifest
    val slug: String get() = pkg.slug.value
    val version: String get() = pkg.version.toString()

    /** `{"<from>": MigrationPlan}` para `tpl_template_version.migration_plans` (`02 §2` V30). */
    fun migrationPlansNode(): JsonNode {
        val obj = Templates2Json.mapper.createObjectNode()
        for ((from, plan) in pkg.migrationPlans) obj.set<JsonNode>(from.toString(), DomainJson.encode(plan))
        return obj
    }
}

/**
 * Pasos 1 y 2 de `02 §4`, **fuera de transacción**: leer, validar contra el JSON Schema emitido,
 * validar las invariantes de paquete, comprobar que los assets subidos son los que el manifiesto
 * declara y calcular el `package_hash`.
 *
 * Orden deliberado (aviso 1 de `handoffs/2-0b.md`): **JSON Schema antes que `DomainJson`**. El códec
 * rechaza claves desconocidas y literales fuera de catálogo, pero no patrones ni rangos numéricos; el
 * esquema no ve `I-01`…`I-30`. Las tres capas juntas son P1; ninguna basta sola.
 */
@Service
class TemplatePackageParser(private val validator: JsonSchemaValidatorService) {

    fun parse(raw: RawTemplatePackage): ValidatedTemplatePackage {
        val manifestNode = leerJson(raw, RawTemplatePackage.MANIFEST)
        val themeNode = leerJson(raw, RawTemplatePackage.THEME)
        val defaultsNode = leerJson(raw, RawTemplatePackage.DEFAULTS)
        val migrationNodes = raw.migrationPaths.associate { p ->
            p.removePrefix(RawTemplatePackage.MIGRATIONS_DIR) to leerJson(raw, p)
        }

        // I-29 sobre el JSON CRUDO: `__proto__`/`constructor`/`prototype` no llegan ni al códec.
        val reservadas = buildList {
            addAll(Invariants.assertNoReservedKeys(manifestNode, RawTemplatePackage.MANIFEST))
            addAll(Invariants.assertNoReservedKeys(themeNode, RawTemplatePackage.THEME))
            addAll(Invariants.assertNoReservedKeys(defaultsNode, RawTemplatePackage.DEFAULTS))
            migrationNodes.forEach { (n, node) ->
                addAll(Invariants.assertNoReservedKeys(node, RawTemplatePackage.MIGRATIONS_DIR + n))
            }
        }
        if (reservadas.isNotEmpty()) throw manifestInvalido("claves reservadas en el paquete", reservadas)

        // Paso 1 de `02 §4`: JSON Schema emitido. `requireValid` ya lanza `TPL_MANIFEST_INVALID`.
        validator.requireValid("template-manifest", manifestNode)
        validator.requireValid("theme", themeNode)
        validator.requireValid("defaults", defaultsNode)
        migrationNodes.values.forEach { validator.requireValid("migration-plan", it) }

        val manifest = decodificar(RawTemplatePackage.MANIFEST) { DomainJson.manifest(manifestNode) }
        val theme = decodificar(RawTemplatePackage.THEME) { DomainJson.theme(themeNode) }
        val defaults = decodificar(RawTemplatePackage.DEFAULTS) { DomainJson.defaults(defaultsNode) }
        val planes = migrationNodes.mapValues { (n, node) ->
            decodificar(RawTemplatePackage.MIGRATIONS_DIR + n) { DomainJson.migrationPlan(node) }
        }

        comprobarUbicacion(raw, manifest)
        comprobarDefaults(manifest, defaults)
        comprobarMigraciones(manifest, planes)

        // Paso 2 de `02 §4`: invariantes de paquete (`I-01`…`I-30` que aplican al manifiesto).
        val violaciones = Invariants.validateManifest(manifest, theme, defaults)
        if (violaciones.isNotEmpty()) {
            throw manifestInvalido("el manifiesto viola ${violaciones.size} invariante(s)", violaciones)
        }

        val assets = comprobarAssets(raw, manifest)

        val hash = PackageHasher.packageHash(
            manifest = manifestNode,
            theme = themeNode,
            defaults = defaultsNode,
            migraciones = migrationNodes,
            assets = assets.associate { it.nombre to it.bytes },
        )

        val porVersion = planes.values.associateBy { it.from }
        return ValidatedTemplatePackage(
            pkg = TemplatePackage(manifest, theme, defaults, porVersion),
            manifestNode = manifestNode,
            themeNode = themeNode,
            defaultsNode = defaultsNode,
            migrationNodes = migrationNodes,
            assets = assets,
            packageHash = hash,
        )
    }

    /**
     * Hash de respaldo para la **auditoría de un paquete que ni siquiera parsea**: `requested_hash` es
     * `NOT NULL` con `CHECK ~ '^sha256:[0-9a-f]{64}$'` (`02 §2` V35), así que un rechazo temprano
     * necesita igualmente un valor. Reutiliza [PackageHasher] tratando **todos** los archivos como
     * binarios (bytes literales, sin canonicalizar): mismo formato, misma función, y determinista para
     * que dos envíos idénticos dejen la misma huella en la auditoría.
     */
    fun rawHash(raw: RawTemplatePackage): String =
        PackageHasher.packageHash(raw.files.map { (p, b) -> PackageHasher.Entrada.Binario(p, b) })

    /** `slug`/`version` para auditar un rechazo, sin exigir que el manifiesto sea válido. */
    fun identidadAproximada(raw: RawTemplatePackage): Pair<String, String> {
        val node = runCatching { Templates2Json.readTree(texto(raw, RawTemplatePackage.MANIFEST)) }.getOrNull()
        val slug = node?.get("slug")?.takeIf { it.isTextual }?.asText()
            ?: raw.slugDeclarado ?: DESCONOCIDO
        val version = node?.get("version")?.takeIf { it.isTextual }?.asText()
            ?: raw.versionDeclarada ?: DESCONOCIDA
        return slug.take(40) to version.take(20)
    }

    private fun leerJson(raw: RawTemplatePackage, path: String): JsonNode =
        try {
            Templates2Json.readTree(texto(raw, path))
        } catch (e: Templates2Exception.MalformedJson) {
            throw Templates2Exception.ManifestInvalid(
                "\"$path\" no es JSON válido: ${e.message}",
                mapOf("packageError" to "TPL_PACKAGE_MALFORMED_JSON", "path" to path),
            )
        }

    private fun texto(raw: RawTemplatePackage, path: String): String {
        val bytes = raw.bytes(path) ?: throw Templates2Exception.ManifestInvalid(
            "falta \"$path\" en el paquete (01 §2.1)",
            mapOf("packageError" to "TPL_PACKAGE_INCOMPLETE", "path" to path),
        )
        // UTF-8 **sin BOM** (`01 §2.1`): con BOM, Jackson falla con un mensaje ilegible.
        val sinBom = if (bytes.size >= 3 && bytes[0] == 0xEF.toByte() && bytes[1] == 0xBB.toByte() && bytes[2] == 0xBF.toByte()) {
            throw Templates2Exception.ManifestInvalid(
                "\"$path\" empieza con BOM; 01 §2.1 exige UTF-8 sin BOM",
                mapOf("packageError" to "TPL_PACKAGE_MALFORMED_JSON", "path" to path),
            )
        } else {
            bytes
        }
        return String(sinBom, Charsets.UTF_8)
    }

    /** `DomainJson` lanza `MalformedJson` (400) ante un id o literal fuera de catálogo; en el registro
     * eso es un manifiesto inválido (422), no un cuerpo HTTP mal formado. Se traduce sin perder nada. */
    private fun <T> decodificar(path: String, bloque: () -> T): T =
        try {
            bloque()
        } catch (e: Templates2Exception.MalformedJson) {
            throw Templates2Exception.ManifestInvalid(
                "\"$path\": ${e.message}",
                mapOf("packageError" to "TPL_PACKAGE_DECODE_FAILED", "path" to path) + e.details,
            )
        }

    private fun comprobarUbicacion(raw: RawTemplatePackage, m: TemplateManifest) {
        val slug = raw.slugDeclarado
        val version = raw.versionDeclarada
        if (slug != null && slug != m.slug.value) throw Templates2Exception.ManifestInvalid(
            "el paquete vive en templates/$slug/… pero el manifiesto declara slug \"${m.slug.value}\"",
            mapOf("packageError" to "TPL_PACKAGE_PATH_MISMATCH", "expected" to slug, "actual" to m.slug.value),
        )
        if (version != null && version != m.version.toString()) throw Templates2Exception.ManifestInvalid(
            "el paquete vive en .../$version pero el manifiesto declara versión \"${m.version}\"",
            mapOf("packageError" to "TPL_PACKAGE_PATH_MISMATCH", "expected" to version, "actual" to m.version.toString()),
        )
    }

    /** `defaults.json` declara a qué plantilla y versión pertenece; discrepar es mezclar paquetes. */
    private fun comprobarDefaults(m: TemplateManifest, d: DefaultsFile) {
        if (d.templateSlug != m.slug || d.templateVersion != m.version) {
            throw Templates2Exception.ManifestInvalid(
                "defaults.json declara ${d.templateSlug.value}@${d.templateVersion} y el manifiesto " +
                    "${m.slug.value}@${m.version}",
                mapOf(
                    "packageError" to "TPL_PACKAGE_DEFAULTS_MISMATCH",
                    "expected" to "${m.slug.value}@${m.version}",
                    "actual" to "${d.templateSlug.value}@${d.templateVersion}",
                ),
            )
        }
    }

    /**
     * `migrations/` contiene **exactamente** un archivo por cada versión de `manifest.migrationsFrom`,
     * ni uno más (`01 §2.1` lo llama `TPL_MIGRATION_PLAN_ORPHAN`) ni uno menos
     * (`TPL_MIGRATION_PLAN_MISSING`), con el nombre derivado `${'$'}{from}-to-${'$'}{version}.json`.
     * Ninguno de esos dos códigos está en el catálogo cerrado de `03 §5`, así que viajan en
     * `details.packageError` de un `TPL_MANIFEST_INVALID` (ADR-2-3-02).
     */
    private fun comprobarMigraciones(m: TemplateManifest, planes: Map<String, MigrationPlan>) {
        val esperados = m.migrationsFrom.associateBy { "$it-to-${m.version}.json" }
        val faltan = esperados.keys - planes.keys
        if (faltan.isNotEmpty()) throw Templates2Exception.ManifestInvalid(
            "faltan planes de migración: ${faltan.sorted().joinToString(", ")}",
            mapOf("packageError" to "TPL_MIGRATION_PLAN_MISSING", "missing" to faltan.sorted()),
        )
        val sobran = planes.keys - esperados.keys
        if (sobran.isNotEmpty()) throw Templates2Exception.ManifestInvalid(
            "planes de migración que el manifiesto no declara en migrationsFrom: ${sobran.sorted().joinToString(", ")}",
            mapOf("packageError" to "TPL_MIGRATION_PLAN_ORPHAN", "orphan" to sobran.sorted()),
        )
        for ((archivo, plan) in planes) {
            val from = esperados.getValue(archivo)
            val mal = plan.templateSlug != m.slug || plan.from != from || plan.to != m.version
            if (mal) throw Templates2Exception.ManifestInvalid(
                "\"migrations/$archivo\" declara ${plan.templateSlug.value} ${plan.from} → ${plan.to}; " +
                    "el nombre del archivo exige ${m.slug.value} $from → ${m.version}",
                mapOf("packageError" to "TPL_MIGRATION_PLAN_MISMATCH", "path" to "migrations/$archivo"),
            )
        }
    }

    /**
     * Paso 2 de `02 §4`: cada `AssetEntry` del manifiesto describe **exactamente** el archivo subido
     * (`sha256`, `bytes`, `contentType`), y no sobra ningún archivo en `assets/`. Sin esta
     * comprobación, el `package_hash` se calcularía sobre un manifiesto que no describe los bytes que
     * se van a subir. Además se verifica el **número mágico** del archivo: el módulo antiguo solo mira
     * el `content-type` declarado (`FileValidationService.kt:21-24`) y aquí no basta.
     */
    private fun comprobarAssets(raw: RawTemplatePackage, m: TemplateManifest): List<PackageAsset> {
        val declarados = m.assets.associateBy { it.path }
        val subidos = raw.assetPaths.toSet()

        val duplicados = m.assets.groupingBy { it.path }.eachCount().filterValues { it > 1 }.keys
        if (duplicados.isNotEmpty()) throw PackageAssetMismatchException(
            "el manifiesto declara dos veces el mismo asset: ${duplicados.sorted().joinToString(", ")}",
            mapOf("duplicated" to duplicados.sorted()),
        )
        // I-09 (ADR-3B-I09-01) — el alias tiene que ser único DENTRO del manifiesto, por el mismo
        // motivo que la ruta: el `AssetIndex` es un mapa y con dos entradas iguales una de las dos
        // imágenes desaparecería en silencio, que es lo que P1 prohíbe. Entre VERSIONES distintas no
        // hay colisión posible: el índice se construye con el manifiesto de la versión que usa el
        // documento, y solo con ese.
        val aliasDuplicados = m.assets.mapNotNull { it.id?.value }
            .groupingBy { it }.eachCount().filterValues { it > 1 }.keys
        if (aliasDuplicados.isNotEmpty()) throw PackageAssetMismatchException(
            "el manifiesto declara dos assets con el mismo id: ${aliasDuplicados.sorted().joinToString(", ")}",
            mapOf("duplicatedId" to aliasDuplicados.sorted()),
        )
        val faltan = declarados.keys - subidos
        if (faltan.isNotEmpty()) throw PackageAssetMismatchException(
            "el manifiesto declara assets que no vienen en el paquete: ${faltan.sorted().joinToString(", ")}",
            mapOf("missing" to faltan.sorted()),
        )
        val sobran = subidos - declarados.keys
        if (sobran.isNotEmpty()) throw PackageAssetMismatchException(
            "el paquete trae assets que el manifiesto no declara: ${sobran.sorted().joinToString(", ")}",
            mapOf("undeclared" to sobran.sorted()),
        )
        val preview = m.previewImage
        if (preview != null && !declarados.containsKey(preview)) throw PackageAssetMismatchException(
            "previewImage \"$preview\" no está entre los assets declarados",
            mapOf("previewImage" to preview),
        )

        return declarados.keys.sorted().map { path ->
            val entry = declarados.getValue(path)
            val bytes = raw.bytes(path) ?: throw PackageAssetMismatchException(
                "asset ausente: $path", mapOf("missing" to listOf(path)),
            )
            val real = Templates2Json.hex(Templates2Json.sha256(bytes))
            if (!real.equals(entry.sha256, ignoreCase = true)) throw PackageAssetMismatchException(
                "\"$path\": el manifiesto declara sha256 ${entry.sha256} y el archivo subido tiene $real",
                mapOf("path" to path, "declared" to entry.sha256, "actual" to real, "constraint" to "sha256"),
            )
            if (entry.bytes != bytes.size) throw PackageAssetMismatchException(
                "\"$path\": el manifiesto declara ${entry.bytes} B y el archivo subido tiene ${bytes.size} B",
                mapOf("path" to path, "declared" to entry.bytes, "actual" to bytes.size, "constraint" to "bytes"),
            )
            if (!MagicBytes.coincide(entry.contentType, bytes)) throw AssetTypeUnsupportedException(
                "\"$path\": los primeros bytes no corresponden a ${entry.contentType.wire}",
                mapOf("path" to path, "declared" to entry.contentType.wire),
            )
            PackageAsset(path, bytes, real, entry.contentType)
        }
    }

    private fun manifestInvalido(mensaje: String, violaciones: List<Violation>): Templates2Exception.ManifestInvalid =
        Templates2Exception.ManifestInvalid(
            mensaje,
            mapOf(
                "violations" to violaciones.map {
                    mapOf("code" to it.wire, "path" to it.path, "detail" to it.detail)
                },
            ),
        )

    companion object {
        const val DESCONOCIDO = "desconocido"
        const val DESCONOCIDA = "desconocida"
    }
}
