// packages/ui/src/componentes/Chip/Chip.tsx — píldora de 34 px (`11 §5`, fila Chip): seleccionable
// (botón con `aria-pressed`, o `role="checkbox"/"radio"` cuando el consumidor lo agrupa), de
// estado (éxito/aviso/peligro/info/acento), con icono y/o cerrable.
"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { IconoCerrar } from "@invitaciones/icons";
import { cn } from "../../utilidades/cn.ts";
import { conAnilloFoco, useFoco } from "../../utilidades/foco.ts";

const ALTO = 34;

export type TonoChip = "neutro" | "exito" | "aviso" | "peligro" | "info" | "acento";

const claseChip = cva(
  "inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-ui-pill text-[13px] font-semibold transition-[background-color,box-shadow] duration-[var(--ui-dur-2)] ease-ui-out disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      tono: {
        neutro: "",
        exito: "bg-ui-success-soft text-ui-on-success-soft",
        aviso: "bg-ui-warning-soft text-ui-on-warning-soft",
        peligro: "bg-ui-danger-soft text-ui-on-danger-soft",
        info: "bg-ui-info-soft text-ui-on-info-soft",
        acento: "bg-ui-accent text-ui-on-accent",
      },
      seleccionado: {
        true: "bg-ui-primary-soft text-ui-on-primary-soft",
        false: "bg-ui-surface-raised text-ui-ink",
      },
    },
    defaultVariants: { tono: "neutro", seleccionado: false },
  },
);

export interface PropsChip
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | keyof VariantProps<typeof claseChip>> {
  readonly tono?: TonoChip;
  /** Alterna el chip entre seleccionado/no seleccionado (`aria-pressed`). */
  readonly seleccionado?: boolean;
  readonly icono?: ReactNode;
  /** Aparece un botón de cierre; requiere `onCerrar` y una `label` para su nombre accesible. */
  readonly onCerrar?: () => void;
  /** Nombre accesible del botón de cierre (p. ej. «Quitar Jardín»). */
  readonly labelCerrar?: string;
  readonly className?: string;
}

export const Chip = forwardRef<HTMLButtonElement, PropsChip>(function Chip(
  { tono = "neutro", seleccionado, icono, onCerrar, labelCerrar, className, disabled, style, onFocus, onBlur, children, ...resto },
  ref,
) {
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLButtonElement>(onFocus, onBlur);
  const esSeleccionable = seleccionado !== undefined;
  const bordeReposo = tono === "neutro" && !seleccionado ? "inset 0 0 0 1.5px var(--ui-border)" : undefined;

  return (
    <span className="inline-flex items-center">
      <button
        ref={ref}
        type="button"
        aria-pressed={esSeleccionable ? seleccionado : undefined}
        disabled={disabled}
        className={cn(
          claseChip({ tono: tono === "neutro" ? undefined : tono, seleccionado: tono === "neutro" ? Boolean(seleccionado) : undefined }),
          className,
        )}
        style={{
          height: ALTO,
          paddingLeft: 14,
          paddingRight: onCerrar ? 6 : 14,
          boxShadow: conAnilloFoco(enFoco, bordeReposo),
          ...style,
        }}
        data-foco={enFoco ? "true" : "false"}
        onFocus={manejarFoco}
        onBlur={manejarDesenfoque}
        {...resto}
      >
        {icono}
        {children}
        {seleccionado ? (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5 L10 17 L19 7.5" />
          </svg>
        ) : null}
      </button>
      {onCerrar ? (
        <button
          type="button"
          onClick={onCerrar}
          disabled={disabled}
          aria-label={labelCerrar ?? "Quitar"}
          className="-ml-1 inline-grid place-items-center rounded-full text-current hover:bg-ui-surface-alt disabled:cursor-not-allowed"
          style={{ width: 24, height: 24 }}
        >
          <IconoCerrar size={14} aria-hidden />
        </button>
      ) : null}
    </span>
  );
});
