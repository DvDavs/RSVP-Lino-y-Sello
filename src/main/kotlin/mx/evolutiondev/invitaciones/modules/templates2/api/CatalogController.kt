package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateCatalogService
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /editor/templates2/catalog` (`03 §3.1`, fila 1 de `03 §2`): las plantillas publicadas que el
 * cliente puede elegir antes de `:choose-template`.
 *
 * **Autenticado, no público** (`contratos.md §4`). `/editor/` + `**` **no** tiene regla en `SecurityConfig`
 * — cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`) —, así que la defensa en
 * profundidad se añade aquí con `@PreAuthorize` a nivel de clase (ADR-1R-B-10, objeción A-02),
 * sin tocar el núcleo. No hay invitación que autorizar: el catálogo es común a los tres roles
 * (`03 §9.1`, fila 1).
 */
@RestController
@RequestMapping("/editor/templates2")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class CatalogController(private val catalogo: TemplateCatalogService) {

    /**
     * `eventKind` y `planTier` son opcionales. Un `eventKind` fuera del catálogo cerrado o un
     * `planTier` fuera de 1-3 se **rechazan** con `400 TPL_MALFORMED_JSON`: devolver el catálogo entero
     * ignorando un filtro que no se entendió es exactamente el descarte silencioso que P1 prohíbe.
     *
     * Sin `planTier`, el catálogo se devuelve **completo** con el `minPlanTier` de cada plantilla a la
     * vista (ADR-2-3-05): quien bloquea por plan es `:choose-template` con
     * `403 TPL_PLAN_TIER_INSUFFICIENT`, decisión ya tomada en `preguntas-abiertas.md`.
     */
    @GetMapping("/catalog")
    fun catalog(
        @RequestParam(required = false) eventKind: String?,
        @RequestParam(required = false) planTier: Int?,
        @RequestParam(required = false) limit: Int?,
        @RequestParam(required = false) cursor: String?,
    ): CatalogResponse {
        val kind = eventKind?.let {
            EventKind.of(it) ?: throw Templates2Exception.MalformedJson(
                "eventKind \"$it\" no pertenece al catálogo cerrado",
                mapOf("param" to "eventKind", "value" to it, "allowed" to EventKind.entries.map { e -> e.wire }),
            )
        }
        val tier = planTier ?: TIER_MAXIMO
        if (tier !in TIER_MINIMO..TIER_MAXIMO) throw Templates2Exception.MalformedJson(
            "planTier debe estar entre $TIER_MINIMO y $TIER_MAXIMO",
            mapOf("param" to "planTier", "value" to tier),
        )
        val tope = (limit ?: TemplateCatalogService.LIMITE_POR_DEFECTO)
            .coerceIn(1, TemplateCatalogService.LIMITE_MAXIMO)
        val pagina = catalogo.catalogo(kind, tier, tope, cursor)
        return CatalogResponse(pagina.items.map(CatalogItemResponse::de), pagina.nextCursor)
    }

    companion object {
        /** `ck_tpl_template_version_tier` de `02 §2` V30: `min_plan_tier BETWEEN 1 AND 3`. */
        const val TIER_MINIMO = 1
        const val TIER_MAXIMO = 3
    }
}
