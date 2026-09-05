"use client";

// components/fields/PersonField.tsx — campo del tipo de bloque `person` (padrinos, testigos…).
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { PersonSpec, PersonValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface PersonFieldProps {
  id: string;
  spec: PersonSpec;
  value: { name: string; note?: string };
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: PersonValue) => void;
}

const schema = z.object({
  name: z.string().min(1, "Escribe un nombre.").max(120, "Como máximo 120 caracteres."),
  note: z.string().max(200, "Como máximo 200 caracteres.").optional(),
});

export function PersonField({ id, spec, value, esContenidoDeEjemplo, onCommit }: PersonFieldProps) {
  const { register, formState, reset, trigger, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: value.name, note: value.note ?? "" },
    mode: "onChange",
  });
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (document.activeElement === nameRef.current) return;
    reset({ name: value.name, note: value.note ?? "" });
  }, [value.name, value.note]);

  async function alCambiar(): Promise<void> {
    const ok = await trigger();
    if (!ok) return;
    const v = getValues();
    onCommit(v.note ? { kind: "person", name: v.name, note: v.note } : { kind: "person", name: v.name });
  }

  const error = formState.errors.name?.message ?? formState.errors.note?.message;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });
  const { ref: nameRhfRef, onChange: nameOnChange, ...nameRegistrados } = register("name");
  const registroNota = register("note");

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo} error={error}>
      <div className="flex flex-col gap-2">
        <input
          id={id}
          type="text"
          placeholder="Nombre"
          aria-invalid={Boolean(formState.errors.name) || undefined}
          aria-describedby={describedBy}
          className={CLASES_CONTROL}
          {...nameRegistrados}
          onChange={(e) => {
            void nameOnChange(e);
            void alCambiar();
          }}
          ref={(el) => {
            nameRhfRef(el);
            nameRef.current = el;
          }}
        />
        <input
          type="text"
          placeholder="Nota (opcional, p. ej. «Padrino de velación»)"
          aria-label={`Nota de ${spec.label["es-MX"]}`}
          className={CLASES_CONTROL}
          {...registroNota}
          onChange={(e) => {
            void registroNota.onChange(e);
            void alCambiar();
          }}
        />
      </div>
    </FieldShell>
  );
}
