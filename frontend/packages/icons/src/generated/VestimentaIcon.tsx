// GENERADO por scripts/generar.ts a partir de svg/vestimenta.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoVestimenta = forwardRef<SVGSVGElement, IconProps>(function IconoVestimenta(
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
      <path fill="var(--tono)" stroke="none" d="M12 9 L3.8 15.3 A1.5 1.5 0 0 0 4.7 18 H19.3 A1.5 1.5 0 0 0 20.2 15.3 Z"/><path d="M12 9 L3.8 15.3 A1.5 1.5 0 0 0 4.7 18 H19.3 A1.5 1.5 0 0 0 20.2 15.3 Z"/><path d="M12 9 V6.8 A1.8 1.8 0 1 1 13.8 5"/>
    </svg>
  );
});
