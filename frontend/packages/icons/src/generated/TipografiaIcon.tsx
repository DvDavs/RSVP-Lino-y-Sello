// GENERADO por scripts/generar.ts a partir de svg/tipografia.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoTipografia = forwardRef<SVGSVGElement, IconProps>(function IconoTipografia(
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
      <path d="M8 18.5 L11.4 6.5 A0.9 0.9 0 0 1 13.2 6.5 L16 18.5"/><path d="M9.4 13.5 H14.6"/><path d="M5.5 21 H18.5"/>
    </svg>
  );
});
