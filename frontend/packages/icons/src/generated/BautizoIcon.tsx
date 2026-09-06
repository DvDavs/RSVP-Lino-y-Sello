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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" d="M12 20.5 C7.3 20.5 3.5 16.4 3.5 11.4 C3.5 9.2 5.4 8.4 6.2 10.3 C6.9 6.6 9.2 6.1 9.7 9.6 C10.1 5.6 11.3 5.2 12 8.4 C12.7 5.2 13.9 5.6 14.3 9.6 C14.8 6.1 17.1 6.6 17.8 10.3 C18.6 8.4 20.5 9.2 20.5 11.4 C20.5 16.4 16.7 20.5 12 20.5 Z"/><path d="M12 19.9 V9.6"/><path d="M8.7 19.1 L7 11"/><path d="M15.3 19.1 L17 11"/>
    </svg>
  );
});
