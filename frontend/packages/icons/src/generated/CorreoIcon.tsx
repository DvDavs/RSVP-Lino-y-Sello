// Generado por scripts/generar.ts a partir de svg/correo.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CorreoIcon = forwardRef<SVGSVGElement, IconoProps>(function CorreoIcon(
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
      <path fill="var(--tono)" stroke="none" d="M3 8.5 L12 14 L21 8.5 V7.5 a2.5 2.5 0 0 0-2.5-2.5 H5.5 A2.5 2.5 0 0 0 3 7.5 Z"/><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 8.5 L12 14 L21 8.5"/>
    </svg>
  );
});
CorreoIcon.displayName = "CorreoIcon";
