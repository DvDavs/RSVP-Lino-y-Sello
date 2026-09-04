package mx.evolutiondev.invitaciones.modules.templates2.composition

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json

/**
 * `contentHash = "sha256:" + hex(SHA-256(utf8(canonicalJson({composed, report}))))` — `01 §5.5`,
 * ADR-1R-D-02, dirimida en X-02.
 *
 * Tres cosas que **no** son negociables y que este objeto encapsula para que nadie las repita mal:
 *
 * 1. Se hashea la **salida de `compose`**, no el documento de entrada: dos documentos distintos que
 *    rinden idéntico (p. ej. uno con una clave huérfana que R1 descarta) deben dar el mismo `ETag`.
 * 2. El **`report` entra en el hash**. Sin él, un cambio en `stillDefault` —que es lo que el editor
 *    muestra y lo que `preflight` bloquea— no invalidaría la caché del render público.
 * 3. Se almacena y se sirve **con prefijo de algoritmo** (`tpl_release.content_hash` es
 *    `VARCHAR(71)` con `CHECK ~ '^sha256:[0-9a-f]{64}$'`): recortarlo en la base y reponerlo en la
 *    capa HTTP daría dos representaciones del mismo hash, que es la enfermedad que P1 ataca.
 *
 * El hash se calcula siempre sobre el JSON **canónico de la aplicación**, nunca sobre los bytes de
 * `jsonb` (ADR-1R-B-07): Postgres reordena las claves de un `jsonb`.
 */
object ContentHasher {

    /** El nodo `{composed, report}` exacto sobre el que se calcula el hash. */
    fun nodo(resultado: CompositionResult): ObjectNode {
        val o = Templates2Json.mapper.createObjectNode()
        o.set<ObjectNode>("composed", DomainJson.encode(resultado.composed))
        o.set<ObjectNode>("report", DomainJson.encode(resultado.report))
        return o
    }

    /** JSON canónico de `{composed, report}` (`01 §5.5`, las cinco reglas). */
    fun canonicalJson(resultado: CompositionResult): String = Templates2Json.canonical(nodo(resultado))

    /** `"sha256:" + 64 hex`. Es el `ETag` del render público y la clave de deduplicación de `tpl_release`. */
    fun contentHash(resultado: CompositionResult): String = Templates2Json.sha256Canonical(nodo(resultado))
}
