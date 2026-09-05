// Generado por scripts/generar.ts a partir de svg/compartir.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CompartirIcon = forwardRef<SVGSVGElement, IconoProps>(function CompartirIcon(
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
      <path fill="var(--tono)" stroke="none" d="M4 6.5 A2.5 2.5 0 0 1 6.5 4 H17.5 A2.5 2.5 0 0 1 20 6.5 V13.5 A2.5 2.5 0 0 1 17.5 16 H10.5 L6 20 V16 A2.5 2.5 0 0 1 4 13.5 Z"/><path d="M4 6.5 A2.5 2.5 0 0 1 6.5 4 H17.5 A2.5 2.5 0 0 1 20 6.5 V13.5 A2.5 2.5 0 0 1 17.5 16 H10.5 L6 20 V16 A2.5 2.5 0 0 1 4 13.5 Z"/><path d="M9.5 12.5 L14.5 7.5 M11 7.5 H14.5 V11"/>
    </svg>
  );
});
CompartirIcon.displayName = "CompartirIcon";
