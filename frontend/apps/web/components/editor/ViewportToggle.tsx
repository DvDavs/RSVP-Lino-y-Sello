"use client";

// components/editor/ViewportToggle.tsx — vista móvil / escritorio (04 §7.4, flujo D).
//
// Es un `radiogroup` de DOS opciones, no un `checkbox` sin nombre (04 §7.4, literal): un
// interruptor sin etiqueta no dice qué estado representa. Cambia el ancho del `<iframe>` y manda
// `SET_VIEWPORT` para que el propio lienzo ajuste su raíz. Las secciones son responsive por CSS;
// no se exponen breakpoints al cliente (anti-patrón confirmado de aura.build).
//
// Fase 3-C: aspecto de la píldora de `Tabs` (`11 §5`: contenedor en `surface-alt`, activa en
// `surface-raised` con `shadow-1`), pero conservando `radiogroup`/`radio` — el patrón ARIA correcto
// para «elige una de dos vistas» — y los iconos `IconoMovil`/`IconoEscritorio` del inventario.
// El anillo de foco es el del sistema (3 px `focus` + halo de 2 px de la superficie, `11 §5`).
import { IconoEscritorio, IconoMovil, type IconProps } from "@invitaciones/icons";
import type { ComponentType } from "react";
import { es_MX } from "@/lib/i18n";
import { useEditorStore } from "@/lib/store";

const OPCIONES: readonly { valor: "desktop" | "mobile"; etiqueta: string; Icono: ComponentType<IconProps> }[] = [
  { valor: "desktop", etiqueta: es_MX.editor.barra.escritorio, Icono: IconoEscritorio },
  { valor: "mobile", etiqueta: es_MX.editor.barra.movil, Icono: IconoMovil },
];

export function ViewportToggle() {
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);

  return (
    <div
      role="radiogroup"
      aria-label={es_MX.editor.barra.verLaInvitacionEn}
      className="inline-flex rounded-ui-pill bg-ui-surface-alt p-1"
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = viewport === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={activo}
            data-testid={`viewport-${valor}`}
            onClick={() => setViewport(valor)}
            className={`inline-flex h-9 min-w-11 items-center gap-1.5 rounded-ui-pill px-3 text-sm font-semibold transition-colors duration-200 ease-ui-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface ${
              activo ? "bg-ui-surface-raised text-ui-link shadow-ui-1" : "text-ui-ink-muted hover:text-ui-ink"
            }`}
          >
            <Icono size={18} tone="mono" />
            <span>{etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
