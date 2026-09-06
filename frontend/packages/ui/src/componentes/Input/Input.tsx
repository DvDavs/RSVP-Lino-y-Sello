// packages/ui/src/componentes/Input/Input.tsx — control de texto (`11 §5`, fila Input): 46 px de
// alto, radio de control, borde de 1,5 px que pasa a 2 px `primary` + anillo al enfocar o a
// `danger` con `aria-invalid`. Se usa dentro de `Field` normalmente, pero funciona solo.
"use client";

import { forwardRef, type CSSProperties, type InputHTMLAttributes } from "react";
import { cn } from "../../utilidades/cn.ts";
import { useFoco } from "../../utilidades/foco.ts";
import { sombraControl } from "../../utilidades/controlSombra.ts";

const ALTO_CONTROL = 46;

export type PropsInput = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  readonly invalido?: boolean;
};

export const Input = forwardRef<HTMLInputElement, PropsInput>(function Input(
  { className, style, disabled, invalido, "aria-invalid": ariaInvalidProp, onFocus, onBlur, ...resto },
  ref,
) {
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLInputElement>(onFocus, onBlur);
  const esInvalido = invalido ?? (ariaInvalidProp === true || ariaInvalidProp === "true");

  const estilo: CSSProperties = {
    height: ALTO_CONTROL,
    boxShadow: sombraControl({ enFoco, invalido: esInvalido, deshabilitado: disabled }),
    ...style,
  };

  return (
    <input
      ref={ref}
      className={cn(
        "w-full min-w-0 rounded-ui-control bg-ui-surface-raised px-[14px] text-base text-ui-ink placeholder:text-ui-ink-placeholder outline-none transition-[box-shadow] duration-[var(--ui-dur-1)] ease-ui-out disabled:cursor-not-allowed disabled:bg-ui-surface-alt disabled:text-ui-ink-muted",
        className,
      )}
      style={estilo}
      disabled={disabled}
      aria-invalid={esInvalido || undefined}
      data-foco={enFoco ? "true" : "false"}
      onFocus={manejarFoco}
      onBlur={manejarDesenfoque}
      {...resto}
    />
  );
});
