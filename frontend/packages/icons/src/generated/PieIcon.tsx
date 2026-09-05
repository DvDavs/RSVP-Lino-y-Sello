// Generado por scripts/generar.ts a partir de svg/pie.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const PieIcon = forwardRef<SVGSVGElement, IconoProps>(function PieIcon(
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
      <path fill="var(--tono)" stroke="none" d="M4.5 4.5 A1.5 1.5 0 0 1 6 3 H18 A1.5 1.5 0 0 1 19.5 4.5 V15.3 L17.5 14.1 L15.5 15.3 L13.5 14.1 L11.5 15.3 L9.5 14.1 L7.5 15.3 L6 14.4 L4.5 15.3 Z"/><path d="M4.5 4.5 A1.5 1.5 0 0 1 6 3 H18 A1.5 1.5 0 0 1 19.5 4.5 V15.3 L17.5 14.1 L15.5 15.3 L13.5 14.1 L11.5 15.3 L9.5 14.1 L7.5 15.3 L6 14.4 L4.5 15.3 Z"/><path d="M7.5 7.5 H16.5"/><path d="M7.5 10.5 H13.5"/>
    </svg>
  );
});
PieIcon.displayName = "PieIcon";
