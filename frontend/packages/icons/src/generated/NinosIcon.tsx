// Generado por scripts/generar.ts a partir de svg/ninos.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const NinosIcon = forwardRef<SVGSVGElement, IconoProps>(function NinosIcon(
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
      <rect x="5" y="7" width="14" height="12" rx="2.5" fill="var(--tono)"/><rect x="5" y="7" width="14" height="12" rx="2.5"/><path fill="currentColor" stroke="none" d="M12 9.3 L13 12 L15.8 12 L13.5 13.8 L14.3 16.6 L12 14.9 L9.7 16.6 L10.5 13.8 L8.2 12 L11 12 Z"/>
    </svg>
  );
});
NinosIcon.displayName = "NinosIcon";
