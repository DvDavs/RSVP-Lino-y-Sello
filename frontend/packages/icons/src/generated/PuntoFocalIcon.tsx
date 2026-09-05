// GENERADO por scripts/generar.ts a partir de svg/punto-focal.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoPuntoFocal = forwardRef<SVGSVGElement, IconProps>(function IconoPuntoFocal(
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
      <circle cx="12" cy="12" r="7" fill="var(--tono)"/><path d="M12 2.5 V5.5"/><path d="M12 18.5 V21.5"/><path d="M2.5 12 H5.5"/><path d="M18.5 12 H21.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>
    </svg>
  );
});
