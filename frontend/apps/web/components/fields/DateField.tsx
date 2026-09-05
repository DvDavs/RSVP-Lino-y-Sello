"use client";

// components/fields/DateField.tsx — campo del tipo de bloque `date`. `<input type="date">` nativo:
// su valor YA es `YYYY-MM-DD` (`esquema/common.ts` `IsoDate`), así que no hace falta re-validar el
// formato — el propio control del navegador lo impide.
import { useEffect, useState } from "react";
import type { DateSpec, DateValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface DateFieldProps {
  id: string;
  spec: DateSpec;
  value: string; // IsoDate
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: DateValue) => void;
}

export function DateField({ id, spec, value, esContenidoDeEjemplo, onCommit }: DateFieldProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"] });

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo}>
      <input
        id={id}
        type="date"
        value={local}
        aria-describedby={describedBy}
        className={CLASES_CONTROL}
        onChange={(e) => {
          setLocal(e.target.value);
          if (e.target.value) onCommit({ kind: "date", value: e.target.value });
        }}
      />
    </FieldShell>
  );
}
