// Generado por scripts/generar.ts a partir de svg/graduacion.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const GraduacionIcon = forwardRef<SVGSVGElement, IconoProps>(function GraduacionIcon(
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
      <path fill="var(--tono)" stroke="none" d="M12 4.5 L21 9 L12 13.5 L3 9 Z"/><path d="M12 4.5 L21 9 L12 13.5 L3 9 Z"/><path d="M7 11.2 V15.2 C7 16.7 9.3 18 12 18 S17 16.7 17 15.2 V11.2"/><path d="M21 9 V14.5"/><circle cx="21" cy="15.8" r="1.1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
GraduacionIcon.displayName = "GraduacionIcon";
