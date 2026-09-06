// GENERADO por scripts/generar.ts a partir de svg/portada.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoPortada = forwardRef<SVGSVGElement, IconProps>(function IconoPortada(
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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="4" width="18" height="16" rx="2" fill="var(--tono)"/><circle cx="8.5" cy="9.5" r="1.6" fill="var(--ui-surface-raised)"/><path d="M4.5 17 L9.5 12.5 L13 15.5 L15.5 13 L19.5 17"/>
    </svg>
  );
});
