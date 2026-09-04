package mx.evolutiondev.invitaciones.modules.templates2.composition

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import mx.evolutiondev.invitaciones.modules.templates2.schema.Violation

/**
 * Utilidades comunes a las pruebas de composición, reductor y migración.
 *
 * **Criterio de igualdad**: JSON **canónico** (`01 §5.5`), no la cadena literal del fichero. Es el
 * criterio normativo del módulo: el orden de claves de un objeto no es dato (los golden se emiten con
 * `JSON.stringify(v, null, 2)`, que conserva el orden de inserción de JavaScript, mientras que Jackson
 * conserva el de construcción en Kotlin). Comparar canónicamente es **más** estricto que comparar
 * estructuras, porque también fija el formato numérico (regla 4 de `§5.5`).
 */
object GoldenComposition {

    fun canonical(node: JsonNode): String = CanonicalJson.canonical(node)

    /** `AssetIndex` leído como DATO del golden (`assets.json`, objeción O-06). */
    fun assetIndex(node: JsonNode): AssetIndex {
        val idx = LinkedHashMap<AssetId, ResolvedAsset>()
        node.fieldNames().forEach { id ->
            val a = node.get(id)
            idx[AssetId(id)] = ResolvedAsset(
                url = a.get("url").textValue(),
                width = a.get("width")?.takeIf { it.isNumber }?.intValue(),
                height = a.get("height")?.takeIf { it.isNumber }?.intValue(),
            )
        }
        return idx
    }

    fun paquete(manifest: JsonNode, theme: JsonNode, defaults: JsonNode): TemplatePackage =
        TemplatePackage(DomainJson.manifest(manifest), DomainJson.theme(theme), DomainJson.defaults(defaults))

    fun paqueteDe(dir: String, prefijo: String): TemplatePackage = paquete(
        Golden.leer(dir, "$prefijo-template.json"),
        Golden.leer(dir, "$prefijo-theme.json"),
        Golden.leer(dir, "$prefijo-defaults.json"),
    )

    private fun objeto(): ObjectNode = Templates2Json.mapper.createObjectNode()

    /**
     * `OperationError` → el mismo objeto JSON que emite `operations-reducer.ts`. Es lo que permite
     * comparar los errores campo a campo contra `reducerResult`, no solo por código.
     */
    fun encode(e: OperationError): ObjectNode {
        val o = objeto().put("code", e.wire)
        when (e) {
            is OperationError.BlockUnknown -> o.put("blockId", e.blockId.value)
            is OperationError.BlockNotEditable -> o.put("blockId", e.blockId.value).put("source", e.source.wire)
            is OperationError.BlockTypeMismatch -> o.put("blockId", e.blockId.value).put("expected", e.expected).put("got", e.got)
            is OperationError.ItemUnknown -> o.put("groupId", e.groupId.value).put("itemId", e.itemId)
            is OperationError.GroupLimit -> o.put("groupId", e.groupId.value).put("min", e.min).put("max", e.max)
            is OperationError.SectionUnknown -> o.put("sectionKey", e.sectionKey.value)
            is OperationError.SectionRequired -> o.put("sectionKey", e.sectionKey.value)
            is OperationError.VariantUnknown -> o.put("sectionKey", e.sectionKey.value).put("variant", e.variant)
            is OperationError.ThemeIdUnknown -> o.put("field", e.field).put("id", e.id)
            is OperationError.AssetNotOwned -> o.put("assetId", e.assetId.value)
            is OperationError.AssetSpecMismatch -> o.put("assetId", e.assetId.value).put("constraint", e.constraint)
            is OperationError.OperationInvalid -> o.put("op", e.op).put("detail", e.detail)
            is OperationError.TempIdDuplicate -> o.put("tempId", e.tempId)
            is OperationError.InvariantViolation -> {
                val arr = Templates2Json.mapper.createArrayNode()
                e.violations.forEach { arr.add(encode(it)) }
                o.set<ObjectNode>("violations", arr)
            }
        }
        return o
    }

    /**
     * `Violation` → `{code, path}`. **`detail` se omite a propósito**: `06 §4` fija que la comparación
     * ignora `detail` y compara `code` + `path`, y hoy los dos lados difieren en un carácter
     * (`invariants.ts` escribe `"text ≠ image"` con U+2260 y `Invariants.kt` escribe `"text != image"`).
     * Está anotado en `bitacora/2-2.md` y en `preguntas-abiertas.md`: es una divergencia real que
     * ninguna prueba de la fase detecta, porque `golden/invariants/` solo compara códigos (O-11).
     */
    fun encode(v: Violation): ObjectNode =
        objeto().put("code", v.code?.wire ?: v.schemaCode ?: "SCHEMA").put("path", v.path)

    /** Recorta `detail` del lado del golden para poder comparar con el criterio de `06 §4`. */
    fun sinDetail(node: JsonNode): JsonNode {
        if (node.isArray) {
            val arr = Templates2Json.mapper.createArrayNode()
            node.forEach { arr.add(sinDetail(it)) }
            return arr
        }
        if (!node.isObject) return node
        val o = objeto()
        node.fieldNames().forEach { k -> if (k != "detail") o.set<JsonNode>(k, sinDetail(node.get(k))) }
        return o
    }

    fun encode(r: OperationResult): ObjectNode = when (r) {
        is OperationResult.Ok -> {
            val o = objeto().put("ok", true)
            o.set<ObjectNode>("doc", DomainJson.encode(r.doc))
            if (r.idMap.isNotEmpty()) {
                val m = objeto()
                r.idMap.forEach { (k, v) -> m.put(k, v) }
                o.set<ObjectNode>("idMap", m)
            }
            o
        }
        is OperationResult.Failed -> objeto().put("ok", false).set<ObjectNode>("error", encode(r.error)) as ObjectNode
    }

    fun encode(r: BatchResult): ObjectNode = when (r) {
        is BatchResult.Ok -> {
            val o = objeto().put("ok", true)
            o.set<ObjectNode>("doc", DomainJson.encode(r.doc))
            val m = objeto()
            r.idMap.forEach { (k, v) -> m.put(k, v) }
            o.set<ObjectNode>("idMap", m)
            o
        }
        is BatchResult.Failed -> {
            val o = objeto().put("ok", false)
            o.set<ObjectNode>("error", encode(r.error))
            o.put("opIndex", r.opIndex)
        }
    }
}
