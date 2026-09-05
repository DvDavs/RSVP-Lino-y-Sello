// Generado por scripts/generar.ts a partir de svg/mesa.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const MesaIcon = forwardRef<SVGSVGElement, IconoProps>(function MesaIcon(
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
      <rect x="4" y="6" width="16" height="4" rx="1.5" fill="var(--tono)"/><rect x="4" y="6" width="16" height="4" rx="1.5"/><path d="M6.5 10 V19 M17.5 10 V19"/><path d="M4.5 19 H8.5 M15.5 19 H19.5"/>
    </svg>
  );
});
MesaIcon.displayName = "MesaIcon";
