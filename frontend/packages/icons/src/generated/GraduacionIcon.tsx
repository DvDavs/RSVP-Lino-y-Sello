// GENERADO por scripts/generar.ts a partir de svg/graduacion.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoGraduacion = forwardRef<SVGSVGElement, IconProps>(function IconoGraduacion(
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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M12 4.5 L21 9 L12 13.5 L3 9 Z"/><path d="M12 4.5 L21 9 L12 13.5 L3 9 Z"/><path d="M7 11.2 V15.2 C7 16.7 9.3 18 12 18 S17 16.7 17 15.2 V11.2"/><path d="M21 9 V14.5"/><circle cx="21" cy="15.8" r="1.1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
