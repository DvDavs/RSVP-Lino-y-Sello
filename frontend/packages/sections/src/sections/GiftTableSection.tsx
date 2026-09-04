// packages/sections/src/sections/GiftTableSection.tsx — tipo `giftTable` (01 §3.1, 04 §5.2).
//
// Variantes: "cards" (grilla de tarjetas con imagen a sangre, insignia de tipo, título y enlace)
// y "list" (filas horizontales separadas por línea fina). El grupo `giftOptions` se pinta
// ÍNTEGRAMENTE con `<GroupBlock>` (3-2a §2: "no reimplementes <ul>/<li>"); el aspecto de tarjeta
// sale de CSS puro sobre los elementos REALES que `GroupBlock`/los bloques de tipo ya producen
// (ver el comentario largo en GiftTableSection.module.css).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { GroupBlock } from "../blocks/GroupBlock.tsx";
import { ImageBlock } from "../blocks/ImageBlock.tsx";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import styles from "../styles/GiftTableSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.giftTable;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

function blockByRole(
  blocks: ReadonlyArray<ComposedBlock | ComposedGroup>,
  role: string,
): ComposedBlock | ComposedGroup | undefined {
  return blocks.find((b) => b.role === role);
}

/** R2: `value === null` no pinta nada. Delega SIEMPRE en el componente de bloque real por
 *  `block.type` (nunca `{block.value.value}` a mano) para conservar click-to-select en canvas. */
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

export function GiftTableSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[GiftTableSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = blockByRole(section.blocks, "sectionTitle");
  const introBlock = blockByRole(section.blocks, "sectionIntro");
  const backgroundBlock = blockByRole(section.blocks, "sectionBackground");
  const decorativeBlock = blockByRole(section.blocks, "decorative");
  const groupBlock = blockByRole(section.blocks, "giftOptions");

  // El h2 obligatorio (04 §17.3) usa el texto EDITABLE del rol `sectionTitle` cuando existe (así
  // una edición del cliente se ve reflejada donde de verdad se lee la sección) y cae al título
  // fijo del manifiesto (`section.title`, siempre presente) cuando el bloque está vacío/ausente
  // — nunca los dos a la vez, para no duplicar literalmente el mismo texto en pantalla.
  const titleNode =
    titleBlock !== undefined && !isComposedGroup(titleBlock)
      ? renderScalar(titleBlock, section.key, mode, onActivate, pending)
      : null;

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="giftTable"
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
            // `sectionIntro` puede resolver a `text`, `richText` (bloque `<div>`) o `listText`
            // (bloque `<ul>`) según lo que declare la plantilla (01 §3.2, filas 1-3) — un `<div>`
            // envolvente es válido para los tres; un `<p>` no lo sería para los dos últimos.
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
