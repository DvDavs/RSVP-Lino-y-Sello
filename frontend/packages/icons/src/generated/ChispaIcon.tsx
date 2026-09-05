// GENERADO por scripts/generar.ts a partir de svg/chispa.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoChispa = forwardRef<SVGSVGElement, IconProps>(function IconoChispa(
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
      <path fill="var(--tono)" stroke="none" d="M12 3 C12.7 8.2 15.8 11.3 21 12 C15.8 12.7 12.7 15.8 12 21 C11.3 15.8 8.2 12.7 3 12 C8.2 11.3 11.3 8.2 12 3 Z"/><path d="M12 3 C12.7 8.2 15.8 11.3 21 12 C15.8 12.7 12.7 15.8 12 21 C11.3 15.8 8.2 12.7 3 12 C8.2 11.3 11.3 8.2 12 3 Z"/><circle cx="19" cy="5" r="1.1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
