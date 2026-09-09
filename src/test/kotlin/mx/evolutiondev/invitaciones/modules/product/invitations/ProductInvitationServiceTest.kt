package mx.evolutiondev.invitaciones.modules.product.invitations

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/**
 * Reglas del alta que no se ven desde HTTP: validaciones, estado inicial de la fila, tope de
 * borradores y la red del doble clic (`memoria/handoffs/5-1b-contrato-alta.md`).
 *
 * El reloj se fija para que las pruebas de fecha no caduquen: sin el, «hoy» cambia cada dia y una
 * prueba de fecha pasada terminaria siendo una prueba que envejece.
 */
class ProductInvitationServiceTest {

    private val repositorio = FakeProductInvitationRepository()
    private val servicio = ProductInvitationService(repositorio).apply {
        reloj = Clock.fixed(Instant.parse("2026-09-09T18:00:00Z"), ZoneOffset.UTC)
    }

    private fun peticion(
        eventKind: String? = "wedding",
        eventDate: String? = "2027-04-18",
        eventTime: String? = "17:00",
        childrenAllowed: Boolean? = null,
        youngAllowed: Boolean? = null,
        hashtag: String? = null,
    ) = CrearInvitacionRequest(eventKind, eventDate, eventTime, childrenAllowed, youngAllowed, hashtag)

    @Test
    fun `la fila nace con el dueno del token y el estado que fija el contrato`() {
        val resultado = servicio.crear(42L, peticion(hashtag = "  #LinoYSello  "))

        assertTrue(resultado.creada)
        val fila = repositorio.insertadas.single()
        assertEquals(42L, fila.customerId)
        assertEquals(901L, fila.templateId, "wedding usa la fila puente 901 de V42")
        assertEquals("2027-04-18", fila.fecha)
        assertEquals("17:00", fila.hora)
        assertEquals("#LinoYSello", fila.hashtag, "el hashtag se recorta")
        assertTrue(fila.childrenAllowed)
        assertTrue(fila.youngAllowed)
        assertEquals(false, resultado.respuesta.isPaid)
        assertEquals(true, resultado.respuesta.usesTemplates2)
    }

    @Test
    fun `cada uno de los ocho tipos de evento tiene su fila puente`() {
        FakeProductInvitationRepository.PUENTES.forEach { (kind, id) ->
            val repo = FakeProductInvitationRepository()
            val uno = ProductInvitationService(repo).apply { reloj = servicio.reloj }
            uno.crear(1L, peticion(eventKind = kind))
            assertEquals(id, repo.insertadas.single().templateId, "eventKind $kind")
        }
    }

    @Test
    fun `sin fila puente el alta falla con 500 tipado y no escribe nada`() {
        val vacio = FakeProductInvitationRepository(puentes = emptyMap())
        val sinPuente = ProductInvitationService(vacio)

        val e = assertThrows<PlantillaPuenteAusenteException> { sinPuente.crear(1L, peticion()) }

        assertEquals("PRD_TEMPLATE_BRIDGE_MISSING", e.code)
        assertEquals(500, e.estado.value())
        assertTrue(vacio.insertadas.isEmpty())
    }

    @Test
    fun `los campos obligatorios que faltan dicen cual es`() {
        listOf(
            "eventKind" to peticion(eventKind = null),
            "eventDate" to peticion(eventDate = "   "),
            "eventTime" to peticion(eventTime = null),
        ).forEach { (campo, cuerpo) ->
            val e = assertThrows<CampoRequeridoException> { servicio.crear(1L, cuerpo) }
            assertEquals("PRD_FIELD_REQUIRED", e.code)
            assertEquals(campo, e.details?.get("field"))
        }
    }

    @Test
    fun `un eventKind fuera de los ocho no se acepta como texto libre`() {
        val e = assertThrows<EventKindInvalidoException> { servicio.crear(1L, peticion(eventKind = "boda")) }
        assertEquals("PRD_EVENT_KIND_INVALID", e.code)
        assertEquals(8, (e.details?.get("allowed") as List<*>).size)
    }

