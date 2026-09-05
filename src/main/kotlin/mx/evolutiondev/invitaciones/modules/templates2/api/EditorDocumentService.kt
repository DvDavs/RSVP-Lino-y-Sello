package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateVersionNotFoundException
import mx.evolutiondev.invitaciones.modules.templates2.composition.AssetIndex
import mx.evolutiondev.invitaciones.modules.templates2.composition.AssetMeta
import mx.evolutiondev.invitaciones.modules.templates2.composition.AssetUrlResolver
import mx.evolutiondev.invitaciones.modules.templates2.composition.BatchResult
import mx.evolutiondev.invitaciones.modules.templates2.composition.Composer
import mx.evolutiondev.invitaciones.modules.templates2.composition.DefaultComposer
import mx.evolutiondev.invitaciones.modules.templates2.composition.DefaultOperationReducer
import mx.evolutiondev.invitaciones.modules.templates2.composition.DocumentNormalizer
import mx.evolutiondev.invitaciones.modules.templates2.composition.ReducerContext
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.DocumentMeta
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.OperationBatch
import mx.evolutiondev.invitaciones.modules.templates2.domain.PublicToken
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateRef
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeChoice
import mx.evolutiondev.invitaciones.modules.templates2.migration.DocumentMigrator
import mx.evolutiondev.invitaciones.modules.templates2.migration.MigrationResult
import mx.evolutiondev.invitaciones.modules.templates2.persistence.BusinessSnapshotReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.DocumentCreation
import mx.evolutiondev.invitaciones.modules.templates2.persistence.DocumentStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.DocumentWrite
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LegacyConfigProbe
import mx.evolutiondev.invitaciones.modules.templates2.persistence.LoadedTemplateVersion
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateVersionLoader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetEditorRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2FlagRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2AssetBucket

/**
 * Ciclo de vida del documento de trabajo (`02 §7.5`): `:choose-template`, `GET /document`,
 * `POST /document/operations`, `GET /document/history` y `POST /document/restore`.
 *
 * Orquesta **autorización + almacén + composición**, con **una transacción por operación de escritura**
 * (`02 §7.5`, `03 §3.4` punto 7). No reimplementa nada de `composition`/`migration`: el reductor, el
 * normalizador, `switchTemplate`, `compose` y las invariantes son los de 2-0b/2-2, aquí solo se
 * encadenan y se traduce cada fallo a su `TplErrorCode`.
 *
 * **`compose` se llama en cada lectura** (ADR-007): nunca se guarda una vista compuesta del documento
 * de trabajo. Lo único congelado es `tpl_release` (`ReleaseService`).
 */
