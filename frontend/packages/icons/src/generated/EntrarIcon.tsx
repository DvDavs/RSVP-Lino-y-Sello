// Generado por scripts/generar.ts a partir de svg/entrar.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const EntrarIcon = forwardRef<SVGSVGElement, IconoProps>(function EntrarIcon(
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
      <path fill="var(--tono)" stroke="none" d="M15 4.5 H18.5 A1.5 1.5 0 0 1 20 6 V18 A1.5 1.5 0 0 1 18.5 19.5 H15 V4.5 Z"/><path d="M15 4.5 H18.5 A1.5 1.5 0 0 1 20 6 V18 A1.5 1.5 0 0 1 18.5 19.5 H15"/><path d="M13 12 H4 M7.5 8.5 L4 12 L7.5 15.5"/>
    </svg>
  );
});
EntrarIcon.displayName = "EntrarIcon";
