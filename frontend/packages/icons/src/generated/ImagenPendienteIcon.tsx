// GENERADO por scripts/generar.ts a partir de svg/imagen-pendiente.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoImagenPendiente = forwardRef<SVGSVGElement, IconProps>(function IconoImagenPendiente(
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
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ ...(style ?? {}), "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor" } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="5" width="18" height="14" rx="3" strokeDasharray="2.2 2.6"/><path fill="var(--tono)" stroke="none" d="M3.5 18.5 L8.5 12 L12.5 16 L15 13.5 L20.5 18.5 Z"/><path d="M3.5 18 L8.5 12 L12.5 16 L15 13.5 L20.5 18.5" strokeDasharray="2.2 2.6"/><circle cx="16.5" cy="9" r="1.75" fill="currentColor" stroke="none"/>
    </svg>
  );
});
