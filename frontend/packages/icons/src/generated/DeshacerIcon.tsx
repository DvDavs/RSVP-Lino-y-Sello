// GENERADO por scripts/generar.ts a partir de svg/deshacer.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoDeshacer = forwardRef<SVGSVGElement, IconProps>(function IconoDeshacer(
  { size = 24, title, tone = "duo", className, style, ...resto },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M4 11 H15 A5 5 0 0 1 15 21 H11 V19 H15 A3 3 0 0 0 15 13 H4 Z"/><path d="M8 7 L4 11 L8 15"/><path d="M4 11 H15 A5 5 0 0 1 15 21 H11"/>
    </svg>
  );
});
