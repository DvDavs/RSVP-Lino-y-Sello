// packages/ui/src/componentes/Switch/Switch.tsx — interruptor (`11 §5`, fila Switch): pista de
// 48 × 28, bolita de 22 con `shadow-1`, transición `spring`. Radix Switch aporta `role="switch"` +
// `aria-checked` y el manejo de teclado (Espacio); el aspecto es propio.
"use client";

import { forwardRef, useState, type ReactNode } from "react";
import * as SwitchPrimitivo from "@radix-ui/react-switch";
import { cn } from "../../utilidades/cn.ts";
import { conAnilloFoco, useFoco } from "../../utilidades/foco.ts";

const ANCHO = 48;
const ALTO = 28;
const BOLITA = 22;
const MARGEN = 3;

export interface PropsSwitch extends Omit<SwitchPrimitivo.SwitchProps, "asChild" | "children"> {
  /** Texto de la fila («Mostrar «Nuestra historia»»). Sin él, dar `aria-label`. */
  readonly label?: ReactNode;
  readonly className?: string;
}

export const Switch = forwardRef<HTMLButtonElement, PropsSwitch>(function Switch(
  { label, className, checked, defaultChecked, onCheckedChange, disabled, onFocus, onBlur, ...resto },
  ref,
) {
  const [marcadoInterno, setMarcadoInterno] = useState(defaultChecked ?? false);
  const marcado = checked ?? marcadoInterno;
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLButtonElement>(onFocus, onBlur);

  function manejarCambio(valor: boolean) {
    setMarcadoInterno(valor);
    onCheckedChange?.(valor);
  }

  const interruptor = (
    <SwitchPrimitivo.Root
      ref={ref}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={manejarCambio}
      disabled={disabled}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-ui-pill transition-colors duration-[var(--ui-dur-2)] ease-ui-out disabled:cursor-not-allowed disabled:opacity-45",
        marcado ? "bg-ui-primary" : "bg-ui-border",
        !label && className,
      )}
      style={{ width: ANCHO, height: ALTO, boxShadow: conAnilloFoco(enFoco) }}
      data-foco={enFoco ? "true" : "false"}
      onFocus={manejarFoco}
      onBlur={manejarDesenfoque}
      {...resto}
    >
      <SwitchPrimitivo.Thumb
        className="block rounded-full bg-ui-surface-raised shadow-ui-1 transition-transform duration-[var(--ui-dur-2)] ease-ui-spring"
        style={{ width: BOLITA, height: BOLITA, transform: `translateX(${marcado ? ANCHO - BOLITA - MARGEN : MARGEN}px)` }}
      />
    </SwitchPrimitivo.Root>
  );

  if (!label) return interruptor;

  return (
    <label
      className={cn("flex cursor-pointer items-center gap-3 text-[15px] text-ui-ink", disabled && "cursor-not-allowed opacity-45", className)}
      style={{ minHeight: 44 }}
    >
      {interruptor}
      <span>{label}</span>
    </label>
  );
});
