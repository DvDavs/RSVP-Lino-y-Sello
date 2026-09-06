// packages/ui/src/componentes/Checkbox/Checkbox.tsx — casilla grande (`11 §5`, fila Radio/Checkbox):
// 26 px, borde de 2 px, marca de 12-16 px. Radix Checkbox aporta `role="checkbox"`, `aria-checked`
// y el manejo de teclado (Espacio); el aspecto es propio. Con `label`, envuelve todo en un
// `<label>` — `<button>` es «labelable» (HTML Living Standard), así que un clic en el texto
// activa el botón sin JS adicional — y sube el objetivo a 44 px (11 §5, columna móvil).
"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import * as CheckboxPrimitivo from "@radix-ui/react-checkbox";
import { cn } from "../../utilidades/cn.ts";
import { conAnilloFoco, useFoco } from "../../utilidades/foco.ts";

const LADO = 26;

export interface PropsCheckbox
  extends Omit<CheckboxPrimitivo.CheckboxProps, "asChild" | "children"> {
  /** Texto de la fila. Sin él, el consumidor debe dar `aria-label`. */
  readonly label?: ReactNode;
  /** Texto secundario a la derecha (p. ej. «2 lugares»). Solo tiene sentido junto a `label`. */
  readonly meta?: ReactNode;
  readonly className?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, PropsCheckbox>(function Checkbox(
  { label, meta, className, disabled, onFocus, onBlur, ...resto },
  ref,
) {
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLButtonElement>(onFocus, onBlur);

  const casilla = (
    <CheckboxPrimitivo.Root
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[8px] bg-ui-surface-raised transition-[box-shadow,background-color] duration-[var(--ui-dur-1)] ease-ui-out data-[state=checked]:bg-ui-primary disabled:opacity-45 disabled:cursor-not-allowed",
        !label && className,
      )}
      style={{
        width: LADO,
        height: LADO,
        boxShadow: conAnilloFoco(enFoco, "inset 0 0 0 2px var(--ui-border)"),
      }}
      data-foco={enFoco ? "true" : "false"}
      onFocus={manejarFoco}
      onBlur={manejarDesenfoque}
      {...resto}
    >
      <CheckboxPrimitivo.Indicator>
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="var(--ui-on-primary)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5 L10 17 L19 7.5" />
        </svg>
      </CheckboxPrimitivo.Indicator>
    </CheckboxPrimitivo.Root>
  );

  if (!label) return casilla;

  const estiloFila: CSSProperties = { minHeight: 44 };

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 text-[15px] text-ui-ink",
        disabled && "cursor-not-allowed opacity-45",
        className,
      )}
      style={estiloFila}
    >
      {casilla}
      <span>{label}</span>
      {meta ? <span className="ml-auto text-[13px] font-medium text-ui-ink-muted">{meta}</span> : null}
    </label>
  );
});
