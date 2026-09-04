package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * Objeción O-06 de `bitacora/2-0a-REV.md`, cerrada aquí. La regla que produjo los `compuesto.json` de
 * la ronda 1R (`url = cdn + assetId.slice(3) + ".webp"`) es una **convención de fixture**; la de
 * producción (`02 §10.4`) deriva la URL de la columna `s3_key`. Estas pruebas fijan que
 * `AssetUrlResolver` implementa la de producción y **no** la del fixture.
 *
 * Objeción **ADV-10** (revisión adversarial global), cerrada en el bloque 2-6: `StoredAsset` ya no
 * transporta `bucket`, y la única puerta desde una fila de `tpl_asset` —[AssetUrlResolver.almacenado]—
 * **falla en voz alta** si la fila vive en otro bucket, en vez de construir una URL que no resuelve.
 */
class AssetUrlResolverTest {

    private val ULID = "01J8AAAAAAAAAAAAAAAAAAAAAA"
    private val id = AssetId("as_$ULID")

    @Test
    fun `la URL sale de la clave S3, no del assetId`() {
        val guardado = AssetUrlResolver.StoredAsset("templates2/invitation/42/abc123.webp", 1200, 800)
        val url = AssetUrlResolver.url("https://assets-prod.s3.us-east-2.amazonaws.com", guardado)
        assertEquals("https://assets-prod.s3.us-east-2.amazonaws.com/templates2/invitation/42/abc123.webp", url)
        assertFalse(
            url.endsWith("$ULID.webp"),
            "si la URL terminara en <ULID>.webp estaríamos usando la convención de fixture (O-06)",
        )
    }

    @Test
    fun `la base y la clave se unen con una sola barra`() {
        val a = AssetUrlResolver.StoredAsset("k/x.webp")
        assertEquals("https://cdn.example.com/k/x.webp", AssetUrlResolver.url("https://cdn.example.com/", a))
        assertEquals(
            "https://cdn.example.com/k/x.webp",
            AssetUrlResolver.url("https://cdn.example.com", AssetUrlResolver.StoredAsset("/k/x.webp")),
        )
    }

    @Test
    fun `el indice conserva las dimensiones y es apto para compose`() {
        val idx = AssetUrlResolver.index(
            "https://cdn.example.com",
            mapOf(id to AssetUrlResolver.StoredAsset("templates2/template/boda/1.0.0/deadbeef.webp", 1000, 1000)),
        )
        assertEquals(1, idx.size)
        assertEquals(ResolvedAsset("https://cdn.example.com/templates2/template/boda/1.0.0/deadbeef.webp", 1000, 1000), idx[id])
    }

    /** `01 §5.5`: la URL debe ser estable; una firma temporal cambiaría el `contentHash` cada petición. */
    @Test
    fun `la URL construida no lleva parametros de firma`() {
        val url = AssetUrlResolver.url("https://cdn.example.com", AssetUrlResolver.StoredAsset("k/x.webp"))
        assertFalse(url.contains("?"), "sin query string: nada de X-Amz-Signature en el hash")
    }

    // =============================================================================================
    // ADV-10 — el bucket de la fila deja de ser un dato que se transporta y no se lee
    // =============================================================================================

    @Test
    fun `una fila del bucket configurado se acepta y conserva clave y dimensiones`() {
        val a = AssetUrlResolver.almacenado(
            bucketEsperado = "assets-prod",
            assetId = "as_$ULID",
            bucketDeLaFila = "assets-prod",
            s3Key = "templates2/invitation/42/abc123.webp",
            width = 1200,
            height = 800,
        )
        assertEquals(AssetUrlResolver.StoredAsset("templates2/invitation/42/abc123.webp", 1200, 800), a)
    }

    @Test
    fun `una fila de otro bucket falla en voz alta en vez de dar una URL rota`() {
        val e = assertThrows<Templates2Exception.Internal> {
            AssetUrlResolver.almacenado(
                bucketEsperado = "assets-prod",
                assetId = "as_$ULID",
                bucketDeLaFila = "otro-bucket",
                s3Key = "templates2/invitation/42/abc123.webp",
            )
        }
        assertEquals(TplErrorCode.TPL_INTERNAL, e.code)
        assertTrue(e.message!!.contains("as_$ULID"), "el mensaje debe señalar la fila: ${e.message}")
        assertTrue(e.message!!.contains("otro-bucket"), "y el bucket que la fila declara: ${e.message}")
        assertTrue(e.message!!.contains("assets-prod"), "y el que el módulo direcciona: ${e.message}")
    }

    /**
     * La comprobación es **exacta**, sin normalizar: dos nombres que difieren solo en mayúsculas son
     * dos buckets distintos para S3, y adivinar cuál quería el operador sería inventar.
     */
    @Test
    fun `la comparacion de buckets no normaliza`() {
        assertThrows<Templates2Exception.Internal> {
            AssetUrlResolver.almacenado("assets-prod", "as_$ULID", "Assets-Prod", "k/x.webp")
        }
        assertThrows<Templates2Exception.Internal> {
            AssetUrlResolver.almacenado("assets-prod", "as_$ULID", " assets-prod", "k/x.webp")
        }
    }

    /**
     * Compuerta mecánica de la propia objeción: si alguien vuelve a añadir un `bucket` a
     * [AssetUrlResolver.StoredAsset], esta prueba falla. El defecto de ADV-10 no era el valor del
     * campo, era **tener un campo que se transporta y nadie lee**.
     */
    @Test
    fun `StoredAsset no vuelve a llevar el bucket`() {
        val propiedades = AssetUrlResolver.StoredAsset::class.java.declaredFields.map { it.name }.toSet()
        assertFalse("bucket" in propiedades, "StoredAsset volvió a transportar el bucket: $propiedades")
        assertEquals(setOf("s3Key", "width", "height"), propiedades)
    }
}
