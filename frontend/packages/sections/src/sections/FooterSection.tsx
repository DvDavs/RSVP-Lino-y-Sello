// packages/sections/src/sections/FooterSection.tsx — tipo `footer` (01 §3.1, 04 §5.2), variante
// `simple` (única declarada). "El pie de una invitación premium es discreto pero cuidado, no un
// bloque gris de relleno" (brief §1): logo pequeño opcional, nota legal, enlace, reproductor de
// música — nunca autorreproducido (04 §17.5, 1.4.2 Audio Control) y oculto por completo cuando
// `backgroundMusicEnabled` es explícitamente `false` (R4: el control de negocio manda).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { ImageBlock } from "../blocks/ImageBlock.tsx";
import { AudioBlock } from "../blocks/AudioBlock.tsx";
import { LinkBlock } from "../blocks/LinkBlock.tsx";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import styles from "../styles/FooterSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.footer;
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

export function FooterSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[FooterSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = blockByRole(section.blocks, "sectionTitle");
  const introBlock = blockByRole(section.blocks, "sectionIntro");
  const backgroundBlock = blockByRole(section.blocks, "sectionBackground");
  const decorativeBlock = blockByRole(section.blocks, "decorative");
  const logoBlock = blockByRole(section.blocks, "footerLogo");
  const noteBlock = blockByRole(section.blocks, "footerNote");
  const linkBlock = blockByRole(section.blocks, "footerLink");
  const musicBlock = blockByRole(section.blocks, "backgroundMusic");
  const musicEnabledBlock = blockByRole(section.blocks, "backgroundMusicEnabled");

  const titleNode =
    titleBlock !== undefined && !isComposedGroup(titleBlock)
      ? renderScalar(titleBlock, section.key, mode, onActivate, pending)
      : null;

  // R4 — negocio por rol: si el bloque de control existe y resuelve a `false`, el reproductor no
  // se pinta aunque haya un asset de música cargado. Sin bloque de control, se respeta lo que
  // haya (compatibilidad con plantillas que no declaren la bandera).
  const musicExplicitlyDisabled =
    musicEnabledBlock !== undefined &&
    !isComposedGroup(musicEnabledBlock) &&
    musicEnabledBlock.value !== null &&
    musicEnabledBlock.value.kind === "boolean" &&
    musicEnabledBlock.value.value === false;

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="footer"
      data-variant={effectiveVariant}
    >
      {backgroundBlock !== undefined && !isComposedGroup(backgroundBlock) && backgroundBlock.value !== null ? (
        <ImageBlock
          block={backgroundBlock}
          mode={mode}
          onActivate={onActivate}
          ref_={{ sectionKey: section.key, blockId: backgroundBlock.id }}
          pending={mode === "canvas" ? (pending?.has(backgroundBlock.id) ?? false) : false}
        />
      ) : null}

      <div className={styles.inner}>
        {logoBlock !== undefined && !isComposedGroup(logoBlock) && logoBlock.value !== null ? (
          <span className={styles.logo}>
            <ImageBlock
              block={logoBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={{ sectionKey: section.key, blockId: logoBlock.id }}
              pending={mode === "canvas" ? (pending?.has(logoBlock.id) ?? false) : false}
            />
          </span>
        ) : (
          <span className={styles.ornament} aria-hidden="true" />
        )}

        <h2 id={headingId} className={styles.title}>
          {titleNode ?? section.title}
        </h2>

        {introBlock !== undefined && !isComposedGroup(introBlock) ? (
          <div className={styles.intro}>{renderScalar(introBlock, section.key, mode, onActivate, pending)}</div>
        ) : null}

        {musicBlock !== undefined &&
        !isComposedGroup(musicBlock) &&
        musicBlock.value !== null &&
        !musicExplicitlyDisabled ? (
          <span className={styles.audio}>
            <AudioBlock
              block={musicBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={{ sectionKey: section.key, blockId: musicBlock.id }}
              pending={mode === "canvas" ? (pending?.has(musicBlock.id) ?? false) : false}
            />
          </span>
        ) : null}

        {linkBlock !== undefined && !isComposedGroup(linkBlock) && linkBlock.value !== null ? (
          <LinkBlock
            block={linkBlock}
            mode={mode}
            onActivate={onActivate}
            ref_={{ sectionKey: section.key, blockId: linkBlock.id }}
            pending={mode === "canvas" ? (pending?.has(linkBlock.id) ?? false) : false}
          />
        ) : null}

        {noteBlock !== undefined && !isComposedGroup(noteBlock) ? (
          <div className={styles.note}>{renderScalar(noteBlock, section.key, mode, onActivate, pending)}</div>
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
