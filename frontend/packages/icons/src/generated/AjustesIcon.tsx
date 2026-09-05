// GENERADO por scripts/generar.ts a partir de svg/ajustes.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoAjustes = forwardRef<SVGSVGElement, IconProps>(function IconoAjustes(
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
      <path d="M4 7 H20"/><circle cx="9" cy="7" r="2" fill="var(--tono)"/><path d="M4 12 H20"/><circle cx="15" cy="12" r="2" fill="var(--tono)"/><path d="M4 17 H20"/><circle cx="11" cy="17" r="2" fill="var(--tono)"/>
    </svg>
  );
});
