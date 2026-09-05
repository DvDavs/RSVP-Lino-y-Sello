"use client";

// components/fields/BooleanField.tsx — campo del tipo de bloque `boolean` (p. ej. "reproducir música
// al abrir"). Interruptor, no casilla: consistente con `Switch` de mostrar/ocultar sección (04 §18).
import { Switch } from "@/components/ui/switch.tsx";
import type { BooleanSpec, BooleanValue } from "@/lib/block-types.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

export interface BooleanFieldProps {
  id: string;
  spec: BooleanSpec;
  value: boolean;
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: BooleanValue) => void;
}

export function BooleanField({ id, spec, value, esContenidoDeEjemplo, onCommit }: BooleanFieldProps) {
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"] });
  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo}>
      <div className="flex items-center gap-2.5">
        <Switch
          id={id}
          checked={value}
          onCheckedChange={(v) => onCommit({ kind: "boolean", value: v })}
          aria-describedby={describedBy}
          aria-label={spec.label["es-MX"]}
        />
        <span className="text-ui-body text-ui-ink">{value ? "Activado" : "Desactivado"}</span>
      </div>
    </FieldShell>
  );
}
