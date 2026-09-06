// GENERADO por scripts/generar.ts a partir de svg/nota.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoNota = forwardRef<SVGSVGElement, IconProps>(function IconoNota(
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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M6.25 4 H15.25 L19.25 8 V18.5 A1.5 1.5 0 0 1 17.75 20 H6.25 A1.5 1.5 0 0 1 4.75 18.5 V5.5 A1.5 1.5 0 0 1 6.25 4 Z"/><path d="M6.25 4 H15.25 L19.25 8 V18.5 A1.5 1.5 0 0 1 17.75 20 H6.25 A1.5 1.5 0 0 1 4.75 18.5 V5.5 A1.5 1.5 0 0 1 6.25 4 Z"/><path d="M15.25 4 V6.5 A1.5 1.5 0 0 0 16.75 8 H19.25"/><path d="M8.25 12 H15.75 M8.25 15.5 H13.25"/>
    </svg>
  );
});
