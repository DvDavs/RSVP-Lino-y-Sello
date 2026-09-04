package mx.evolutiondev.invitaciones.modules.templates2.api

import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Rutas 15 y 16 de `03 §2`, **sin autenticación**: el documento renderizable que ve el invitado.
 *
 * **La forma canónica de la ruta es `/public/i/{publicToken}/render`** (decisión X-08), tal como la
 * fijan `03 §2`, `contratos.md §4`, `02 §7` y `04 §15`. La forma `/public/invitations/{token}/render`
 * que aparece en el texto de ADR-013 es la del borrador y **no existe**.
 *
 * `/public/` + `**` ya es `permitAll()` en `SecurityConfig.kt:38`, así que estas dos rutas quedan
 * abiertas **sin tocar nada** del núcleo. No llevan `@PreAuthorize`: ponerlo aquí las cerraría.
 *
 * `publicToken` es `tpl_document.public_token` (`02 §2` V32), **nunca** el `invitationId`: el enlace es
 * una capacidad revocable —se rota con `POST …/public-token:rotate`— y un id secuencial habría sido
 * enumerable desde el primero.
 */
@RestController
@RequestMapping("/public/i/{publicToken}")
class PublicRenderController(private val servicio: PublicRenderService) {

    /**
     * `03 §3.15` y `§7`.
     *
     * - **`ETag` = `"<content_hash>"`**, fuerte y con el prefijo del algoritmo. Es determinista y
     *   cambia siempre que cambia el contenido **o el informe** (`contentHash` se calcula sobre
     *   `{composed, report}`, ADR-1R-D-02): un cambio en `stillDefault` invalida la caché.
     * - **`Cache-Control: public, max-age=300, stale-while-revalidate=3600`.** Consecuencia asumida y
     *   explícita: tras publicar, despublicar o rotar el token, el CDN puede seguir sirviendo la
     *   respuesta anterior hasta 300 s (y hasta 1 h en modo `stale-while-revalidate`). La revocación es
     *   inmediata **en origen**, no necesariamente en el borde; purgar el CDN es una operación de la
     *   capa de despliegue, fuera de este módulo.
     * - **`304` solo después de resolver.** Un release despublicado o una invitación deshabilitada
     *   dejan de servirse aunque el cliente traiga el `ETag` correcto; por eso la consulta se ejecuta
     *   siempre y la comparación va al final.
     */
    @GetMapping("/render")
    fun render(
        @PathVariable publicToken: String,
        @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) ifNoneMatch: String?,
    ): ResponseEntity<RenderResponse> {
        val salida = servicio.render(publicToken)
        val yaLoTiene = PublicRenderService.casaIfNoneMatch(ifNoneMatch, salida.etag)
        val estado = if (yaLoTiene) HttpStatus.NOT_MODIFIED else HttpStatus.OK
        val respuesta = ResponseEntity.status(estado)
            .eTag(salida.etag)
            .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
            .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING)
            .header(CABECERA_NOSNIFF, VALOR_NOSNIFF)
        // Un `304` no lleva cuerpo ni `Content-Type`; las cabeceras de caché sí, porque son lo que el
        // cliente vuelve a guardar.
        if (yaLoTiene) return respuesta.build()
        return respuesta.contentType(MediaType.APPLICATION_JSON).body(salida.cuerpo)
    }

    /**
     * `03 §3.16`. `Cache-Control: no-store` **es parte del contrato**: es la sonda que el editor
     * consulta justo después de publicar, y cachearla la haría inútil.
     *
     * Devuelve `{"published": false}` —no `404`— también para un token inventado, para no ser un
     * oráculo de enumeración.
     */
    @GetMapping("/exists")
    fun exists(@PathVariable publicToken: String): ResponseEntity<ExistsResponse> =
        ResponseEntity.ok()
            .header(HttpHeaders.CACHE_CONTROL, SIN_CACHE)
            .header(CABECERA_NOSNIFF, VALOR_NOSNIFF)
            .body(servicio.exists(publicToken))

    companion object {
        const val CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"
        const val SIN_CACHE = "no-store"
        const val CABECERA_NOSNIFF = "X-Content-Type-Options"
        const val VALOR_NOSNIFF = "nosniff"
    }
}
