// GENERADO por scripts/generar.ts a partir de svg/inicio.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoInicio = forwardRef<SVGSVGElement, IconProps>(function IconoInicio(
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
      <path d="M4 11.5 L12 4.5 L20 11.5 Z" fill="var(--tono)" stroke="none"/><path d="M4 11.5 L12 4.5 L20 11.5 V19 A1 1 0 0 1 19 20 H5 A1 1 0 0 1 4 19 Z"/><path d="M9.7 20 V16 A2.3 2.3 0 0 1 14.3 16 V20"/>
    </svg>
  );
});
