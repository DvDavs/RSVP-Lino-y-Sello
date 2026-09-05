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
      style={{ ...(style ?? {}), "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor" } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="6.5" r="3" fill="var(--tono)"/><circle cx="12" cy="6.5" r="3"/><path d="M12 5 V8 M10.5 6.5 H13.5"/><path fill="var(--tono)" stroke="none" d="M7.5 11 H16.5 L15 17.5 A3 3 0 0 1 12 20 A3 3 0 0 1 9 17.5 Z"/><path d="M7.5 11 H16.5 L15 17.5 A3 3 0 0 1 12 20 A3 3 0 0 1 9 17.5 Z"/><path d="M9.5 11 V9.5 A2.5 2.5 0 0 1 12 7 A2.5 2.5 0 0 1 14.5 9.5 V11"/>
    </svg>
  );
});
