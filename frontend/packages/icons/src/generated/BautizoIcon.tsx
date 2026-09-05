// GENERADO por scripts/generar.ts a partir de svg/bautizo.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoBautizo = forwardRef<SVGSVGElement, IconProps>(function IconoBautizo(
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
      <path fill="var(--tono)" stroke="none" d="M12 5 C16 5 19 8.5 19 12.5 C19 12.5 16.5 12 16.5 15 C16.5 12.5 14.5 12.3 14 15 C13.8 12.3 12.6 12.3 12 15 C11.4 12.3 10.2 12.3 10 15 C9.5 12.3 7.5 12.5 7.5 15 C7.5 12 5 12.5 5 12.5 C5 8.5 8 5 12 5 Z"/><path d="M12 5 C16 5 19 8.5 19 12.5 C19 12.5 16.5 12 16.5 15 C16.5 12.5 14.5 12.3 14 15 C13.8 12.3 12.6 12.3 12 15 C11.4 12.3 10.2 12.3 10 15 C9.5 12.3 7.5 12.5 7.5 15 C7.5 12 5 12.5 5 12.5 C5 8.5 8 5 12 5 Z"/><path d="M12 15 V19.5 M9.5 17.2 H14.5"/>
    </svg>
  );
});
