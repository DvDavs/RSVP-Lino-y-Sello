// Generado por scripts/generar.ts a partir de svg/boda.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const BodaIcon = forwardRef<SVGSVGElement, IconoProps>(function BodaIcon(
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
      <circle cx="9" cy="14" r="5.5" fill="var(--tono)"/><circle cx="15" cy="14" r="5.5"/><path d="M13 5.5 L15 3 L17 5.5 L15 8.5 Z" fill="var(--tono)"/>
    </svg>
  );
});
BodaIcon.displayName = "BodaIcon";
