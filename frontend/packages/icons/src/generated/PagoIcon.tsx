// GENERADO por scripts/generar.ts a partir de svg/pago.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoPago = forwardRef<SVGSVGElement, IconProps>(function IconoPago(
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
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="var(--tono)"/><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 9.5 H21"/><rect x="5.5" y="13" width="5" height="2.4" rx="1"/>
    </svg>
  );
});
