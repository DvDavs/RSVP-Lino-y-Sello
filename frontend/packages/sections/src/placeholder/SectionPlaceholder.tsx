// packages/sections/src/placeholder/SectionPlaceholder.tsx — componente marcador de posición
// MÍNIMO Y HONESTO para las 12 entradas de `sectionRegistry` (04 §5.2, tarea del brief 3-2a §4).
//
// "Honesto" quiere decir: no inventa diseño de sección (eso lo deciden los dos agentes que
// escriben `src/sections/*.tsx`), pero SÍ cumple el contrato entero — R2/R5 (bloque sin valor no
// se pinta), R7 (grupos en orden), rol fuera de `roles` no se pinta y avisa, `variant`
// desconocida cae a `defaultVariant` y avisa (regla 2 de `04 §5.2`, mismo criterio que U-01),
// estructura semántica de `04 §17.3` (`<section aria-labelledby>` + un `<h2>`), y separación
// pública/lienzo (activation solo en mode="canvas").
//
// NO vive en `src/sections/` a propósito: esa carpeta y el patrón `*.tsx` están reservados a los
// 12 componentes reales (ver brief 3-2a, "ARCHIVOS QUE TE TOCAN"). Los agentes de sección
// sustituyen el `component:` de su entrada en `registry.ts` por su propio archivo en
// `src/sections/<Nombre>Section.tsx`; no tocan las demás entradas ni este archivo.
import type { FC } from "react";
import type { SectionType, BlockRole } from "@invitaciones/schema";
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef } from "../types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { GroupBlock } from "../blocks/GroupBlock.tsx";
import styles from "./SectionPlaceholder.module.css";

export function createPlaceholderSection(
  sectionType: SectionType,
  roles: readonly BlockRole[],
  supportedVariants: readonly string[],
  defaultVariant: string,
): FC<SectionComponentProps> {
  const allowedRoles = new Set<BlockRole>(roles);
  const knownVariants = new Set<string>(supportedVariants);

  function PlaceholderSection({
    section,
    variant,
    mode,
    selected,
    onActivate,
    pending,
  }: SectionComponentProps) {
    const headingId = `s-${section.key}`;
    // Regla 2 de `04 §5.2`: variante desconocida ⇒ se pinta `defaultVariant` y se avisa. Este
    // marcador no tiene layouts por variante que elegir de verdad (no hay diseño aún), pero
    // igual resuelve la variante EFECTIVA así, para que el patrón quede listo para que la
    // sección real solo tenga que leer `effectiveVariant` en vez de reinventar el fallback.
    const effectiveVariant = knownVariants.has(variant) ? variant : defaultVariant;
    if (mode === "canvas" && effectiveVariant !== variant) {
      // eslint-disable-next-line no-console
      console.warn(
        `[sectionRegistry] "${sectionType}.${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
      );
    }

    return (
      <section
        aria-labelledby={headingId}
        className={styles.section}
        data-section-type={sectionType}
        data-variant={effectiveVariant}
      >
        <h2 id={headingId} className={styles.heading}>
          {section.title}
        </h2>
        <div className={styles.blocks}>
          {section.blocks.map((block) => {
            if (!allowedRoles.has(block.role)) {
              // R5: un rol que la sección no contempla no se pinta. Nunca se inventa un hueco.
              if (mode === "canvas") {
                // eslint-disable-next-line no-console
                console.warn(
                  `[sectionRegistry] "${sectionType}.${section.key}": rol "${block.role}" (bloque "${block.id}") sin hueco — no se pinta (unmapped-role).`,
                );
              }
              return null;
            }

            const ref_: BlockRef = { sectionKey: section.key, blockId: block.id };

            if (isComposedGroup(block)) {
              return (
                <div key={block.id} className={styles.blockSlot}>
                  <GroupBlock
                    group={block}
                    mode={mode}
                    onActivate={onActivate}
                    ref_={ref_}
                    pending={mode === "canvas" ? pending : undefined}
                  />
                </div>
              );
            }

            // `isComposedGroup` ya excluyó el miembro `ComposedGroup` de la unión, pero
            // `block.type` sigue siendo el `BlockKind` COMPLETO (composed.ts no lo discrimina de
            // verdad — ver el comentario de `isComposedGroup` en schema-types.ts): un
            // `type:"group"` aquí sería un dato corrupto, nunca uno válido; se omite (R5).
            if (block.type === "group") return null;

            const Component = SCALAR_BLOCK_COMPONENTS[block.type];
            const isPending = mode === "canvas" ? (pending?.has(block.id) ?? false) : false;
            return (
              <div key={block.id} className={styles.blockSlot}>
                <Component block={block} mode={mode} onActivate={onActivate} ref_={ref_} pending={isPending} />
              </div>
            );
          })}
        </div>
        {mode === "canvas" && selected?.sectionKey === section.key ? (
          <span className={styles.visuallyHidden} data-testid="placeholder-selected-marker" />
        ) : null}
      </section>
    );
  }

  PlaceholderSection.displayName = `SectionPlaceholder(${sectionType})`;
  return PlaceholderSection;
}
