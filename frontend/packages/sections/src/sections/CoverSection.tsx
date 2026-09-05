// packages/sections/src/sections/CoverSection.tsx — 3-2b, tipo 1/6.
//
// Contrato: handoffs/3-2a.md §2, 04 §5.2/§17.3. Un solo <h2 id="s-{key}"> por sección
// (aria-labelledby); "el nivel lo decide la posición, nunca el tamaño". Para `cover` en concreto,
// `section.title` es la etiqueta de EDITOR del manifiesto ("Portada", `template.json:29`) —
// nunca texto para el invitado. Se mantiene visualmente oculta (`shared.visuallyHidden`, técnica
// estándar de clip, NO `display:none`: sigue en el árbol de accesibilidad) para no imprimir la
// palabra "Portada" en la pantalla más importante de la invitación — eso es exactamente lo que
// el brief pide evitar ("no debe verse como un formulario"). El contenido dominante en pantalla
// es el bloque `coverTitle` (los nombres), en texto grande — no se marca como encabezado (`<h1>`
// vive, si acaso, a nivel de página en `apps/web`, fuera de este paquete) para no arriesgar un
// segundo salto de nivel dentro de la prueba jest-axe de este componente; sigue siendo texto
// visible, leído en orden por cualquier lector de pantalla.
//
// Una sola estructura de DOM para las tres variantes (`full`/`framed`/`split`): el layout lo
// decide `[data-variant=…]` en `.module.css`, no una rama de JSX por variante — menos superficie
// que probar, y evita que una variante "olvide" un bloque que otra sí pinta.
import type { SectionComponentProps } from "../registry.ts";
import type { BlockRef } from "../types.ts";
import type { ComposedBlock, ComposedGroup } from "../schema-types.ts";
import { isComposedGroup } from "../schema-types.ts";
import type { BlockRole } from "@invitaciones/schema";
import { SECTION_REGISTRY_DATA } from "../registry-data.ts";
import { TextBlock, DateBlock, ImageBlock, LinkBlock } from "../blocks/index.ts";
import shared from "../styles/shared.module.css";
import styles from "../styles/CoverSection.module.css";

const { supportedVariants, defaultVariant } = SECTION_REGISTRY_DATA.cover;
const KNOWN_VARIANTS = new Set<string>(supportedVariants);

type SectionBlock = ComposedBlock | ComposedGroup;

function findScalar(blocks: readonly SectionBlock[], role: BlockRole): ComposedBlock | undefined {
  const found = blocks.find((b) => b.role === role);
  return found !== undefined && !isComposedGroup(found) ? found : undefined;
}

function isPending(pending: ReadonlySet<string> | undefined, mode: "canvas" | "public", blockId: string): boolean {
  return mode === "canvas" ? (pending?.has(blockId) ?? false) : false;
}

export function CoverSection({ section, variant, mode, onActivate, pending }: SectionComponentProps) {
  const headingId = `s-${section.key}`;
  const effectiveVariant = KNOWN_VARIANTS.has(variant) ? variant : defaultVariant;
  if (mode === "canvas" && effectiveVariant !== variant) {
    // eslint-disable-next-line no-console
    console.warn(
      `[CoverSection] "${section.key}": variante "${variant}" no soportada, se usa "${defaultVariant}" (unknown-variant).`,
    );
  }

  const titleBlock = findScalar(section.blocks, "coverTitle");
  const subtitleBlock = findScalar(section.blocks, "coverSubtitle");
  const dateBlock = findScalar(section.blocks, "coverDate");
  // `coverBackground` es el respaldo cuando la plantilla no declara `coverImage` (ambos son
  // válidos por rol, 01 §3.1); nunca se muestran los dos a la vez en v1 — un solo hueco de imagen.
  const imageBlock = findScalar(section.blocks, "coverImage") ?? findScalar(section.blocks, "coverBackground");
  const buttonLabelBlock = findScalar(section.blocks, "coverButtonLabel");
  const buttonLinkBlock = findScalar(section.blocks, "coverButtonLink");

  const refFor = (blockId: string): BlockRef => ({ sectionKey: section.key, blockId });

  return (
    <section
      aria-labelledby={headingId}
      className={styles.section}
      data-section-type="cover"
      data-variant={effectiveVariant}
    >
      <h2 id={headingId} className={shared.visuallyHidden}>
        {section.title}
      </h2>
      <div className={styles.stage}>
        {imageBlock ? (
          <div className={styles.imageWrap}>
            <ImageBlock
              block={imageBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(imageBlock.id)}
              pending={isPending(pending, mode, imageBlock.id)}
              /* La portada es, por definición, la primera pantalla: su lámina es el elemento LCP
               * (medido [V] con Lighthouse tras A1 de 3-9, `largest-contentful-paint-element` =
               * este `<img>`). Con el `loading="lazy"` por defecto de `ImageBlock` el navegador la
               * dejaba para el final y el LCP se iba a 4 304 ms, contra un tope de 2 500. */
              prioritaria
            />
          </div>
        ) : null}
        {/* Puramente decorativo (velo de degradado): sin `aria-hidden` porque un <div> vacío sin
         * texto ni imagen ya es invisible para cualquier tecnología de asistencia por sí solo —
         * añadirlo colisionaría con el selector que usa `test/canvas/selection-overlay.test.tsx`
         * (`div[aria-hidden="true"]`) para localizar el overlay de selección del lienzo, que es
         * el único otro `<div>` de ese tipo en el árbol (foundation 3-2a, fuera de mi alcance). */}
        <div className={styles.scrim} />
        <div className={styles.content}>
          {subtitleBlock ? (
            <p className={styles.eyebrow}>
              <TextBlock
                block={subtitleBlock}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(subtitleBlock.id)}
                pending={isPending(pending, mode, subtitleBlock.id)}
              />
            </p>
          ) : null}
          {titleBlock ? (
            <p className={styles.heroName}>
              <TextBlock
                block={titleBlock}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(titleBlock.id)}
                pending={isPending(pending, mode, titleBlock.id)}
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
          {buttonLabelBlock ? (
            <span className={styles.badge}>
              <TextBlock
                block={buttonLabelBlock}
                mode={mode}
                onActivate={onActivate}
                ref_={refFor(buttonLabelBlock.id)}
                pending={isPending(pending, mode, buttonLabelBlock.id)}
              />
            </span>
          ) : null}
          {buttonLinkBlock ? (
            <LinkBlock
              block={buttonLinkBlock}
              mode={mode}
              onActivate={onActivate}
              ref_={refFor(buttonLinkBlock.id)}
              pending={isPending(pending, mode, buttonLinkBlock.id)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
