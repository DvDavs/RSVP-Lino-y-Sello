// Generado por scripts/generar.ts a partir de svg/plan.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const PlanIcon = forwardRef<SVGSVGElement, IconoProps>(function PlanIcon(
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
      <path fill="var(--tono)" stroke="none" d="M4 5.5 A1.5 1.5 0 0 1 5.5 4 H13 L20 11 A1.5 1.5 0 0 1 20 13.1 L13.1 20 A1.5 1.5 0 0 1 11 20 L4 13 Z"/><path d="M4 5.5 A1.5 1.5 0 0 1 5.5 4 H13 L20 11 A1.5 1.5 0 0 1 20 13.1 L13.1 20 A1.5 1.5 0 0 1 11 20 L4 13 Z"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/>
    </svg>
  );
});
PlanIcon.displayName = "PlanIcon";
