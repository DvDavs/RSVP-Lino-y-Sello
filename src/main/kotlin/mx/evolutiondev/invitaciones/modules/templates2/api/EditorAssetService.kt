package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.modules.templates2.catalog.ImageDimensions
import mx.evolutiondev.invitaciones.modules.templates2.catalog.MagicBytes
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.persistence.AssetStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAssetStorage
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetEntity
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.InputStream
import java.time.Duration

/**
 * Assets del cliente: rutas 7-9 de `03 §2` (`03 §3.7`-`§3.9`, `02 §10.1`).
 *
 * **El orden de efectos de `02 §10` se cumple aquí, paso a paso, y no es negociable:**
 *
 * 1. Autorización (P8) — antes de tocar ninguna tabla ni leer un byte del cuerpo.
 * 2. Documento existente: sin `:choose-template` previo no hay dónde colgar un asset.
 * 3. Lectura **contada** del cuerpo, con corte a 15 MiB antes de agotar la memoria.
 * 4. Tipo declarado **y** número mágico (`MagicBytes`, de 2-3). La cabecera sola no basta: quien la
 *    declara es exactamente quien sube el archivo.
 * 5. `sha256` → si ya existe un asset de esta invitación con ese digesto, se devuelve **ese**
 *    (`reused = true`) sin duplicar objeto ni fila. Idempotencia por contenido, no por reintento.
 * 6. Cuota blanda de 200 por invitación.
 * 7. `assetId = "as_" + ULID` y `s3_key` **determinista por contenido**.
 * 8. **S3 primero** (R-S3-1): un objeto sin fila es basura barata y determinista; una fila sin objeto
 *    es una imagen rota en una invitación publicada.
 * 9. La fila, en su transacción.
 *
 * El método [subir] **no** es `@Transactional` a propósito: si lo fuera, la subida a S3 quedaría
 * dentro de la transacción de Postgres y una espera de red mantendría abierta una conexión de la base.
 * Cada escritura abre la suya en `AssetStore` (`02 §7.4`).
 */
