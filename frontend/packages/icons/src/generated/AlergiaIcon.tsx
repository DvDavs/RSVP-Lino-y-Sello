// GENERADO por scripts/generar.ts a partir de svg/alergia.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoAlergia = forwardRef<SVGSVGElement, IconProps>(function IconoAlergia(
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
      <path fill="var(--tono)" stroke="none" d="M12 4 C15.5 8.4 18 11.8 18 14.8 A6 6 0 0 1 6 14.8 C6 11.8 8.5 8.4 12 4 Z"/><path d="M12 4 C15.5 8.4 18 11.8 18 14.8 A6 6 0 0 1 6 14.8 C6 11.8 8.5 8.4 12 4 Z"/><path d="M12 11 V14.6"/><circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
