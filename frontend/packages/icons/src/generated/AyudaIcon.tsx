// GENERADO por scripts/generar.ts a partir de svg/ayuda.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoAyuda = forwardRef<SVGSVGElement, IconProps>(function IconoAyuda(
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
      <circle cx="12" cy="12" r="8.5" fill="var(--tono)"/><path d="M9.7 9.6 A2.3 2.3 0 1 1 12.6 13.4 C12 13.8 11.7 14.2 11.7 15"/><circle cx="11.9" cy="17.6" r="0.9" fill="currentColor" stroke="none"/>
    </svg>
  );
});
