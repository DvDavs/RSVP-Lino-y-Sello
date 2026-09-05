// GENERADO por scripts/generar.ts a partir de svg/mesa-de-regalos.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoMesaDeRegalos = forwardRef<SVGSVGElement, IconProps>(function IconoMesaDeRegalos(
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
      <rect x="4" y="10.5" width="16" height="9.5" rx="2" fill="var(--tono)"/><rect x="3" y="7" width="18" height="3.5" rx="1.5"/><path d="M12 7 V20"/><path d="M12 7 C9.5 7 7.5 5.5 8.5 3.8 C9.5 2.4 11.5 3.8 12 7 C12.5 3.8 14.5 2.4 15.5 3.8 C16.5 5.5 14.5 7 12 7 Z"/>
    </svg>
  );
});
