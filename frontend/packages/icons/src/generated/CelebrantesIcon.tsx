// GENERADO por scripts/generar.ts a partir de svg/celebrantes.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoCelebrantes = forwardRef<SVGSVGElement, IconProps>(function IconoCelebrantes(
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
      <circle cx="8.5" cy="8" r="2.6" fill="var(--tono)"/><path d="M3.5 20 C3.5 15.7 5.7 13.3 8.5 13.3 S13.5 15.7 13.5 20" fill="var(--tono)" stroke="none"/><circle cx="15.5" cy="9.5" r="2.6"/><path d="M10.2 20.5 C10.2 16.3 12.5 13.9 15.5 13.9 S20.8 16.3 20.8 20.5" fill="var(--ui-surface-raised)"/>
    </svg>
  );
});