    @Test
    fun `una fecha que no existe en el calendario no pasa`() {
        val e = assertThrows<FechaInvalidaException> { servicio.crear(1L, peticion(eventDate = "2027-02-30")) }
        assertEquals("PRD_DATE_INVALID", e.code)
    }

    @Test
    fun `una fecha con otro formato no pasa`() {
        assertThrows<FechaInvalidaException> { servicio.crear(1L, peticion(eventDate = "18/04/2027")) }
    }

    @Test
    fun `una fecha anterior a hoy no pasa`() {
        val e = assertThrows<FechaEnElPasadoException> { servicio.crear(1L, peticion(eventDate = "2020-01-01")) }
        assertEquals("PRD_DATE_IN_PAST", e.code)
    }

    @Test
    fun `hoy mismo si pasa`() {
        assertTrue(servicio.crear(1L, peticion(eventDate = "2026-09-09")).creada)
    }

    @Test
    fun `una fecha a mas de diez anos no pasa`() {
        val e = assertThrows<FechaDemasiadoLejanaException> { servicio.crear(1L, peticion(eventDate = "2099-01-01")) }
        assertEquals("PRD_DATE_TOO_FAR", e.code)
    }

    @Test
    fun `una hora fuera de 24 horas no pasa`() {
        listOf("25:00", "17:60", "5:00", "17.00").forEach {
            assertThrows<HoraInvalidaException> { servicio.crear(1L, peticion(eventTime = it)) }
        }
    }

    @Test
    fun `un hashtag desmedido no pasa`() {
        val e = assertThrows<HashtagDemasiadoLargoException> {
            servicio.crear(1L, peticion(hashtag = "#".repeat(ProductInvitationService.MAXIMO_HASHTAG + 1)))
        }
        assertEquals("PRD_HASHTAG_TOO_LONG", e.code)
    }

    @Test
    fun `el tope de borradores es por clienta y dice cuantos lleva`() {
        repeat(ProductInvitationService.MAXIMO_BORRADORES) {
            servicio.crear(5L, peticion(eventTime = "1$it:00"))
        }

        val e = assertThrows<LimiteDeBorradoresException> { servicio.crear(5L, peticion(eventTime = "20:00")) }

        assertEquals("PRD_DRAFT_LIMIT_REACHED", e.code)
        assertEquals(409, e.estado.value())
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES, e.details?.get("limit"))
        assertEquals(ProductInvitationService.MAXIMO_BORRADORES, repositorio.insertadas.size)
    }

    /** Doble clic: mismo cuerpo, mismo dueno, dentro de la ventana → no gasta un hueco de los tres. */
    @Test
    fun `dos envios identicos seguidos devuelven la misma invitacion sin duplicarla`() {
        val primera = servicio.crear(9L, peticion())
        val segunda = servicio.crear(9L, peticion())

        assertTrue(primera.creada)
        assertFalse(segunda.creada, "el segundo envio no crea nada")
        assertEquals(primera.respuesta.invitationId, segunda.respuesta.invitationId)
        assertEquals(1, repositorio.insertadas.size)
    }

    /** Dos altas distintas del mismo dia sí son dos invitaciones: no se deduplica lo que difiere. */
    @Test
    fun `dos altas con datos distintos son dos invitaciones`() {
        servicio.crear(9L, peticion(eventTime = "17:00"))
        servicio.crear(9L, peticion(eventTime = "18:00"))

        assertEquals(2, repositorio.insertadas.size)
    }

    @Test
    fun `el doble clic de otra clienta no le devuelve la invitacion ajena`() {
        val ajena = servicio.crear(9L, peticion())
        val propia = servicio.crear(10L, peticion())

        assertTrue(propia.creada)
        assertTrue(ajena.respuesta.invitationId != propia.respuesta.invitationId)
        assertEquals(listOf(9L, 10L), repositorio.insertadas.map { it.customerId })
    }
}
