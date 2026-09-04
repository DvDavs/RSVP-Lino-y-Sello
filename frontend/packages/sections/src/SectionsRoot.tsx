// packages/sections/src/SectionsRoot.tsx — recorre composed.sections y despacha por el registro.
// "SectionsRoot NO despacha bloques: cada componente de sección coloca sus huecos por rol" (04
// §5.2) — este componente solo decide QUÉ componente de sección usar para cada `type`, con qué
// `variant` (la efectiva la resuelve el propio componente, regla 2 de §5.2) y le pasa las props.
import { useRef } from "react";
import type { ComposedDocument } from "@invitaciones/schema";
import type { BlockRef, RenderMode } from "./types.ts";
import { sectionRegistry } from "./registry.ts";
import { useCanvasOptional } from "./canvas/CanvasContext.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";
import { SelectionOverlay } from "./canvas/SelectionOverlay.tsx";
import styles from "./SectionsRoot.module.css";

export interface SectionsRootProps {
  readonly composed: ComposedDocument;
  readonly mode: RenderMode;
  /** Nonce de CSP para el `<style>` del tema (04 §17/handoffs/3-0b.md §1) — obligatorio dentro del lienzo. */
  readonly nonce?: string;
  /**
   * Overrides directos de estado de canvas (útiles en pruebas de componente, sin montar un
   * `CanvasProvider`). Si se omiten y hay un `CanvasProvider` por encima, se toman de ahí.
   */
  readonly selected?: BlockRef | null;
  readonly onActivate?: (ref: BlockRef) => void;
  readonly pending?: ReadonlySet<string>;
}

export function SectionsRoot({
  composed,
  mode,
  nonce,
  selected: selectedProp,
  onActivate: onActivateProp,
  pending: pendingProp,
}: SectionsRootProps) {
  const canvas = useCanvasOptional();
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = mode === "canvas" ? (selectedProp ?? canvas?.selected ?? null) : null;
  const onActivate = mode === "canvas" ? (onActivateProp ?? canvas?.onActivate) : undefined;
  const pending = mode === "canvas" ? (pendingProp ?? canvas?.pending) : undefined;

  const visibleSections = composed.sections.filter((section) => section.visible);

  return (
    <ThemeProvider theme={composed.theme} nonce={nonce}>
      <div ref={containerRef} className={styles.root} lang={composed.locale}>
        {visibleSections.map((section) => {
          const entry = sectionRegistry[section.type];
          const Component = entry.component;
          return (
            <Component
              key={section.key}
              section={section}
              variant={section.variant}
              mode={mode}
              selected={selected}
              onActivate={onActivate}
              pending={pending}
            />
          );
        })}
        {mode === "canvas" ? <SelectionOverlay containerRef={containerRef} /> : null}
      </div>
    </ThemeProvider>
  );
}
