// components/sitio/Seccion.tsx — el bloque de sección de la web pública: un ancla, un titular y,
// opcionalmente, una entradilla. Existe para que las siete secciones de `/` compartan ritmo
// vertical y jerarquía de encabezados sin repetirlos siete veces (y sin que ninguna se salte un
// nivel: `<h2>` siempre, `11 §7`).
import type { ReactNode } from "react";

export interface PropsSeccion {
  readonly id: string;
  readonly titulo: string;
  /** Antetítulo en voz `label` (Red Hat Mono, mayúsculas). Decorativo: nunca lleva información. */
  readonly eyebrow?: string;
  readonly intro?: string;
  /** Fondo alterno para separar secciones sin dibujar una línea. */
  readonly fondo?: "papel" | "alterno";
  readonly className?: string;
  readonly children?: ReactNode;
}

export function Seccion({ id, titulo, eyebrow, intro, fondo = "papel", className, children }: PropsSeccion) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`scroll-mt-20 ${fondo === "alterno" ? "bg-ui-surface-alt" : "bg-ui-surface"}`}
    >
      <div className={`mx-auto w-full max-w-ui-page px-5 py-14 sm:px-8 lg:py-20 ${className ?? ""}`}>
        {eyebrow ? <p className="label-sm uppercase text-ui-link">{eyebrow}</p> : null}
        <h2 id={`${id}-titulo`} className="display-sm mt-2 text-ui-ink">
          {titulo}
        </h2>
        {intro ? <p className="text-lg mt-3 max-w-[58ch] text-ui-ink-muted">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
