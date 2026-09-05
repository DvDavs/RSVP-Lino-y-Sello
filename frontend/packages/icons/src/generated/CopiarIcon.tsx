// Generado por scripts/generar.ts a partir de svg/copiar.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CopiarIcon = forwardRef<SVGSVGElement, IconoProps>(function CopiarIcon(
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
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" fill="var(--tono)"/><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><rect x="3.5" y="3.5" width="12" height="12" rx="2.5"/>
    </svg>
  );
});
CopiarIcon.displayName = "CopiarIcon";
