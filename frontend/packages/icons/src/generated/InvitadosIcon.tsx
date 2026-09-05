// GENERADO por scripts/generar.ts a partir de svg/invitados.svg — no editar a mano.
// Regenerar: `node --experimental-strip-types scripts/generar.ts` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const IconoInvitados = forwardRef<SVGSVGElement, IconProps>(function IconoInvitados(
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
      <circle cx="9" cy="8.5" r="3" fill="var(--tono)"/><circle cx="9" cy="8.5" r="3"/><path d="M4 19 C4 15.5 6.2 13.5 9 13.5 S14 15.5 14 19"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M14.6 19 C14.7 16.2 16.3 14.4 18.3 14.4 C20 14.4 21.3 15.7 21.3 17.4 V19"/>
    </svg>
  );
});
