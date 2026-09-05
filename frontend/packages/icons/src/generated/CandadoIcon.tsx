// GENERADO por scripts/generar.ts a partir de svg/candado.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoCandado = forwardRef<SVGSVGElement, IconProps>(function IconoCandado(
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
      <path fill="var(--tono)" stroke="none" d="M5.5 11 H18.5 V19 A2 2 0 0 1 16.5 21 H7.5 A2 2 0 0 1 5.5 19 Z"/><path d="M5.5 11 H18.5 V19 A2 2 0 0 1 16.5 21 H7.5 A2 2 0 0 1 5.5 19 Z"/><path d="M8 11 V8 A4 4 0 0 1 16 8 V11"/><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
});
