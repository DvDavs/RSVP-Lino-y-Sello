// GENERADO por scripts/generar.ts a partir de svg/copiar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoCopiar = forwardRef<SVGSVGElement, IconProps>(function IconoCopiar(
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
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" fill="var(--tono)"/><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><rect x="3.5" y="3.5" width="12" height="12" rx="2.5"/>
    </svg>
  );
});
