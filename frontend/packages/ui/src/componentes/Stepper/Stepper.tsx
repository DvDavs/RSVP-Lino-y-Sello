// packages/ui/src/componentes/Stepper/Stepper.tsx — contador numérico (cantidad de invitados,
// lugares, etc.). Distinto del `WizardProgress` (el "Stepper" de pasos de `11 §5`): el brief de este
// bloque pide, además de ese, un stepper NUMÉRICO con botones ≥ 44 px — no está en el doc 11 con
// este nombre; registrado como ADR de este bloque (nunca un control mudo: `label` es obligatorio y
// nombra los botones «Restar/Sumar <label>», y el límite alcanzado queda dicho, no solo deshabilitado).
"use client";

import { useId } from "react";
import type { JSX } from "react";
import { IconoAgregar, IconoQuitar } from "@invitaciones/icons";
import { twMerge } from "tailwind-merge";

export interface StepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Nombra el grupo y los dos botones («Restar/Sumar <label>»): nunca un «+»/«−» mudo. */
  readonly label: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

const BOTON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-pill bg-ui-surface-alt text-ui-ink transition-colors duration-[var(--ui-dur-2)] ease-ui-out hover:enabled:bg-ui-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface";

export function Stepper({ value, onChange, min = 0, max = Number.POSITIVE_INFINITY, step = 1, label, disabled = false, className }: StepperProps): JSX.Element {
  const idValor = useId();
  const enMinimo = value <= min;
  const enMaximo = value >= max;

  function bajar(): void {
    if (!disabled && !enMinimo) onChange(Math.max(min, value - step));
  }
  function subir(): void {
    if (!disabled && !enMaximo) onChange(Math.min(max, value + step));
  }

  return (
    <div className={twMerge("inline-flex items-center gap-3", className)} role="group" aria-label={label}>
      <button type="button" onClick={bajar} disabled={disabled || enMinimo} aria-label={`Restar: ${label}`} aria-controls={idValor} className={BOTON}>
        <IconoQuitar size={22} />
      </button>
      <output id={idValor} aria-live="polite" className="min-w-[2.5ch] text-center text-sm font-semibold tabular-nums text-ui-ink">
        {value}
      </output>
      <button type="button" onClick={subir} disabled={disabled || enMaximo} aria-label={`Sumar: ${label}`} aria-controls={idValor} className={BOTON}>
        <IconoAgregar size={22} />
      </button>
    </div>
  );
}
