package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.persistence.AssetGcJob
import mx.evolutiondev.invitaciones.modules.templates2.persistence.AssetGcQueue
import mx.evolutiondev.invitaciones.modules.templates2.persistence.AssetStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAssetStorage
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAvailabilityReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.ReleaseStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetGcRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplAssetStoreRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2FlagRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import mx.evolutiondev.invitaciones.modules.templates2.persistence.UlidGenerator
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import jakarta.persistence.EntityManager
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

/**
 * S3 falso, con memoria y con interruptor de avería.
 *
 * Existe porque `02 §10.5` exige probar el **fallo parcial** en las dos direcciones —S3 escribe y la
 * base falla, y S3 falla y la base no escribe— y porque estas pruebas corren contra PostgreSQL real
 * pero **sin** credenciales de AWS. Registra lo subido y lo borrado para poder afirmar "no se llamó a
 * S3", que en varios casos es la aserción importante.
 */
class S3Falso : InvitationAssetStorage {

    val objetos = ConcurrentHashMap<String, ByteArray>()
    val borrados = mutableListOf<String>()

    @Volatile var fallaSubida: Boolean = false
    @Volatile var fallaBorrado: Boolean = false
    @Volatile var subidas: Int = 0

    override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) {
        subidas++
        if (fallaSubida) throw IllegalStateException("S3 caído (simulado)")
        objetos["$bucket/$key"] = bytes
    }

    override fun previewUrl(bucket: String, key: String, duracion: Duration): String {
        // La duración forma parte del contrato de `03 §3.7`; la prueba la comprueba en la URL.
        return "https://s3.pruebas.local/$bucket/$key?X-Amz-Expires=${duracion.seconds}"
    }

    override fun delete(bucket: String, key: String) {
        if (fallaBorrado) throw IllegalStateException("S3 caído (simulado)")
        borrados.add("$bucket/$key")
        objetos.remove("$bucket/$key")
    }

    fun limpiar() {
        objetos.clear()
        borrados.clear()
        fallaSubida = false
        fallaBorrado = false
        subidas = 0
    }
}

/**
 * Beans de este bloque para el *slice* `@DataJpaTest`, construidos a mano igual que `EditorTestConfig`
 * (2-4) y `RegistroTestSupport` (2-3), para no depender de la resolución de `@Value` dentro del slice.
 */
@TestConfiguration
class Templates2ApiTestConfig {

    /**
     * **Un solo bean para las dos vistas**, igual que la sonda de `EditorTestConfig`: la prueba lo
     * inyecta como [S3Falso] para manipularlo y los servicios como [InvitationAssetStorage]. Dos beans
     * distintos hacen ambigua la inyección por tipo y el contexto no arranca.
     */
    @Bean
    fun s3Falso(): S3Falso = S3Falso()

    @Bean
    fun templates2S3KeyService() = Templates2S3KeyService()

    @Bean
    fun assetStore(
        assets: TplAssetRepository,
        consultas: TplAssetStoreRepository,
        entityManager: EntityManager,
    ) = AssetStore(assets, consultas, entityManager)

    @Bean
    fun editorAssetService(
        editor: EditorDocumentService,
        store: AssetStore,
        almacen: S3Falso,
        claves: Templates2S3KeyService,
        ulids: UlidGenerator,
    ) = EditorAssetService(editor, store, almacen, claves, ulids, BUCKET)

    @Bean
    fun publicRenderService(
        documentos: TplDocumentRepository,
        releases: ReleaseStore,
        disponibilidad: InvitationAvailabilityReader,
        flags: Templates2FlagRepository,
    ) = PublicRenderService(documentos, releases, disponibilidad, flags)

    @Bean
    fun assetGcQueue(cola: TplAssetGcRepository) = AssetGcQueue(cola)

    @Bean
    fun assetGcJob(cola: AssetGcQueue, almacen: S3Falso) = AssetGcJob(cola, almacen)

    companion object {
        const val BUCKET = "bucket-de-pruebas"
    }
}
