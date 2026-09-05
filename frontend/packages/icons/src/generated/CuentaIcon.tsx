// Generado por scripts/generar.ts a partir de svg/cuenta.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const CuentaIcon = forwardRef<SVGSVGElement, IconoProps>(function CuentaIcon(
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
      <circle cx="12" cy="12" r="8.5" fill="var(--tono)"/><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="9.8" r="2.8"/><path d="M6.3 18 C6.9 14.8 9.1 13 12 13 S17.1 14.8 17.7 18"/>
    </svg>
  );
});
CuentaIcon.displayName = "CuentaIcon";
