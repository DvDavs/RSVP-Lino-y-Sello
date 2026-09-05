// GENERADO por scripts/generar.ts a partir de svg/lugar.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoLugar = forwardRef<SVGSVGElement, IconProps>(function IconoLugar(
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
      <path fill="var(--tono)" stroke="none" d="M12 21 C12 21 5 14.6 5 10 A7 7 0 0 1 19 10 C19 14.6 12 21 12 21 Z"/><path d="M12 21 C12 21 5 14.6 5 10 A7 7 0 0 1 19 10 C19 14.6 12 21 12 21 Z"/><circle cx="12" cy="10" r="2.5" fill="var(--ui-surface-raised)"/>
    </svg>
  );
});
