"use client";

// components/editor/SaveIndicator.tsx — el indicador dice LA VERDAD en todo momento (04 §12.8).
// No es decorativo: es lo que sustituye al botón «Guardar» que el editor no tiene. Región `status`
// con `aria-live="polite"` para que un lector de pantalla anuncie el cambio sin interrumpir.
//
// Fase 3-C: iconos del sistema (`@invitaciones/icons`, `11 §4`) y color por rol semántico — el
// `-text` de `warning`/`danger` es la variante verificada AA para TEXTO sobre superficie, no la
// sólida de fondo. El spinner solo gira con `prefers-reduced-motion: no-preference`
// (`11 §6.2` regla 5): el texto siempre está, así que sin animación el estado se lee igual.
import type { ComponentType } from "react";
import { IconoAviso, IconoCargando, IconoError, IconoExito, type IconProps } from "@invitaciones/icons";
import { useEditorStore, saveLabel } from "@/lib/store";

const ICONO = {
  idle: IconoExito,
  dirty: IconoCargando,
  saving: IconoCargando,
  retrying: IconoCargando,
  offline: IconoAviso,
  conflict: IconoError,
  error: IconoError,
} as const satisfies Record<string, ComponentType<IconProps>>;

const TONO = {
  idle: "text-ui-ink-muted",
  dirty: "text-ui-ink-muted",
  saving: "text-ui-ink-muted",
  retrying: "text-ui-warning-text",
  offline: "text-ui-warning-text",
  conflict: "text-ui-danger-text",
  error: "text-ui-danger-text",
} as const;

export function SaveIndicator() {
  const saveState = useEditorStore((s) => s.saveState);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const Icono = ICONO[saveState];
  const texto = saveLabel(saveState, lastSavedAt);
  const girando = saveState === "saving" || saveState === "retrying";

  return (
    <span
      role="status"
      aria-live="polite"
      data-save-state={saveState}
      className={`inline-flex min-w-0 items-center gap-1.5 text-sm ${TONO[saveState]}`}
    >
      <Icono size={18} tone="mono" className={girando ? "shrink-0 motion-safe:animate-spin" : "shrink-0"} />
      <span className="truncate">{texto}</span>
    </span>
  );
}
