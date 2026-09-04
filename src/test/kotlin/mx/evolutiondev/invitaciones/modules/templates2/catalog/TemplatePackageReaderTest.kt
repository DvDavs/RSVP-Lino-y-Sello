package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.io.TempDir
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * [TemplatePackageReader]: las tres formas de entregar un paquete (`01 §2.1`, `03 §3.17`) producen el
 * **mismo** `ruta → bytes`, y todo lo que no está en el árbol exacto **rechaza el registro**, sin
 * ignorar nada en silencio (P1).
 */
class TemplatePackageReaderTest {

    private val paquete = PaqueteFixture.ejemplo("boda-clasica-1.0.0")

    @Test
    fun `las partes del multipart producen el arbol de 01 2_1`() {
        val leido = TemplatePackageReader.fromParts(PaqueteFixture.partes(paquete))
        assertEquals(paquete.files.keys, leido.files.keys)
        assertEquals(
            listOf("assets/preview.webp", "assets/rsvp-bg.webp", "defaults.json", "template.json", "theme.json"),
            leido.files.keys.sorted(),
        )
        assertNull(leido.slugDeclarado, "el multipart no declara ubicación: solo la declara el árbol en disco")
    }

    @Test
    fun `una parte con la ruta relativa completa como nombre tambien vale`() {
        val partes = PaqueteFixture.partes(paquete).map { p ->
            if (p.partName == "assets") PackagePart("assets/" + p.fileName, null, p.bytes) else p
        }
        assertEquals(paquete.files.keys, TemplatePackageReader.fromParts(partes).files.keys)
    }

    @Test
    fun `un ZIP con la carpeta templates-slug-version deduce slug y version`() {
        val zip = PaqueteFixture.zip(paquete, "boda-clasica", "1.0.0")
        val leido = ByteArrayInputStream(zip).use { TemplatePackageReader.fromZip(it) }
        assertEquals(paquete.files.keys, leido.files.keys)
        assertEquals("boda-clasica", leido.slugDeclarado)
        assertEquals("1.0.0", leido.versionDeclarada)
    }

    @Test
    fun `un directorio templates-slug-version deduce slug y version`(@TempDir tmp: File) {
        val dir = PaqueteFixture.directorio(paquete, tmp, "boda-clasica", "1.0.0")
        val leido = TemplatePackageReader.fromDirectory(dir)
        assertEquals(paquete.files.keys, leido.files.keys)
        assertEquals("boda-clasica", leido.slugDeclarado)
        assertEquals("1.0.0", leido.versionDeclarada)
        assertTrue(leido.files.getValue("template.json").isNotEmpty())
    }

    @Test
    fun `un archivo fuera del arbol rechaza el registro entero y lo nombra`(@TempDir tmp: File) {
        val dir = PaqueteFixture.directorio(paquete, tmp, "boda-clasica", "1.0.0")
        File(dir, "LEEME.md").writeText("nota del autor")
        val e = assertThrows<Templates2Exception.ManifestInvalid> { TemplatePackageReader.fromDirectory(dir) }
        assertEquals("TPL_PACKAGE_UNEXPECTED_FILE", e.details["packageError"])
        assertEquals(listOf("LEEME.md"), e.details["unexpected"])
    }

    @Test
    fun `un asset con nombre fuera del patron de 01 2_1 tambien se rechaza`(@TempDir tmp: File) {
        val dir = PaqueteFixture.directorio(paquete, tmp, "boda-clasica", "1.0.0")
        File(dir, "assets/Portada Final.WEBP").writeBytes(byteArrayOf(1, 2, 3))
        val e = assertThrows<Templates2Exception.ManifestInvalid> { TemplatePackageReader.fromDirectory(dir) }
        assertEquals("TPL_PACKAGE_UNEXPECTED_FILE", e.details["packageError"])
    }

    @Test
    fun `falta uno de los tres JSON obligatorios`(@TempDir tmp: File) {
        val dir = PaqueteFixture.directorio(paquete, tmp, "boda-clasica", "1.0.0")
        File(dir, "theme.json").delete()
        val e = assertThrows<Templates2Exception.ManifestInvalid> { TemplatePackageReader.fromDirectory(dir) }
        assertEquals("TPL_PACKAGE_INCOMPLETE", e.details["packageError"])
        assertEquals(listOf("theme.json"), e.details["missing"])
    }

    @Test
    fun `una entrada de ZIP con salto de directorio se rechaza (no se escribe nada fuera)`() {
        val salida = ByteArrayOutputStream()
        ZipOutputStream(salida).use { z ->
            z.putNextEntry(ZipEntry("templates/boda-clasica/1.0.0/template.json"))
            z.write(paquete.files.getValue("template.json"))
            z.closeEntry()
            z.putNextEntry(ZipEntry("../../../etc/passwd"))
            z.write("x".toByteArray())
            z.closeEntry()
        }
        val e = assertThrows<Templates2Exception.ManifestInvalid> {
            ByteArrayInputStream(salida.toByteArray()).use { TemplatePackageReader.fromZip(it) }
        }
        assertEquals("TPL_PACKAGE_UNEXPECTED_FILE", e.details["packageError"])
    }

    @Test
    fun `un asset por encima de 15 MiB es 413 TPL_ASSET_TOO_LARGE`() {
        val partes = PaqueteFixture.partes(paquete) +
            PackagePart("assets", "enorme.webp", ByteArray(PackageLimits.MAX_ASSET_BYTES + 1))
        val e = assertThrows<AssetTooLargeException> { TemplatePackageReader.fromParts(partes) }
        assertEquals(413, e.status)
        assertEquals("assets/enorme.webp", e.details["path"])
    }

    @Test
    fun `los JSON del paquete por encima de 2 MiB son 413 TPL_BODY_TOO_LARGE`() {
        val relleno = ByteArray(PackageLimits.MAX_JSON_BYTES + 1) { '0'.code.toByte() }
        val partes = PaqueteFixture.partes(paquete) + PackagePart("migrations", "1.0.0-to-2.0.0.json", relleno)
        val e = assertThrows<PackageTooLargeException> { TemplatePackageReader.fromParts(partes) }
        assertEquals(413, e.status)
    }

    @Test
    fun `una parte con nombre desconocido no se ignora`() {
        val partes = PaqueteFixture.partes(paquete) + PackagePart("notas", "notas.txt", byteArrayOf(1))
        val e = assertThrows<Templates2Exception.ManifestInvalid> { TemplatePackageReader.fromParts(partes) }
        assertTrue((e.details["unexpected"] as List<*>).any { it.toString().contains("notas") })
    }
}
