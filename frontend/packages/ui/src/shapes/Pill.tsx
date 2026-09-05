// packages/ui/src/shapes/Pill.tsx — píldora (`11 §3.1`): prueba social, insignia colgada del borde
// de una tarjeta, eyebrow con fondo.
//
// A diferencia del resto de la biblioteca, la píldora NO es decorativa: lleva texto y por tanto se
// anuncia. Emite un `<span>` (no SVG), y su pareja fondo/texto es una de las VERIFICADAS de
// `11 §1.4` (`-soft` de fondo, `-deep`/`on-…-soft` de texto): no se puede componer una pareja nueva
// desde fuera, que es justo lo que evita un fallo de contraste.
import type { JSX, ReactNode } from "react";
import { clases } from "./base.ts";

/** Matices con pareja `-soft` / texto verificada en claro y oscuro (`11 §1.4`). */
export type TonoPildora = "primary" | "support-1" | "support-2" | "accent";

const PAREJA: Readonly<Record<TonoPildora, { readonly fondo: string; readonly texto: string; readonly punto: string }>> =
  {
    primary: { fondo: "--ui-primary-soft", texto: "--ui-on-primary-soft", punto: "--ui-primary" },
    "support-1": { fondo: "--ui-support-1-soft", texto: "--ui-support-1-deep", punto: "--ui-support-1" },
    "support-2": { fondo: "--ui-support-2-soft", texto: "--ui-support-2-deep", punto: "--ui-support-2" },
    accent: { fondo: "--ui-accent-soft", texto: "--ui-on-accent-soft", punto: "--ui-accent" },
  };

export interface PillProps {
  readonly tone?: TonoPildora;
  /** Punto de color a la izquierda (estado). */
  readonly dot?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Pill({ tone = "support-1", dot = false, className, children }: PillProps): JSX.Element {
  const pareja = PAREJA[tone];
  return (
    <span
      className={clases("ui-pildora", className)}
      style={{ background: `var(${pareja.fondo})`, color: `var(${pareja.texto})` }}
      data-tono={tone}
    >
      {dot ? <span className="ui-pildora__punto" style={{ background: `var(${pareja.punto})` }} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
