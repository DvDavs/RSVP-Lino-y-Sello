// GENERADO por scripts/generar.ts a partir de svg/xv-anos.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoXvAnos = forwardRef<SVGSVGElement, IconProps>(function IconoXvAnos(
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
      <path fill="var(--tono)" stroke="none" d="M4.5 18 L3 8.5 L8 12 L12 5.5 L16 12 L21 8.5 L19.5 18 Z"/><path d="M4.5 18 L3 8.5 L8 12 L12 5.5 L16 12 L21 8.5 L19.5 18 Z"/><path d="M4.5 18 H19.5 V20 a1 1 0 0 1-1 1 H5.5 a1 1 0 0 1-1-1 Z"/><circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
});
