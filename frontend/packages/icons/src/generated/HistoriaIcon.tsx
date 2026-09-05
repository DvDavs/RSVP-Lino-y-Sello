// GENERADO por scripts/generar.ts a partir de svg/historia.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoHistoria = forwardRef<SVGSVGElement, IconProps>(function IconoHistoria(
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
      <path fill="var(--tono)" stroke="none" d="M12 5.2 C10 3.7 6.6 3.3 3.8 4.3 V18.3 C6.6 17.3 10 17.7 12 19.1 Z"/><path d="M12 5.2 C10 3.7 6.6 3.3 3.8 4.3 V18.3 C6.6 17.3 10 17.7 12 19.1 Z"/><path d="M12 5.2 C14 3.7 17.4 3.3 20.2 4.3 V18.3 C17.4 17.3 14 17.7 12 19.1 Z"/><path d="M12 5.2 V19.1"/>
    </svg>
  );
});
