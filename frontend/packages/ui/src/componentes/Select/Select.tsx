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

/**
 * Alto de fila del panel (`11 §5`: objetivo táctil de 44 px también dentro de la lista).
 * Exportado porque la galería expone el panel abierto como MAQUETA estática (ver más abajo).
 */
export const ALTO_OPCION_SELECT = 44;

/**
 * Clases del panel y de la fila, exportadas a propósito.
 *
 * El panel de Radix Select solo existe mientras el selector está abierto, y abierto se comporta
 * como una capa modal: marca el resto de la página `aria-hidden` y le pone
 * `pointer-events: none` (`@radix-ui/react-select` fija `disableOutsidePointerEvents: true`, sin
 * forma de desactivarlo — a diferencia de `Dialog`, que sí acepta `modal={false}`). En la galería
 * eso deja la página inutilizable: `axe` canta «aria-hidden-focus» y el conmutador de tema no se
 * puede pulsar. Así que `/design/componentes/select` enseña el panel como maqueta estática con
 * ESTAS MISMAS clases, y `Select.test.tsx` comprueba que el panel real las sigue llevando: la
 * maqueta no puede desviarse del componente sin poner una prueba en rojo.
 */
export const CLASES_PANEL_SELECT =
  "z-[var(--ui-z-hoja)] max-h-[320px] overflow-hidden rounded-ui-card bg-ui-surface-raised p-1.5 shadow-ui-2";
export const CLASES_OPCION_SELECT =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-[10px] px-3 text-[15px] text-ui-ink outline-none data-[highlighted]:bg-ui-primary-soft data-[highlighted]:text-ui-on-primary-soft data-[disabled]:cursor-not-allowed data-[disabled]:text-ui-ink-muted data-[disabled]:opacity-70";

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
          className={cn(CLASES_PANEL_SELECT, "w-[var(--radix-select-trigger-width)]")}
        >
          <SelectPrimitivo.Viewport>
            {opciones.map((opcion) => (
              <SelectPrimitivo.Item
                key={opcion.value}
                value={opcion.value}
                disabled={opcion.disabled}
                className={CLASES_OPCION_SELECT}
                style={{ height: ALTO_OPCION_SELECT }}
              >
                {/* `min-w-0 truncate` + `shrink-0` en el motivo: sin esto, en un panel estrecho
                    (el panel copia el ancho del disparador) el motivo se parte en dos renglones y se
                    SUPERPONE al nombre de la opción — medido en la revisión del bloque 2 con
                    «Corporativo · Requiere el plan 2» en una ficha de 301 px. */}
                <span className="min-w-0 flex-1 truncate">
                  <SelectPrimitivo.ItemText>{opcion.label}</SelectPrimitivo.ItemText>
                </span>
                {opcion.motivo ? (
                  <span className="ml-auto shrink-0 whitespace-nowrap text-[13px] text-ui-ink-muted">{opcion.motivo}</span>
                ) : null}
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
