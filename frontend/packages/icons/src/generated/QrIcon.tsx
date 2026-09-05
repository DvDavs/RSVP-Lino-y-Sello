// Generado por scripts/generar.ts a partir de svg/qr.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const QrIcon = forwardRef<SVGSVGElement, IconoProps>(function QrIcon(
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="var(--tono)"/><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><rect x="6.5" y="6.5" width="4" height="4" rx="1"/><rect x="13.5" y="6.5" width="4" height="4" rx="1"/><rect x="6.5" y="13.5" width="4" height="4" rx="1"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>
    </svg>
  );
});
QrIcon.displayName = "QrIcon";
