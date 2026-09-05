// GENERADO por scripts/generar.ts a partir de svg/borrar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoBorrar = forwardRef<SVGSVGElement, IconProps>(function IconoBorrar(
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
      <path d="M4 7 H20"/><path d="M9 7 V5.3 A1.3 1.3 0 0 1 10.3 4 H13.7 A1.3 1.3 0 0 1 15 5.3 V7"/><path d="M6 7 L7 19.5 A1.5 1.5 0 0 0 8.5 21 H15.5 A1.5 1.5 0 0 0 17 19.5 L18 7 Z" fill="var(--tono)"/><path d="M10 10.5 V17.5"/><path d="M14 10.5 V17.5"/>
    </svg>
  );
});
