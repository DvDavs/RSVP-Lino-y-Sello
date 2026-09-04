// packages/sections/src/sections/RsvpSection.tsx — tipo `rsvp` (01 §3.1, 04 §5.2).
//
// **Frontera dura (04 §15.6, §8.1, §8.7 — NO negociable):** el formulario de RSVP funcional NO
// se implementa aquí. Este componente pinta el CONTENEDOR, el texto (nota, fecha límite, admite
// niños/jóvenes) y la LLAMADA A LA ACCIÓN — la superficie con la que el invitado actúa, así que
// es la más clara y apetecible de pulsar de toda la invitación. La isla real de RSVP se monta
// DESPUÉS, fuera de `packages/sections` (que no puede importar `next/dynamic` — `04 §19.3`
// prohíbe `next/*` salvo `next/image`), usando el gancho DOM estable que este componente deja
// (`#rsvp-mount-{section.key}` / `data-rsvp-mount`; detalle exacto en `handoffs/3-2c.md`).
//
// En `mode:"canvas"` la llamada a la acción es INERTE: el lienzo no tiene `allow-forms` (04 §8.1
// tabla), así que un control que pareciera funcionar mentiría. Se pinta como texto no interactivo
// (`aria-disabled`, `tabIndex={-1}`, sin `href` ni manejadores) con una nota que explica por qué.
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef, RenderMode } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import { SCALAR_BLOCK_COMPONENTS } from "../blocks/dispatch.ts";
import { ImageBlock } from "../blocks/ImageBlock.tsx";
import { activationAttrs } from "../blocks/activation.ts";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import styles from "../styles/RsvpSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.rsvp;
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

interface BooleanChipProps {
  readonly block: ComposedBlock;
  readonly sectionKey: string;
  readonly mode: RenderMode;
  readonly onActivate: ((ref: BlockRef) => void) | undefined;
  readonly pending: ReadonlySet<string> | undefined;
  readonly whenTrue: string;
  readonly whenFalse: string;
}

/** Redacta el estado del booleano en es-MX (en vez del "Sí"/"No" genérico de `BooleanBlock`),
 *  conservando el click-to-select real (mismos `activationAttrs` que usa cada bloque). */
function BooleanChip({ block, sectionKey, mode, onActivate, pending, whenTrue, whenFalse }: BooleanChipProps) {
  if (block.value === null || block.value.kind !== "boolean") return null; // R2
  const ref_: BlockRef = { sectionKey, blockId: block.id };
  const attrs = activationAttrs(mode, ref_, onActivate, mode === "canvas" ? (pending?.has(block.id) ?? false) : undefined);
  return (
    <span className={styles.chip} {...attrs}>
      {block.value.value ? whenTrue : whenFalse}
    </span>
  );
}

export function RsvpSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[RsvpSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = blockByRole(section.blocks, "sectionTitle");
  const introBlock = blockByRole(section.blocks, "sectionIntro");
  const noteBlock = blockByRole(section.blocks, "rsvpNote");
  const kidsNoteBlock = blockByRole(section.blocks, "rsvpKidsNote");
  const deadlineBlock = blockByRole(section.blocks, "rsvpDeadline");
  const childrenAllowedBlock = blockByRole(section.blocks, "rsvpChildrenAllowed");
  const youngAllowedBlock = blockByRole(section.blocks, "rsvpYoungAllowed");
  const backgroundBlock = blockByRole(section.blocks, "rsvpBackground") ?? blockByRole(section.blocks, "sectionBackground");
  const decorativeBlock = blockByRole(section.blocks, "decorative");

  const titleNode =
    titleBlock !== undefined && !isComposedGroup(titleBlock)
      ? renderScalar(titleBlock, section.key, mode, onActivate, pending)
      : null;

  const hasDeadline =
    deadlineBlock !== undefined && !isComposedGroup(deadlineBlock) && deadlineBlock.value !== null;

  const mountId = `rsvp-mount-${section.key}`;
  const ctaLabel = "Confirmar asistencia";

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="rsvp"
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
      <div className={styles.veil} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.content}>
          <span className={styles.ornament} aria-hidden="true" />
          <h2 id={headingId} className={styles.heading}>
            {titleNode ?? section.title}
          </h2>
          {introBlock !== undefined && !isComposedGroup(introBlock) ? (
            <div className={styles.intro}>{renderScalar(introBlock, section.key, mode, onActivate, pending)}</div>
          ) : null}

          {hasDeadline || childrenAllowedBlock !== undefined || youngAllowedBlock !== undefined ? (
            <div className={styles.meta}>
              {hasDeadline && !isComposedGroup(deadlineBlock!) ? (
                <span className={styles.chip}>
                  Confirma antes del {renderScalar(deadlineBlock as ComposedBlock, section.key, mode, onActivate, pending)}
                </span>
              ) : null}
              {childrenAllowedBlock !== undefined && !isComposedGroup(childrenAllowedBlock) ? (
                <BooleanChip
                  block={childrenAllowedBlock}
                  sectionKey={section.key}
                  mode={mode}
                  onActivate={onActivate}
                  pending={pending}
                  whenTrue="Este evento admite niños"
                  whenFalse="Evento solo para adultos"
                />
              ) : null}
              {youngAllowedBlock !== undefined && !isComposedGroup(youngAllowedBlock) ? (
                <BooleanChip
                  block={youngAllowedBlock}
                  sectionKey={section.key}
                  mode={mode}
                  onActivate={onActivate}
                  pending={pending}
                  whenTrue="Jóvenes bienvenidos"
                  whenFalse="Evento solo para adultos mayores de edad"
                />
              ) : null}
            </div>
          ) : null}

          {noteBlock !== undefined && !isComposedGroup(noteBlock) ? (
            <div className={styles.note}>{renderScalar(noteBlock, section.key, mode, onActivate, pending)}</div>
          ) : null}
          {kidsNoteBlock !== undefined && !isComposedGroup(kidsNoteBlock) ? (
            <div className={styles.note}>{renderScalar(kidsNoteBlock, section.key, mode, onActivate, pending)}</div>
          ) : null}
        </div>

        <div className={styles.ctaRow}>
          {mode === "canvas" ? (
            <>
              <span className={`${styles.cta} ${styles.ctaInert}`} aria-disabled="true" tabIndex={-1}>
                {ctaLabel}
              </span>
              <p className={styles.ctaCaption}>
                El formulario se activa en la invitación publicada (el lienzo no envía datos).
              </p>
            </>
          ) : (
            <a className={styles.cta} href={`#${mountId}`}>
              {ctaLabel}
            </a>
          )}
        </div>
      </div>

      {/* Gancho DOM estable para la isla de RSVP (04 §15.6) — `apps/web` la monta aquí por
       * portal/hidratación selectiva; `packages/sections` no sabe nada de su contenido. */}
      <div id={mountId} className={styles.mountSlot} data-rsvp-mount={section.key} />

      {decorativeBlock !== undefined && !isComposedGroup(decorativeBlock) && decorativeBlock.value !== null ? (
        <ImageBlock
          block={decorativeBlock}
          mode={mode}
          onActivate={onActivate}
          ref_={{ sectionKey: section.key, blockId: decorativeBlock.id }}
          pending={mode === "canvas" ? (pending?.has(decorativeBlock.id) ?? false) : false}
        />
      ) : null}
    </section>
  );
}
