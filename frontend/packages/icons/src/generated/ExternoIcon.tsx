// GENERADO por scripts/generar.ts a partir de svg/externo.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoExterno = forwardRef<SVGSVGElement, IconProps>(function IconoExterno(
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
      <path d="M14.5 6.5 H6.5 A1.5 1.5 0 0 0 5 8 V17.5 A1.5 1.5 0 0 0 6.5 19 H16 A1.5 1.5 0 0 0 17.5 17.5 V13.5"/><path d="M10 6.5 H17.5 V14"/><path d="M17.5 6.5 L9 15"/>
    </svg>
  );
});
