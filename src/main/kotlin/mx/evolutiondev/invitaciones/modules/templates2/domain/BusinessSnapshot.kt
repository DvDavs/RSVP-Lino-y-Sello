package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `composed.ts` `BusinessSnapshot` — proyección inmutable de la tabla `invitation`.
 * La construye el backend (`BusinessSnapshotReader`); el frontend nunca consulta Postgres.
 *
 * `timezone` lleva `.default("America/Mexico_City")` en Zod y el JSON Schema emitido no lo marca como
 * requerido: un snapshot crudo válido llega sin él (objeción O-02).
 */
data class BusinessSnapshot(
    val invitationId: Long,
    val date: String?,
    val time: String?,
    val hashtag: String?,
    val coverPhotoUrl: String?,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val eventKind: EventKind,
    val planTier: Int,
    val timezone: String = "America/Mexico_City",
)
