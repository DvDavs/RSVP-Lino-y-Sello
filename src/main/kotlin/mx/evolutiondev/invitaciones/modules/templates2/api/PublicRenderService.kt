package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationAvailabilityReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.ReleaseStore
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2FlagRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/** `03 §3.15`. `composed` sale **tal cual** del release: el render público no compone nada. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RenderResponse(
    val composed: JsonNode,
    val publishedAt: Instant,
    val contentHash: String,
)

/** `03 §3.16`. Sonda liviana que el editor consulta tras publicar. */
data class ExistsResponse(val published: Boolean)

/**
 * Lo que el render necesita saber además del cuerpo: el `ETag` con el que responder y si el cliente ya
 * lo tiene.
 */
data class RenderOutcome(val cuerpo: RenderResponse, val etag: String)

/**
 * Render público (rutas 15 y 16 de `03 §2`): la **única** superficie del módulo sin autenticación.
 *
 * Cuatro propiedades que definen esta ruta y que están escritas aquí porque son las que la hacen
 * segura, no porque el documento las liste:
 *
 * 1. **Lee solo `tpl_release`.** El invitado nunca dispara composición ni toca `tpl_document`
 *    (ADR-013): el `composed` ya está congelado desde la publicación. Corrige de raíz H-04/H-05 —dos
 *    verdades vivas para la misma invitación— y hace la ruta cacheable de verdad.
 * 2. **Jamás escribe** (`03 §3.15`): ni contadores ni "visto por última vez". Una escritura en la ruta
 *    cacheable traería H-04 de vuelta. La transacción es `readOnly` y hay una prueba que la ejecuta
 *    con la conexión en modo solo lectura.
 * 3. **La bandera de corte manda aquí también** (X-09, ADR-1R-X-04): con `invitation.uses_templates2 =
 *    false` responde `404` aunque exista un release activo. Tras un rollback (`05 §7.5`) el contenido
 *    autoritativo vuelve a ser `invitation_configs`, servido por el módulo antiguo; seguir sirviendo
 *    desde aquí dejaría **dos verdades vivas**. La bandera se lee, nunca se escribe.
 * 4. **Un solo `404` para todo lo que no se sirve**: token inexistente, token rotado, sin release
 *    activo, despublicado o con la bandera apagada. Distinguirlos sería un oráculo de enumeración de
 *    tokens, y la entropía imprevisible de un `public_token` es alta pero finita.
 *
 * El `403 TPL_INVITATION_UNAVAILABLE` es la única excepción a ese silencio, y es deliberada: replica
 * exactamente lo que el controlador público del módulo antiguo ya hace hoy
 * (`PublicGuestInfoController.kt:65-75`) con las **mismas tres** comprobaciones. Sin él, deshabilitar
 * una invitación o banear a un cliente dejaría de retirar su invitación de internet — una regresión
 * frente al módulo antiguo (objeción B-07).
 */
