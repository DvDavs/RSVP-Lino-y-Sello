package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.composition.ContentHasher
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAvailabilityReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LoadedTemplateVersion
import mx.evolutiondev.invitaciones.modules.templates2.persistence.ReleaseStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateVersionLoader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseEntity
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Base64

/**
 * Publicación (`02 §7.5`): `GET …/release/preflight`, `POST …/release`, `DELETE …/release`,
 * `GET …/releases` y `POST …/public-token:rotate`.
 *
 * Tres cosas que esta clase hace cumplir y que son el motivo de que la publicación exista como
 * superficie separada (ADR-013):
 *
 * 1. **El preflight de `03 §6` mata H-03 en la vía de publicación.** Un bloque **obligatorio** que
 *    sigue mostrando el valor de demostración de la plantilla (`provenance: "default"`, R3) bloquea la
 *    publicación con `TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT`. Los opcionales en `default` **no**
 *    bloquean: es legítimo publicar una sección opcional con su marcador mientras el cliente decide.
 * 2. **El release es inmutable y lleva su `business_snapshot` congelado** (`02 §2` V34): es lo que
 *    permite marcar `stale` sin recomponer y sin reescribir la fila (ADR-007).
 * 3. **Publicar toma `SELECT … FOR UPDATE` sobre el documento** (`02 §11.2`): sin él,
 *    `tpl_release.document_revision` podría no corresponder al contenido de `composed` — un release que
 *    miente sobre qué revisión publicó.
 */
