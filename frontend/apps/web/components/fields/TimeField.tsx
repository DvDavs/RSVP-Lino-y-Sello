"use client";

// components/fields/TimeField.tsx — campo del tipo de bloque `time`. `<input type="time">`: su valor
// ya es `HH:MM` en 24 h (`esquema/common.ts` `IsoTime`).
import { useEffect, useState } from "react";
import { Input } from "@invitaciones/ui";
import type { TimeSpec, TimeValue } from "@/lib/block-types.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

export interface TimeFieldProps {
  id: string;
  spec: TimeSpec;
  value: string; // IsoTime
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: TimeValue) => void;
}

export function TimeField({ id, spec, value, esContenidoDeEjemplo, onCommit }: TimeFieldProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"] });

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo}>
      <Input
        id={id}
        type="time"
        value={local}
        aria-describedby={describedBy}
        onChange={(e) => {
          setLocal(e.target.value);
          if (e.target.value) onCommit({ kind: "time", value: e.target.value });
        }}
      />
    </FieldShell>
  );
}