@Service
class EditorAssetService(
    private val editor: EditorDocumentService,
    private val assets: AssetStore,
    private val almacen: InvitationAssetStorage,
    private val claves: Templates2S3KeyService,
    private val ulids: UlidGenerator,
    @Value("\${templates2.assets.bucket:}") bucketConfigurado: String,
) {

    /** Mismo valor por defecto que `EditorDocumentService`, para que la URL compuesta y la firmada
     *  apunten al mismo objeto. */
    val bucket: String = bucketConfigurado.ifBlank { BUCKET_POR_DEFECTO }

    // =============================================================================================
    // 03 §3.7 — POST …/assets   (cuerpo binario crudo, ADR-1R-B-12)
    // =============================================================================================

    /**
     * `reused = true` ⇒ el controlador responde `200`; si no, `201` (`03 §3.7`).
     *
     * [contentLengthDeclarado] es lo que dice la cabecera (`-1` si no viene, p. ej. `chunked`); se
     * comprueba **antes** de leer, pero no se confía en él: la lectura vuelve a contar.
     */
    fun subir(
        requesterId: Long,
        invitationId: Long,
        contentTypeDeclarado: String?,
        contentLengthDeclarado: Long,
        cuerpo: InputStream,
    ): AssetUploadResponse {
        editor.autorizar(requesterId, invitationId)
        editor.exigirDocumento(invitationId)

        val tipo = tipoAceptado(contentTypeDeclarado)
        if (contentLengthDeclarado > MAX_BYTES) throw AssetTooLargeException(
            "el archivo declara ${contentLengthDeclarado} B y el máximo es $MAX_BYTES B",
            mapOf("bytes" to contentLengthDeclarado, "limit" to MAX_BYTES),
        )

        val bytes = leerConTope(cuerpo)
        if (bytes.isEmpty()) throw Templates2Exception.MalformedJson(
            "el cuerpo de la subida está vacío",
            mapOf("path" to "body"),
        )
        if (!MagicBytes.coincide(tipo, bytes)) throw AssetTypeUnsupportedException(
            "los primeros bytes del archivo no corresponden a ${tipo.wire}",
            mapOf("contentType" to tipo.wire),
        )

        val sha = sha256(bytes)
        assets.porContenido(invitationId, sha)?.let { return respuesta(it, reused = true) }

        val cuantos = assets.cuantos(invitationId)
        if (cuantos >= AssetStore.CUOTA_POR_INVITACION) throw AssetQuotaExceededException(
            "la invitación $invitationId ya tiene $cuantos assets y el máximo es " +
                "${AssetStore.CUOTA_POR_INVITACION}",
            mapOf("count" to cuantos, "limit" to AssetStore.CUOTA_POR_INVITACION),
        )

        val publicId = "as_" + ulids.next()
        val clave = claves.invitationAssetKey(invitationId, sha, tipo)
        try {
            almacen.upload(bucket, clave, bytes, tipo.wire)
        } catch (e: Exception) {
            // Paso 8 de `02 §10.1`: **no queda ninguna fila**. El cliente reintenta y, como la clave es
            // determinista, el reintento reescribe el mismo objeto en vez de acumular copias.
            throw AssetStorageUnavailableException("S3 no aceptó \"$clave\": ${e.message}", e)
        }

        val dimensiones = ImageDimensions.de(tipo, bytes)
        val fila = assets.registrar(
            invitationId = invitationId,
            publicId = publicId,
            bucket = bucket,
            s3Key = clave,
            sha256 = sha,
            contentType = tipo.wire,
            bytes = bytes.size.toLong(),
            width = dimensiones?.first,
            height = dimensiones?.second,
            createdBy = requesterId,
        )
        return respuesta(fila, reused = false)
    }

    // =============================================================================================
    // 03 §3.8 — GET …/assets
    // =============================================================================================

    @Transactional(readOnly = true)
    fun listar(requesterId: Long, invitationId: Long, limit: Int?, cursor: String?): AssetListResponse {
        editor.autorizar(requesterId, invitationId)
        val tope = (limit ?: LIMITE_POR_DEFECTO).coerceIn(1, LIMITE_MAXIMO)
        val pagina = paginaDe(cursor)
        // El "hay más" **no** se resuelve pidiendo `tope + 1` filas: con `Pageable`, el desplazamiento
        // es `página × tamaño`, así que pedir una de más desplazaría la página siguiente y se saltaría
        // un asset por página. Se resuelve con el `count`, que además ya hace falta para la cuota.
        val filas = assets.listar(invitationId, PageRequest.of(pagina, tope))
        val total = assets.cuantos(invitationId)

        val referenciadosEnDoc = assetsDelDocumento(invitationId)
        val referenciadosEnReleases = assets.referenciadosPorReleases(invitationId, filas.map { it.s3Key })

        return AssetListResponse(
            items = filas.map {
                AssetItemResponse(
                    assetId = it.publicId,
                    bytes = it.bytes,
                    contentType = it.contentType,
                    width = it.width,
                    height = it.height,
                    createdAt = it.createdAt,
                    referenced = referenciadosEnDoc.contains(it.publicId) ||
                        referenciadosEnReleases.contains(it.s3Key),
                    previewUrl = previewUrl(it),
                )
            },
            nextCursor = if ((pagina + 1).toLong() * tope < total) (pagina + 1).toString() else null,
        )
    }

    // =============================================================================================
    // 03 §3.9 — DELETE …/assets/{assetId}
    // =============================================================================================

    /**
     * Una sola transacción para "¿está referenciado?" + `DELETE`: separarlas dejaría una ventana en la
     * que un `setBlock` concurrente referencia el asset justo después de la comprobación y antes del
     * borrado, publicando una invitación con una imagen que ya no existe.
     *
     * El objeto de S3 **no** se borra aquí (R-S3-2): lo encola el trigger `trg_tpl_asset_gc` y lo
     * retira `AssetGcJob` después del commit. Borrar antes del commit dejaría rotas las invitaciones si
     * la transacción se revirtiera.
     */
    @Transactional
    fun borrar(requesterId: Long, invitationId: Long, assetId: String) {
        editor.autorizar(requesterId, invitationId)
        // Un `assetId` de otra invitación y uno inexistente dan **la misma** respuesta (`03 §9.2`).
        val fila = assets.propio(invitationId, assetId) ?: throw AssetNotFoundException(
            "la invitación $invitationId no tiene ningún asset $assetId",
            mapOf("assetId" to assetId),
        )
        if (assetsDelDocumento(invitationId).contains(assetId)) throw AssetInUseException(
            "el asset $assetId lo usa el documento de trabajo",
            mapOf("assetId" to assetId, "usedBy" to "document"),
        )
        if (assets.referenciadoPorAlgunRelease(invitationId, fila.s3Key)) throw AssetInUseException(
            "el asset $assetId lo usa una publicación de esta invitación",
            mapOf("assetId" to assetId, "usedBy" to "release"),
        )
        assets.borrar(fila)
    }

    // =============================================================================================

    /**
     * `assetId` presentes en `content` **y en el `attic`** del documento vigente.
     *
     * El `attic` cuenta: es contenido recuperable (ADR-006) y borrar el asset que respalda una imagen
     * archivada convertiría un `restore` futuro en una imagen rota, en silencio. Ante la duda, no se
     * borra.
     */
    private fun assetsDelDocumento(invitationId: Long): Set<String> {
        val fila = editor.exigirDocumento(invitationId)
        val documento: InvitationDocument = editor.decodificar(fila)
        val salida = LinkedHashSet<String>()
        documento.content.values.forEach { recolectar(it, salida) }
        documento.attic.values.forEach { mapa -> mapa.values.forEach { recolectar(it, salida) } }
        return salida
    }

    private fun recolectar(valor: BlockValue, salida: MutableSet<String>) {
        when (valor) {
            is ImageValue -> salida.add(valor.assetId.value)
            is AudioValue -> salida.add(valor.assetId.value)
            is GroupValue -> valor.items.forEach { item ->
                item.values.values.forEach { recolectar(it, salida) }
            }
            else -> Unit
        }
    }

    /** El catálogo de `03 §3.7`, intersecado con el de `blocks.ts` (`AssetContentType`). */
    private fun tipoAceptado(declarado: String?): AssetContentType {
        val limpio = declarado?.substringBefore(';')?.trim()?.lowercase()
        if (limpio.isNullOrBlank()) throw AssetTypeUnsupportedException(
            "hace falta declarar el Content-Type del archivo",
            mapOf("allowed" to TIPOS_ACEPTADOS.map { it.wire }),
        )
        val tipo = AssetContentType.of(limpio)
        if (tipo == null || tipo !in TIPOS_ACEPTADOS) throw AssetTypeUnsupportedException(
            "el tipo \"$limpio\" no se acepta en la subida de assets del editor",
            mapOf("contentType" to limpio, "allowed" to TIPOS_ACEPTADOS.map { it.wire }),
        )
        return tipo
    }

    /**
     * Lectura contada (`03 §3.7`): corta **al rebasar**, sin cargar antes 15 MiB "para medirlos". Es la
     * segunda vía del límite; la primera, `Content-Length`, se comprueba antes y puede ser mentira.
     */
    private fun leerConTope(cuerpo: InputStream): ByteArray {
        val buffer = ByteArray(TROZO)
        val salida = java.io.ByteArrayOutputStream(TROZO)
        var total = 0L
        while (true) {
            val n = cuerpo.read(buffer)
            if (n < 0) break
            total += n
            if (total > MAX_BYTES) throw AssetTooLargeException(
                "el archivo supera los $MAX_BYTES B",
                mapOf("limit" to MAX_BYTES),
            )
            salida.write(buffer, 0, n)
        }
        return salida.toByteArray()
    }

    /**
     * **Una sola implementación de sha256-hex en el módulo** (objeción ADV-15 de la revisión
     * adversarial global). Antes había dos —esta y `Templates2Json.sha256`/`hex`, la que usa el
     * registro de plantillas— y coincidían por casualidad, no por construcción: las dos alimentan la
     * **misma** columna `tpl_asset.sha256` y el mismo `ck_tpl_asset_sha256` (`^[0-9a-f]{64}$`), así
     * que basta que una de las dos emitiera mayúsculas para que la otra ruta dejara de insertar.
     */
    private fun sha256(bytes: ByteArray): String = Templates2Json.hex(Templates2Json.sha256(bytes))

    private fun previewUrl(fila: TplAssetEntity): String =
        almacen.previewUrl(fila.bucket, fila.s3Key, DURACION_PREVIEW)

    private fun respuesta(fila: TplAssetEntity, reused: Boolean) = AssetUploadResponse(
        assetId = fila.publicId,
        bytes = fila.bytes,
        contentType = fila.contentType,
        sha256 = fila.sha256,
        width = fila.width,
        height = fila.height,
        previewUrl = previewUrl(fila),
        reused = reused,
    )

    private fun paginaDe(cursor: String?): Int {
        if (cursor.isNullOrBlank()) return 0
        return cursor.toIntOrNull()?.coerceAtLeast(0) ?: throw Templates2Exception.MalformedJson(
            "cursor inválido: se esperaba un número de página",
            mapOf("param" to "cursor", "value" to cursor),
        )
    }

    companion object {
        /** `03 §3.7` y `ck_tpl_asset_bytes` de `02 §2` V31: 15 MiB. */
        const val MAX_BYTES = 15L * 1024 * 1024

        /** `03 §3.7`: la duración se pasa **siempre** explícita (el defecto del método es 7 días). */
        val DURACION_PREVIEW: Duration = Duration.ofMinutes(15)

        const val LIMITE_POR_DEFECTO = 50
        const val LIMITE_MAXIMO = 100
        /**
         * `02 §10.1` paso 8 fija literalmente `S3Service.uploadPublicFile(S3Buckets.ASSETS, …)`, y es
         * el mismo bucket que ya usan `catalog.TemplateRegistrationService` y
         * `catalog.TemplateCatalogService` (los dos con `S3Buckets.ASSETS`). Un literal propio aquí
         * hacía que, **sin** `templates2.assets.bucket` configurada —que es el estado real:
         * `contratos.md §4` prohíbe tocar `application.yml` salvo `spring.servlet.multipart`—, el
         * editor subiera a un bucket y el catálogo compusiera la URL desde otro.
         */
        const val BUCKET_POR_DEFECTO = S3Buckets.ASSETS

        private const val TROZO = 64 * 1024

        /**
         * `03 §3.7` enumera `{image/webp, image/png, image/jpeg, audio/mpeg, audio/aac}`, pero
         * **`audio/aac` no existe en el catálogo del esquema** (`manifest.ts:48`, espejado en
         * `AssetContentType`): un asset AAC no se podría referenciar desde un documento, así que
         * aceptarlo aquí sería aceptar un archivo inservible. Y `image/svg+xml`/`font/woff2`, que sí
         * están en el catálogo, se quedan **fuera** de esta ruta: son assets de un paquete de plantilla
         * (rutas MASTER), y un SVG subido por un cliente y servido desde un bucket público es un vector
         * de XSS. ADR-2-5-04.
         */
        val TIPOS_ACEPTADOS = setOf(
            AssetContentType.IMAGE_WEBP,
            AssetContentType.IMAGE_PNG,
            AssetContentType.IMAGE_JPEG,
            AssetContentType.AUDIO_MPEG,
        )
    }
}
