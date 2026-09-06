// components/editor/VariantDiagram.tsx — miniatura ESQUEMÁTICA (SVG, no foto) del diseño de una
// sección, para el selector de variante (04 §6.3, `preguntas-abiertas.md`: "el selector usa las
// etiquetas es-MX y los diagramas SVG del `sectionRegistry` del frontend, no fotos de la plantilla,
// porque el manifiesto no declara imagen por variante"). `sectionRegistry` da el catálogo cerrado de
// ids de variante y su etiqueta es-MX (`variantLabels`); el DIBUJO de cada una vive aquí porque
// `packages/sections` es zona prohibida para este bloque y estos trazos son chrome del editor, no
// invitación (P3: cero `--inv-*` aquí, solo geometría neutra).
import type { ReactNode } from "react";

// Fase 3-C: cero `var(--…)` a mano. El trazo hereda `currentColor` del `<svg>` (que lleva la clase
// del rol `ink-muted`) y el relleno usa la utilidad `fill-*` del preset semántico: si la paleta
// cambia, el diagrama cambia con ella sin tocar este archivo.
const TRAZO = "currentColor";
const RELLENO = "fill-ui-primary-soft";

function Marco({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true" className="shrink-0 text-ui-ink-muted">
      <rect x="1" y="1" width="62" height="42" rx="4" fill="none" stroke={TRAZO} strokeWidth="1.5" />
      {children}
    </svg>
  );
}

/** Un dibujo por FORMA reconocible, no por cada id de variante (serían decenas). Heurística por nombre. */
export function VariantDiagram({ variant }: { variant: string }) {
  if (variant === "full" || variant === "banner") {
    return (
      <Marco>
        <rect x="4" y="4" width="56" height="36" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "framed") {
    return (
      <Marco>
        <rect x="10" y="8" width="44" height="28" className={RELLENO} stroke={TRAZO} strokeWidth="1" />
      </Marco>
    );
  }
  if (variant === "split" || variant === "side-by-side" || variant === "two-columns") {
    return (
      <Marco>
        <rect x="4" y="4" width="26" height="36" className={RELLENO} />
        <rect x="34" y="4" width="26" height="36" fill="none" stroke={TRAZO} strokeWidth="1" />
      </Marco>
    );
  }
  if (variant === "stacked" || variant === "alternating") {
    return (
      <Marco>
        <rect x="14" y="4" width="36" height="15" className={RELLENO} />
        <rect x="14" y="23" width="36" height="15" fill="none" stroke={TRAZO} strokeWidth="1" />
      </Marco>
    );
  }
  if (variant === "centered" || variant === "simple") {
    return (
      <Marco>
        <circle cx="32" cy="22" r="12" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "grid-6" || variant === "grid-9") {
    const n = variant === "grid-9" ? 3 : 2;
    const celdas = [];
    const w = 56 / n;
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < n; c++) {
        celdas.push(
          <rect key={`${f}-${c}`} x={4 + c * w} y={4 + f * (36 / n)} width={w - 2} height={36 / n - 2} className={RELLENO} />,
        );
      }
    }
    return <Marco>{celdas}</Marco>;
  }
  if (variant === "carousel") {
    return (
      <Marco>
        <rect x="2" y="10" width="16" height="24" fill="none" stroke={TRAZO} strokeWidth="1" opacity="0.5" />
        <rect x="22" y="6" width="20" height="32" className={RELLENO} />
        <rect x="46" y="10" width="16" height="24" fill="none" stroke={TRAZO} strokeWidth="1" opacity="0.5" />
      </Marco>
    );
  }
  if (variant === "masonry") {
    return (
      <Marco>
        <rect x="4" y="4" width="18" height="16" className={RELLENO} />
        <rect x="24" y="4" width="18" height="26" className={RELLENO} />
        <rect x="44" y="4" width="16" height="12" className={RELLENO} />
        <rect x="4" y="22" width="18" height="14" className={RELLENO} />
        <rect x="44" y="18" width="16" height="18" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "timeline" || variant === "line") {
    return (
      <Marco>
        <line x1="32" y1="4" x2="32" y2="40" stroke={TRAZO} strokeWidth="1.5" />
        <circle cx="32" cy="10" r="3" className={RELLENO} />
        <circle cx="32" cy="22" r="3" className={RELLENO} />
        <circle cx="32" cy="34" r="3" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "cards") {
    return (
      <Marco>
        <rect x="4" y="8" width="16" height="28" rx="2" className={RELLENO} />
        <rect x="24" y="8" width="16" height="28" rx="2" className={RELLENO} />
        <rect x="44" y="8" width="16" height="28" rx="2" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "list" || variant === "form-inline") {
    return (
      <Marco>
        <rect x="8" y="8" width="48" height="4" className={RELLENO} />
        <rect x="8" y="18" width="48" height="4" className={RELLENO} />
        <rect x="8" y="28" width="48" height="4" className={RELLENO} />
      </Marco>
    );
  }
  if (variant === "single-place") {
    return (
      <Marco>
        <path d="M32 8 c-6 0 -10 4 -10 10 0 8 10 18 10 18 0 0 10 -10 10 -18 0 -6 -4 -10 -10 -10z" className={RELLENO} />
      </Marco>
    );
  }
  // Genérico: rectángulo con una línea de título — cubre cualquier id nuevo sin romper (I-24/R-diseño).
  return (
    <Marco>
      <rect x="8" y="8" width="48" height="6" className={RELLENO} />
      <rect x="8" y="20" width="48" height="16" fill="none" stroke={TRAZO} strokeWidth="1" />
    </Marco>
  );
}
