// GENERADO por scripts/generar.ts a partir de svg/rechazar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoRechazar = forwardRef<SVGSVGElement, IconProps>(function IconoRechazar(
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
      <rect x="4" y="4" width="3" height="9" rx="1.2"/><path fill="var(--tono)" d="M7 13 L10.3 19.4 A1.6 1.6 0 0 0 13.3 18.4 L12.3 14 H18 A2 2 0 0 0 19.9 11.4 L18.2 5.4 A2 2 0 0 0 16.3 4 H7 Z"/>
    </svg>
  );
});
