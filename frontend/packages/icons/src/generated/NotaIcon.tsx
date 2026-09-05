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
      style={{ ...(style ?? {}), "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor" } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M5.5 4 H14.5 L18.5 8 V18.5 A1.5 1.5 0 0 1 17 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V5.5 A1.5 1.5 0 0 1 5.5 4 Z"/><path d="M5.5 4 H14.5 L18.5 8 V18.5 A1.5 1.5 0 0 1 17 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V5.5 A1.5 1.5 0 0 1 5.5 4 Z"/><path d="M14.5 4 V6.5 A1.5 1.5 0 0 0 16 8 H18.5"/><path d="M7.5 12 H15 M7.5 15.5 H12.5"/>
    </svg>
  );
});
