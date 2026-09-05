// GENERADO por scripts/generar.ts a partir de svg/mesa.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoMesa = forwardRef<SVGSVGElement, IconProps>(function IconoMesa(
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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <rect x="4" y="6" width="16" height="4" rx="1.5" fill="var(--tono)"/><rect x="4" y="6" width="16" height="4" rx="1.5"/><path d="M6.5 10 V19 M17.5 10 V19"/><path d="M4.5 19 H8.5 M15.5 19 H19.5"/>
    </svg>
  );
});
