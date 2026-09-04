// packages/sections/src/sections/CelebrantSection.tsx — 3-2b, tipo 2/6.
//
// Unifica boda (celebrantA/celebrantB) y XV/bautizo (honoree) por ROL, nunca por campo nulable
// (01 §3.1: "unifica boda (2 personas) y XV/bautizo (1) por rol, no por campos groom*/bride*
// nullables"). Los tres "cupos" de persona (A, B, homenajeadx) se recorren en orden fijo y solo
// se pintan los que de verdad tienen contenido (nombre, foto o texto) — nunca una tarjeta vacía.
//
// `section.title` ("Los novios"/"La quinceañera", `template.json`) SÍ es texto para el invitado
// aquí (a diferencia de `cover`): se muestra como el <h2> visible de la sección. El nombre de
// cada persona es un <h3> propio — subtítulo interno legítimo (04 §17.3), útil además para
// navegar por encabezados en un lector de pantalla ("Antonio" / "Camila").
import type { ReactNode } from "react";
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup, ComposedSection } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import type { BlockRole } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import { ImageBlock, PersonBlock, RichTextBlock, TextBlock, DateBlock } from "../blocks/index.ts";
import shared from "../styles/shared.module.css";
import styles from "../styles/CelebrantSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.celebrant;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

type SectionBlock = ComposedBlock | ComposedGroup;

function findScalar(blocks: readonly SectionBlock[], role: BlockRole): ComposedBlock | undefined {
  const found = blocks.find((b) => b.role === role);
  return found !== undefined && !isComposedGroup(found) ? found : undefined;
}

function isPending(pending: ReadonlySet<string> | undefined, mode: RenderMode, blockId: string): boolean {
  return mode === "canvas" ? (pending?.has(blockId) ?? false) : false;
}

const PERSON_SLOTS = [
  { key: "A", role: "celebrantA", photoRole: "celebrantAPhoto", textRole: "celebrantAText" },
  { key: "B", role: "celebrantB", photoRole: "celebrantBPhoto", textRole: "celebrantBText" },
  { key: "honoree", role: "honoree", photoRole: "honoreePhoto", textRole: "honoreeMessage" },
] as const;

interface RenderCtx {
  readonly section: ComposedSection;
  readonly mode: RenderMode;
  readonly onActivate?: (ref: BlockRef) => void;
  readonly pending?: ReadonlySet<string>;
}

function renderPerson(slot: (typeof PERSON_SLOTS)[number], ctx: RenderCtx): ReactNode {
  const { section, mode, onActivate, pending } = ctx;
  const nameBlock = findScalar(section.blocks, slot.role as BlockRole);
  const photoBlock = findScalar(section.blocks, slot.photoRole as BlockRole);
  const textBlock = findScalar(section.blocks, slot.textRole as BlockRole);
  const hasContent = nameBlock?.value != null || photoBlock?.value != null || textBlock?.value != null;
  if (!hasContent) return null;

  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <article className={styles.person} key={slot.key}>
      {photoBlock ? (
        <div className={styles.photoWrap}>
          <ImageBlock
            block={photoBlock}
            mode={mode}
            onActivate={onActivate}
            ref_={refFor(photoBlock.id)}
            pending={isPending(pending, mode, photoBlock.id)}
          />
        </div>
      ) : null}
      <div className={styles.textCol}>
        {nameBlock?.value != null ? (
          <h3 className={styles.personName}>
            <PersonBlock
              block={nameBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(nameBlock.id)}
              pending={isPending(pending, mode, nameBlock.id)}
            />
          </h3>
        ) : null}
        {textBlock ? (
          <div className={`${styles.quote} ${shared.measure}`}>
            <RichTextBlock
              block={textBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(textBlock.id)}
              pending={isPending(pending, mode, textBlock.id)}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function CelebrantSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[CelebrantSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const headingBlock = findScalar(section.blocks, "celebrantsHeading");
  const dateBlock = findScalar(section.blocks, "celebrantsDate");
  const ctx: RenderCtx = { section, mode, onActivate, pending };
  const people = PERSON_SLOTS.map((slot) => renderPerson(slot, ctx)).filter((node): node is ReactNode => node !== null);
  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="celebrant"
      data-variant={effectiveVariant}
      data-people={people.length}
    >
      <header className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          {section.title}
        </h2>
        {headingBlock ? (
          <p className={styles.kicker}>
            <TextBlock
              block={headingBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(headingBlock.id)}
              pending={isPending(pending, mode, headingBlock.id)}
            />
          </p>
        ) : null}
        {dateBlock ? (
          <div className={styles.dateRow}>
            <DateBlock
              block={dateBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(dateBlock.id)}
              pending={isPending(pending, mode, dateBlock.id)}
            />
          </div>
        ) : null}
      </header>
      {people.length > 0 ? <div className={styles.people}>{people}</div> : null}
    </section>
  );
}