@Service
class ReleaseService(
    private val editor: EditorDocumentService,
    private val releases: ReleaseStore,
    private val availability: InvitationAvailabilityReader,
    private val versions: TemplateVersionLoader,
) {

    // =============================================================================================
    // 03 §3.11 — GET …/release/preflight
    // =============================================================================================

    @Transactional(readOnly = true)
    fun preflight(requesterId: Long, invitationId: Long): PreflightResponse {
        editor.autorizar(requesterId, invitationId)
        val fila = editor.exigirDocumento(invitationId)
        val version = editor.versionDe(fila)
        val resultado = editor.componer(
            editor.decodificar(fila), version, editor.negocio(invitationId), invitationId,
        )
        val hash = ContentHasher.contentHash(resultado)
        val activo = releases.active(invitationId)
        val bloqueos = bloqueos(resultado, version.pkg)
        return PreflightResponse(
            canPublish = bloqueos.isEmpty(),
            blockers = bloqueos,
            warnings = avisos(resultado),
            report = DomainJson.encode(resultado.report),
            contentHash = hash,
            sameAsActiveRelease = activo?.contentHash == hash,
        )
    }

    /**
     * Las tres comprobaciones de `03 §3.12` paso 5, **las mismas** que corre el preflight (`03 §6`).
     *
     * `stillDefault` lo puebla `DefaultComposer` solo con bloques `required` (`DefaultComposer.kt:132`
     * y `:158`), pero aquí se vuelve a filtrar contra el manifiesto: es la comprobación que impide
     * publicar contenido de demostración como real y no puede depender de que otra clase mantenga esa
     * garantía.
     */
    private fun bloqueos(resultado: CompositionResult, pkg: TemplatePackage): List<PreflightFinding> {
        val specs: Map<String, BlockSpec> = pkg.manifest.topLevelBlocks().mapKeys { it.key.value }
        val salida = mutableListOf<PreflightFinding>()
        if (resultado.report.missingRequired.isNotEmpty()) {
            salida.add(
                PreflightFinding(
                    code = TplErrorCode.TPL_PUBLISH_BLOCKED_MISSING_REQUIRED.name,
                    blockIds = resultado.report.missingRequired.map { it.value },
                ),
            )
        }
        val defectoObligatorio = resultado.report.stillDefault
            .map { it.value }
            .filter { specs[it]?.required ?: true }
        if (defectoObligatorio.isNotEmpty()) {
            salida.add(
                PreflightFinding(
                    code = TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT.name,
                    blockIds = defectoObligatorio,
                ),
            )
        }
        if (resultado.report.invalidValues.isNotEmpty()) {
            salida.add(
                PreflightFinding(
                    code = TplErrorCode.TPL_PUBLISH_BLOCKED_INVALID_VALUES.name,
                    blockIds = resultado.report.invalidValues.map { it.blockId.value },
                ),
            )
        }
        return salida
    }

    /** `TPL_SECTION_EMPTY`: sección **visible** sin un solo valor resuelto (`03 §3.11`). No bloquea. */
    private fun avisos(resultado: CompositionResult): List<PreflightFinding> {
        val vacias = resultado.composed.sections
            .filter { it.visible && it.blocks.isNotEmpty() && it.blocks.all(::sinValor) }
            .map { it.key.value }
        return if (vacias.isEmpty()) emptyList() else listOf(PreflightFinding(AVISO_SECCION_VACIA, sectionKeys = vacias))
    }

    private fun sinValor(entrada: ComposedEntry): Boolean = when (entrada) {
        is ComposedBlock -> entrada.value == null
        is ComposedGroup -> entrada.items.isEmpty()
    }

    // =============================================================================================
    // 03 §3.12 — POST …/release
    // =============================================================================================

    /** `reusedActiveRelease = false` ⇒ el controlador responde `201`; si no, `200`. */
    @Transactional
    fun publish(requesterId: Long, invitationId: Long, body: JsonNode): ReleaseResponse {
        editor.autorizar(requesterId, invitationId)
        val peticion = EditorRequests.publish(body)

        // Paso 1: el bloqueo pesimista abre la transacción de publicación (`02 §11.2`). A partir de
        // aquí ningún `OperationBatch` concurrente puede colarse entre "leo la revisión" y "escribo".
        val fila: TplDocumentEntity = releases.lockDocument(invitationId) ?: throw DocumentNotStartedException(
            "la invitación $invitationId no tiene documento: hay que llamar antes a :choose-template",
            mapOf("invitationId" to invitationId),
        )
        val negocio = editor.negocio(invitationId)
        // Paso 2.
        if (peticion.baseRevision != fila.revision) throw editor.conflicto(fila, negocio)

        // Paso 3: `validateInvitationAccess` usa `findByIdEvenIfDisabled`, así que **publicar** tiene
        // que comprobar disponibilidad por su cuenta (`03 §9.1`, riesgo residual).
        val disponibilidad = availability.read(invitationId) ?: throw Templates2Exception.Internal(
            "la invitación $invitationId no existe al comprobar disponibilidad",
        )
        if (!disponibilidad.disponible) {
            throw InvitationUnavailableException(
                "la invitación $invitationId no está disponible para publicar",
                mapOf("invitationId" to invitationId),
            )
        }

        // Pasos 4 y 5.
        val version = editor.versionDe(fila)
        val documento = editor.decodificar(fila)
        val resultado = editor.componer(documento, version, negocio, invitationId)
        val bloqueos = bloqueos(resultado, version.pkg)
        bloqueos.firstOrNull()?.let { bloqueo ->
            throw PublishBlockedException(
                TplErrorCode.valueOf(bloqueo.code),
                "la publicación está bloqueada: ${bloqueo.code}",
                mapOf("blockers" to bloqueos.map { mapOf("code" to it.code, "blockIds" to it.blockIds) }),
            )
        }

        // Paso 6: `contentHash` sobre `{composed, report}` — **con** el informe (ADR-1R-D-02). Si
        // coincide con el del release activo, no se inserta fila (evita historial ruidoso).
        val hash = ContentHasher.contentHash(resultado)
        val activo = releases.active(invitationId)
        if (activo != null && activo.contentHash == hash) {
            return respuesta(activo, fila, reusado = true)
        }

        // Paso 7: desactivar el activo + insertar el nuevo, en esta misma transacción. Paso 8: no se
        // toca S3 en ningún momento — publicar es inmune a que S3 esté caído (`02 §10.5`).
        val nuevo = releases.publish(
            invitationId = invitationId,
            templateVersionId = fila.templateVersionId,
            documentRevision = fila.revision,
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
            businessSnapshot = DomainJson.encode(negocio),
            contentHash = hash,
            publishedBy = requesterId,
            publishedAt = Instant.now(),
        )
        return respuesta(nuevo, fila, reusado = false)
    }

    // =============================================================================================
    // 03 §3.13 — DELETE …/release   ·   03 §3.14 — GET …/releases   ·   03 §3.10 — rotar el enlace
    // =============================================================================================

    /**
     * Despublicar (ADR-1R-B-05). La fila **no** se borra: sigue siendo auditable y republicable. Es
     * idempotente por diseño — sin release activo también responde `204`.
     */
    @Transactional
    fun unpublish(requesterId: Long, invitationId: Long) {
        editor.autorizar(requesterId, invitationId)
        editor.exigirDocumento(invitationId)
        releases.unpublish(invitationId)
    }

    @Transactional(readOnly = true)
    fun list(requesterId: Long, invitationId: Long, limit: Int?, cursor: String?): ReleaseListResponse {
        editor.autorizar(requesterId, invitationId)
        editor.exigirDocumento(invitationId)
        val tope = (limit ?: LISTA_POR_DEFECTO).coerceIn(1, LISTA_MAXIMO)
        val desplazamiento = descifrarCursor(cursor)
        val filas = releases.history(invitationId, tope, desplazamiento)
        val slugs = HashMap<Long, LoadedTemplateVersion?>()
        val items = filas.map { r ->
            val v = slugs.getOrPut(r.templateVersionId) { versions.porId(r.templateVersionId) }
            ReleaseItemResponse(
                releaseId = r.id,
                publishedAt = r.publishedAt,
                unpublishedAt = r.unpublishedAt,
                contentHash = r.contentHash,
                documentRevision = r.documentRevision,
                templateVersion = v?.let { TemplateVersionRef(it.slug, it.version, it.status) },
                isActive = r.isActive,
                publishedBy = r.publishedBy,
            )
        }
        val siguiente = if (filas.size < tope) null else cifrarCursor(desplazamiento + tope)
        return ReleaseListResponse(items, siguiente)
    }

    /**
     * Rotar el enlace público (`03 §3.10`, ADR-1R-B-05). El token nuevo lo acuña `PublicTokenGenerator`
     * con `SecureRandom` (ADR-2-ORQ-01): rotar hacia un token adivinable desde el anterior no revocaría
     * nada. Los releases no cambian — el enlace es del documento, no del release.
     */
    @Transactional
    fun rotatePublicToken(requesterId: Long, invitationId: Long): PublicTokenResponse {
        editor.autorizar(requesterId, invitationId)
        val fila = editor.exigirDocumento(invitationId)
        val nuevo = editor.rotar(fila.id)
        return PublicTokenResponse(nuevo.value, editor.publicUrl(nuevo.value), Instant.now())
    }

    private fun respuesta(release: TplReleaseEntity, fila: TplDocumentEntity, reusado: Boolean) = ReleaseResponse(
        releaseId = release.id,
        contentHash = release.contentHash,
        documentRevision = release.documentRevision,
        publishedAt = release.publishedAt,
        publicToken = fila.publicToken,
        publicUrl = editor.publicUrl(fila.publicToken),
        reusedActiveRelease = reusado,
    )

    /** Cursor de desplazamiento, mismo formato que el catálogo de 2-3 (ADR-2-3-04). */
    private fun cifrarCursor(offset: Int): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString("o:$offset".toByteArray(Charsets.UTF_8))

    private fun descifrarCursor(cursor: String?): Int {
        if (cursor.isNullOrBlank()) return 0
        return runCatching {
            String(Base64.getUrlDecoder().decode(cursor), Charsets.UTF_8).removePrefix("o:").toInt()
        }.getOrDefault(0).coerceAtLeast(0)
    }

    companion object {
        const val AVISO_SECCION_VACIA = "TPL_SECTION_EMPTY"
        const val LISTA_POR_DEFECTO = 20
        const val LISTA_MAXIMO = 50
    }
}
