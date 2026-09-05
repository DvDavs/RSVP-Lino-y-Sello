// Generado por scripts/generar.ts a partir de svg/cumpleanos.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CumpleanosIcon = forwardRef<SVGSVGElement, IconoProps>(function CumpleanosIcon(
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
      className={className}
      style={{ ["--tono" as string]: tone === "mono" ? "currentColor" : "var(--ui-primary-soft)", ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M4 14 H20 V19 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 Z"/><path d="M4 14 H20 V19 a2 2 0 0 1-2 2 H6 a2 2 0 0 1-2-2 Z"/><path d="M6 14 V11.5 A1.5 1.5 0 0 1 7.5 10 H16.5 A1.5 1.5 0 0 1 18 11.5 V14"/><path d="M4 16.5 c1.5 1.2 3 1.2 4.5 0 c1.5 1.2 3 1.2 4.5 0 c1.5 1.2 3 1.2 4.5 0 c1 0.8 2 1 2.5 0.6"/><path d="M12 10 V6.8"/><path d="M12 2.8 c1.2 1.3 1.2 2.7 0 4 c-1.2-1.3-1.2-2.7 0-4 Z" fill="var(--tono)"/>
    </svg>
  );
});
CumpleanosIcon.displayName = "CumpleanosIcon";
