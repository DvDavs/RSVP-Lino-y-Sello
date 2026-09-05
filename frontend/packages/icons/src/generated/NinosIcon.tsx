// GENERADO por scripts/generar.ts a partir de svg/ninos.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoNinos = forwardRef<SVGSVGElement, IconProps>(function IconoNinos(
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
      <rect x="5" y="7" width="14" height="12" rx="2.5" fill="var(--tono)"/><rect x="5" y="7" width="14" height="12" rx="2.5"/><path fill="currentColor" stroke="none" d="M12 9.3 L13 12 L15.8 12 L13.5 13.8 L14.3 16.6 L12 14.9 L9.7 16.6 L10.5 13.8 L8.2 12 L11 12 Z"/>
    </svg>
  );
});
