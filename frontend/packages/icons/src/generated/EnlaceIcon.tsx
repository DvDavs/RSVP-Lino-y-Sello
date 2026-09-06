// GENERADO por scripts/generar.ts a partir de svg/enlace.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoEnlace = forwardRef<SVGSVGElement, IconProps>(function IconoEnlace(
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
      <rect x="2.5" y="10" width="12" height="6.5" rx="3.25" transform="rotate(-45 8.5 13.25)" fill="var(--tono)"/><rect x="9.5" y="7.5" width="12" height="6.5" rx="3.25" transform="rotate(-45 15.5 10.75)"/>
    </svg>
  );
});
