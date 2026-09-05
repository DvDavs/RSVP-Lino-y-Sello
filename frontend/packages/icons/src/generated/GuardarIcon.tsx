// GENERADO por scripts/generar.ts a partir de svg/guardar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoGuardar = forwardRef<SVGSVGElement, IconProps>(function IconoGuardar(
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
      <path d="M5.5 4.5 H15.5 L19 8 V18.5 A1 1 0 0 1 18 19.5 H6 A1 1 0 0 1 5 18.5 V5.5 A1 1 0 0 1 5.5 4.5 Z"/><rect x="9" y="5" width="5" height="3.5" rx="0.5"/><rect x="7.5" y="12.5" width="9" height="7" rx="0.5" fill="var(--tono)"/>
    </svg>
  );
});
