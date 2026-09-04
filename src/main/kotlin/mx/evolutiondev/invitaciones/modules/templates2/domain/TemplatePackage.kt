package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Agregado inmutable `manifiesto + theme + defaults + planes` que consume `compose` (`02 §7.1`).
 * Es la capa 1 del modelo de 4 capas: el paquete de plantilla, inmutable una vez registrado.
 */
data class TemplatePackage(
    val manifest: TemplateManifest,
    val theme: ThemeSpec,
    val defaults: DefaultsFile,
    /** planes indexados por versión de origen; una entrada por cada `manifest.migrationsFrom` */
    val migrationPlans: Map<SemverVersion, MigrationPlan> = emptyMap(),
) {
    val slug: TemplateSlug get() = manifest.slug
    val version: SemverVersion get() = manifest.version
}
