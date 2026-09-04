package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.composition.OperationError
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * Frontera de deserialización de los cuerpos pequeños (`03 §3.2`, `§3.6`, `§3.12`) y traducción de los
 * errores del reductor a `details` (`03 §3.4` punto 1).
 *
 * Los cuerpos se leen con el lector estricto de 2-0b y **no** con `@RequestBody DTO`: el
 * `ObjectMapper` con `FAIL_ON_UNKNOWN_PROPERTIES` del módulo no es `@Primary` (ADR-1R-B-06), así que
 * vincular a un DTO con el mapper del núcleo descartaría en silencio las claves de más — el ataque de
 * `03 §9.2` fila 2 y una violación de P1.
 */
class EditorRequestsTest {

    private fun json(texto: String) = Templates2Json.readTree(texto)

    @Test
    fun `choose-template acepta baseRevision opcional`() {
        val sin = EditorRequests.chooseTemplate(json("""{"templateSlug":"s","templateVersion":"1.0.0"}"""))
        assertEquals("s", sin.templateSlug)
        assertNull(sin.baseRevision)

        val con = EditorRequests.chooseTemplate(json("""{"templateSlug":"s","templateVersion":"1.0.0","baseRevision":7}"""))
        assertEquals(7L, con.baseRevision)
    }

    @Test
    fun `un invitationId colado en el cuerpo es TPL_MALFORMED_JSON, no un descarte silencioso`() {
        val e = assertThrows<Templates2Exception.MalformedJson> {
            EditorRequests.chooseTemplate(json("""{"templateSlug":"s","templateVersion":"1.0.0","invitationId":200}"""))
        }
        assertEquals(TplErrorCode.TPL_MALFORMED_JSON, e.code)
        assertTrue(e.message!!.contains("invitationId"), "el mensaje tiene que nombrar la clave sobrante")
    }

    @Test
    fun `restore exige revision y baseRevision, las dos`() {
        val r = EditorRequests.restore(json("""{"revision":37,"baseRevision":43}"""))
        assertEquals(37L, r.revision)
        assertEquals(43L, r.baseRevision)

        assertThrows<Templates2Exception.MalformedJson> { EditorRequests.restore(json("""{"revision":37}""")) }
        assertThrows<Templates2Exception.MalformedJson> { EditorRequests.restore(json("""{"baseRevision":43}""")) }
    }

    @Test
    fun `publish exige baseRevision y rechaza un decimal`() {
        assertEquals(43L, EditorRequests.publish(json("""{"baseRevision":43}""")).baseRevision)
        assertThrows<Templates2Exception.MalformedJson> { EditorRequests.publish(json("""{"baseRevision":4.3}""")) }
        assertThrows<Templates2Exception.MalformedJson> { EditorRequests.publish(json("""{}""")) }
    }

    @Test
    fun `un baseRevision que no es entero se rechaza tambien en choose-template`() {
        assertThrows<Templates2Exception.MalformedJson> {
            EditorRequests.chooseTemplate(json("""{"templateSlug":"s","templateVersion":"1.0.0","baseRevision":"3"}"""))
        }
    }

    // =============================================================================================
    // Traducción de los errores del reductor
    // =============================================================================================

    @Test
    fun `un bloque no editable conserva su codigo y lleva details source`() {
        val e = OperationRejectedException.de(
            OperationError.BlockNotEditable(BlockId("cover.date"), BlockSource.BUSINESS), 2,
        )
        assertEquals(TplErrorCode.TPL_BLOCK_NOT_EDITABLE, e.code)
        val op = (e.details["operations"] as List<*>).single() as Map<*, *>
        assertEquals(2, op["index"])
        assertEquals("TPL_BLOCK_NOT_EDITABLE", op["code"])
        assertEquals("cover.date", op["path"])
        assertEquals("business", op["source"], "details.source distingue business de fixed (decisión X-04)")
    }

    @Test
    fun `un asset que no cumple el spec lleva assetId y constraint`() {
        val e = OperationRejectedException.de(
            OperationError.AssetSpecMismatch(AssetId("as_01J8ZQ2K3M4N5P6R7S8T9V0W1X"), "maxBytes"), 0,
        )
        assertEquals(TplErrorCode.TPL_ASSET_SPEC_MISMATCH, e.code)
        val op = (e.details["operations"] as List<*>).single() as Map<*, *>
        assertEquals("maxBytes", op["constraint"])
        assertEquals("as_01J8ZQ2K3M4N5P6R7S8T9V0W1X", op["assetId"])
    }

    @Test
    fun `los errores sin codigo propio caen en TPL_OPERATION_INVALID con su literal en details`() {
        val e = OperationRejectedException.de(OperationError.GroupLimit(BlockId("g.cards"), 1, 2), 4)
        assertEquals(TplErrorCode.TPL_OPERATION_INVALID, e.code)
        val op = (e.details["operations"] as List<*>).single() as Map<*, *>
        assertEquals("TPL_GROUP_LIMIT", op["code"])
        assertEquals(1, op["min"])
        assertEquals(2, op["max"])
    }
}
