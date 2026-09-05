// Generado por scripts/generar.ts a partir de svg/enlace.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const EnlaceIcon = forwardRef<SVGSVGElement, IconoProps>(function EnlaceIcon(
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
      <rect x="2.5" y="10" width="12" height="6.5" rx="3.25" transform="rotate(-45 8.5 13.25)" fill="var(--tono)"/><rect x="9.5" y="7.5" width="12" height="6.5" rx="3.25" transform="rotate(-45 15.5 10.75)"/>
    </svg>
  );
});
EnlaceIcon.displayName = "EnlaceIcon";
