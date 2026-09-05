// GENERADO por scripts/generar.ts a partir de svg/rehacer.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoRehacer = forwardRef<SVGSVGElement, IconProps>(function IconoRehacer(
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
      <path d="M20 11 H9 A5 5 0 0 0 9 21 H13 V19 H9 A3 3 0 0 1 9 13 H20 Z" fill="var(--tono)" stroke="none"/><path d="M16 7 L20 11 L16 15"/><path d="M20 11 H9 A5 5 0 0 0 9 21 H13"/>
    </svg>
  );
});
