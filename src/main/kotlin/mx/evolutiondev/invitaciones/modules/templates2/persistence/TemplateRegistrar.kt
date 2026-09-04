package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.catalog.BreakingChangeNotMajorException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.StructuralDiffWire
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistrationOutcome
import mx.evolutiondev.invitaciones.modules.templates2.catalog.ValidatedTemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.catalog.VersionHashMismatchException
import mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructuralDiff
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.migration.MigrationPlanCoverageChecker
import mx.evolutiondev.invitaciones.modules.templates2.migration.StructuralDiffCalculator
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Pasos **3 a 7** de `02 §4`, todos dentro de **una** transacción (P6). Los pasos 1, 2 y 2b (leer,
 * validar y subir a S3) ocurren fuera y los hace `TemplateRegistrationService`.
 *
 * ```
 * 3  INSERT tpl_template … ON CONFLICT DO NOTHING  +  SELECT … FOR UPDATE   (serializa por slug)
 * 4  idempotencia por (template_id, package_hash) → 200 noop_same_hash
 *    misma versión con otro hash                  → 409 TPL_VERSION_HASH_MISMATCH
 * 5  diff estructural contra la última publicada  → ADR-028
 * 6  claves S3 ya calculadas (los objetos están subidos)
 * 7  INSERT versión + INSERT assets + auditoría 'created'   → COMMIT
 * ```
 *
 * **Idempotencia visible, no silenciosa** (`contratos.md §4`): el paso 4 devuelve
 * [RegistrationResult.NoopSameHash] con la versión existente, deja fila de auditoría y el controlador
 * responde `200 {result:"noop_same_hash", alreadyRegistered:true}`. La fórmula vieja de `package_hash`
 * solo cubría manifiesto y assets: dos paquetes que solo diferían en `theme.json` o `defaults.json`
 * colisionaban y el segundo se perdía **sin rastro** (ADR-1R-D-03). Con la fórmula de `01 §2.1` eso ya
 * no ocurre; este bloque añade que el resultado sea, además, **visible**.
 *
 * Todo rechazo sale como excepción tipada: así la transacción se revierte de verdad (P6) y la fila de
 * auditoría, escrita con `REQUIRES_NEW`, sobrevive (objeción B-04).
 */
