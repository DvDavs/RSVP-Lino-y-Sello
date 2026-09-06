// packages/ui/src/componentes/Field/Field.tsx — envoltura de campo (`11 §5`, fila Input: «etiqueta
// 14/600 arriba… ayuda 12,5 debajo, error con icono»). Envuelve UN control (Input, Textarea,
// Select, Combobox, RadioGroup, Switch…) y le añade `id`, `aria-invalid` y `aria-describedby` por
// clonación: el control no necesita saber si vive dentro de un `Field` o no.
"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { IconoError } from "@invitaciones/icons";
import { cn } from "../../utilidades/cn.ts";

export interface PropsField {
  /** Identificador del control; si no se da, se genera con `useId()`. */
  readonly id?: string;
  readonly label: ReactNode;
  /** Texto de ayuda (reposo). Se oculta si hay `error`: un campo muestra un solo mensaje. */
  readonly hint?: ReactNode;
  /** Presencia = campo inválido: pinta `aria-invalid`, borde de `danger` y el mensaje con icono. */
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly className?: string;
  /** El control. Debe aceptar `id`, `aria-invalid` y `aria-describedby` (todos los de este paquete). */
  readonly children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}

export function Field({ id, label, hint, error, required, className, children }: PropsField): ReactNode {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;
  const describedBy = error ? idError : hint ? idAyuda : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: idCampo,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={idCampo} className="text-sm text-ui-ink" style={{ fontWeight: 600 }}>
        {label}
        {required ? (
          <span aria-hidden> *</span>
        ) : null}
      </label>
      {control}
      {error ? (
        <span id={idError} role="alert" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ui-danger-text">
          <IconoError size={16} aria-hidden />
          {error}
        </span>
      ) : hint ? (
        <span id={idAyuda} className="text-[12.5px] text-ui-ink-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
