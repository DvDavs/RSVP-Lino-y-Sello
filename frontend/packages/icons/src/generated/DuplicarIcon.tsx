// GENERADO por scripts/generar.ts a partir de svg/duplicar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoDuplicar = forwardRef<SVGSVGElement, IconProps>(function IconoDuplicar(
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
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="var(--tono)"/><rect x="4.5" y="4.5" width="11" height="11" rx="2" fill="var(--ui-surface-raised)"/>
    </svg>
  );
});
