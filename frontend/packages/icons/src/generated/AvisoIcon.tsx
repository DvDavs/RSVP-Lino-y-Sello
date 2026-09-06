// GENERADO por scripts/generar.ts a partir de svg/aviso.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoAviso = forwardRef<SVGSVGElement, IconProps>(function IconoAviso(
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
      <path fill="var(--tono)" stroke="none" d="M12 3.9 A1.6 1.6 0 0 1 13.35 4.68 L20.9 18.6 A1.6 1.6 0 0 1 19.5 21 H4.5 A1.6 1.6 0 0 1 3.1 18.6 L10.65 4.68 A1.6 1.6 0 0 1 12 3.9 Z"/><path d="M12 3.9 A1.6 1.6 0 0 1 13.35 4.68 L20.9 18.6 A1.6 1.6 0 0 1 19.5 21 H4.5 A1.6 1.6 0 0 1 3.1 18.6 L10.65 4.68 A1.6 1.6 0 0 1 12 3.9 Z"/><path d="M12 10 V14.3"/><circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
});
