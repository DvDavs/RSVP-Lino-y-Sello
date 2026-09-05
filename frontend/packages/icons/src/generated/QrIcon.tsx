// GENERADO por scripts/generar.ts a partir de svg/qr.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoQr = forwardRef<SVGSVGElement, IconProps>(function IconoQr(
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="var(--tono)"/><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><rect x="6.5" y="6.5" width="4" height="4" rx="1"/><rect x="13.5" y="6.5" width="4" height="4" rx="1"/><rect x="6.5" y="13.5" width="4" height="4" rx="1"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>
    </svg>
  );
});
