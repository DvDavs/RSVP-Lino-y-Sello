// Generado por scripts/generar.ts a partir de svg/aviso.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (`pnpm --filter @invitaciones/icons run generar`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const AvisoIcon = forwardRef<SVGSVGElement, IconoProps>(function AvisoIcon(
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
      <path fill="var(--tono)" stroke="none" d="M12 3.8c.35 0 .68.2.86.52l8.4 14.9c.35.63-.1 1.4-.82 1.4H4.56c-.72 0-1.17-.77-.82-1.4l8.4-14.9c.18-.32.51-.52.86-.52Z"/><path d="M12 3.8c.35 0 .68.2.86.52l8.4 14.9c.35.63-.1 1.4-.82 1.4H4.56c-.72 0-1.17-.77-.82-1.4l8.4-14.9c.18-.32.51-.52.86-.52Z"/><path d="M12 9.3 V13.6"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
AvisoIcon.displayName = "AvisoIcon";
