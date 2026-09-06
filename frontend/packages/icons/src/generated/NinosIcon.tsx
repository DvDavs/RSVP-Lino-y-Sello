// GENERADO por scripts/generar.ts a partir de svg/ninos.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoNinos = forwardRef<SVGSVGElement, IconProps>(function IconoNinos(
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
      <path fill="var(--tono)" d="M12 3.2 C15.6 3.2 17.8 6 17.8 9.3 C17.8 12.7 15 15.5 12 15.5 C9 15.5 6.2 12.7 6.2 9.3 C6.2 6 8.4 3.2 12 3.2 Z"/><path d="M10.8 15.4 L12 17 L13.2 15.4"/><path d="M12 17 C12 18.5 10.2 18.7 10.2 20.2 C10.2 20.9 10.8 21.1 11.4 20.9"/>
    </svg>
  );
});
