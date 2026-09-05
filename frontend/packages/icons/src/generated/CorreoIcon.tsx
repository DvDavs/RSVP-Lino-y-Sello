// GENERADO por scripts/generar.ts a partir de svg/correo.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoCorreo = forwardRef<SVGSVGElement, IconProps>(function IconoCorreo(
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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M3 10 L12 4 L21 10 V18 A2 2 0 0 1 19 20 H5 A2 2 0 0 1 3 18 Z"/><path d="M3 10 L12 4 L21 10 V18 A2 2 0 0 1 19 20 H5 A2 2 0 0 1 3 18 Z"/><path d="M3 10 L11.2 15.6 A1.4 1.4 0 0 0 12.8 15.6 L21 10"/>
    </svg>
  );
});
