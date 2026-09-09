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

    // ------------------------------------------------------------------------------------------
    // R1-11 · la ventana de 60 s ya no responde datos que no se guardaron
    // ------------------------------------------------------------------------------------------

    /**
     * El hallazgo, tal cual: dos altas legitimas del mismo evento con hashtag distinto colapsaban en
     * una sola fila y la respuesta afirmaba que se habia guardado el hashtag nuevo, que no se
     * escribia en ninguna parte. Ahora la igualdad del doble clic mira el cuerpo entero.
     */
    @Test
    fun `dos altas del mismo evento con hashtag distinto son dos invitaciones`() {
        val primera = servicio.crear(9L, peticion(hashtag = "#Ana"))
        val segunda = servicio.crear(9L, peticion(hashtag = "#AnaYLuis"))

        assertTrue(segunda.creada, "un hashtag distinto es un alta distinta, no un doble clic")
        assertEquals(2, repositorio.insertadas.size)
        assertEquals("#Ana", repositorio.insertadas[0].hashtag)
        assertEquals("#AnaYLuis", repositorio.insertadas[1].hashtag)
        assertEquals("#AnaYLuis", segunda.respuesta.hashtag)
        assertTrue(primera.respuesta.invitationId != segunda.respuesta.invitationId)
    }

    /** Lo mismo con los dos permisos, que tampoco se escribian en el camino del doble clic. */
    @Test
    fun `cambiar childrenAllowed tampoco se deduplica`() {
        servicio.crear(9L, peticion())
        val segunda = servicio.crear(9L, peticion(childrenAllowed = false))

        assertTrue(segunda.creada)
        assertEquals(false, segunda.respuesta.childrenAllowed)
        assertEquals(false, repositorio.insertadas[1].childrenAllowed)
    }

    /**
     * Y cuando el doble clic si se reconoce, la respuesta sale **de la fila guardada**. El doble de
     * abajo devuelve a proposito una fila que no se parece a la peticion: si algun campo de la
     * respuesta viniera del cuerpo, esta prueba lo caza.
     */
    @Test
    fun `el doble clic responde la fila que hay en la base, no el eco de la peticion`() {
        val guardada = InvitacionExistente(
            id = 77L,
            fecha = "2027-12-31",
            hora = "23:59",
            hashtag = "#LoQueSeGuardo",
            childrenAllowed = false,
            youngAllowed = false,
            isPaid = true,
            isEnabled = true,
            isFinished = true,
            creadaEn = Instant.parse("2026-09-09T17:59:30Z"),
        )
        val conFilaPrevia = object : ProductInvitationRepository by repositorio {
            override fun borradorIdenticoReciente(
                customerId: Long,
                templateId: Long,
                fecha: String,
                hora: String,
                hashtag: String,
                childrenAllowed: Boolean,
                youngAllowed: Boolean,
                desde: Instant,
            ): InvitacionExistente = guardada
        }
        val servicioConPrevia = ProductInvitationService(conFilaPrevia).apply { reloj = servicio.reloj }

        val resultado = servicioConPrevia.crear(9L, peticion(hashtag = "#LoQuePedi", childrenAllowed = true))

        assertFalse(resultado.creada)
        assertEquals(77L, resultado.respuesta.invitationId)
        assertEquals("#LoQueSeGuardo", resultado.respuesta.hashtag)
        assertEquals("2027-12-31", resultado.respuesta.eventDate)
        assertEquals("23:59", resultado.respuesta.eventTime)
        assertFalse(resultado.respuesta.childrenAllowed)
        assertFalse(resultado.respuesta.youngAllowed)
        assertTrue(resultado.respuesta.isPaid)
        assertTrue(resultado.respuesta.isFinished)
        assertEquals("2026-09-09T17:59:30Z", resultado.respuesta.createdAt)
    }

    // ------------------------------------------------------------------------------------------
    // R1-05 · el bloqueo, el freno de caudal y la salida
    // ------------------------------------------------------------------------------------------

    /**
     * El bloqueo de fila tiene que ser lo **primero** que toca la base: si se tomara despues de
     * contar, la carrera seguiria abierta. Aqui se comprueba que se pide siempre y con el dueno del
     * token; que de verdad serializa lo demuestra `ProductInvitationConcurrenciaTest`.
     */
    @Test
    fun `el alta bloquea la fila de la clienta antes de contar e insertar`() {
        servicio.crear(42L, peticion())

        assertEquals(listOf(42L), repositorio.bloqueadas)
    }

    @Test
    fun `el freno de caudal corta la rafaga de altas de una misma clienta`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 3, maxPorIp = 1000)
        val conFreno = ProductInvitationService(FakeProductInvitationRepository(), freno)
            .apply { reloj = servicio.reloj }

        repeat(3) { conFreno.crear(1L, peticion(eventTime = "1$it:00")) }
        val e = assertThrows<DemasiadasInvitacionesException> { conFreno.crear(1L, peticion(eventTime = "20:00")) }

        assertEquals("PRD_TOO_MANY_REQUESTS", e.code)
        assertEquals(429, e.estado.value())
    }

    @Test
    fun `el freno no gasta cupo con un cuerpo invalido`() {
        val freno = ProductInvitationThrottle(maxPorCuenta = 1, maxPorIp = 1000)
        val conFreno = ProductInvitationService(FakeProductInvitationRepository(), freno)
            .apply { reloj = servicio.reloj }

        assertThrows<CampoRequeridoException> { conFreno.crear(1L, peticion(eventKind = null)) }

        assertTrue(conFreno.crear(1L, peticion()).creada, "el rechazo por validacion no puede gastar el unico cupo")
    }

    @Test
    fun `la clienta borra un borrador suyo y recupera el hueco`() {
        val ids = (0 until ProductInvitationService.MAXIMO_BORRADORES).map {
            servicio.crear(5L, peticion(eventTime = "1$it:00")).respuesta.invitationId
        }
        assertThrows<LimiteDeBorradoresException> { servicio.crear(5L, peticion(eventTime = "20:00")) }

        servicio.eliminar(5L, ids.first())

        assertEquals(listOf(ids.first()), repositorio.borradas)
        assertTrue(servicio.crear(5L, peticion(eventTime = "20:00")).creada, "el hueco liberado se puede usar")
    }

    @Test
    fun `una invitacion que no existe y una ajena responden lo mismo`() {
        val mia = servicio.crear(5L, peticion()).respuesta.invitationId

        val ajena = assertThrows<InvitacionNoEncontradaException> { servicio.eliminar(6L, mia) }
        val fantasma = assertThrows<InvitacionNoEncontradaException> { servicio.eliminar(6L, 999_999L) }

        assertEquals(ajena.code, fantasma.code)
        assertEquals(ajena.message, fantasma.message)
        assertEquals(ajena.details, fantasma.details)
        assertTrue(repositorio.borradas.isEmpty())
    }

    @Test
    fun `una invitacion pagada o publicada no se borra`() {
        val pagada = servicio.crear(5L, peticion(eventTime = "10:00")).respuesta.invitationId
        val publicada = servicio.crear(5L, peticion(eventTime = "11:00")).respuesta.invitationId
        repositorio.propias[pagada] = repositorio.propias.getValue(pagada).copy(isPaid = true)
        repositorio.propias[publicada] = repositorio.propias.getValue(publicada).copy(publicadaAlgunaVez = true)

        val porPago = assertThrows<InvitacionNoBorrableException> { servicio.eliminar(5L, pagada) }
        val porPublicacion = assertThrows<InvitacionNoBorrableException> { servicio.eliminar(5L, publicada) }

        assertEquals("PRD_INVITATION_NOT_DELETABLE", porPago.code)
        assertEquals(409, porPago.estado.value())
        assertEquals("paid", porPago.details?.get("reason"))
        assertEquals("published", porPublicacion.details?.get("reason"))
        assertTrue(repositorio.borradas.isEmpty())
    }
}
