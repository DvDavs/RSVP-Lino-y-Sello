// GENERADO por scripts/generar.ts a partir de svg/confirmar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoConfirmar = forwardRef<SVGSVGElement, IconProps>(function IconoConfirmar(
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
      <rect x="4" y="11" width="3" height="9" rx="1.2" fill="var(--tono)"/><rect x="4" y="11" width="3" height="9" rx="1.2"/><path d="M7 11 L10.3 4.6 A1.6 1.6 0 0 1 13.3 5.6 L12.3 10 H18 A2 2 0 0 1 19.9 12.6 L18.2 18.6 A2 2 0 0 1 16.3 20 H7 Z"/>
    </svg>
  );
});
