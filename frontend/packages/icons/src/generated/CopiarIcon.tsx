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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M4.5 7.5 A2.5 2.5 0 0 1 7 5 H17 A2.5 2.5 0 0 1 19.5 7.5 V18 A2.5 2.5 0 0 1 17 20.5 H7 A2.5 2.5 0 0 1 4.5 18 Z"/><path d="M9 5 H7 A2.5 2.5 0 0 0 4.5 7.5 V18 A2.5 2.5 0 0 0 7 20.5 H17 A2.5 2.5 0 0 0 19.5 18 V7.5 A2.5 2.5 0 0 0 17 5 H15"/><path d="M9.5 5.5 A1.4 1.4 0 0 1 10.9 3.5 H13.1 A1.4 1.4 0 0 1 14.5 5.5 V6.4 H9.5 Z" fill="var(--ui-surface-raised)"/><path d="M8.5 11.5 H15.5 M8.5 15 H13"/>
    </svg>
  );
});
