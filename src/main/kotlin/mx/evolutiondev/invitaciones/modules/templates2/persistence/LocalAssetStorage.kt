package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.catalog.AssetStorageUnavailableException
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateAssetStorage
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Primary
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.time.Duration

/**
 * Almacén de assets **en disco local**, alternativa de DESARROLLO a S3 (`02 §10`).
 *
 * ## Por qué existe (ADR-3-0a-02)
 *
 * `S3InvitationAssetStorage` y `catalog.S3TemplateAssetStorage` escriben en un bucket real. En el
 * entorno de desarrollo de esta fase **no hay ningún bucket de pruebas utilizable** —`templates2.
 * assets.bucket` es obligatoria y sin defecto (ADR-2-ORQ-03) precisamente para que nadie caiga en el
 * de producción, y no existe otro—, así que sin esta pieza **ninguna** de las tres rutas que suben
 * bytes (`POST /master/templates2/versions`, el registro por línea de comandos y
 * `POST /editor/invitations/{id}/assets`) puede ejercitarse contra un Tomcat real. La evidencia del
 * fallo real de S3 está en `bitacora/3-0a.md`.
 *
 * ## Alcance, deliberadamente estrecho
 *
 * - Es **aditivo**: no modifica ni una línea de las implementaciones de S3, que siguen siendo el
 *   comportamiento por defecto. Se activa **sólo** con `templates2.assets.mode=local`
 *   (`@ConditionalOnProperty` sin `matchIfMissing`), y entonces gana la inyección por `@Primary`.
 *   Sin la propiedad este bean no existe y el módulo se comporta exactamente como antes.
 * - **No cambia ninguna firma pública ni el contrato de las rutas.** El `previewUrl` de `03 §3.7`
 *   sigue siendo una URL que el cliente abre con un `GET`; lo único que cambia es quién la sirve.
 *   No se firma —no hay nada que firmar en disco—, así que **no caduca**: es una diferencia de
 *   desarrollo aceptada y anotada en `preguntas-abiertas.md`.
 * - **Prohibido en producción**: si el perfil activo es de producción, el bean **falla al construirse**
 *   y la aplicación no arranca. Es ruidoso a propósito (P1): un `.env` con `mode=local` copiado a
 *   producción serviría assets desde el disco de un contenedor efímero y los perdería en el
 *   siguiente despliegue, sin que nadie se enterara hasta ver imágenes rotas en invitaciones
 *   publicadas.
 *
 * El árbol en disco reproduce la clave de S3 tal cual (`templates2/template/<slug>/<version>/<sha>.<ext>`
 * y `templates2/invitation/<id>/<sha>.<ext>`, `02 §10.1`), así que migrar de local a S3 es copiar el
 * directorio al bucket: las filas de `tpl_asset` no cambian.
 */
@Component
@Primary
@ConditionalOnProperty(name = [LocalAssetStorage.MODE], havingValue = LocalAssetStorage.LOCAL)
class LocalAssetStorage(
    @Value("\${templates2.assets.local.dir:build/templates2-assets}") directorio: String,
    @Value("\${templates2.assets.local.base-url:http://localhost:6003/public/templates2-assets}")
    private val baseUrl: String,
    environment: Environment,
) : InvitationAssetStorage, TemplateAssetStorage {

    private val log = LoggerFactory.getLogger(LocalAssetStorage::class.java)

    /** Raíz absoluta y normalizada; todo lo demás se comprueba contra ella. */
    val raiz: Path = Paths.get(directorio).toAbsolutePath().normalize()

    init {
        val produccion = environment.activeProfiles.filter { it.lowercase() in PERFILES_DE_PRODUCCION }
        if (produccion.isNotEmpty()) {
            throw ModoLocalEnProduccion(
                "'$MODE=$LOCAL' está PROHIBIDO con el perfil ${produccion.joinToString()} activo: los " +
                    "assets se guardarían en el disco de la instancia y se perderían en el siguiente " +
                    "despliegue, dejando imágenes rotas en invitaciones ya publicadas. Quita la " +
                    "propiedad (el valor por defecto es '$S3') o cambia de perfil.",
            )
        }
        Files.createDirectories(raiz)
        log.warn(
            "templates2: MODO DE ASSETS **LOCAL** ({}={}). Los objetos NO van a S3: se escriben en {} " +
                "y se sirven sin firmar desde {}. Es una configuración de DESARROLLO (ADR-3-0a-02).",
            MODE, LOCAL, raiz, baseUrl,
        )
    }

    // ------------------------------------------------------------------ InvitationAssetStorage

    override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) {
        val destino = resolver(key)
        try {
            Files.createDirectories(destino.parent)
            // Escritura atómica: primero un temporal en el mismo directorio, después `move`. Sin esto,
            // un fallo a mitad dejaría un archivo truncado con la clave definitiva — y la clave es
            // determinista por `sha256`, así que nadie lo volvería a escribir (`02 §10.1` paso 7).
            val tmp = Files.createTempFile(destino.parent, ".tpl-", ".part")
            Files.write(tmp, bytes)
            Files.move(tmp, destino, StandardCopyOption.REPLACE_EXISTING)
        } catch (e: IOException) {
            throw AssetStorageUnavailableException(
                "el almacén local no aceptó \"$key\" (bucket declarado \"$bucket\"): ${e.message}", e,
            )
        }
    }

    /**
     * URL de lectura. No es firmada ni caduca —en disco no hay nada que firmar—, así que [duracion]
     * se ignora; se registra en el log para que la diferencia con `03 §3.7` no pase inadvertida.
     */
    override fun previewUrl(bucket: String, key: String, duracion: Duration): String {
        log.debug("templates2: previewUrl local para \"{}\" (la duración {} no aplica en disco)", key, duracion)
        return baseUrl.trimEnd('/') + "/" + key.trimStart('/')
    }

    override fun delete(bucket: String, key: String) {
        try {
            Files.deleteIfExists(resolver(key))
        } catch (e: IOException) {
            throw AssetStorageUnavailableException("el almacén local no pudo borrar \"$key\": ${e.message}", e)
        }
    }

    // -------------------------------------------------------------------- TemplateAssetStorage
    // La firma es la misma que la de `InvitationAssetStorage.upload`, así que `override` de arriba
    // satisface las dos interfaces: un solo almacén para assets de plantilla y de invitación,
    // exactamente como en S3 (mismo bucket, prefijos distintos).

    /** Ruta en disco de una clave, comprobando que no se escapa de [raiz]. */
    fun resolver(key: String): Path {
        val limpia = key.trimStart('/')
        if (limpia.isEmpty() || limpia.split('/').any { it == ".." || it == "." || it.isEmpty() }) {
            throw AssetStorageUnavailableException("clave de asset no admisible: \"$key\"")
        }
        val destino = raiz.resolve(limpia).normalize()
        if (!destino.startsWith(raiz)) {
            throw AssetStorageUnavailableException("clave de asset fuera de la raíz local: \"$key\"")
        }
        return destino
    }

    companion object {
        const val MODE = "templates2.assets.mode"
        const val LOCAL = "local"
        const val S3 = "s3"

        /** Perfiles de Spring en los que el modo local está prohibido. */
        val PERFILES_DE_PRODUCCION = setOf("prod", "production", "prd", "produccion", "producción")
    }
}

/**
 * Se lanza al construir el contexto, igual que [Templates2AssetBucketNoConfigurado]: es un error de
 * configuración y el sitio donde hay que descubrirlo es el arranque, no la primera subida.
 */
class ModoLocalEnProduccion(mensaje: String) : IllegalStateException(mensaje)
