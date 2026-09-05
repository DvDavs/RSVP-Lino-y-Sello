// Generado por scripts/generar.ts a partir de svg/nota.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const NotaIcon = forwardRef<SVGSVGElement, IconoProps>(function NotaIcon(
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
      <path fill="var(--tono)" stroke="none" d="M5.5 4 H14.5 L18.5 8 V18.5 A1.5 1.5 0 0 1 17 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V5.5 A1.5 1.5 0 0 1 5.5 4 Z"/><path d="M5.5 4 H14.5 L18.5 8 V18.5 A1.5 1.5 0 0 1 17 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V5.5 A1.5 1.5 0 0 1 5.5 4 Z"/><path d="M14.5 4 V6.5 A1.5 1.5 0 0 0 16 8 H18.5"/><path d="M7.5 12 H15 M7.5 15.5 H12.5"/>
    </svg>
  );
});
NotaIcon.displayName = "NotaIcon";
