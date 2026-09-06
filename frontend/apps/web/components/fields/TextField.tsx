"use client";

// components/fields/TextField.tsx — campo del tipo de bloque `text` (04 §6.3, U-17).
//
// U-17 (`04 §20.1`): un `TextSpec` con `maxLength: 40` impide guardar con 41 caracteres y anuncia el
// error con `aria-describedby`. La validación es `react-hook-form` + resolver Zod CONSTRUIDO DESDE
// EL `BlockSpec` (`spec.constraints.{minLength,maxLength,multiline}`) — el mismo esquema que valida
// el servidor, así que un texto que el panel deja escribir siempre pasa la operación real.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input, Textarea } from "@invitaciones/ui";
import type { TextSpec, TextValue } from "@/lib/block-types.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

export interface TextFieldProps {
  id: string;
  spec: TextSpec;
  value: string;
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: TextValue) => void;
}

export function TextField({ id, spec, value, esContenidoDeEjemplo, onCommit }: TextFieldProps) {
  const { minLength, maxLength, multiline } = spec.constraints;
  const schema = z.object({
    value: z
      .string()
      .min(minLength, minLength > 0 ? `Escribe al menos ${minLength} caracteres.` : "")
      .max(maxLength, `Como máximo ${maxLength} caracteres — tiene ${maxLength + 1} o más.`),
  });
  const { register, formState, reset, trigger, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { value },
    mode: "onChange",
  });
  const elementoRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (document.activeElement === elementoRef.current) return; // no pisar mientras el cliente escribe
    reset({ value });
  }, [value, reset]);

  const error = formState.errors.value?.message;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });
  const { ref: rhfRef, onChange: rhfOnChange, ...registrados } = register("value");

  async function alCambiar(evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): Promise<void> {
    await rhfOnChange(evento);
    const ok = await trigger("value");
    if (!ok) return; // U-17: no se guarda un valor inválido
    const actual = getValues("value");
    if (actual !== value) onCommit({ kind: "text", value: actual });
  }

  const longitudActual = getValues("value")?.length ?? value.length;
  const contador = `${longitudActual}/${maxLength}`;
  const compartido = {
    id,
    ...registrados,
    onChange: alCambiar,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": describedBy,
  } as const;

  return (
    <FieldShell
      id={id}
      label={spec.label["es-MX"]}
      help={spec.help?.["es-MX"]}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
      counter={contador}
      error={error}
    >
      {multiline ? (
        <Textarea
          {...compartido}
          rows={4}
          ref={(el) => {
            rhfRef(el);
            elementoRef.current = el;
          }}
        />
      ) : (
        <Input
          {...compartido}
          type="text"
          ref={(el) => {
            rhfRef(el);
            elementoRef.current = el;
          }}
        />
      )}
    </FieldShell>
  );
}
