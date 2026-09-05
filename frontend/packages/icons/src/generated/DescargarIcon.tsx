// GENERADO por scripts/generar.ts a partir de svg/descargar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoDescargar = forwardRef<SVGSVGElement, IconProps>(function IconoDescargar(
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
      <path d="M12 3.5 V14.5 M8 11 L12 15 L16 11"/><path fill="var(--tono)" stroke="none" d="M4 15.5 H20 V18.5 A2 2 0 0 1 18 20.5 H6 A2 2 0 0 1 4 18.5 Z"/><path d="M4 15.5 H20 V18.5 A2 2 0 0 1 18 20.5 H6 A2 2 0 0 1 4 18.5 Z"/>
    </svg>
  );
});
