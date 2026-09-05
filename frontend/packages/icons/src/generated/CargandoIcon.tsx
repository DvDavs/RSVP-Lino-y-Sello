// Generado por scripts/generar.ts a partir de svg/cargando.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CargandoIcon = forwardRef<SVGSVGElement, IconoProps>(function CargandoIcon(
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
      <path d="M12 3.5 A8.5 8.5 0 1 1 4.4 8.1"/><circle cx="12" cy="3.5" r="1.3" fill="var(--tono)" stroke="none"/>
    </svg>
  );
});
CargandoIcon.displayName = "CargandoIcon";
