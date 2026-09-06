"use client";

// components/editor/ViewportToggle.tsx — vista móvil / escritorio (04 §7.4, flujo D).
//
// Es un `radiogroup` de DOS opciones, no un `checkbox` sin nombre (04 §7.4, literal): un
// interruptor sin etiqueta no dice qué estado representa. Cambia el ancho del `<iframe>` y manda
// `SET_VIEWPORT` para que el propio lienzo ajuste su raíz. Las secciones son responsive por CSS;
// no se exponen breakpoints al cliente (anti-patrón confirmado de aura.build).
import { Monitor, Smartphone } from "lucide-react";
import { useEditorStore } from "@/lib/store";

const OPCIONES = [
  { valor: "desktop", etiqueta: "Escritorio", Icono: Monitor },
  { valor: "mobile", etiqueta: "Móvil", Icono: Smartphone },
] as const;

export function ViewportToggle() {
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);

  return (
    <div role="radiogroup" aria-label="Ver la invitación en" className="inline-flex rounded-ui-pill bg-ui-bg-alt p-0.5">
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
            className={`inline-flex h-10 min-w-11 items-center gap-1.5 rounded-ui-pill px-3 text-ui-aux font-semibold transition-colors ${
              activo ? "bg-ui-surface text-ui-primary shadow-ui-1" : "text-ui-ink-muted hover:text-ui-ink"
            }`}
          >
            <Icono className="size-4" aria-hidden="true" />
            <span>{etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
