// packages/ui/src/componentes/Textarea/Textarea.tsx — como Input, alto mínimo 96 px, contador
// opcional («0/280») que aparece al 80 % del límite (`11 §5`, fila Textarea).
"use client";

import { forwardRef, useId, useState, type CSSProperties, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utilidades/cn.ts";
import { useFoco } from "../../utilidades/foco.ts";
import { sombraControl } from "../../utilidades/controlSombra.ts";

const ALTO_MINIMO = 96;

export type PropsTextarea = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  readonly invalido?: boolean;
  /** Límite de caracteres. Con él aparece el contador «n/límite» al llegar al 80 %. */
  readonly limite?: number;
};

export const Textarea = forwardRef<HTMLTextAreaElement, PropsTextarea>(function Textarea(
  {
    className,
    style,
    disabled,
    invalido,
    limite,
    defaultValue,
    value,
    onChange,
    onFocus,
    onBlur,
    "aria-describedby": ariaDescribedByProp,
    ...resto
  },
  ref,
) {
  const { enFoco, onFocus: manejarFoco, onBlur: manejarDesenfoque } = useFoco<HTMLTextAreaElement>(onFocus, onBlur);
  const idContador = useId();
  const [longitud, setLongitud] = useState(() => String(value ?? defaultValue ?? "").length);
  const esControlado = value !== undefined;

  const estilo: CSSProperties = {
    minHeight: ALTO_MINIMO,
    boxShadow: sombraControl({ enFoco, invalido, deshabilitado: disabled }),
    ...style,
  };

  const mostrarContador = typeof limite === "number" && longitud >= limite * 0.8;

  return (
    <div className="grid gap-1">
      <textarea
        ref={ref}
        className={cn(
          "w-full min-w-0 resize-y rounded-ui-control bg-ui-surface-raised px-[14px] py-3 text-base text-ui-ink placeholder:text-ui-ink-placeholder outline-none transition-[box-shadow] duration-[var(--ui-dur-1)] ease-ui-out disabled:cursor-not-allowed disabled:bg-ui-surface-alt disabled:text-ui-ink-muted",
          className,
        )}
        style={estilo}
        disabled={disabled}
        aria-invalid={invalido || undefined}
        aria-describedby={cn(ariaDescribedByProp, mostrarContador ? idContador : undefined).trim() || undefined}
        value={value}
        defaultValue={esControlado ? undefined : defaultValue}
        maxLength={limite}
        data-foco={enFoco ? "true" : "false"}
        onFocus={manejarFoco}
        onBlur={manejarDesenfoque}
        onChange={(evento) => {
          setLongitud(evento.target.value.length);
          onChange?.(evento);
        }}
        {...resto}
      />
      {mostrarContador ? (
        <span id={idContador} aria-live="polite" className="justify-self-end text-[12.5px] text-ui-ink-muted">
          {longitud}/{limite}
        </span>
      ) : null}
    </div>
  );
});
