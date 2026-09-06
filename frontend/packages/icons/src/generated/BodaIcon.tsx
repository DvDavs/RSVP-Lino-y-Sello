// GENERADO por scripts/generar.ts a partir de svg/boda.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoBoda = forwardRef<SVGSVGElement, IconProps>(function IconoBoda(
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
      <circle cx="9" cy="14" r="5.5" fill="var(--tono)"/><circle cx="15" cy="14" r="5.5"/><path d="M13 5.5 L15 3 L17 5.5 L15 8.5 Z" fill="var(--tono)"/>
    </svg>
  );
});
