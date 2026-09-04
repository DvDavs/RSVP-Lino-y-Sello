// packages/sections/src/sections/EventSection.tsx — 3-2b, tipo 3/6.
//
// `eventCards` es un GRUPO (01 §3.1): se delega entero en `<GroupBlock>` (handoffs/3-2a.md §2 —
// "no reimplementes <ul>/<li>"). Este componente NUNCA despacha por rol dentro del grupo: solo
// decide el envoltorio visual según la variante (eje de línea de tiempo vs rejilla de tarjetas),
// apoyado en selectores de ETIQUETA (`ul`/`li`) sobre el HTML que `GroupBlock` ya produce —
// `GroupBlock.module.css` está fuera de mi alcance, pero `ul`/`li` son selectores de etiqueta,
// no de clase, así que no dependen de sus nombres de clase internos (hasheados por CSS Modules).
//
// El `<h2>` muestra el bloque editable `sectionTitle` ("event.title" en `template.json`, rol
// genérico admisible en cualquier sección, 01 §3.1) cuando el cliente lo personalizó; si el
// bloque no existe o sigue vacío, cae a la etiqueta fija del manifiesto (`section.title`,
// "Itinerario") — así el <h2> SIEMPRE tiene texto real (aria-labelledby lo exige) y, cuando hay
// contenido de usuario, se pinta con su propio bloque (click-to-select funcional en el lienzo).
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import type { BlockRole } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import { GroupBlock, LocationBlock, TextBlock } from "../blocks/index.ts";
import styles from "../styles/EventSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.event;
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

export function EventSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[EventSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = findScalar(section.blocks, "sectionTitle");
  const cardsGroup = findGroup(section.blocks, "eventCards");
  const placeBlock = findScalar(section.blocks, "eventPlace");
  const locationNoteBlock = findScalar(section.blocks, "eventLocationNote");
  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="event"
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
      </header>

      {cardsGroup ? (
        <div className={styles.groupWrap}>
          <GroupBlock
            group={cardsGroup}
            mode={mode}
            onActivate={onActivate}
            ref_={refFor(cardsGroup.id)}
            pending={mode === "canvas" ? pending : undefined}
          />
        </div>
      ) : placeBlock ? (
        <div className={styles.singlePlace}>
          {locationNoteBlock ? (
            <p className={styles.note}>
              <TextBlock
                block={locationNoteBlock}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(locationNoteBlock.id)}
                pending={isPending(pending, mode, locationNoteBlock.id)}
              />
            </p>
          ) : null}
          <LocationBlock
            block={placeBlock}
            mode={mode}
            onActivate={onActivate}
            ref_={refFor(placeBlock.id)}
            pending={isPending(pending, mode, placeBlock.id)}
          />
        </div>
      ) : null}
    </section>
  );
}
