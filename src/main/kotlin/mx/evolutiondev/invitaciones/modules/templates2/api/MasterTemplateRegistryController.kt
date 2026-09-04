package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.templates2.catalog.PackagePart
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateCatalogService
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplatePackageReader
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistrationService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartHttpServletRequest

/**
 * Las tres rutas MASTER del catálogo (`03 §2` filas 17, 18 y 19; `03 §3.17`-`§3.19`).
 *
 * **Autorización.** `/master/` + `**` ya exige `hasRole("MASTER")` en `SecurityConfig.kt:44` (verificado);
 * el `@PreAuthorize` de clase es defensa en profundidad, posible porque `@EnableMethodSecurity` está
 * activo (`SecurityConfig.kt:17`). **No** usa `HierarchyValidationService`: aquí no hay invitación que
 * autorizar (ADR-033). El `403` de un `USER`/`ADMIN` lo produce `InvitationsAccessDeniedHandler`, con
 * el cuerpo de la plataforma, no un `TPL_*` (`03 §9.1`, nota).
 *
 * **Errores.** Este controlador **no** captura nada: lanza excepciones tipadas
 * (`TemplateRegistryException`, `Templates2Exception`) y el `@RestControllerAdvice` del bloque 2-5 las
 * traduce a `TplErrorResponse` con su `code` y su HTTP. `contratos.md §4` prohíbe `require`/`check`/
 * `error()` en todo `templates2`.
 */
@RestController
@RequestMapping("/master/templates2/versions")
@PreAuthorize("hasRole('MASTER')")
class MasterTemplateRegistryController(
    private val registro: TemplateRegistrationService,
    private val catalogo: TemplateCatalogService,
) {

    /**
     * `POST /master/templates2/versions` — **único camino de alta** (`03 §3.17`, ADR-033).
     *
     * `multipart/form-data` porque el paquete son varios archivos; es la **única** ruta multipart del
     * módulo y por eso `application.yml` eleva `spring.servlet.multipart.max-file-size` a 15MB y
     * `max-request-size` a 64MB (`contratos.md §4`). Partes: `template`, `theme`, `defaults`,
     * `migrations` (0..n) y `assets` (0..200, con la ruta relativa como nombre de parte o el nombre de
     * archivo original).
     *
     * `201` si se creó; `200` con `alreadyRegistered = true` si el `package_hash` ya estaba registrado
     * (idempotencia real de ADR-008, **visible**).
     */
    @PostMapping(consumes = ["multipart/form-data"])
    fun register(
        request: MultipartHttpServletRequest,
        authentication: Authentication?,
    ): ResponseEntity<RegisterTemplateResponse> {
        val partes = request.multiFileMap.entries.flatMap { (nombre, archivos) ->
            archivos.map { PackagePart(nombre, it.originalFilename, it.bytes) }
        }
        val raw = TemplatePackageReader.fromParts(partes)
        val salida = registro.register(raw, requesterId(authentication))
        val cuerpo = RegisterTemplateResponse.de(salida)
        val estado = if (salida.alreadyRegistered) HttpStatus.OK else HttpStatus.CREATED
        return ResponseEntity.status(estado).body(cuerpo)
    }

    /** `GET /master/templates2/versions` (`03 §3.18`): versiones + auditoría reciente. */
    @GetMapping
    fun list(
        @RequestParam(required = false) slug: String?,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) limit: Int?,
        @RequestParam(required = false) cursor: String?,
    ): TemplateVersionListResponse {
        val tope = limite(limit)
        val pagina = catalogo.versiones(slug, status, tope, cursor)
        return TemplateVersionListResponse(
            items = pagina.items.map(TemplateVersionItemResponse::de),
            recentRegistrations = catalogo.registrosRecientes(slug, tope).map(RegistrationItemResponse::de),
            nextCursor = pagina.nextCursor,
        )
    }

    /**
     * `POST /master/templates2/versions/{templateVersionId}:deprecate` (`03 §3.19`). Idempotente: si ya
     * estaba deprecada responde `200` igual. No afecta a los documentos que ya usan la versión, solo la
     * retira del catálogo y de `:choose-template` para documentos nuevos.
     */
    @PostMapping("/{templateVersionId}:deprecate")
    fun deprecate(@PathVariable templateVersionId: Long): TemplateVersionItemResponse =
        TemplateVersionItemResponse.de(catalogo.deprecar(templateVersionId))

    private fun limite(limit: Int?): Int =
        (limit ?: TemplateCatalogService.LIMITE_POR_DEFECTO)
            .coerceIn(1, TemplateCatalogService.LIMITE_MAXIMO)

    /** P8: el id sale del token, **nunca** del cuerpo. Un principal ajeno deja `published_by` nulo. */
    private fun requesterId(authentication: Authentication?): Long? =
        authentication?.let { runCatching { it.userId() }.getOrNull() }
}
