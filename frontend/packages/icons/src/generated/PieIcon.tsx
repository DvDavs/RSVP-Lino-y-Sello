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
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "currentColor", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      <path fill="var(--tono)" stroke="none" d="M4 4.5 A1.5 1.5 0 0 1 5.5 3 H18.5 A1.5 1.5 0 0 1 20 4.5 V20.5 L17.33 19 L14.67 20.5 L12 19 L9.33 20.5 L6.67 19 L4 20.5 Z"/><path d="M4 4.5 A1.5 1.5 0 0 1 5.5 3 H18.5 A1.5 1.5 0 0 1 20 4.5 V20.5 L17.33 19 L14.67 20.5 L12 19 L9.33 20.5 L6.67 19 L4 20.5 Z"/><path d="M7 8 H17"/><path d="M7 11.5 H17"/><path d="M7 15 H13.5"/>
    </svg>
  );
});
