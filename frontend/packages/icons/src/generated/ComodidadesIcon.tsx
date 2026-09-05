// GENERADO por scripts/generar.ts a partir de svg/comodidades.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoComodidades = forwardRef<SVGSVGElement, IconProps>(function IconoComodidades(
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
      <path d="M12 3.5 L14.6 9.4 L21 10.1 L16.2 14.4 L17.6 20.7 L12 17.3 L6.4 20.7 L7.8 14.4 L3 10.1 L9.4 9.4 Z" fill="var(--tono)"/>
    </svg>
  );
});
