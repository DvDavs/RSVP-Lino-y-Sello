// GENERADO por scripts/generar.ts a partir de svg/corporativo.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoCorporativo = forwardRef<SVGSVGElement, IconProps>(function IconoCorporativo(
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
      <path fill="var(--tono)" stroke="none" d="M3.5 9 A2 2 0 0 1 5.5 7 H18.5 A2 2 0 0 1 20.5 9 V17 A2 2 0 0 1 18.5 19 H5.5 A2 2 0 0 1 3.5 17 Z"/><rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M8.5 7 V5.5 A1.5 1.5 0 0 1 10 4 H14 A1.5 1.5 0 0 1 15.5 5.5 V7"/><path d="M3.5 12.5 H20.5"/>
    </svg>
  );
});
