// packages/sections/src/sections/AmenitiesSection.tsx — tipo `amenities` (01 §3.1, 04 §5.2).
// Mismo patrón visual que `GiftTableSection` (grupo de tarjetas/lista pintado ÍNTEGRAMENTE con
// `<GroupBlock>`, sin insignia de tipo — `amenityList` no tiene un itemBlock `choice`).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { GroupBlock } from "../blocks/GroupBlock.tsx";
import { ImageBlock } from "../blocks/ImageBlock.tsx";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import styles from "../styles/AmenitiesSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.amenities;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

function blockByRole(
  blocks: ReadonlyArray<ComposedBlock | ComposedGroup>,
  role: string,
): ComposedBlock | ComposedGroup | undefined {
  return blocks.find((b) => b.role === role);
}

function renderScalar(
  block: ComposedBlock,
  sectionKey: string,
  mode: RenderMode,
  onActivate: ((ref: BlockRef) => void) | undefined,
  pending: ReadonlySet<string> | undefined,
) {
  if (block.value === null || block.type === "group") return null;
  const Component = SCALAR_BLOCK_COMPONENTS[block.type];
  const ref_: BlockRef = { sectionKey, blockId: block.id };
  return (
    <Component
      block={block}
      mode={mode}
      onActivate={onActivate}
      ref_={ref_}
      pending={mode === "canvas" ? (pending?.has(block.id) ?? false) : false}
    />
  );
}

export function AmenitiesSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[AmenitiesSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = blockByRole(section.blocks, "sectionTitle");
  const introBlock = blockByRole(section.blocks, "sectionIntro");
  const backgroundBlock = blockByRole(section.blocks, "sectionBackground");
  const decorativeBlock = blockByRole(section.blocks, "decorative");
  const groupBlock = blockByRole(section.blocks, "amenityList");

  const titleNode =
    titleBlock !== undefined && !isComposedGroup(titleBlock)
      ? renderScalar(titleBlock, section.key, mode, onActivate, pending)
      : null;

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="amenities"
      data-variant={effectiveVariant}
    >
      {backgroundBlock !== undefined && !isComposedGroup(backgroundBlock) && backgroundBlock.value !== null ? (
        <div className={styles.backdrop} aria-hidden="true">
          <ImageBlock
            block={backgroundBlock}
            mode={mode}
            onActivate={onActivate}
            ref_={{ sectionKey: section.key, blockId: backgroundBlock.id }}
            pending={mode === "canvas" ? (pending?.has(backgroundBlock.id) ?? false) : false}
          />
        </div>
      ) : null}

      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.ornament} aria-hidden="true" />
          <h2 id={headingId} className={styles.heading}>
            {titleNode ?? section.title}
          </h2>
          {introBlock !== undefined && !isComposedGroup(introBlock) ? (
            <div className={styles.intro}>{renderScalar(introBlock, section.key, mode, onActivate, pending)}</div>
          ) : null}
        </header>

        {groupBlock !== undefined && isComposedGroup(groupBlock) ? (
          <div className={`${styles.groupWrap} ${effectiveVariant === "list" ? styles.list : styles.cards}`}>
            <GroupBlock
              group={groupBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={{ sectionKey: section.key, blockId: groupBlock.id }}
              pending={mode === "canvas" ? pending : undefined}
            />
          </div>
        ) : null}

        {decorativeBlock !== undefined && !isComposedGroup(decorativeBlock) && decorativeBlock.value !== null ? (
          <ImageBlock
            block={decorativeBlock}
            mode={mode}
            onActivate={onActivate}
            ref_={{ sectionKey: section.key, blockId: decorativeBlock.id }}
            pending={mode === "canvas" ? (pending?.has(decorativeBlock.id) ?? false) : false}
          />
        ) : null}
      </div>
    </section>
  );
}
