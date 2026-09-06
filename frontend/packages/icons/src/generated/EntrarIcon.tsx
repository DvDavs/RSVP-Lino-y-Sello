// GENERADO por scripts/generar.ts a partir de svg/entrar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoEntrar = forwardRef<SVGSVGElement, IconProps>(function IconoEntrar(
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
      <path fill="var(--tono)" stroke="none" d="M15 4.5 H18.5 A1.5 1.5 0 0 1 20 6 V18 A1.5 1.5 0 0 1 18.5 19.5 H15 V4.5 Z"/><path d="M15 4.5 H18.5 A1.5 1.5 0 0 1 20 6 V18 A1.5 1.5 0 0 1 18.5 19.5 H15"/><path d="M4 12 H13 M9.5 8.5 L13 12 L9.5 15.5"/>
    </svg>
  );
});
