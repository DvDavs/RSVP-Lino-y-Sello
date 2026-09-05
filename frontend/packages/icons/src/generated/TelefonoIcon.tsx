// GENERADO por scripts/generar.ts a partir de svg/telefono.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoTelefono = forwardRef<SVGSVGElement, IconProps>(function IconoTelefono(
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
      <path fill="var(--tono)" stroke="none" d="M5.5 4.5 H9 L10.5 8.5 L8.3 10 A10 10 0 0 0 14 15.7 L15.5 13.5 L19.5 15 V18.5 A2 2 0 0 1 17.3 20.5 C10 20 4 14 3.5 6.7 A2 2 0 0 1 5.5 4.5 Z"/><path d="M5.5 4.5 H9 L10.5 8.5 L8.3 10 A10 10 0 0 0 14 15.7 L15.5 13.5 L19.5 15 V18.5 A2 2 0 0 1 17.3 20.5 C10 20 4 14 3.5 6.7 A2 2 0 0 1 5.5 4.5 Z"/>
    </svg>
  );
});
