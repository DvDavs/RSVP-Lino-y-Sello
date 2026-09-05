// Generado por scripts/generar.ts a partir de svg/reloj.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const RelojIcon = forwardRef<SVGSVGElement, IconoProps>(function RelojIcon(
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
      <circle cx="12" cy="12.5" r="8.5" fill="var(--tono)"/><circle cx="12" cy="12.5" r="8.5"/><path d="M12 8 V12.5 L15.2 14.7"/>
    </svg>
  );
});
RelojIcon.displayName = "RelojIcon";
