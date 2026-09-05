// Generado por scripts/generar.ts a partir de svg/xv-anos.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const XvAnosIcon = forwardRef<SVGSVGElement, IconoProps>(function XvAnosIcon(
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
      <path fill="var(--tono)" stroke="none" d="M4.5 18 L3 8.5 L8 12 L12 5.5 L16 12 L21 8.5 L19.5 18 Z"/><path d="M4.5 18 L3 8.5 L8 12 L12 5.5 L16 12 L21 8.5 L19.5 18 Z"/><path d="M4.5 18 H19.5 V20 a1 1 0 0 1-1 1 H5.5 a1 1 0 0 1-1-1 Z"/><circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
  );
});
XvAnosIcon.displayName = "XvAnosIcon";
