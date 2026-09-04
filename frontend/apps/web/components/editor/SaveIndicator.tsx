"use client";

// components/editor/SaveIndicator.tsx — el indicador dice LA VERDAD en todo momento (04 §12.8).
// No es decorativo: es lo que sustituye al botón «Guardar» que el editor no tiene. Región `status`
// con `aria-live="polite"` para que un lector de pantalla anuncie el cambio sin interrumpir.
import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import { useEditorStore, saveLabel } from "@/lib/store";

const ICONO = {
  idle: Check,
  dirty: Loader2,
  saving: Loader2,
  retrying: Loader2,
  offline: CloudOff,
  conflict: TriangleAlert,
  error: TriangleAlert,
} as const;

const TONO = {
  idle: "text-ui-ink-muted",
  dirty: "text-ui-ink-muted",
  saving: "text-ui-ink-muted",
  retrying: "text-ui-warning",
  offline: "text-ui-warning",
  conflict: "text-ui-danger",
  error: "text-ui-danger",
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
      className={`inline-flex items-center gap-1.5 text-ui-aux ${TONO[saveState]}`}
    >
      <Icono className={`size-4 shrink-0 ${girando ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{texto}</span>
    </span>
  );
}
