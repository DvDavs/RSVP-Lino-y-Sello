// GENERADO por scripts/generar.ts a partir de svg/pie.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoPie = forwardRef<SVGSVGElement, IconProps>(function IconoPie(
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
      <path fill="var(--tono)" stroke="none" d="M4.5 4.5 A1.5 1.5 0 0 1 6 3 H18 A1.5 1.5 0 0 1 19.5 4.5 V15.3 L17.5 14.1 L15.5 15.3 L13.5 14.1 L11.5 15.3 L9.5 14.1 L7.5 15.3 L6 14.4 L4.5 15.3 Z"/><path d="M4.5 4.5 A1.5 1.5 0 0 1 6 3 H18 A1.5 1.5 0 0 1 19.5 4.5 V15.3 L17.5 14.1 L15.5 15.3 L13.5 14.1 L11.5 15.3 L9.5 14.1 L7.5 15.3 L6 14.4 L4.5 15.3 Z"/><path d="M7.5 7.5 H16.5"/><path d="M7.5 10.5 H13.5"/>
    </svg>
  );
});
