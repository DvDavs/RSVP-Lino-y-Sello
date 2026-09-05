// GENERADO por scripts/generar.ts a partir de svg/ver.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoVer = forwardRef<SVGSVGElement, IconProps>(function IconoVer(
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
      <path d="M2.5 12 C5 7 9 5 12 5 S19 7 21.5 12 C19 17 15 19 12 19 S5 17 2.5 12 Z" fill="var(--tono)"/><circle cx="12" cy="12" r="2.6" fill="var(--ui-surface-raised)"/>
    </svg>
  );
});
