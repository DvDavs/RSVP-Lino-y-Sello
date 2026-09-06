// packages/ui/src/componentes/Select/Select.tsx — selector propio para listas cortas (≤ 5 opciones,
// `11 §5` fila Select). Radix Select aporta `role="combobox"` en el disparador, `role="listbox"` en
// el panel, teclado completo (flechas, Inicio/Fin, escribir para saltar, Esc) y el manejo de foco;
// el aspecto es 100 % propio.
"use client";

import { forwardRef, type ReactNode } from "react";
import * as SelectPrimitivo from "@radix-ui/react-select";
import { IconoChevronAbajo } from "@invitaciones/icons";
import { cn } from "../../utilidades/cn.ts";
import { useFoco } from "../../utilidades/foco.ts";
import { sombraControl } from "../../utilidades/controlSombra.ts";

const ALTO_CONTROL = 44;
const ALTO_OPCION = 44;

export interface OpcionSelect {
  readonly value: string;
  readonly label: ReactNode;
  readonly disabled?: boolean;
  /** Motivo de una opción deshabilitada («Corporativo · plan 2»). */
  readonly motivo?: ReactNode;
}

export interface PropsSelect extends Omit<SelectPrimitivo.SelectProps, "children"> {
  readonly opciones: readonly OpcionSelect[];
  readonly placeholder?: ReactNode;
  readonly invalido?: boolean;
  readonly id?: string;
  readonly className?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean;
  /** El disparador (no `Root`, que no renderiza ningún elemento) es quien necesita el nombre. */
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
}

export const Select = forwardRef<HTMLButtonElement, PropsSelect>(function Select(
  {
    opciones,
    placeholder,
    invalido,
    id,
    className,
    disabled,
    "aria-describedby": describedBy,
    "aria-invalid": ariaInvalidProp,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...resto
  },
  ref,
) {
  const { enFoco, onFocus, onBlur } = useFoco<HTMLButtonElement>();
  const esInvalido = invalido ?? ariaInvalidProp;

  return (
    <SelectPrimitivo.Root disabled={disabled} {...resto}>
      <SelectPrimitivo.Trigger
        ref={ref}
        id={id}
        aria-invalid={esInvalido || undefined}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-ui-control bg-ui-surface-raised px-[14px] text-left text-base text-ui-ink outline-none transition-[box-shadow] duration-[var(--ui-dur-1)] ease-ui-out data-[placeholder]:text-ui-ink-placeholder disabled:cursor-not-allowed disabled:bg-ui-surface-alt disabled:text-ui-ink-muted",
          className,
        )}
        style={{ height: ALTO_CONTROL, boxShadow: sombraControl({ enFoco, invalido: esInvalido, deshabilitado: disabled }) }}
        data-foco={enFoco ? "true" : "false"}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className="flex-1 truncate">
          <SelectPrimitivo.Value placeholder={placeholder} />
        </span>
        <SelectPrimitivo.Icon className="text-ui-ink-muted">
          <IconoChevronAbajo size={18} aria-hidden />
        </SelectPrimitivo.Icon>
      </SelectPrimitivo.Trigger>
      <SelectPrimitivo.Portal>
        <SelectPrimitivo.Content
          position="popper"
          sideOffset={6}
          className="z-[var(--ui-z-hoja)] max-h-[320px] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-ui-card bg-ui-surface-raised p-1.5 shadow-ui-2"
        >
          <SelectPrimitivo.Viewport>
            {opciones.map((opcion) => (
              <SelectPrimitivo.Item
                key={opcion.value}
                value={opcion.value}
                disabled={opcion.disabled}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-[10px] px-3 text-[15px] text-ui-ink outline-none data-[highlighted]:bg-ui-primary-soft data-[highlighted]:text-ui-on-primary-soft data-[disabled]:cursor-not-allowed data-[disabled]:text-ui-ink-muted data-[disabled]:opacity-70"
                style={{ height: ALTO_OPCION }}
              >
                <SelectPrimitivo.ItemText>{opcion.label}</SelectPrimitivo.ItemText>
                {opcion.motivo ? <span className="ml-auto text-[13px] text-ui-ink-muted">{opcion.motivo}</span> : null}
                <SelectPrimitivo.ItemIndicator className="ml-auto text-ui-primary">
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5 L10 17 L19 7.5" />
                  </svg>
                </SelectPrimitivo.ItemIndicator>
              </SelectPrimitivo.Item>
            ))}
          </SelectPrimitivo.Viewport>
        </SelectPrimitivo.Content>
      </SelectPrimitivo.Portal>
    </SelectPrimitivo.Root>
  );
});