@Service
class TemplateRegistrar(
    private val templates: TplTemplateRepository,
    private val versions: TplTemplateVersionRepository,
    private val assets: TplAssetRepository,
    private val auditor: TemplateRegistrationAuditor,
) {

    /** Un asset del paquete **ya subido a S3** (`02 §10.2`), pendiente de su fila en `tpl_asset`. */
    /**
     * `width`/`height` los lee `catalog.ImageDimensions` de la cabecera del archivo (objeción ADV-09,
     * bloque 2-6). Son `null` para lo que no es imagen o cuya cabecera no se entiende, y **no son
     * adorno**: el reductor hace cumplir `image.aspect` con `tpl_asset.width`/`height` y, si faltan,
     * no comprueba nada (`OperationReducer.comprobarAsset`). Con ellos a `NULL` —como estaban hasta
     * 2-6, ADR-2-3-07— un `setBlock` con el `assetId` de un asset **de plantilla** pasaba `aspect`
     * siempre, y `contratos.md §3` prohíbe una restricción del esquema sin validador.
     */
    data class AssetSubido(
        val publicId: String,
        val sha256: String,
        val contentType: String,
        val bytes: Long,
        val bucket: String,
        val s3Key: String,
        val width: Int? = null,
        val height: Int? = null,
    )

    @Transactional
    fun register(
        pkg: ValidatedTemplatePackage,
        subidos: List<AssetSubido>,
        requesterId: Long? = null,
    ): TemplateRegistrationOutcome {
        val slug = pkg.slug
        val version = pkg.version

        // Paso 3: crear el slug si no existe y **bloquear su fila** — serializa dos registros
        // concurrentes del mismo slug (`02 §11.4`), para que no calculen el diff contra la misma
        // versión anterior y ambos se crean primeros.
        templates.insertIgnoreConflict(slug)
        val plantilla = templates.lockBySlug(slug)
            ?: throw Templates2Exception.Internal(
                "tpl_template.slug=\"$slug\" no existe tras INSERT … ON CONFLICT DO NOTHING",
            )

        // Paso 4: idempotencia real, por `package_hash` (ADR-008).
        val misma = versions.findByTemplateIdAndPackageHash(plantilla.id, pkg.packageHash)
        if (misma != null) {
            auditor.auditarNoop(slug, version, pkg.packageHash, misma.id, requesterId)
            return TemplateRegistrationOutcome(
                result = RegistrationResult.NoopSameHash(pkg.manifest.slug, pkg.manifest.version, pkg.packageHash),
                templateVersionId = misma.id,
                slug = slug,
                version = misma.version,
                packageHash = pkg.packageHash,
                assetsRegistered = 0,
            )
        }

        val mismaVersion = versions.findByTemplateIdAndVersion(plantilla.id, version)
        if (mismaVersion != null) {
            val detalle = mapOf(
                "slug" to slug, "version" to version,
                "registeredHash" to mismaVersion.packageHash, "requestedHash" to pkg.packageHash,
            )
            auditor.auditarRechazo(slug, version, pkg.packageHash, TplErrorCode.TPL_VERSION_HASH_MISMATCH, detalle, requesterId)
            throw VersionHashMismatchException(
                "$slug@$version ya está registrada con otro contenido; una versión publicada nunca se pisa",
                detalle,
            )
        }

        // Paso 5: diff estructural contra la última publicada (ADR-028).
        val diff = comprobarDiff(plantilla.id, pkg, requesterId)

        // Paso 7: la versión, sus assets y la auditoría 'created', todo en esta transacción.
        val fila = versions.save(
            TplTemplateVersionEntity(
                templateId = plantilla.id,
                version = version,
                versionMajor = pkg.manifest.version.major,
                versionMinor = pkg.manifest.version.minor,
                versionPatch = pkg.manifest.version.patch,
                manifest = pkg.manifestNode,
                theme = pkg.themeNode,
                defaults = pkg.defaultsNode,
                migrationPlans = pkg.migrationPlansNode(),
                packageHash = pkg.packageHash,
                status = PUBLICADA,
                minPlanTier = pkg.manifest.minPlanTier.toShort(),
                eventKinds = eventKindsNode(pkg),
                publishedAt = Instant.now(),
                publishedBy = requesterId,
            ),
        )

        for (a in subidos) {
            assets.save(
                TplAssetEntity(
                    publicId = a.publicId,
                    templateVersionId = fila.id,
                    invitationId = null,
                    bucket = a.bucket,
                    s3Key = a.s3Key,
                    sha256 = a.sha256,
                    contentType = a.contentType,
                    bytes = a.bytes,
                    width = a.width,
                    height = a.height,
                    createdBy = requesterId,
                ),
            )
        }

        auditor.auditarAlta(
            slug, version, pkg.packageHash, fila.id,
            mapOf("assetsRegistered" to subidos.size, "structuralDiff" to (diff?.let { StructuralDiffWire.de(it) } ?: emptyMap<String, Any?>())),
            requesterId,
        )

        return TemplateRegistrationOutcome(
            result = RegistrationResult.Created(pkg.manifest.slug, pkg.manifest.version, pkg.packageHash),
            templateVersionId = fila.id,
            slug = slug,
            version = version,
            packageHash = pkg.packageHash,
            assetsRegistered = subidos.size,
            structuralDiff = diff,
        )
    }

    /**
     * Paso 5 de `02 §4` / ADR-028. Si el slug ya tiene alguna versión `published`, se carga la de mayor
     * `(major, minor, patch)` y se compara:
     *
     * - diff vacío → adelante, sin exigir plan;
     * - diff no vacío y bump **no** mayor → `422 TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`;
     * - diff no vacío y bump mayor → hace falta un `MigrationPlan` que cubra **cada** elemento
     *   ([MigrationPlanCoverageChecker]); si falta cobertura, mismo código y mismo 422.
     *
     * Devuelve el diff calculado (o `null` si es la primera versión) para que la respuesta de
     * `03 §3.17` lo lleve: registrar una versión mayor **legítima** también informa de qué rompió.
     */
    private fun comprobarDiff(templateId: Long, pkg: ValidatedTemplatePackage, requesterId: Long?): StructuralDiff? {
        val anteriorFila = versions.findLatestPublished(templateId).firstOrNull() ?: return null
        val anterior = aPaquete(anteriorFila)
        val diff = StructuralDiffCalculator.diff(anterior, pkg.pkg)
        if (diff.isEmpty) return diff

        val esMayor = pkg.manifest.version.major > anterior.version.major
        if (!esMayor) {
            rechazarPorDiff(
                pkg, requesterId, anterior.version,
                "el paquete rompe la compatibilidad con ${anterior.version} y el bump no es mayor",
                mapOf("diff" to StructuralDiffWire.de(diff)),
            )
        }

        val plan = pkg.pkg.migrationPlans[anterior.version]
        val sinCubrir = MigrationPlanCoverageChecker.uncovered(anterior, diff, plan)
        if (sinCubrir.isNotEmpty()) {
            rechazarPorDiff(
                pkg, requesterId, anterior.version,
                if (plan == null) {
                    "falta migrations/${anterior.version}-to-${pkg.version}.json: el diff contra " +
                        "${anterior.version} no está cubierto por ningún MigrationPlan (ADR-028)"
                } else {
                    "el MigrationPlan ${anterior.version} → ${pkg.version} deja ${sinCubrir.size} " +
                        "elemento(s) del diff sin cubrir (ADR-028)"
                },
                mapOf(
                    "diff" to StructuralDiffWire.de(diff),
                    "uncovered" to sinCubrir.map {
                        mapOf("kind" to it.kind, "target" to it.target, "expectedOps" to it.expectedOps)
                    },
                ),
            )
        }
        return diff
    }

    private fun rechazarPorDiff(
        pkg: ValidatedTemplatePackage,
        requesterId: Long?,
        anterior: SemverVersion,
        mensaje: String,
        detalle: Map<String, Any?>,
    ): Nothing {
        val completo = detalle + mapOf("previousVersion" to anterior.toString(), "version" to pkg.version)
        auditor.auditarRechazo(
            pkg.slug, pkg.version, pkg.packageHash,
            TplErrorCode.TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR, completo, requesterId,
        )
        throw BreakingChangeNotMajorException(mensaje, completo)
    }

    /** Reconstruye el `TemplatePackage` de una versión guardada; el diff solo mira manifiesto y tema. */
    private fun aPaquete(fila: TplTemplateVersionEntity): TemplatePackage = TemplatePackage(
        manifest = DomainJson.manifest(fila.manifest),
        theme = DomainJson.theme(fila.theme),
        defaults = DomainJson.defaults(fila.defaults),
        migrationPlans = emptyMap(),
    )

    private fun eventKindsNode(pkg: ValidatedTemplatePackage): JsonNode {
        val arr = Templates2Json.mapper.createArrayNode()
        pkg.manifest.eventKinds.forEach { arr.add(it.wire) }
        return arr
    }

    companion object {
        /** Los dos literales de `ck_tpl_template_version_status` (`02 §2` V30). */
        const val PUBLICADA = "published"
        const val DEPRECADA = "deprecated"
    }
}
