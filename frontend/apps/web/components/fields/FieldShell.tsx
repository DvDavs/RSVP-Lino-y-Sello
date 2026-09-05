"use client";

// components/fields/FieldShell.tsx — envoltorio COMÚN de los 14 campos: etiqueta, ayuda, contador,
// insignia de "contenido de ejemplo" (H-03, `report.stillDefault`) y mensaje de error con
// `aria-describedby` (U-17: "anuncia el error con `aria-describedby`"). Nunca decide SI hay error —
// eso es de cada campo, según su `BlockSpec`.
import type { ReactNode } from "react";

export function idsAyudaError(id: string): { helpId: string; errorId: string } {
  return { helpId: `${id}-ayuda`, errorId: `${id}-error` };
}

/** El MISMO cálculo que usa `FieldShell`: el control real (`<input>`, …) debe usar este valor tal cual
 *  para que `aria-describedby` apunte a los nodos que `FieldShell` efectivamente pinta (U-17). */
export function describedByPara(id: string, opciones: { help?: string; error?: string }): string | undefined {
  const { helpId, errorId } = idsAyudaError(id);
  return [opciones.help ? helpId : null, opciones.error ? errorId : null].filter(Boolean).join(" ") || undefined;
}

export interface FieldShellProps {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  esContenidoDeEjemplo?: boolean;
  counter?: string;
  error?: string;
  children: ReactNode;
}

export function FieldShell({ id, label, help, required, esContenidoDeEjemplo, counter, error, children }: FieldShellProps) {
  const { helpId, errorId } = idsAyudaError(id);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-ui-aux font-semibold text-ui-ink">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-ui-danger">
              *
            </span>
          ) : null}
        </label>
        {counter ? <span className="shrink-0 text-ui-eyebrow text-ui-ink-muted">{counter}</span> : null}
      </div>
      {help ? (
        <p id={helpId} className="text-ui-eyebrow text-ui-ink-muted">
          {help}
        </p>
      ) : null}
      {children}
      {esContenidoDeEjemplo ? (
        <p className="flex items-center gap-1 text-ui-eyebrow text-ui-warning">
          <span aria-hidden="true">⚠</span> Contenido de ejemplo — reemplázalo antes de publicar.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-ui-eyebrow text-ui-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Clases comunes de los controles de texto (input/textarea/select), consistentes con `arte-chrome.md §6`. */
export const CLASES_CONTROL =
  "h-11 w-full rounded-ui-control border border-ui-border-field bg-white px-4 text-ui-body text-ui-ink placeholder:text-ui-ink-placeholder focus-visible:border-ui-focus disabled:cursor-not-allowed disabled:bg-ui-bg-alt disabled:text-ui-ink-muted aria-[invalid=true]:border-ui-danger";

/** Bloque de solo lectura (04 §6.3, §7.1 paso 5): NUNCA un input deshabilitado y mudo. */
export function SoloLectura({ label, valor, explicacion }: { label: string; valor: string; explicacion: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-ui-aux font-semibold text-ui-ink">
        {label}
        <span aria-hidden="true" title="Solo lectura">
          🔒
        </span>
      </span>
      <p className="rounded-ui-control bg-ui-bg-alt px-4 py-2.5 text-ui-body text-ui-ink">{valor || "—"}</p>
      <p className="text-ui-eyebrow text-ui-ink-muted">{explicacion}</p>
    </div>
  );
}
