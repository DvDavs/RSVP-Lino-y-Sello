package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired

/**
 * `03 §3.20` — `PUT /editor/invitations/{invitationId}/event`, contra PostgreSQL real.
 *
 * **La issue que cierra (I-06 / U-3):** hasta este bloque, *ninguna* ruta de cliente escribía
 * `invitation.date`; sólo `PUT /admin/invitations/{id}` con rol ADMIN
 * (`InvitationAdminService.kt:414`). La clienta no podía cambiar la fecha de su boda por ninguna vía
 * y el editor la enseñaba con candado. Ese era el TERCER verbo del criterio de terminado.
 *
 * Las tres pruebas de contrato que exige el encargo son, por este orden: **positivo** (la fecha
 * cambia de verdad y se ve en el `composed`), **otro dueño** (`403` y ni un byte escrito) y
 * **formato inválido** (rechazo tipado y ni un byte escrito). Se añaden las dos comprobaciones que
 * el encargo pide *describir*: que sólo cambian esas dos columnas y que el release activo **no** se
 * invalida solo.
 */
class EventoIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var evento: EditorEventService
    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var releaseRepo: TplReleaseRepository
    @Autowired private lateinit var hierarchy: HierarchyValidationService

    private val slug = "prueba-evento"
    private var customerId = 0L
    private var invitationId = 0L

    /** El formato REAL que el clúster sembrado almacena hoy: `id=3 date=2027-04-18 time=17:00`. */
    private val fechaInicial = "2027-04-18"
    private val horaInicial = "17:00"

    @BeforeEach
    fun preparar() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        actualizar("UPDATE invitation SET date = ?, time = ? WHERE id = ?", fechaInicial, horaInicial, invitationId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
    }

    @AfterEach
    fun limpiar() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    // =============================================================================================
    // 1. POSITIVO
    // =============================================================================================

    @Test
    fun `positivo - la duena cambia la fecha de su evento y la ve en la invitacion`() {
        assertEquals(fechaInicial, fechaEnBd(), "antes")
        val revisionAntes = revisionDe(invitationId)

        val respuesta = evento.setEvent(
            customerId, invitationId, json("""{"date":"2028-05-20","time":"18:30"}"""),
        )

        // Lo que responde la ruta sale de releer Postgres, no de repetir el cuerpo.
        assertEquals(invitationId, respuesta.invitationId)
        assertEquals("2028-05-20", respuesta.date)
        assertEquals("18:30", respuesta.time)

        // Lo que quedó guardado.
        assertEquals("2028-05-20", fechaEnBd(), "después")
        assertEquals("18:30", horaEnBd())

        // Y lo que la clienta VE: el bloque `business` del `composed`, ya formateado en es-MX.
        val doc = editor.getDocument(customerId, invitationId)
        val bloque = bloqueDeFecha(doc)
        assertEquals("2028-05-20", bloque["value"]["value"].asText())
        assertEquals("20 de mayo de 2028", bloque["value"]["formatted"].asText())
        assertEquals("business", bloque["provenance"].asText())

        // El documento de trabajo NO se toca: la fecha vive en `invitation`, no en `doc.content`.
        assertEquals(revisionAntes, revisionDe(invitationId), "la ruta no escribe en tpl_document")
    }

    @Test
    fun `positivo - sin 'time' la hora se queda como estaba (ausente no es borrar)`() {
        evento.setEvent(customerId, invitationId, json("""{"date":"2029-01-02"}"""))

        assertEquals("2029-01-02", fechaEnBd())
        assertEquals(horaInicial, horaEnBd(), "un PUT que no nombra la hora no la vacía")
    }

    @Test
    fun `positivo - es idempotente y no toca ninguna otra columna de invitation`() {
        val antes = filaDeInvitacionSinFechaNiHora()

        evento.setEvent(customerId, invitationId, json("""{"date":"2028-05-20","time":"18:30"}"""))
        val primera = fechaEnBd() to horaEnBd()
        evento.setEvent(customerId, invitationId, json("""{"date":"2028-05-20","time":"18:30"}"""))

        assertEquals(primera, fechaEnBd() to horaEnBd(), "repetir la misma llamada deja el mismo estado")
        assertEquals(antes, filaDeInvitacionSinFechaNiHora(), "sólo cambian date y time")
    }

    // =============================================================================================
    // 2. OTRO DUEÑO — 403 y sin efectos secundarios
    // =============================================================================================

    @Test
    fun `otro dueno - responde 403 TPL_FORBIDDEN y no escribe nada`() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)

        val e = assertThrows<ForbiddenException> {
            evento.setEvent(777L, invitationId, json("""{"date":"2028-05-20","time":"18:30"}"""))
        }

        assertEquals(TplErrorCode.TPL_FORBIDDEN, e.code)
        assertEquals(403, e.status)
        assertEquals(invitationId, e.details["invitationId"])
        assertEquals(fechaInicial, fechaEnBd(), "el 403 no puede haber escrito la fecha")
        assertEquals(horaInicial, horaEnBd(), "el 403 no puede haber escrito la hora")
    }

    @Test
    fun `otro dueno - la autorizacion se comprueba ANTES de mirar el cuerpo`() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)

        // Cuerpo basura: si el orden fuera el contrario, esto saldría como 400/422 y filtraría que
        // la invitación existe. Tiene que salir 403.
        val e = assertThrows<ForbiddenException> {
            evento.setEvent(777L, invitationId, json("""{"date":"no-es-una-fecha","sobra":1}"""))
        }
        assertEquals(TplErrorCode.TPL_FORBIDDEN, e.code)
    }

    // =============================================================================================
    // 3. FORMATO INVÁLIDO — rechazo tipado
    // =============================================================================================

    /**
     * El patrón lo impone el consumidor, no el gusto: `DateFormatting` parte `date` por `-`
     * esperando tres segmentos numéricos y `time` por `:` esperando dos, y **devuelve el valor
     * crudo** si no encajan — es decir, un formato inválido no revienta: se imprimiría tal cual en
     * la invitación publicada. `2027-02-31` pasa el patrón pero no existe, y saldría como «31 de
     * febrero de 2027»: por eso además se comprueba el calendario.
     */
    @TestFactory
    fun `formato invalido - se rechaza con 422 TPL_EVENT_DATE_INVALID y no escribe nada`(): List<DynamicTest> {
        val casos = listOf(
            "date" to """{"date":"18/04/2027"}""",
            "date" to """{"date":"2027-4-18"}""",
            "date" to """{"date":"2027-04-18T17:00"}""",
            "date" to """{"date":""}""",
            "date" to """{"date":"2027-02-31"}""",
            "date" to """{"date":"2027-13-01"}""",
            "time" to """{"date":"2028-05-20","time":"5:00 pm"}""",
            "time" to """{"date":"2028-05-20","time":"18:30:00"}""",
            "time" to """{"date":"2028-05-20","time":"25:00"}""",
        )
        return casos.map { (campo, cuerpo) ->
            DynamicTest.dynamicTest("$cuerpo → TPL_EVENT_DATE_INVALID($campo)") {
                whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
                val e = assertThrows<EventDateInvalidException> {
                    evento.setEvent(customerId, invitationId, json(cuerpo))
                }
                assertEquals(TplErrorCode.TPL_EVENT_DATE_INVALID, e.code)
                assertEquals(422, e.status)
                assertEquals(campo, e.details["field"])
                assertNotNull(e.details["expected"])
                assertEquals(fechaInicial, fechaEnBd(), "$cuerpo escribió la fecha pese al rechazo")
                assertEquals(horaInicial, horaEnBd(), "$cuerpo escribió la hora pese al rechazo")
            }
        }
    }

    @Test
    fun `una clave desconocida sigue siendo 400 TPL_MALFORMED_JSON, no un rechazo de fecha`() {
        val e = assertThrows<mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception.MalformedJson> {
            evento.setEvent(customerId, invitationId, json("""{"date":"2028-05-20","invitationId":200}"""))
        }
        assertEquals(TplErrorCode.TPL_MALFORMED_JSON, e.code)
        assertEquals(fechaInicial, fechaEnBd())
    }

    // =============================================================================================
    // 4. El release activo NO se invalida solo (el encargo pide comprobarlo y describirlo)
    // =============================================================================================

    @Test
    fun `cambiar la fecha deja el release publicado DESACTUALIZADO, no lo invalida`() {
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":0,"clientBatchId":"b_evt_01","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Ana y Luis"}}]}""",
            ),
        )
        val publicado = releases.publish(
            customerId, invitationId, json("""{"baseRevision":${revisionDe(invitationId)}}"""),
        )
        assertFalse(editor.getDocument(customerId, invitationId).activeRelease!!.stale, "recién publicado")

        val respuesta = evento.setEvent(customerId, invitationId, json("""{"date":"2028-05-20"}"""))

        // 1. La propia respuesta ya lo dice, sin una llamada más.
        assertTrue(respuesta.releaseStale)
        assertEquals(listOf("business.date"), respuesta.staleReason)

        // 2. Y el `GET …/document` lo dice igual, por el mecanismo que ya existía (03 §3.3).
        val activo = editor.getDocument(customerId, invitationId).activeRelease!!
        assertTrue(activo.stale)
        assertEquals(listOf("business.date"), activo.staleReason)

        // 3. El release SIGUE activo y con el mismo contenido congelado: nadie lo despublicó ni lo
        //    recompuso. El invitado sigue viendo la fecha vieja hasta que la clienta republique.
        val fila = releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId)!!
        assertEquals(publicado.releaseId, fila.id)
        assertEquals(publicado.contentHash, fila.contentHash)
        assertEquals(
            fechaInicial,
            fila.businessSnapshot.get("date").asText(),
            "el business_snapshot congelado conserva la fecha ANTERIOR (ADR-007)",
        )
    }

    // =============================================================================================
    // Utilidades
    // =============================================================================================

    private fun fechaEnBd(): String? =
        consultar("SELECT date FROM invitation WHERE id = ?", invitationId) as String?

    private fun horaEnBd(): String? =
        consultar("SELECT time FROM invitation WHERE id = ?", invitationId) as String?

    /** Todo lo demás de la fila, para poder afirmar que **sólo** cambian esas dos columnas. */
    private fun filaDeInvitacionSinFechaNiHora(): String? = consultar(
        "SELECT to_jsonb(i) - 'date' - 'time' FROM invitation i WHERE i.id = ?", invitationId,
    )?.toString()

    private fun bloqueDeFecha(doc: DocumentResponse) = doc.composed
        .get("sections").first { it.get("key").asText() == "cover" }
        .get("blocks").first { it.get("id").asText() == "cover.date" }
}
