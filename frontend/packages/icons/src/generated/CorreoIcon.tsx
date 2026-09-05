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
      style={{ ...(style ?? {}), "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor" } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M3 8.5 L12 14 L21 8.5 V7.5 a2.5 2.5 0 0 0-2.5-2.5 H5.5 A2.5 2.5 0 0 0 3 7.5 Z"/><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 8.5 L12 14 L21 8.5"/>
    </svg>
  );
});
