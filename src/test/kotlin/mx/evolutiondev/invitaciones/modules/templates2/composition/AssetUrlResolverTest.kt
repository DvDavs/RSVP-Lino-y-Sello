package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test

/**
 * Objeción O-06 de `bitacora/2-0a-REV.md`, cerrada aquí. La regla que produjo los `compuesto.json` de
 * la ronda 1R (`url = cdn + assetId.slice(3) + ".webp"`) es una **convención de fixture**; la de
 * producción (`02 §10.4`) deriva la URL de la columna `s3_key`. Estas pruebas fijan que
 * `AssetUrlResolver` implementa la de producción y **no** la del fixture.
 */
class AssetUrlResolverTest {

    private val ULID = "01J8AAAAAAAAAAAAAAAAAAAAAA"
    private val id = AssetId("as_$ULID")

    @Test
    fun `la URL sale de la clave S3, no del assetId`() {
        val guardado = AssetUrlResolver.StoredAsset("assets-prod", "templates2/invitation/42/abc123.webp", 1200, 800)
        val url = AssetUrlResolver.url("https://assets-prod.s3.us-east-2.amazonaws.com", guardado)
        assertEquals("https://assets-prod.s3.us-east-2.amazonaws.com/templates2/invitation/42/abc123.webp", url)
        assertFalse(
            url.endsWith("$ULID.webp"),
            "si la URL terminara en <ULID>.webp estaríamos usando la convención de fixture (O-06)",
        )
    }

    @Test
    fun `la base y la clave se unen con una sola barra`() {
        val a = AssetUrlResolver.StoredAsset("b", "k/x.webp")
        assertEquals("https://cdn.example.com/k/x.webp", AssetUrlResolver.url("https://cdn.example.com/", a))
        assertEquals(
            "https://cdn.example.com/k/x.webp",
            AssetUrlResolver.url("https://cdn.example.com", AssetUrlResolver.StoredAsset("b", "/k/x.webp")),
        )
    }

    @Test
    fun `el indice conserva las dimensiones y es apto para compose`() {
        val idx = AssetUrlResolver.index(
            "https://cdn.example.com",
            mapOf(id to AssetUrlResolver.StoredAsset("b", "templates2/template/boda/1.0.0/deadbeef.webp", 1000, 1000)),
        )
        assertEquals(1, idx.size)
        assertEquals(ResolvedAsset("https://cdn.example.com/templates2/template/boda/1.0.0/deadbeef.webp", 1000, 1000), idx[id])
    }

    /** `01 §5.5`: la URL debe ser estable; una firma temporal cambiaría el `contentHash` cada petición. */
    @Test
    fun `la URL construida no lleva parametros de firma`() {
        val url = AssetUrlResolver.url("https://cdn.example.com", AssetUrlResolver.StoredAsset("b", "k/x.webp"))
        assertFalse(url.contains("?"), "sin query string: nada de X-Amz-Signature en el hash")
    }
}
