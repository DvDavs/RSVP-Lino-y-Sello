package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrationAuditor
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

/**
 * El **único** camino de alta de una plantilla (`02 §4`, ADR-033): lo comparten
 * `POST /master/templates2/versions` y el comando de línea [TemplateRegisterCommand]. No hay una
 * segunda vía, a diferencia de las seis del módulo antiguo (Flyway, seed, dos rutas MASTER, scripts y
 * edición manual).
 *
 * Orden exacto de efectos, con su motivo:
 *
 * 1. **Fuera de transacción** — parseo y validación ([TemplatePackageParser]). Fallo → auditoría
 *    `rejected` con transacción propia + excepción tipada. Nada más se ejecuta.
 * 2. **Fuera de transacción** — subida de los assets a S3 (`R-S3-1` de `02 §10`: primero el objeto,
 *    después la fila; un objeto sin fila es basura barata y determinista, una fila sin objeto es una
 *    imagen rota en una invitación publicada).
 * 3. **Una transacción** — [TemplateRegistrar] (pasos 3-7 de `02 §4`).
 *
 * Si 3 falla, los objetos ya subidos quedan huérfanos pero **inertes y deterministas**: su clave
 * incluye el `sha256`, así que el reintento reescribe exactamente el mismo objeto y el barrido semanal
 * de `AssetGcJob` los retira (`02 §4` paso 8, `§10.5`). Ninguna fila queda a medias.
 *
 * **Nunca se descarta nada en silencio (P1):** cada intento —éxito, no-op o rechazo— deja fila en
 * `tpl_template_registration`.
 */
@Service
class TemplateRegistrationService(
    private val parser: TemplatePackageParser,
    private val storage: TemplateAssetStorage,
    private val keys: Templates2S3KeyService,
    private val ulid: UlidGenerator,
    private val registrar: TemplateRegistrar,
    private val auditor: TemplateRegistrationAuditor,
    @Value("\${templates2.assets.bucket:}") bucketConfigurado: String,
) {

    /** `S3Buckets.ASSETS` salvo que se configure otro (`02 §10.4`); no exige tocar `application.yml`. */
    val bucket: String = bucketConfigurado.ifBlank { S3Buckets.ASSETS }

    fun register(raw: RawTemplatePackage, requesterId: Long? = null): TemplateRegistrationOutcome {
        // --- Paso 1: parseo + JSON Schema + invariantes + assets declarados + package_hash ---
        val validado = try {
            parser.parse(raw)
        } catch (e: TemplateRegistryException) {
            auditarFalloTemprano(raw, e.code, e.details, requesterId)
            throw e
        } catch (e: Templates2Exception) {
            auditarFalloTemprano(raw, e.code, e.details, requesterId)
            throw e
        }

        // --- Paso 2: S3 antes de la transacción (R-S3-1). Deduplicado por contenido: dos rutas con
        // los mismos bytes son el mismo objeto y una sola fila (`ux_tpl_asset_version_sha`). ---
        val subidos = try {
            subirAssets(validado)
        } catch (e: TemplateRegistryException) {
            auditor.auditarRechazo(validado.slug, validado.version, validado.packageHash, e.code, e.details, requesterId)
            throw e
        } catch (e: Exception) {
            auditor.auditarRechazo(
                validado.slug, validado.version, validado.packageHash, TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE,
                mapOf("message" to (e.message ?: e.javaClass.simpleName)), requesterId,
            )
            throw AssetStorageUnavailableException("fallo subiendo los assets del paquete: ${e.message}", e)
        }

        // --- Paso 3: una transacción (`02 §4` pasos 3-7). Los rechazos de dentro ya se auditaron. ---
        return try {
            registrar.register(validado, subidos, requesterId)
        } catch (e: TemplateRegistryException) {
            throw e
        } catch (e: Templates2Exception) {
            throw e
        } catch (e: Exception) {
            auditor.auditarRechazo(
                validado.slug, validado.version, validado.packageHash, TplErrorCode.TPL_INTERNAL,
                mapOf("message" to (e.message ?: e.javaClass.simpleName)), requesterId,
            )
            throw Templates2Exception.Internal("el registro de ${validado.slug}@${validado.version} falló: ${e.message}", e)
        }
    }

    private fun subirAssets(pkg: ValidatedTemplatePackage): List<TemplateRegistrar.AssetSubido> {
        val porSha = LinkedHashMap<String, TemplateRegistrar.AssetSubido>()
        for (a in pkg.assets) {
            if (porSha.containsKey(a.sha256)) continue
            val key = keys.templateAssetKey(pkg.slug, pkg.version, a.sha256, a.contentType)
            storage.upload(bucket, key, a.bytes, a.contentType.wire)
            // Objeción ADV-09: alto y ancho leídos de la cabecera, igual que en la subida de assets de
            // invitación (`02 §10.1` paso 10). Sin ellos, `image.aspect` se quedaba sin validador para
            // todo documento que referenciara un asset de plantilla (`contratos.md §3`).
            val dimensiones = ImageDimensions.de(a.contentType, a.bytes)
            porSha[a.sha256] = TemplateRegistrar.AssetSubido(
                publicId = "as_" + ulid.next(),
                sha256 = a.sha256,
                contentType = a.contentType.wire,
                bytes = a.size.toLong(),
                bucket = bucket,
                s3Key = key,
                width = dimensiones?.first,
                height = dimensiones?.second,
            )
        }
        return porSha.values.toList()
    }

    /** Auditoría de un paquete que ni siquiera llegó a tener `package_hash` canónico. */
    private fun auditarFalloTemprano(
        raw: RawTemplatePackage,
        code: TplErrorCode,
        details: Map<String, Any?>,
        requesterId: Long?,
    ) {
        val (slug, version) = parser.identidadAproximada(raw)
        auditor.auditarRechazo(slug, version, parser.rawHash(raw), code, details, requesterId)
    }
}
