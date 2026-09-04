// packages/sections/src/sections/FamilySection.tsx — tipo `family` (01 §3.1, 04 §5.2).
//
// Cuatro padres sueltos (roles singleton `parentA1/A2/B1/B2`), hasta tres personas sueltas más
// (`godparentA`, `godparentB`, `witness`) y un grupo reordenable (`familyGroup`/`personList`,
// pintado ÍNTEGRAMENTE con `<GroupBlock>` — 3-2a §2). La etiqueta bajo cada nombre usa
// `block.label` (la etiqueta es-MX del propio manifiesto, p. ej. "Madre del novio") en vez de
// texto inventado: es dato real, no presentación fabricada (P3/R5).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { GroupBlock } from "../blocks/GroupBlock.tsx";
import { ImageBlock } from "../blocks/ImageBlock.tsx";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import styles from "../styles/FamilySection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.family;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

function blocksByRole(
  blocks: ReadonlyArray<ComposedBlock | ComposedGroup>,
  role: string,
): Array<ComposedBlock | ComposedGroup> {
  return blocks.filter((b) => b.role === role);
}

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

interface PersonTileProps {
  readonly block: ComposedBlock;
  readonly sectionKey: string;
  readonly mode: RenderMode;
  readonly onActivate: ((ref: BlockRef) => void) | undefined;
  readonly pending: ReadonlySet<string> | undefined;
}

function PersonTile({ block, sectionKey, mode, onActivate, pending }: PersonTileProps) {
  if (block.value === null || block.value.kind !== "person") return null; // R2
  return (
    <div className={styles.personTile}>
      <span className={styles.personName}>
        {renderScalar(block, sectionKey, mode, onActivate, pending)}
      </span>
      {block.label !== "" ? <span className={styles.personCaption}>{block.label}</span> : null}
    </div>
  );
}

export function FamilySection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[FamilySection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = blockByRole(section.blocks, "sectionTitle");
  const introBlock = blockByRole(section.blocks, "sectionIntro");
  const familyIntroBlock = blockByRole(section.blocks, "familyIntro");
  const backgroundBlock = blockByRole(section.blocks, "sectionBackground");
  const decorativeBlock = blockByRole(section.blocks, "decorative");

  const parentA1 = blockByRole(section.blocks, "parentA1");
  const parentA2 = blockByRole(section.blocks, "parentA2");
  const parentB1 = blockByRole(section.blocks, "parentB1");
  const parentB2 = blockByRole(section.blocks, "parentB2");
  const godparentA = blockByRole(section.blocks, "godparentA");
  const godparentB = blockByRole(section.blocks, "godparentB");
  const witness = blockByRole(section.blocks, "witness");

  const groupTitleBlocks = blocksByRole(section.blocks, "familyGroupTitle").filter(
    (b): b is ComposedBlock => !isComposedGroup(b),
  );
  const groups = [
    ...blocksByRole(section.blocks, "familyGroup"),
    ...blocksByRole(section.blocks, "personList"),
  ].filter((b): b is ComposedGroup => isComposedGroup(b));

  const titleNode =
    titleBlock !== undefined && !isComposedGroup(titleBlock)
      ? renderScalar(titleBlock, section.key, mode, onActivate, pending)
      : null;

  const parentColumns = [
    [parentA1, parentA2],
    [parentB1, parentB2],
  ]
    .map((col) => col.filter((b): b is ComposedBlock => b !== undefined && !isComposedGroup(b) && b.value !== null))
    .filter((col) => col.length > 0);

  const standalone = [godparentA, godparentB, witness].filter(
    (b): b is ComposedBlock => b !== undefined && !isComposedGroup(b) && b.value !== null,
  );

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="family"
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
          {familyIntroBlock !== undefined && !isComposedGroup(familyIntroBlock) ? (
            <div className={styles.blessing}>
              {renderScalar(familyIntroBlock, section.key, mode, onActivate, pending)}
            </div>
          ) : null}
        </header>

        {parentColumns.length > 0 || standalone.length > 0 ? (
          <div className={styles.parents}>
            {parentColumns.map((col, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className={styles.parentColumn}>
                {col.map((block) => (
                  <PersonTile
                    key={block.id}
                    block={block}
                    sectionKey={section.key}
                    mode={mode}
                    onActivate={onActivate}
                    pending={pending}
                  />
                ))}
              </div>
            ))}
            {standalone.map((block) => (
              <div key={block.id} className={styles.parentColumn}>
                <PersonTile
                  block={block}
                  sectionKey={section.key}
                  mode={mode}
                  onActivate={onActivate}
                  pending={pending}
                />
              </div>
            ))}
          </div>
        ) : null}

        {groups.map((group, index) => {
          const titleBlockForGroup = groupTitleBlocks[index];
          const groupHeadingNode =
            titleBlockForGroup !== undefined
              ? renderScalar(titleBlockForGroup, section.key, mode, onActivate, pending)
              : null;
          return (
            <div key={group.id}>
              <h3 className={styles.groupHeading}>{groupHeadingNode ?? group.label}</h3>
              <div className={`${styles.groupWrap} ${effectiveVariant === "list" ? styles.list : styles.cards}`}>
                <GroupBlock
                  group={group}
                  mode={mode}
                  onActivate={onActivate}
                  ref_={{ sectionKey: section.key, blockId: group.id }}
                  pending={mode === "canvas" ? pending : undefined}
                />
              </div>
            </div>
          );
        })}

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
