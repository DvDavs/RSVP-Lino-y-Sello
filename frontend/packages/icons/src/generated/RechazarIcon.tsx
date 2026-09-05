// Generado por scripts/generar.ts a partir de svg/rechazar.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const RechazarIcon = forwardRef<SVGSVGElement, IconoProps>(function RechazarIcon(
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
      <rect x="4" y="4" width="3" height="9" rx="1.2" fill="var(--tono)"/><rect x="4" y="4" width="3" height="9" rx="1.2"/><path d="M7 13 L10.3 19.4 A1.6 1.6 0 0 0 13.3 18.4 L12.3 14 H18 A2 2 0 0 0 19.9 11.4 L18.2 5.4 A2 2 0 0 0 16.3 4 H7 Z"/>
    </svg>
  );
});
RechazarIcon.displayName = "RechazarIcon";
