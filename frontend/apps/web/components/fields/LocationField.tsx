"use client";

// components/fields/LocationField.tsx — campo del tipo de bloque `location` (lugar de la ceremonia,
// recepción…). `name` es obligatorio; `address` y `mapHref` opcionales.
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@invitaciones/ui";
import type { LocationSpec, LocationValue } from "@/lib/block-types.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

export interface LocationFieldProps {
  id: string;
  spec: LocationSpec;
  value: { name: string; address?: string; mapHref?: string };
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: LocationValue) => void;
}

const schema = z.object({
  name: z.string().min(1, "Escribe el nombre del lugar.").max(120, "Como máximo 120 caracteres."),
  address: z.string().max(300, "Como máximo 300 caracteres.").optional(),
  mapHref: z
    .union([z.string().regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i, "Escribe un enlace de mapa completo (http:// o https://)."), z.literal("")])
    .optional(),
});

export function LocationField({ id, spec, value, esContenidoDeEjemplo, onCommit }: LocationFieldProps) {
  const { register, formState, reset, trigger, getValues } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: value.name, address: value.address ?? "", mapHref: value.mapHref ?? "" },
    mode: "onChange",
  });
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (document.activeElement === nameRef.current) return;
    reset({ name: value.name, address: value.address ?? "", mapHref: value.mapHref ?? "" });
  }, [value.name, value.address, value.mapHref]);

  async function alCambiar(): Promise<void> {
    const ok = await trigger();
    if (!ok) return;
    const v = getValues();
    const salida: LocationValue = { kind: "location", name: v.name };
    if (v.address) salida.address = v.address;
    if (v.mapHref) salida.mapHref = v.mapHref;
    onCommit(salida);
  }

  const error = formState.errors.name?.message ?? formState.errors.address?.message ?? formState.errors.mapHref?.message;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });
  const { ref: nameRhfRef, onChange: nameOnChange, ...nameRegistrados } = register("name");
  const registroDireccion = register("address");
  const registroMapa = register("mapHref");

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo} error={error}>
      <div className="flex flex-col gap-2">
        <Input
          id={id}
          type="text"
          placeholder="Nombre del lugar"
          aria-invalid={Boolean(formState.errors.name) || undefined}
          aria-describedby={describedBy}
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
        <Input
          type="text"
          placeholder="Dirección (opcional)"
          aria-label={`Dirección de ${spec.label["es-MX"]}`}
          {...registroDireccion}
          onChange={(e) => {
            void registroDireccion.onChange(e);
            void alCambiar();
          }}
        />
        <Input
          type="url"
          placeholder="Enlace al mapa (opcional)"
          aria-label={`Enlace al mapa de ${spec.label["es-MX"]}`}
          {...registroMapa}
          onChange={(e) => {
            void registroMapa.onChange(e);
            void alCambiar();
          }}
        />
      </div>
    </FieldShell>
  );
}
