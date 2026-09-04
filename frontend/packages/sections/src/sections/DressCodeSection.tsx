// packages/sections/src/sections/DressCodeSection.tsx — 3-2b, tipo 6/6.
//
// `dressCodeRules` es un GRUPO (min 1, max 3, `template.json`): se delega en `<GroupBlock>`.
// Orden fijo de `itemBlocks` en las dos plantillas semilla: para quién (título), descripción,
// imagen opcional — mismo criterio posicional que el resto de secciones con grupo.
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import type { BlockRole } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import { GroupBlock, TextBlock } from "../blocks/index.ts";
import styles from "../styles/DressCodeSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.dressCode;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

type SectionBlock = ComposedBlock | ComposedGroup;

function findScalar(blocks: readonly SectionBlock[], role: BlockRole): ComposedBlock | undefined {
  const found = blocks.find((b) => b.role === role);
  return found !== undefined && !isComposedGroup(found) ? found : undefined;
}

function findGroup(blocks: readonly SectionBlock[], role: BlockRole): ComposedGroup | undefined {
  const found = blocks.find((b) => b.role === role);
  return found !== undefined && isComposedGroup(found) ? found : undefined;
}

function isPending(pending: ReadonlySet<string> | undefined, mode: RenderMode, blockId: string): boolean {
  return mode === "canvas" ? (pending?.has(blockId) ?? false) : false;
}

export function DressCodeSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[DressCodeSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = findScalar(section.blocks, "sectionTitle");
  const introBlock = findScalar(section.blocks, "sectionIntro");
  const rulesGroup = findGroup(section.blocks, "dressCodeRules");
  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="dressCode"
      data-variant={effectiveVariant}
    >
      <header className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          {titleBlock?.value != null ? (
            <TextBlock
              block={titleBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(titleBlock.id)}
              pending={isPending(pending, mode, titleBlock.id)}
            />
          ) : (
            section.title
          )}
        </h2>
        {introBlock ? (
          <p className={styles.intro}>
            <TextBlock
              block={introBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(introBlock.id)}
              pending={isPending(pending, mode, introBlock.id)}
            />
          </p>
        ) : null}
      </header>

      {rulesGroup ? (
        <div className={styles.groupWrap}>
          <GroupBlock
            group={rulesGroup}
            mode={mode}
            onActivate={onActivate}
            ref_={refFor(rulesGroup.id)}
            pending={mode === "canvas" ? pending : undefined}
          />
        </div>
      ) : null}
    </section>
  );
}
