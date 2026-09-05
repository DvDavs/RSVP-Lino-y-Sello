// GENERADO por scripts/generar.ts a partir de svg/sugerencias.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoSugerencias = forwardRef<SVGSVGElement, IconProps>(function IconoSugerencias(
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
      <path d="M8 14.5 C6 13 5.3 10.7 6.2 8.5 C7.1 6.3 9.4 5 12 5 S16.9 6.3 17.8 8.5 C18.7 10.7 18 13 16 14.5 C15.3 15 15 15.7 15 16.5 V17 H9 V16.5 C9 15.7 8.7 15 8 14.5 Z" fill="var(--tono)"/><path d="M12 8.7 V12.4"/><path d="M10 17.5 H14"/><path d="M9.5 20 H14.5"/>
    </svg>
  );
});
