// packages/ui/src/componentes/RadioGroup/RadioGroup.tsx — radios grandes (`11 §5`, fila
// Radio/Checkbox): 26 px, borde de 2 px (a `primary` cuando está marcado), punto de 12 px. Radix
// RadioGroup aporta `role="radiogroup"` + `role="radio"`, foco por roving tabindex y flechas entre
// opciones. Cada opción se envuelve en un `<label>` (objetivo de toda la fila, >= 44 px): `<button>`
// es labelable, así que el clic en el texto activa el radio sin JS adicional.
//
// El grupo mantiene su propio valor (controlado o no) porque cada opción necesita saber si ES la
// marcada para pintar su borde en `primary` — Radix no expone ese booleano por ítem, solo el
// `data-state` del DOM, y el borde se compone en línea junto al anillo de foco (`utilidades/foco.ts`).
"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import * as RadioGroupPrimitivo from "@radix-ui/react-radio-group";
import { cn } from "../../utilidades/cn.ts";
import { conAnilloFoco, useFoco } from "../../utilidades/foco.ts";

const LADO = 26;

export interface OpcionRadio {
  readonly value: string;
  readonly label: ReactNode;
  /** Texto secundario a la derecha (p. ej. «2 lugares»). */
  readonly meta?: ReactNode;
  readonly disabled?: boolean;
}

export interface PropsRadioGroup
  extends Omit<RadioGroupPrimitivo.RadioGroupProps, "asChild" | "children"> {
  readonly opciones: readonly OpcionRadio[];
  readonly className?: string;
}

function ItemRadio({
  opcion,
  seleccionado,
  deshabilitadoGrupo,
}: {
  readonly opcion: OpcionRadio;
  readonly seleccionado: boolean;
  readonly deshabilitadoGrupo?: boolean;
}) {
  const { enFoco, onFocus, onBlur } = useFoco<HTMLButtonElement>();
  const deshabilitado = deshabilitadoGrupo || opcion.disabled;
  const estiloFila: CSSProperties = { minHeight: 44 };
  const bordePropio = `inset 0 0 0 2px var(${seleccionado ? "--ui-primary" : "--ui-border"})`;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 text-[15px] text-ui-ink",
        deshabilitado && "cursor-not-allowed opacity-45",
      )}
      style={estiloFila}
    >
      <RadioGroupPrimitivo.Item
        value={opcion.value}
        disabled={deshabilitado}
        className="inline-grid shrink-0 place-items-center rounded-full bg-ui-surface-raised transition-[box-shadow] duration-[var(--ui-dur-1)] ease-ui-out"
        style={{ width: LADO, height: LADO, boxShadow: conAnilloFoco(enFoco, bordePropio) }}
        data-foco={enFoco ? "true" : "false"}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <RadioGroupPrimitivo.Indicator className="block h-3 w-3 rounded-full bg-ui-primary" />
      </RadioGroupPrimitivo.Item>
      <span>{opcion.label}</span>
      {opcion.meta ? <span className="ml-auto text-[13px] font-medium text-ui-ink-muted">{opcion.meta}</span> : null}
    </label>
  );
}

export function RadioGroup({
  opciones,
  className,
  disabled,
  value,
  defaultValue,
  onValueChange,
  ...resto
}: PropsRadioGroup) {
  const [valorInterno, setValorInterno] = useState(defaultValue);
  const valorActual = value ?? valorInterno;

  function manejarCambio(nuevoValor: string) {
    setValorInterno(nuevoValor);
    onValueChange?.(nuevoValor);
  }

  return (
    <RadioGroupPrimitivo.Root
      className={cn("grid gap-2", className)}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      onValueChange={manejarCambio}
      {...resto}
    >
      {opciones.map((opcion) => (
        <ItemRadio key={opcion.value} opcion={opcion} seleccionado={valorActual === opcion.value} deshabilitadoGrupo={disabled} />
      ))}
    </RadioGroupPrimitivo.Root>
  );
}
