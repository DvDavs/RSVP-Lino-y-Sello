// GENERADO por scripts/generar.ts a partir de svg/paleta.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoPaleta = forwardRef<SVGSVGElement, IconProps>(function IconoPaleta(
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
      <path d="M12 4 C6.5 4 3 7.8 3 12.3 C3 15.6 5.6 17 8 16.4 C8.9 16.2 9.7 16.6 9.9 17.5 C10.2 18.8 11.3 20 13.3 20 C18 20 21 16.2 21 12 C21 7.6 17 4 12 4 Z" fill="var(--tono)"/><circle cx="8.6" cy="10" r="1.15" fill="currentColor" stroke="none"/><circle cx="12.3" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.15" fill="currentColor" stroke="none"/>
    </svg>
  );
});
