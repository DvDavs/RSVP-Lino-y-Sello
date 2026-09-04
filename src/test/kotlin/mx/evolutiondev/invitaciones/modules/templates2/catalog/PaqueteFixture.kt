package mx.evolutiondev.invitaciones.modules.templates2.catalog

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Construye paquetes de plantilla **reales** (con bytes de asset de verdad) a partir de los dos
 * ejemplos completos de la fase 1, `diseno/ejemplos/{boda-clasica-1.0.0,xv-jardin-1.0.0}`.
 *
 * **Por qué hay que fabricar los assets.** Los manifiestos de los ejemplos declaran digestos de
 * relleno (`aa00…01`, `bb00…01`) que ningún archivo puede tener: son ejemplos de *forma*, no paquetes
 * registrables. Como `02 §4` paso 2 exige que `sha256`/`bytes`/`contentType` de cada `AssetEntry`
 * coincidan con el archivo subido (o `422 TPL_PACKAGE_ASSET_MISMATCH`), aquí se generan archivos
 * deterministas **del tamaño y tipo declarados** y se sustituye únicamente el `sha256` del manifiesto.
 * Todo lo demás del ejemplo se registra tal cual. Está anotado en `bitacora/2-3.md` y en
 * `preguntas-abiertas.md`.
 */
object PaqueteFixture {

    /** Paquete registrable a partir de un ejemplo de `diseno/ejemplos/`. */
    fun ejemplo(plantilla: String): RawTemplatePackage {
        val manifest = Golden.Ejemplos.leer(plantilla, "template").deepCopy<ObjectNode>()
        val theme = Golden.Ejemplos.leer(plantilla, "theme")
        val defaults = Golden.Ejemplos.leer(plantilla, "defaults")
        return conAssetsReales(manifest, theme, defaults, emptyMap())
    }

    /**
     * Genera los bytes de cada asset declarado, corrige su `sha256` en el manifiesto y devuelve el
     * paquete completo con la disposición de `01 §2.1`.
     */
    fun conAssetsReales(
        manifest: ObjectNode,
        theme: JsonNode,
        defaults: JsonNode,
        migraciones: Map<String, JsonNode>,
    ): RawTemplatePackage {
        val files = LinkedHashMap<String, ByteArray>()
        val assets = manifest.get("assets") as? ArrayNode
        assets?.forEach { entrada ->
            val obj = entrada as ObjectNode
            val path = obj.get("path").asText()
            val bytes = obj.get("bytes").asInt()
            val contentType = obj.get("contentType").asText()
            val datos = archivo(path, bytes, contentType)
            obj.put("sha256", hex(sha256(datos)))
            files[path] = datos
        }
        files[RawTemplatePackage.MANIFEST] = texto(manifest)
        files[RawTemplatePackage.THEME] = texto(theme)
        files[RawTemplatePackage.DEFAULTS] = texto(defaults)
        migraciones.forEach { (nombre, node) -> files[RawTemplatePackage.MIGRATIONS_DIR + nombre] = texto(node) }
        return RawTemplatePackage(files.toSortedMap())
    }

    /**
     * Variante de un paquete: cambia la versión, opcionalmente **retira un bloque** (lo que produce un
     * diff estructural de ADR-028) y opcionalmente añade un plan de migración.
     */
    fun variante(
        plantilla: String,
        nuevaVersion: String,
        quitarBloque: String? = null,
        migrationsFrom: List<String> = emptyList(),
        planes: Map<String, JsonNode> = emptyMap(),
    ): RawTemplatePackage {
        val manifest = Golden.Ejemplos.leer(plantilla, "template").deepCopy<ObjectNode>()
        val defaults = Golden.Ejemplos.leer(plantilla, "defaults").deepCopy<ObjectNode>()
        val theme = Golden.Ejemplos.leer(plantilla, "theme")

        manifest.put("version", nuevaVersion)
        defaults.put("templateVersion", nuevaVersion)
        val desde = manifest.putArray("migrationsFrom")
        migrationsFrom.forEach { desde.add(it) }

        if (quitarBloque != null) {
            for (seccion in manifest.get("sections") as ArrayNode) {
                val bloques = (seccion as ObjectNode).get("blocks") as ArrayNode
                val restantes = bloques.filter { it.get("id").asText() != quitarBloque }
                if (restantes.size != bloques.size()) {
                    val nuevo = seccion.putArray("blocks")
                    restantes.forEach { nuevo.add(it) }
                }
            }
            (defaults.get("content") as ObjectNode).remove(quitarBloque)
        }
        return conAssetsReales(manifest, theme, defaults, planes)
    }

