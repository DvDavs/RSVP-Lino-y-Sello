// GENERADO por scripts/generar.ts a partir de svg/arrastrar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoArrastrar = forwardRef<SVGSVGElement, IconProps>(function IconoArrastrar(
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
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>
    </svg>
  );
});
