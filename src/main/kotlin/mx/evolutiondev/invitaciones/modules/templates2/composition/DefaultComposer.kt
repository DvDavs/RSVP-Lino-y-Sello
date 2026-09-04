package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedSection
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionReport
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvalidValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.Provenance
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateRef
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants

/**
 * Implementación de R1-R9 (`01 §5.2` y el pseudocódigo de `§5.3`). **Espejo exacto** de
 * `packages/schema/src/compose.ts`, que es la especificación ejecutable (ADR-004: TypeScript es la
 * fuente, Kotlin el espejo). La paridad se prueba contra `golden/templates/` y `golden/compose/`.
 *
 * Pura: sin reloj, sin E/S, sin `java.util.Locale.getDefault()`, sin aleatoriedad, sin generar ULIDs
 * (R6 y R9). En ningún paso aparece un índice de array ni una comparación de cadenas de contenido:
 * ahí es donde H-01 (emparejar por texto) y H-02 (emparejar por posición) se vuelven imposibles.
 */
object DefaultComposer : Composer {

    override fun compose(
        pkg: TemplatePackage,
        doc: InvitationDocument,
        business: BusinessSnapshot,
        assets: AssetIndex,
        locale: Locale,
    ): CompositionResult {
        val m = pkg.manifest
        val missingRequired = mutableListOf<BlockId>()
        val stillDefault = mutableListOf<BlockId>()
        val orphanSections = mutableListOf<SectionKey>()
        val invalidValues = mutableListOf<InvalidValue>()

        // ── paso 0. tema (R8) ────────────────────────────────────────────────────────────────
        val tema = ThemeResolver.resolve(pkg.theme, doc.theme)

        // ── paso 1. orden de secciones (R1) ──────────────────────────────────────────────────
        val porClave = m.sections.associateBy { it.key }
        val vistas = LinkedHashSet<SectionKey>()
        val orden = mutableListOf<EntradaOrden>()
        for (e in doc.structure.sections) {
            val spec = porClave[e.key]
            if (spec == null) { orphanSections.add(e.key); continue }   // no se renderiza
            if (!vistas.add(e.key)) continue                            // I-11: gana la primera
            orden.add(
                EntradaOrden(
                    spec = spec,
                    variant = if (spec.variants.contains(e.variant)) e.variant else spec.defaultVariant,
                    visible = if (spec.required) true else e.visible,   // I-17: required nunca oculta
                ),
            )
        }
        // R1c (ADR-1R-D-06): la sección ausente se inserta **detrás del último predecesor del
        // manifiesto que sí está presente**, no al final. Anexar al final colocaba una sección nueva
        // después del pie de página (verificado en la ronda 1R con xv-jardin, que omite `family`).
        for (i in m.sections.indices) {
            val s = m.sections[i]
            if (vistas.contains(s.key)) continue
            var pos = 0
            for (j in i - 1 downTo 0) {
                val k = orden.indexOfFirst { it.spec.key == m.sections[j].key }
                if (k >= 0) { pos = k + 1; break }
            }
            orden.add(pos, EntradaOrden(s, s.defaultVariant, s.defaultVisible))
            vistas.add(s.key)
        }

        // ── paso 2. huérfanos de contenido ───────────────────────────────────────────────────
        val declarados = m.sections.flatMap { it.blocks }.map { it.id }.toSet()
        val orphanContent = doc.content.keys.filter { !declarados.contains(it) }
            .map { it.value }.sorted().map { BlockId(it) }

        // ── paso 3. bloques, sección por sección, EN EL ORDEN DEL MANIFIESTO ─────────────────
        fun registrarInvalidos(spec: mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec, valor: BlockValue, ruta: String) {
            // O-12: un valor presente pero inválido para su spec deja rastro. Se ejecuta la MISMA
            // `validateValueAgainstSpec` que el reductor y las invariantes; `composed` no cambia.
            for (v in Invariants.validateValueAgainstSpec(spec, valor, ruta)) {
                val codigo = v.code?.wire ?: v.schemaCode ?: "SCHEMA"
                invalidValues.add(InvalidValue(spec.id, codigo))
            }
        }

        fun componerBloque(b: mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec): ComposedEntry {
            val label = b.label.resolve(locale)

            if (b is GroupSpec) {                                                      // R7
                val delUsuario = doc.content[b.id]
                val elDefault = pkg.defaults.content[b.id]
                val fuente: GroupValue? =
                    (delUsuario as? GroupValue) ?: (elDefault as? GroupValue)
                val procedencia = when {
                    delUsuario is GroupValue -> Provenance.USER
                    elDefault is GroupValue -> Provenance.DEFAULT
                    else -> Provenance.EMPTY
                }
                if (fuente != null) registrarInvalidos(b, fuente, "content.${b.id.value}")
                else if (delUsuario != null) registrarInvalidos(b, delUsuario, "content.${b.id.value}")

                val items = (fuente?.items ?: emptyList()).map { it ->
                    ComposedItem(
                        itemId = it.itemId,
                        // R9 punto 1: el orden lo fija el SPEC, nunca el orden de claves del JSON.
                        blocks = b.itemBlocks.map { ib ->
                            val v = it.values[ib.id]                                   // MERGE POR ID
                            val resuelto = v?.let { valor -> ValueResolver.resolve(ib, valor, assets, locale) }
                            ComposedBlock(
                                id = ib.id, role = ib.role, type = ib.type, label = ib.label.resolve(locale),
                                provenance = if (resuelto == null) Provenance.EMPTY else procedencia,
                                value = resuelto,
                            )
                        },
                    )
                }
                if (b.required && items.isEmpty()) missingRequired.add(b.id)
                if (b.required && procedencia == Provenance.DEFAULT) stillDefault.add(b.id)
                return ComposedGroup(b.id, b.role, label, procedencia, items)
            }

            if (b.source == BlockSource.BUSINESS) {                                    // R4
                val v = BusinessProjector.project(b, business, locale)
                if (v == null) {
                    if (b.required) missingRequired.add(b.id)
                    return ComposedBlock(b.id, b.role, b.type, label, Provenance.EMPTY, null)
                }
                return ComposedBlock(b.id, b.role, b.type, label, Provenance.BUSINESS, v)
            }

            // R2 — tres escalones: user → default → empty. `fixed` solo puede venir de defaults.
            val delUsuario = if (b.source == BlockSource.FIXED) null else doc.content[b.id]
            val elDefault = pkg.defaults.content[b.id]
            val origen = delUsuario ?: elDefault
            var procedencia = when {
                delUsuario != null -> Provenance.USER
                elDefault != null -> if (b.source == BlockSource.FIXED) Provenance.FIXED else Provenance.DEFAULT
                else -> Provenance.EMPTY
            }
            if (origen != null) registrarInvalidos(b, origen, "content.${b.id.value}")
            val value = origen?.let { ValueResolver.resolve(b, it, assets, locale) }
            if (value == null) procedencia = Provenance.EMPTY   // asset borrado: no se inventa URL (R5)
            if (b.required && value == null) missingRequired.add(b.id)
            if (b.required && procedencia == Provenance.DEFAULT) stillDefault.add(b.id)
            return ComposedBlock(b.id, b.role, b.type, label, procedencia, value)
        }

        val secciones = orden.map { (spec, variant, visible) ->
            ComposedSection(
                key = spec.key, type = spec.type, variant = variant, visible = visible,
                title = spec.title.resolve(locale),
                blocks = spec.blocks.map { componerBloque(it) },
            )
        }

        // ── paso 4. determinismo (R9) ────────────────────────────────────────────────────────
        val report = CompositionReport(
            missingRequired = missingRequired.sortedBy { it.value },
            stillDefault = stillDefault.sortedBy { it.value },
            orphanContent = orphanContent,
            orphanSections = orphanSections.sortedBy { it.value },
            invalidValues = invalidValues.sortedWith(compareBy({ it.blockId.value }, { it.code })),
            themeFallback = tema.fallback,
        )
        val composed = ComposedDocument(
            composedVersion = 1,
            template = TemplateRef(m.slug, m.version),
            locale = locale,
            theme = tema.tema,
            sections = secciones,
        )
        return CompositionResult(composed, report)
    }

    private data class EntradaOrden(val spec: SectionSpec, val variant: String, val visible: Boolean)
}
