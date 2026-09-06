"use client";

// components/ui/switch.tsx — interruptor accesible (04 §18: rol `switch` + `aria-checked`, teclado
// Espacio, objetivo táctil ≥ 24×24 con separación — 2.5.8). Implementación PROPIA sobre `<button>`
// nativo (sin Radix): un `switch` es un patrón de un solo elemento, sin posicionamiento flotante ni
// gestión de foco compleja, así que añadir una dependencia no compraba nada.
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Nombra lo que activa (04 §18: "Mostrar Nuestra historia", nunca solo "Activar"). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, disabled, className, id, ...aria },
  ref,
) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={twMerge(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-ui-pill transition-colors duration-[var(--ui-duration)] ease-[var(--ui-ease)] disabled:pointer-events-none disabled:opacity-50",
        checked ? "bg-ui-primary" : "bg-ui-border-field",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden="true"
        className={twMerge(
          "inline-block size-5 translate-x-0.5 rounded-full bg-white shadow-ui-1 transition-transform duration-[var(--ui-duration)] ease-[var(--ui-ease)]",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
});
