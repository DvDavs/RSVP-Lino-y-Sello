// GENERADO por scripts/generar.ts a partir de svg/comunion.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoComunion = forwardRef<SVGSVGElement, IconProps>(function IconoComunion(
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
      <circle cx="12" cy="5.9" r="3.2" fill="var(--tono)"/><path d="M4.5 10.5 H19.5 A7.5 7.5 0 0 1 4.5 10.5 Z" fill="var(--tono)"/><path d="M12 18 V19.8"/><path d="M8 20.8 H16"/>
    </svg>
  );
});
