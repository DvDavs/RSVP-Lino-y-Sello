// Generado por scripts/generar.ts a partir de svg/pago.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const PagoIcon = forwardRef<SVGSVGElement, IconoProps>(function PagoIcon(
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
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="var(--tono)"/><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 9.5 H21"/><rect x="5.5" y="13" width="5" height="2.4" rx="1"/>
    </svg>
  );
});
PagoIcon.displayName = "PagoIcon";