@Service
class EditorDocumentService(
    private val hierarchy: HierarchyValidationService,
    private val documents: DocumentStore,
    private val versions: TemplateVersionLoader,
    private val business: BusinessSnapshotReader,
    private val assets: TplAssetEditorRepository,
    private val releases: TplReleaseRepository,
    private val flags: Templates2FlagRepository,
    private val legacyConfig: LegacyConfigProbe,
    private val schemas: JsonSchemaValidatorService,
    private val ulids: UlidGenerator,
    @Value("\${templates2.assets.public-base-url:}") baseUrlConfigurada: String,
    bucketDelModulo: Templates2AssetBucket,
    @Value("\${aws.region:us-east-2}") region: String,
    @Value("\${app.frontend.url:http://localhost}") private val frontendUrl: String,
    private val composer: Composer = DefaultComposer,
) {

    /** Resuelto por [Templates2AssetBucket], único punto del módulo que decide el bucket:
     *  si difieren, la URL compuesta apunta a un bucket distinto de donde se subió el asset. */
    private val bucket: String = bucketDelModulo.nombre

    /** `02 §10.4`: por patrón, sin llamar a S3 — `compose` no puede depender de su disponibilidad. */
    val publicBaseUrl: String = baseUrlConfigurada.ifBlank { "https://$bucket.s3.$region.amazonaws.com" }

    // =============================================================================================
    // 03 §3.2 — POST …/document:choose-template   (EL ÚNICO creador del documento, decisión X-07)
    // =============================================================================================

    /** `created = true` ⇒ el controlador responde `201`; si no, `200` (`03 §3.2`). */
    @Transactional
    fun chooseTemplate(requesterId: Long, invitationId: Long, body: JsonNode): ChooseTemplateResponse {
        autorizar(requesterId, invitationId)
        val peticion = EditorRequests.chooseTemplate(body)
        val actual = documents.find(invitationId)

        val destino = versions.porSlugYVersion(peticion.templateSlug, peticion.templateVersion)
            ?: throw TemplateVersionNotFoundException(
                "no existe la versión ${peticion.templateSlug}@${peticion.templateVersion}",
                mapOf("templateSlug" to peticion.templateSlug, "templateVersion" to peticion.templateVersion),
            )
        // `03 §5`: una versión `deprecated` no puede **iniciar** un documento; para uno que ya la usa
        // sigue siendo válida (deprecar no rompe los documentos existentes, `03 §3.19`).
        if (destino.status != ESTADO_PUBLICADA && actual == null) {
            throw TemplateVersionNotFoundException(
                "la versión ${destino.slug}@${destino.version} está ${destino.status} y no puede iniciar un documento",
                mapOf("templateSlug" to destino.slug, "templateVersion" to destino.version, "status" to destino.status),
            )
        }

        val negocio = negocio(invitationId)
        if (destino.minPlanTier > negocio.planTier) {
            throw PlanTierInsufficientException(
                "la plantilla ${destino.slug}@${destino.version} exige plan ${destino.minPlanTier} " +
                    "y la invitación tiene ${negocio.planTier}",
                mapOf("minPlanTier" to destino.minPlanTier, "planTier" to negocio.planTier),
            )
        }

        return if (actual == null) {
            crearDocumento(requesterId, invitationId, destino, negocio, peticion)
        } else {
            cambiarPlantilla(requesterId, invitationId, actual, destino, negocio, peticion)
        }
    }

    private fun crearDocumento(
        requesterId: Long,
        invitationId: Long,
        destino: LoadedTemplateVersion,
        negocio: BusinessSnapshot,
        peticion: EditorRequests.ChooseTemplateRequest,
    ): ChooseTemplateResponse {
        // `baseRevision` solo se envía cuando el cliente cree que ya hay documento. Si no lo hay, esa
        // creencia es falsa y hay que decírselo (P1), no ignorar el campo en silencio.
        if (peticion.baseRevision != null) {
            throw RevisionConflictException(
                "se envió baseRevision=${peticion.baseRevision} pero la invitación aún no tiene documento",
                mapOf("currentRevision" to null, "reason" to "document_not_started"),
            )
        }
        val activarBandera = comprobarCorte(invitationId)

        val documento = documentoInicial(destino)
        val creacion: DocumentCreation = documents.createIfAbsent(
            invitationId = invitationId,
            templateVersionId = destino.templateVersionId,
            doc = DomainJson.encode(documento),
            createdBy = requesterId,
        )
        if (!creacion.created) {
            // Carrera contra otro `:choose-template` simultáneo: el índice único decidió (`02 §11.5`).
            // Si el ganador eligió la misma versión, esto es el no-op de `03 §3.2`; si eligió otra,
            // el cliente tiene que reintentar con `baseRevision`, que es un conflicto de revisión.
            if (creacion.document.templateVersionId != destino.templateVersionId) {
                throw RevisionConflictException(
                    "otra petición creó el documento con otra plantilla mientras esta se ejecutaba",
                    mapOf("currentRevision" to creacion.document.revision),
                )
            }
            return respuestaChoose(creacion.document, destino, negocio, created = false, changed = false, movidos = emptyList())
        }
        if (activarBandera) flags.setUsesTemplates2(invitationId, true)
        return respuestaChoose(creacion.document, destino, negocio, created = true, changed = true, movidos = emptyList())
    }

    private fun cambiarPlantilla(
        requesterId: Long,
        invitationId: Long,
        fila: TplDocumentEntity,
        destino: LoadedTemplateVersion,
        negocio: BusinessSnapshot,
        peticion: EditorRequests.ChooseTemplateRequest,
    ): ChooseTemplateResponse {
        val base = peticion.baseRevision ?: throw Templates2Exception.MalformedJson(
            "baseRevision es obligatorio cuando el documento ya existe (ADR-1R-B-11)",
            mapOf("path" to "body.baseRevision"),
        )
        if (base != fila.revision) throw conflicto(fila, negocio)

        // Idempotencia de `03 §8`: repetir con la versión que el documento ya usa es un no-op que no
        // incrementa `revision` ni crea snapshot.
        if (fila.templateVersionId == destino.templateVersionId) {
            return respuestaChoose(fila, destino, negocio, created = false, changed = false, movidos = emptyList())
        }

        val origen = versions.porId(fila.templateVersionId)
            ?: throw Templates2Exception.Internal(
                "tpl_document.id=${fila.id} apunta a template_version_id=${fila.templateVersionId}, que no existe",
            )
        val documento = decodificar(fila)

        val (migrado, movidos) = if (origen.slug == destino.slug) {
            migrarVersion(documento, origen, destino)
        } else {
            // ADR-1R-D-07: transporte solo por rol singleton; los grupos, **siempre** al attic.
            val r = DocumentMigrator.switchTemplate(documento, origen.pkg, destino.pkg)
            r.doc to r.report.toAttic
        }

        // `01 §6.4` paso 6 / ADR-029: el resultado se normaliza contra el manifiesto vigente, se
        // revalida valor a valor y se valida entero antes de escribir. `switchTemplate` no valida: lo
        // hace el llamador. Un valor transportado por rol que ya no cumple el `BlockSpec` del destino
        // (p. ej. un título más largo del que el destino admite) va al **attic**, no impide el cambio:
        // bloquear el cambio de plantilla entero por un texto largo sería peor y menos recuperable.
        val normalizado = DocumentNormalizer.normalize(migrado, destino.pkg)
        val revalidado = revalidar(normalizado.doc, destino.pkg)
        val nuevo = revalidado.doc.copy(template = TemplateRef(destino.pkg.slug, destino.pkg.version))
        val violaciones = Invariants.validateInvariants(nuevo, destino.pkg)
        if (violaciones.isNotEmpty()) {
            throw Templates2Exception.ManifestInvalid(
                "el documento resultante del cambio de plantilla viola ${violaciones.size} invariante(s)",
                mapOf("violations" to violaciones.map { mapOf("code" to it.wire, "path" to it.path) }),
            )
        }

        val escritura = documents.applyRevision(
            documentId = fila.id,
            expectedRevision = base,
            doc = DomainJson.encode(nuevo),
            origin = DocumentStore.ORIGEN_CHOOSE_TEMPLATE,
            updatedBy = requesterId,
            templateVersionId = destino.templateVersionId,
        )
        val revision = when (escritura) {
            is DocumentWrite.Applied -> escritura.revision
            is DocumentWrite.Conflict -> throw conflicto(fila, negocio)
            is DocumentWrite.TooLarge -> throw demasiadoGrande(escritura)
        }

        val resultado = componer(nuevo, destino, negocio, invitationId)
        return ChooseTemplateResponse(
            revision = revision,
            created = false,
            changed = true,
            document = DomainJson.encode(nuevo),
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
            movedToAttic = (movidos + (normalizado.toAttic + revalidado.toAttic).map { it.value }).distinct(),
            templateVersion = TemplateVersionRef(destino.slug, destino.version, destino.status),
            publicToken = fila.publicToken,
            publicUrl = publicUrl(fila.publicToken),
        )
    }

    /** Cambio de **versión** de la misma plantilla: exige `MigrationPlan` registrado (`03 §3.2`). */
    private fun migrarVersion(
        documento: InvitationDocument,
        origen: LoadedTemplateVersion,
        destino: LoadedTemplateVersion,
    ): Pair<InvitationDocument, List<String>> {
        val plan = destino.pkg.migrationPlans[origen.semver] ?: throw MigrationPlanMissingException(
            "la versión ${destino.slug}@${destino.version} no registra un MigrationPlan desde ${origen.version}",
            mapOf("from" to origen.version, "to" to destino.version, "templateSlug" to destino.slug),
        )
        // `migrate` es pura: llamarla **es** la simulación previa que exige `03 §3.2`; solo se persiste
        // si devuelve `Ok`.
        return when (val r = DocumentMigrator.migrate(documento, origen.pkg, destino.pkg, plan)) {
            is MigrationResult.Ok -> r.doc to r.report.toAttic.map { it.blockId }
            is MigrationResult.Failed -> throw MigrationPlanMissingException(
                "el MigrationPlan de ${origen.version} → ${destino.version} no se pudo aplicar: ${r.error.code}",
                // `MIG_*` no está en el catálogo cerrado de `03 §5`; viaja en `details` con su nombre
                // literal, mismo criterio que ADR-2-3-02 para los códigos de `01 §2.1`.
                mapOf("from" to origen.version, "to" to destino.version, "migrationError" to r.error.code),
            )
        }
    }

    /**
     * Documento recién creado: `structure` = orden y variantes por defecto del manifiesto,
     * `content = {}` (todo lo visible viene de `defaults.json` con `provenance: "default"`, R2/R3, que
     * es lo que el preflight bloquea al publicar), `theme` = ids por defecto de la plantilla.
     */
    private fun documentoInicial(destino: LoadedTemplateVersion): InvitationDocument {
        val m = destino.pkg.manifest
        val locale = if (m.locales.contains(Locale.ES_MX)) Locale.ES_MX else m.locales.first()
        val documento = InvitationDocument(
            schemaVersion = 1,
            template = TemplateRef(m.slug, m.version),
            theme = ThemeChoice(destino.pkg.theme.defaultPaletteId, destino.pkg.theme.defaultFontSetId),
            structure = Structure(
                m.sections.map { StructureEntry(it.key, it.defaultVariant, if (it.required) true else it.defaultVisible) },
            ),
            content = emptyMap(),
            attic = emptyMap(),
            meta = DocumentMeta(locale),
        )
        val violaciones = Invariants.validateInvariants(documento, destino.pkg)
        if (violaciones.isNotEmpty()) {
            throw Templates2Exception.ManifestInvalid(
                "la versión ${destino.slug}@${destino.version} no produce un documento inicial válido",
                mapOf("violations" to violaciones.map { mapOf("code" to it.wire, "path" to it.path) }),
            )
        }
        return documento
    }

    /**
     * Bandera de corte (`02 §6`). Devuelve `true` si hay que **activarla** tras crear el documento.
     *
     * - `uses_templates2 = true` → adelante, nada que activar.
     * - `false` y la sonda confirma que **no** hay `invitation_configs` → invitación nueva: se crea y
     *   se activa la bandera en la misma transacción.
     * - `false` y la sonda dice que sí hay, o no lo sabe → `409 TPL_NOT_MIGRATED`. Es la opción
     *   conservadora de ADR-2-4-02: empezar a editar aquí una invitación que el módulo antiguo sigue
     *   sirviendo es exactamente el estado de dos verdades de H-04/H-05.
     */
    private fun comprobarCorte(invitationId: Long): Boolean {
        if (flags.usesTemplates2(invitationId) == true) return false
        return when (legacyConfig.hasLegacyConfig(invitationId)) {
            false -> true
            true -> throw NotMigratedException(
                "la invitación $invitationId la sirve el módulo antiguo (tiene invitation_configs)",
                mapOf("invitationId" to invitationId, "reason" to "legacy_config_present"),
            )
            null -> throw NotMigratedException(
                "no se puede determinar si la invitación $invitationId tiene configuración antigua; " +
                    "la bandera uses_templates2 la activa el proceso de migración (05 §4)",
                mapOf("invitationId" to invitationId, "reason" to "legacy_config_unknown"),
            )
        }
    }

    // =============================================================================================
    // 03 §3.3 — GET …/document
    // =============================================================================================

    /** Lectura pura: **no** crea el documento (X-07). Sin documento → `404 TPL_DOCUMENT_NOT_STARTED`. */
    @Transactional(readOnly = true)
    fun getDocument(requesterId: Long, invitationId: Long): DocumentResponse {
        autorizar(requesterId, invitationId)
        val fila = exigirDocumento(invitationId)
        val version = versionDe(fila)
        val documento = decodificar(fila)
        val negocio = negocio(invitationId)
        val resultado = componer(documento, version, negocio, invitationId)
        return DocumentResponse(
            document = DomainJson.encode(documento),
            revision = fila.revision,
            templateVersion = TemplateVersionRef(version.slug, version.version, version.status),
            // El paquete de plantilla que el editor necesita para EDITAR y que el compuesto no lleva
            // (ADR-3-4b-01): `constraints`, opciones de `choice`, `required` y `variants` de sección, y
            // el catálogo de paletas y tipografías. Se expone tal cual está registrado — ni se filtra ni
            // se transforma (P3) — con el mismo códec que ya emite `document`/`composed`/`report`.
            manifest = DomainJson.encode(version.pkg.manifest),
            theme = DomainJson.encode(version.pkg.theme),
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
            publicToken = fila.publicToken,
            publicUrl = publicUrl(fila.publicToken),
            activeRelease = releaseActivo(invitationId, negocio),
        )
    }

    // =============================================================================================
    // 03 §3.4 — POST …/document/operations
    // =============================================================================================

    @Transactional
    fun applyOperations(requesterId: Long, invitationId: Long, body: JsonNode): OperationBatchResponse {
        autorizar(requesterId, invitationId)
        val fila = exigirDocumento(invitationId)
        val version = versionDe(fila)
        val negocio = negocio(invitationId)

        // El tamaño del lote se mide **antes** del esquema: `operations` también lleva `maxItems: 50`
        // en el JSON Schema, y dejar que salte allí daría `400 TPL_MALFORMED_JSON` donde `03 §12`
        // (caso 24) exige `422 TPL_OPERATION_INVALID`.
        val operaciones = body.get("operations")
        if (operaciones != null && operaciones.isArray &&
            (operaciones.isEmpty || operaciones.size() > MAX_OPERACIONES)
        ) {
            throw OperationRejectedException(
                TplErrorCode.TPL_OPERATION_INVALID,
                "un lote lleva entre 1 y $MAX_OPERACIONES operaciones y llegaron ${operaciones.size()}",
                mapOf("operations" to operaciones.size(), "max" to MAX_OPERACIONES),
            )
        }
        // Dos capas, ninguna basta sola (aviso 1 de `handoffs/2-0b.md`): el JSON Schema ve patrones y
        // rangos, el códec ve claves desconocidas y literales fuera de catálogo. Un cuerpo que no casa
        // la forma es `400 TPL_MALFORMED_JSON` (`03 §5`), no un `422` de registro de plantilla.
        schemas.requireValid("operation-batch", body, TplErrorCode.TPL_MALFORMED_JSON)
        val lote = DomainJson.operationBatch(body)

        val documento = decodificar(fila)
        val metadatos = metadatosDeAssets(invitationId, version)

        // ---- Idempotencia REAL del lote (ADR-1R-B-03): `(document_id, clientBatchId)` ----
        // El chequeo de `baseRevision` NO cubre el caso que importa: si el cliente no vio la respuesta
        // (timeout), su `baseRevision` local sigue siendo la vieja y el reintento pasaría el chequeo y
        // aplicaría el lote **dos veces**.
        val yaAplicado = documents.snapshotOfBatch(fila.id, lote.clientBatchId)
        if (yaAplicado != null) {
            val docDeEseLote = DomainJson.document(yaAplicado.doc)
            val resultado = componer(documento, version, negocio, invitationId)
            return OperationBatchResponse(
                revision = yaAplicado.revision,
                applied = false,
                idMap = idMapDeReintento(fila.id, yaAplicado.revision, docDeEseLote, lote, version.pkg, metadatos),
                composed = DomainJson.encode(resultado.composed),
                report = DomainJson.encode(resultado.report),
            )
        }

        comprobarTempIds(lote)

        val ctx = ReducerContext(
            pkg = version.pkg,
            newUlid = { ulids.next() },
            assetMeta = { metadatos[it] },
        )
        val nuevo = when (val r = DefaultOperationReducer.applyBatch(documento, lote.operations, ctx)) {
            is BatchResult.Ok -> r
            is BatchResult.Failed -> throw OperationRejectedException.de(r.error, r.opIndex)
        }

        val escritura = documents.applyRevision(
            documentId = fila.id,
            expectedRevision = lote.baseRevision,
            doc = DomainJson.encode(nuevo.doc),
            origin = DocumentStore.ORIGEN_OPERATIONS,
            clientBatchId = lote.clientBatchId,
            updatedBy = requesterId,
        )
        val revision = when (escritura) {
            is DocumentWrite.Applied -> escritura.revision
            is DocumentWrite.Conflict -> throw conflicto(fila, negocio)
            is DocumentWrite.TooLarge -> throw demasiadoGrande(escritura)
        }

        val resultado = componer(nuevo.doc, version, negocio, invitationId)
        return OperationBatchResponse(
            revision = revision,
            applied = true,
            idMap = nuevo.idMap,
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
        )
    }

    /**
     * `03 §3.4` punto 2: un `tempId` que ningún `addItem` **previo** del lote declaró es
     * `TPL_TEMP_ID_UNRESOLVED`, y dos `addItem` con el mismo `tempId` son `TPL_TEMP_ID_DUPLICATE`.
     *
     * El reductor único devuelve `TPL_ITEM_UNKNOWN` (`TPL_OPERATION_INVALID`) para el primer caso —es
     * el espejo de TypeScript y `composition` está congelado—, así que la distinción se hace aquí,
     * antes de entrar, sin tocar el reductor ni divergir de él en el veredicto: lo que uno rechaza, el
     * otro también.
     */
    private fun comprobarTempIds(lote: OperationBatch) {
        val declarados = LinkedHashSet<String>()
        lote.operations.forEachIndexed { i, op ->
            when (op) {
                is Operation.AddItem ->
                    if (!declarados.add(op.tempId)) throw TempIdDuplicateException(
                        "el tempId ${op.tempId} lo declaran dos addItem del mismo lote",
                        mapOf("operations" to listOf(mapOf("index" to i, "code" to "TPL_TEMP_ID_DUPLICATE", "tempId" to op.tempId))),
                    )
                is Operation.RemoveItem -> exigirTempId(op.itemId, i, declarados)
                is Operation.MoveItem -> exigirTempId(op.itemId, i, declarados)
                is Operation.SetItemBlock -> exigirTempId(op.itemId, i, declarados)
                is Operation.ClearItemBlock -> exigirTempId(op.itemId, i, declarados)
                else -> Unit
            }
        }
    }

    private fun exigirTempId(itemId: String, index: Int, declarados: Set<String>) {
        if (itemId.startsWith("tmp:") && !declarados.contains(itemId)) throw TempIdUnresolvedException(
            "el tempId $itemId no lo declaró ningún addItem previo del lote",
            mapOf("operations" to listOf(mapOf("index" to index, "code" to "TPL_TEMP_ID_UNRESOLVED", "tempId" to itemId))),
        )
    }

    /**
     * Reconstruye el `idMap` que devolvió la primera ejecución de un lote reenviado (`03 §3.4` punto 6
     * promete "el `idMap` guardado", y `tpl_document_snapshot` no tiene columna donde guardarlo).
     *
     * Se **resimula** el lote sobre el documento de la revisión anterior con ULIDs deterministas: el
     * reductor es puro y determinista salvo por esos ids, así que cada ítem nuevo cae en la **misma
     * posición** del mismo grupo que la primera vez; el ULID real se lee entonces del documento que
     * aquel lote produjo. Si el snapshot anterior ya fue purgado o la simulación no reproduce (por
     * ejemplo, un asset borrado entretanto), se devuelve un mapa vacío en vez de uno inventado: el
     * cuerpo trae `composed` completo y el cliente puede releer (ADR-2-4-05).
     */
    private fun idMapDeReintento(
        documentId: Long,
        revision: Long,
        resultante: InvitationDocument,
        lote: OperationBatch,
        pkg: TemplatePackage,
        metadatos: Map<AssetId, AssetMeta>,
    ): Map<String, String> {
        if (lote.operations.none { it is Operation.AddItem }) return emptyMap()
        val previo = documents.snapshot(documentId, revision - 1) ?: return emptyMap()
        val docPrevio = try {
            DomainJson.document(previo.doc)
        } catch (fallo: Templates2Exception) {
            return emptyMap()
        }
        val ulids = DocumentMigrator.deterministicUlids()
        val simulado = DefaultOperationReducer.applyBatch(
            docPrevio,
            lote.operations,
            ReducerContext(pkg, ulids) { metadatos[it] },
        )
        if (simulado !is BatchResult.Ok) return emptyMap()

        // simulado.idMap: tempId → ULID ficticio. Se busca ese ULID en el documento simulado para
        // saber (grupo, posición), y se lee el ULID real en esa misma posición del documento real.
        val posiciones = LinkedHashMap<String, Pair<BlockId, Int>>()
        for ((groupId, valor) in simulado.doc.content) {
            if (valor !is GroupValue) continue
            valor.items.forEachIndexed { i, item -> posiciones[item.itemId.value] = groupId to i }
        }
        val salida = LinkedHashMap<String, String>()
        for ((tempId, ficticio) in simulado.idMap) {
            val (groupId, indice) = posiciones[ficticio] ?: continue
            val grupo = resultante.content[groupId] as? GroupValue ?: continue
            val real = grupo.items.getOrNull(indice) ?: continue
            salida[tempId] = real.itemId.value
        }
        return salida
    }

    // =============================================================================================
    // 03 §3.5 — GET …/document/history
    // =============================================================================================

    @Transactional(readOnly = true)
    fun history(
        requesterId: Long,
        invitationId: Long,
        limit: Int?,
        cursor: String?,
        clientBatchId: String?,
    ): HistoryPageResponse {
        autorizar(requesterId, invitationId)
        val fila = exigirDocumento(invitationId)
        val tope = (limit ?: HISTORIAL_POR_DEFECTO).coerceIn(1, HISTORIAL_MAXIMO)
        val desde = cursor?.let {
            it.toLongOrNull() ?: throw Templates2Exception.MalformedJson(
                "cursor inválido: se esperaba una revisión", mapOf("param" to "cursor", "value" to it),
            )
        }
        val filas = documents.history(fila.id, tope + 1, desde, clientBatchId)
        val pagina = filas.take(tope)
        val siguiente = if (filas.size > tope) (pagina.last().revision - 1).toString() else null
        return HistoryPageResponse(
            items = pagina.map {
                HistoryItemResponse(it.revision, it.createdAt, it.clientBatchId, it.origin, it.createdBy)
            },
            nextCursor = siguiente,
        )
    }

    // =============================================================================================
    // 03 §3.6 — POST …/document/restore
    // =============================================================================================

    /**
     * Pipeline de ADR-029, **nunca copia el `doc` crudo**: toma `content`/`structure`/`theme` de la
     * snapshot, ignora su `template` (es histórico), normaliza contra el manifiesto **vigente**,
     * revalida valor a valor y persiste como revisión **nueva** con `origin = 'restore'`.
     *
     * `baseRevision` es obligatoria (`02 §11.3`): restaurar es una escritura como cualquier otra y
     * debe fallar con `409` si otra pestaña escribió entretanto.
     */
    @Transactional
    fun restore(requesterId: Long, invitationId: Long, body: JsonNode): RestoreResponse {
        autorizar(requesterId, invitationId)
        val fila = exigirDocumento(invitationId)
        val peticion = EditorRequests.restore(body)
        val negocio = negocio(invitationId)
        if (peticion.baseRevision != fila.revision) throw conflicto(fila, negocio)

        val snapshot = documents.snapshot(fila.id, peticion.revision) ?: throw SnapshotNotFoundException(
            "la revisión ${peticion.revision} no existe para este documento o ya fue purgada",
            mapOf("revision" to peticion.revision),
        )
        val version = versionDe(fila)
        val historico = DomainJson.document(snapshot.doc)
        val actual = decodificar(fila)

        // El attic del documento vigente se conserva y se le suma el del snapshot: nada retrocede
        // destructivamente (ADR-006).
        val atticUnido = (actual.attic.keys + historico.attic.keys).associateWith { clave ->
            (actual.attic[clave] ?: emptyMap()) + (historico.attic[clave] ?: emptyMap())
        }
        // `template` = el de la SNAPSHOT para que el normalizador use `attic["<slug>@<version>"]` de la
        // snapshot (`03 §3.6` paso 2); se sustituye por el vigente justo después.
        val candidato = historico.copy(attic = atticUnido)
        val normalizado = DocumentNormalizer.normalize(candidato, version.pkg)
        val revalidado = revalidar(normalizado.doc, version.pkg)
        val restaurado = revalidado.doc.copy(template = TemplateRef(version.pkg.slug, version.pkg.version))

        val violaciones = Invariants.validateInvariants(restaurado, version.pkg)
        if (violaciones.isNotEmpty()) {
            throw Templates2Exception.Internal(
                "restore produjo un documento inválido pese a normalizar y revalidar: " +
                    violaciones.joinToString { "${it.wire}@${it.path}" },
            )
        }

        val escritura = documents.applyRevision(
            documentId = fila.id,
            expectedRevision = peticion.baseRevision,
            doc = DomainJson.encode(restaurado),
            origin = DocumentStore.ORIGEN_RESTORE,
            updatedBy = requesterId,
        )
        val revision = when (escritura) {
            is DocumentWrite.Applied -> escritura.revision
            is DocumentWrite.Conflict -> throw conflicto(fila, negocio)
            is DocumentWrite.TooLarge -> throw demasiadoGrande(escritura)
        }
        val resultado = componer(restaurado, version, negocio, invitationId)
        return RestoreResponse(
            revision = revision,
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
            movedToAttic = (normalizado.toAttic + revalidado.toAttic).map { it.value }.distinct(),
        )
    }

    /**
     * Paso 3 de `03 §3.6`: lo que sí coincide con el manifiesto vigente se valida con
     * `validateValueAgainstSpec`; lo que no valida **se guarda en el attic**, no se descarta ni tumba
     * la restauración (ADR-2-4-04). Un valor que era legal en la versión de la snapshot y ya no lo es
     * (p. ej. un texto más largo que el `maxLength` de hoy) no puede impedir recuperar el resto.
     */
    private fun revalidar(doc: InvitationDocument, pkg: TemplatePackage): DocumentNormalizer.Resultado {
        val specs = pkg.manifest.topLevelBlocks()
        val invalidos = doc.content.filter { (id, valor) ->
            val spec = specs[id] ?: return@filter false
            Invariants.validateValueAgainstSpec(spec, valor, id.value).isNotEmpty()
        }
        if (invalidos.isEmpty()) return DocumentNormalizer.Resultado(doc, emptyList(), emptyList())
        val clave = "${doc.template.slug.value}@${doc.template.version}"
        val attic = doc.attic.toMutableMap()
        attic[clave] = (attic[clave] ?: emptyMap()) + invalidos
        return DocumentNormalizer.Resultado(
            doc.copy(content = doc.content - invalidos.keys, attic = attic),
            invalidos.keys.toList(),
            emptyList(),
        )
    }

    // =============================================================================================
    // Piezas compartidas (las usa también ReleaseService)
    // =============================================================================================

    fun autorizar(requesterId: Long, invitationId: Long) {
        if (!hierarchy.validateInvitationAccess(requesterId, invitationId)) {
            throw ForbiddenException(
                "el usuario $requesterId no tiene acceso a la invitación $invitationId",
                mapOf("invitationId" to invitationId),
            )
        }
    }

    fun exigirDocumento(invitationId: Long): TplDocumentEntity =
        documents.find(invitationId) ?: throw DocumentNotStartedException(
            "la invitación $invitationId no tiene documento: hay que llamar antes a :choose-template",
            mapOf("invitationId" to invitationId),
        )

    fun versionDe(fila: TplDocumentEntity): LoadedTemplateVersion =
        versions.porId(fila.templateVersionId) ?: throw Templates2Exception.Internal(
            "tpl_document.id=${fila.id} apunta a template_version_id=${fila.templateVersionId}, que no existe",
        )

    fun decodificar(fila: TplDocumentEntity): InvitationDocument = DomainJson.document(fila.doc)

    fun negocio(invitationId: Long): BusinessSnapshot =
        business.read(invitationId) ?: throw Templates2Exception.Internal(
            "no se pudo proyectar el BusinessSnapshot de la invitación $invitationId",
        )

    /** `compose` es puro y **no valida**: el documento que llega aquí ya pasó por las invariantes. */
    fun componer(
        documento: InvitationDocument,
        version: LoadedTemplateVersion,
        negocio: BusinessSnapshot,
        invitationId: Long,
    ): CompositionResult = composer.compose(
        version.pkg, documento, negocio, indiceDeAssets(invitationId, version), documento.meta.locale,
    )

    /**
     * `AssetIndex` de `compose` (ADR-1R-D-01): assets de **esta** invitación más los de la versión de
     * plantilla vigente. La URL se deriva de `tpl_asset.s3_key` y es **estable, sin firma** — una URL
     * firmada cambiaría el `contentHash` en cada petición y rompería el `ETag` del render (`01 §5.5`).
     */
    fun indiceDeAssets(invitationId: Long, version: LoadedTemplateVersion): AssetIndex =
        AssetUrlResolver.index(publicBaseUrl, almacenados(invitationId, version))

    private fun almacenados(
        invitationId: Long,
        version: LoadedTemplateVersion,
    ): Map<AssetId, AssetUrlResolver.StoredAsset> =
        // `almacenado` comprueba en voz alta que la fila vive en el bucket que este módulo
        // direcciona (ADV-10): una fila en otro bucket daría una URL rota dentro del `composed`
        // que se congela en `tpl_release`, y ahí ya no la detecta nadie.
        filasIndexadas(invitationId, version).mapValues { (_, a) ->
            AssetUrlResolver.almacenado(bucket, a.publicId, a.bucket, a.s3Key, a.width, a.height)
        }

    /**
     * `assetId → fila de tpl_asset`, con **dos** clases de clave y en este orden, que importa:
     *
     * 1. el `public_id` REAL de cada fila (assets de la invitación y de la versión de plantilla);
     * 2. los **ALIAS** que el manifiesto declara en `AssetEntry.id` (I-09, ADR-3B-I09-01), casados
     *    con su fila por `sha256` y **solo** entre las filas de la versión de plantilla.
     *
     * El alias existe porque el `publicId` lo acuña el servidor en el registro
     * (`TemplateRegistrationService`, `"as_" + ulid`) y por tanto un paquete no puede escribirlo en
     * su `defaults.json`: sin esto, `cover.image` salía `provenance:"empty"` y `rsvp.background`
     * —que es `source:"fixed"`— quedaba inalcanzable por cualquier vía (`bitacora/3-2d.md §5`).
     *
     * **El alias NUNCA pisa a un asset real**: se añade con `putIfAbsent` después de todas las
     * filas, así que si un `id` del manifiesto coincidiera con el `public_id` de un asset de la
     * invitación, gana el asset real y el alias se descarta. La base no cambia: `tpl_asset.public_id`
     * sigue siendo el ULID del servidor y el alias solo vive en este mapa.
     */
    private fun filasIndexadas(
        invitationId: Long,
        version: LoadedTemplateVersion,
    ): Map<AssetId, TplAssetEntity> {
        val filas = filasDeAssets(invitationId, version)
        val salida = LinkedHashMap<AssetId, TplAssetEntity>()
        for (a in filas) salida[AssetId(a.publicId)] = a
        val declarados = version.pkg.manifest.assets.mapNotNull { e -> e.id?.let { it to e.sha256.lowercase() } }
        if (declarados.isEmpty()) return salida
        val porSha = filas.filter { it.templateVersionId == version.templateVersionId }
            .associateBy { it.sha256.lowercase() }
        for ((alias, sha) in declarados) porSha[sha]?.let { salida.putIfAbsent(alias, it) }
        return salida
    }

    /**
     * `assetMeta` del reductor: **una consulta por origen**, nunca una por operación (`03 §3.4` punto
     * 3, "la consulta se hace en bloque"). Un `assetId` ausente de este mapa es, por construcción, uno
     * que no pertenece ni a la invitación ni a la plantilla vigente → el reductor devuelve
     * `TPL_ASSET_NOT_OWNED` (ADR-030).
     */
    fun metadatosDeAssets(invitationId: Long, version: LoadedTemplateVersion): Map<AssetId, AssetMeta> =
        // Los mismos alias que el `AssetIndex` (I-09): si no, `image.aspect` se quedaría sin
        // validador para el alias y el reductor lo rechazaría con `TPL_ASSET_NOT_OWNED`.
        filasIndexadas(invitationId, version).mapValues { (_, a) ->
            AssetMeta(a.bytes, a.width, a.height, a.contentType)
        }

    private fun filasDeAssets(invitationId: Long, version: LoadedTemplateVersion): List<TplAssetEntity> =
        assets.findByInvitationId(invitationId) + assets.findByTemplateVersionId(version.templateVersionId)

    /** `03 §3.3`: `stale` sale de comparar el `business_snapshot` congelado con el actual, sin recomponer. */
    fun releaseActivo(invitationId: Long, negocio: BusinessSnapshot): ActiveReleaseRef? {
        val release = releases.findByInvitationIdAndIsActiveTrue(invitationId) ?: return null
        val razones = razonesDeStale(release, negocio)
        return ActiveReleaseRef(
            releaseId = release.id,
            publishedAt = release.publishedAt,
            contentHash = release.contentHash,
            documentRevision = release.documentRevision,
            stale = razones.isNotEmpty(),
            staleReason = razones,
        )
    }

    /** Campo a campo sobre el JSON congelado: el nombre que sale es el que el editor enseña. */
    fun razonesDeStale(release: TplReleaseEntity, negocio: BusinessSnapshot): List<String> {
        val congelado = try {
            DomainJson.businessSnapshot(release.businessSnapshot)
        } catch (fallo: Templates2Exception) {
            // Una fila ilegible no puede tumbar el `GET /document`; se marca stale (P1: se ve).
            return listOf("business.unreadable")
        }
        val razones = mutableListOf<String>()
        if (congelado.date != negocio.date) razones.add("business.date")
        if (congelado.time != negocio.time) razones.add("business.time")
        if (congelado.hashtag != negocio.hashtag) razones.add("business.hashtag")
        if (congelado.coverPhotoUrl != negocio.coverPhotoUrl) razones.add("business.coverPhotoUrl")
        if (congelado.childrenAllowed != negocio.childrenAllowed) razones.add("business.childrenAllowed")
        if (congelado.youngAllowed != negocio.youngAllowed) razones.add("business.youngAllowed")
        if (congelado.eventKind != negocio.eventKind) razones.add("business.eventKind")
        if (congelado.planTier != negocio.planTier) razones.add("business.planTier")
        if (congelado.timezone != negocio.timezone) razones.add("business.timezone")
        return razones
    }

    /** `03 §3.10`: token nuevo acuñado con `SecureRandom`; `revision` y `doc` intactos. */
    fun rotar(documentId: Long): PublicToken = documents.rotatePublicToken(documentId)

    fun publicUrl(publicToken: String): String = "${frontendUrl.trimEnd('/')}/i/$publicToken"

    /** `409` con el documento actual dentro, para que el cliente rebase (`03 §3.4` punto 5). */
    fun conflicto(fila: TplDocumentEntity, negocio: BusinessSnapshot): RevisionConflictException {
        val actual = documents.find(fila.invitationId) ?: fila
        val version = versionDe(actual)
        val documento = decodificar(actual)
        val resultado = componer(documento, version, negocio, actual.invitationId)
        return RevisionConflictException(
            "la revisión base no coincide con la actual (${actual.revision})",
            mapOf(
                "currentRevision" to actual.revision,
                "document" to DomainJson.encode(documento),
                "composed" to DomainJson.encode(resultado.composed),
                "report" to DomainJson.encode(resultado.report),
            ),
        )
    }

    private fun demasiadoGrande(e: DocumentWrite.TooLarge) = DocumentTooLargeException(
        "el documento resultante ocupa ${e.bytes} B y el tope es ${e.limit} B",
        mapOf("bytes" to e.bytes, "limit" to e.limit),
    )

    private fun respuestaChoose(
        fila: TplDocumentEntity,
        version: LoadedTemplateVersion,
        negocio: BusinessSnapshot,
        created: Boolean,
        changed: Boolean,
        movidos: List<String>,
    ): ChooseTemplateResponse {
        val actual = documents.find(fila.invitationId) ?: fila
        val documento = decodificar(actual)
        val resultado = componer(documento, version, negocio, actual.invitationId)
        return ChooseTemplateResponse(
            revision = actual.revision,
            created = created,
            changed = changed,
            document = DomainJson.encode(documento),
            composed = DomainJson.encode(resultado.composed),
            report = DomainJson.encode(resultado.report),
            movedToAttic = movidos,
            templateVersion = TemplateVersionRef(version.slug, version.version, version.status),
            publicToken = actual.publicToken,
            publicUrl = publicUrl(actual.publicToken),
        )
    }

    companion object {
        const val ESTADO_PUBLICADA = "published"

        /** `operations.ts` `OperationBatch.operations` y `03 §8`. */
        const val MAX_OPERACIONES = 50

        const val HISTORIAL_POR_DEFECTO = 50
        const val HISTORIAL_MAXIMO = 100
    }
}