@Service
class PublicRenderService(
    private val documents: TplDocumentRepository,
    private val releases: ReleaseStore,
    private val availability: InvitationAvailabilityReader,
    private val flags: Templates2FlagRepository,
) {

    /**
     * `03 §3.15`. Devuelve el cuerpo y su `ETag`; el `304` lo decide el controlador comparando con
     * `If-None-Match`, **después** de que esta resolución haya confirmado que el release sigue activo y
     * la invitación disponible: un release despublicado deja de servirse aunque el cliente traiga el
     * `ETag` correcto.
     */
    @Transactional(readOnly = true)
    fun render(publicToken: String): RenderOutcome {
        val invitationId = invitacionServible(publicToken)
        val release = releases.activeByPublicToken(publicToken) ?: throw noEncontrado(publicToken)
        // Coherencia: el índice único parcial garantiza un solo activo por invitación, así que este
        // release es el de la invitación que ya se comprobó.
        if (release.invitationId != invitationId) throw noEncontrado(publicToken)
        return RenderOutcome(
            cuerpo = RenderResponse(
                composed = release.composed,
                publishedAt = release.publishedAt,
                contentHash = release.contentHash,
            ),
            etag = etagDe(release.contentHash),
        )
    }

    /**
     * `03 §3.16`. **Nunca lanza**: devuelve `false` para un token inexistente, para una invitación no
     * disponible y para `uses_templates2 = false`. Un `404` aquí sería el oráculo que `§3.15` evita, y
     * la respuesta que el editor necesita es la misma en los tres casos: "ese enlace no publica nada".
     */
    @Transactional(readOnly = true)
    fun exists(publicToken: String): ExistsResponse {
        if (!formatoValido(publicToken)) return ExistsResponse(false)
        val documento = documents.findByPublicToken(publicToken) ?: return ExistsResponse(false)
        if (flags.usesTemplates2(documento.invitationId) != true) return ExistsResponse(false)
        val disponible = availability.read(documento.invitationId)?.disponible ?: false
        if (!disponible) return ExistsResponse(false)
        return ExistsResponse(releases.activeByPublicToken(publicToken) != null)
    }

    /**
     * Token → invitación servible, o la excepción que corresponda. Es el orden de `03 §3.15`: existir,
     * estar cortada al módulo nuevo, estar disponible; el release se comprueba después.
     */
    private fun invitacionServible(publicToken: String): Long {
        if (!formatoValido(publicToken)) throw noEncontrado(publicToken)
        val documento = documents.findByPublicToken(publicToken) ?: throw noEncontrado(publicToken)
        val invitationId = documento.invitationId

        // X-09: sin la bandera, el contenido autoritativo de esta invitación es el del módulo antiguo.
        // No se redirige al enlace legado: este módulo no conoce su forma y el enlace legado sigue
        // funcionando por su propio camino.
        if (flags.usesTemplates2(invitationId) != true) throw noEncontrado(publicToken)

        val disponibilidad = availability.read(invitationId) ?: throw noEncontrado(publicToken)
        if (!disponibilidad.disponible) throw InvitationUnavailableException(
            "la invitación no está disponible",
            mapOf("publicToken" to publicToken),
        )
        return invitationId
    }

    /**
     * Un token que ni siquiera cumple el patrón no se busca en la base, pero responde **igual** que uno
     * que sí lo cumple y no existe: un `400` distinguible convertiría la ruta en un validador de
     * formato gratuito para quien enumere.
     */
    private fun formatoValido(publicToken: String): Boolean =
        Patterns.PUBLIC_TOKEN.matches(publicToken)

    private fun noEncontrado(publicToken: String) = ReleaseNotFoundException(
        "no hay ninguna invitación publicada en este enlace",
        mapOf("publicToken" to publicToken),
    )

    companion object {

        /**
         * `ETag` **fuerte**: el `content_hash` completo, con su prefijo `sha256:`, entre comillas
         * (`03 §7`). Es determinista —dos publicaciones del mismo contenido producen el mismo `ETag`—
         * y cambia siempre que cambia el contenido, **incluido el informe**: `contentHash` se calcula
         * sobre `{composed, report}` (ADR-1R-D-02, X-02), así que un cambio en `stillDefault` invalida
         * la caché en vez de servir una versión vieja con el aspecto correcto.
         */
        fun etagDe(contentHash: String): String = "\"$contentHash\""

        /**
         * `If-None-Match` según RFC 9110: lista separada por comas, `*` casa con cualquier
         * representación, y el prefijo `W/` de una validación débil se ignora al comparar — un `ETag`
         * que el cliente guardó y devuelve marcado como débil sigue siendo el mismo recurso.
         */
        fun casaIfNoneMatch(cabecera: String?, etag: String): Boolean {
            if (cabecera.isNullOrBlank()) return false
            return cabecera.split(',')
                .map { it.trim() }
                .any { it == "*" || it.removePrefix("W/") == etag }
        }
    }
}
