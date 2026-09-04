// packages/sections/src/sections/GallerySection.tsx — 3-2b, tipo 4/6.
//
// `galleryPhotos` es un GRUPO: se delega en `<GroupBlock>`, nunca reimplementado (handoffs/
// 3-2a.md §2). Las cuatro variantes (`grid-6`, `grid-9`, `carousel`, `masonry`) son puro CSS
// sobre el `<ul>/<li>` que ya produce — mismo criterio que `EventSection` (selectores de
// ETIQUETA, no de clase, porque `GroupBlock.module.css` está fuera de mi alcance).
//
// `loading="lazy"` en TODAS las fotos (incluida la primera): `ImageBlock` (blocks/ImageBlock.tsx,
// fuera de mi alcance) lo fija de forma incondicional y no expone ninguna prop para variarlo por
// posición. El brief pide "salvo la primera" — hueco de la base 3-2a que no puedo cerrar sin
// tocar `src/blocks/**` (prohibido); registrado en preguntas-abiertas.md, no bloquea (P9/opción
// conservadora: usar el componente compartido tal cual, nunca reimplementar el bloque de imagen).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import type { BlockRole } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import { GroupBlock, TextBlock } from "../blocks/index.ts";
import styles from "../styles/GallerySection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.gallery;
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

export function GallerySection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[GallerySection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = findScalar(section.blocks, "sectionTitle");
  const introBlock = findScalar(section.blocks, "galleryIntro");
  const photosGroup = findGroup(section.blocks, "galleryPhotos");
  const hashtagBlock = findScalar(section.blocks, "hashtag");
  const hashtagListGroup = findGroup(section.blocks, "hashtagList");
  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="gallery"
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

      {photosGroup ? (
        <div
          className={styles.groupWrap}
          tabIndex={effectiveVariant === "carousel" ? 0 : undefined}
          role={effectiveVariant === "carousel" ? "group" : undefined}
          aria-label={effectiveVariant === "carousel" ? "Carrusel de fotos, desplázate con las flechas" : undefined}
        >
          <GroupBlock
            group={photosGroup}
            mode={mode}
            onActivate={onActivate}
            ref_={refFor(photosGroup.id)}
            pending={mode === "canvas" ? pending : undefined}
          />
        </div>
      ) : null}

      {hashtagBlock || hashtagListGroup ? (
        <footer className={styles.social}>
          {hashtagBlock ? (
            <p className={styles.hashtag}>
              <TextBlock
                block={hashtagBlock}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(hashtagBlock.id)}
                pending={isPending(pending, mode, hashtagBlock.id)}
              />
            </p>
          ) : null}
          {hashtagListGroup ? (
            <div className={styles.hashtagListWrap}>
              <GroupBlock
                group={hashtagListGroup}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(hashtagListGroup.id)}
                pending={mode === "canvas" ? pending : undefined}
              />
            </div>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