    /** Plan de migración mínimo con una sola operación `removeBlock` (`01 §6.2`). */
    fun planRemoveBlock(slug: String, from: String, to: String, blockId: String): JsonNode {
        val plan = Templates2Json.mapper.createObjectNode()
        plan.put("templateSlug", slug)
        plan.put("from", from)
        plan.put("to", to)
        val ops = plan.putArray("ops")
        val op = ops.addObject()
        op.put("op", "removeBlock")
        op.put("id", blockId)
        return plan
    }

    /** Partes de multipart equivalentes al paquete (`03 §3.17`). */
    fun partes(raw: RawTemplatePackage): List<PackagePart> = raw.files.map { (ruta, bytes) ->
        when {
            ruta == RawTemplatePackage.MANIFEST -> PackagePart("template", "template.json", bytes)
            ruta == RawTemplatePackage.THEME -> PackagePart("theme", "theme.json", bytes)
            ruta == RawTemplatePackage.DEFAULTS -> PackagePart("defaults", "defaults.json", bytes)
            ruta.startsWith(RawTemplatePackage.MIGRATIONS_DIR) ->
                PackagePart("migrations", ruta.removePrefix(RawTemplatePackage.MIGRATIONS_DIR), bytes)
            else -> PackagePart("assets", ruta.removePrefix(RawTemplatePackage.ASSETS_DIR), bytes)
        }
    }

    /** El paquete como ZIP, con la carpeta `templates/<slug>/<version>/` envolviéndolo. */
    fun zip(raw: RawTemplatePackage, slug: String, version: String): ByteArray {
        val salida = ByteArrayOutputStream()
        ZipOutputStream(salida).use { z ->
            raw.files.forEach { (ruta, bytes) ->
                z.putNextEntry(ZipEntry("templates/$slug/$version/$ruta"))
                z.write(bytes)
                z.closeEntry()
            }
        }
        return salida.toByteArray()
    }

    /** El paquete en disco, en `<raiz>/templates/<slug>/<version>/`; devuelve ese directorio. */
    fun directorio(raw: RawTemplatePackage, raiz: File, slug: String, version: String): File {
        val destino = File(raiz, "templates/$slug/$version")
        destino.mkdirs()
        raw.files.forEach { (ruta, bytes) ->
            val f = File(destino, ruta)
            f.parentFile.mkdirs()
            f.writeBytes(bytes)
        }
        return destino
    }

    fun texto(node: JsonNode): ByteArray = Templates2Json.mapper.writeValueAsBytes(node)

    /** Bytes deterministas del tamaño exacto declarado, con el número mágico del tipo (`02 §10.1`). */
    fun archivo(path: String, bytes: Int, contentType: String): ByteArray {
        val datos = ByteArray(bytes)
        val semilla = path.hashCode()
        for (i in datos.indices) datos[i] = ((i * 31 + semilla) and 0x7F).toByte()
        val magico: ByteArray = when (contentType) {
            "image/webp" -> "RIFF".toByteArray() + byteArrayOf(0, 0, 0, 0) + "WEBP".toByteArray()
            "image/png" -> byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
            "image/jpeg" -> byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
            "image/svg+xml" -> "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>".toByteArray()
            "audio/mpeg" -> "ID3".toByteArray()
            "font/woff2" -> "wOF2".toByteArray()
            else -> ByteArray(0)
        }
        magico.copyInto(datos, 0, 0, minOf(magico.size, datos.size))
        return datos
    }

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }
}
