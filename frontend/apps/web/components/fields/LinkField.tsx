"use client";

// components/fields/LinkField.tsx — campo del tipo de bloque `link` (p. ej. el hashtag o "más info").
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { LinkSpec, LinkValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface LinkFieldProps {
  id: string;
  spec: LinkSpec;
  value: { href: string; label?: string };
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: LinkValue) => void;
}

const schema = z.object({
  href: z
    .string()
    .max(2048)
    .regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "Escribe una dirección web completa, con http:// o https://."),
  label: z.string().max(80, "Como máximo 80 caracteres.").optional(),
});

export function LinkField({ id, spec, value, esContenidoDeEjemplo, onCommit }: LinkFieldProps) {
  const { register, formState, reset, trigger, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { href: value.href, label: value.label ?? "" },
    mode: "onChange",
  });
  const hrefRef = useRef<HTMLInputElement | null>(null);
  const labelRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (document.activeElement === hrefRef.current || document.activeElement === labelRef.current) return;
    reset({ href: value.href, label: value.label ?? "" });
  }, [value.href, value.label]);

  async function alCambiar(): Promise<void> {
    const ok = await trigger();
    if (!ok) return;
    const v = getValues();
    onCommit(v.label ? { kind: "link", href: v.href, label: v.label } : { kind: "link", href: v.href });
  }

  const error = formState.errors.href?.message ?? formState.errors.label?.message;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });
  const { ref: hrefRhfRef, onChange: hrefOnChange, ...hrefRegistrados } = register("href");
  const { ref: labelRhfRef, onChange: labelOnChange, ...labelRegistrados } = register("label");

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo} error={error}>
      <div className="flex flex-col gap-2">
        <input
          id={id}
          type="url"
          placeholder="https://…"
          aria-invalid={Boolean(formState.errors.href) || undefined}
          aria-describedby={describedBy}
          className={CLASES_CONTROL}
          {...hrefRegistrados}
          onChange={(e) => {
            void hrefOnChange(e);
            void alCambiar();
          }}
          ref={(el) => {
            hrefRhfRef(el);
            hrefRef.current = el;
          }}
        />
        <input
          type="text"
          placeholder="Texto del enlace (opcional)"
          aria-label={`Texto visible de ${spec.label["es-MX"]}`}
          className={CLASES_CONTROL}
          {...labelRegistrados}
          onChange={(e) => {
            void labelOnChange(e);
            void alCambiar();
          }}
          ref={(el) => {
            labelRhfRef(el);
            labelRef.current = el;
          }}
        />
      </div>
    </FieldShell>
  );
}
