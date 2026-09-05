"use client";

// components/fields/DateTimeRangeField.tsx — campo del tipo de bloque `dateTimeRange` (p. ej. "de la
// ceremonia a la recepción"). `<input type="datetime-local">` produce `YYYY-MM-DDTHH:MM`, igual que
// `IsoLocalDateTime` (`esquema/common.ts`). El fin es opcional (I-01 del servidor exige `end ≥ start`
// cuando existe; aquí se avisa antes de guardar, no se re-implementa la invariante completa).
import { useEffect, useState } from "react";
import type { DateTimeRangeSpec, DateTimeRangeValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface DateTimeRangeFieldProps {
  id: string;
  spec: DateTimeRangeSpec;
  value: { start: string; end?: string };
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: DateTimeRangeValue) => void;
}

export function DateTimeRangeField({ id, spec, value, esContenidoDeEjemplo, onCommit }: DateTimeRangeFieldProps) {
  const [start, setStart] = useState(value.start);
  const [end, setEnd] = useState(value.end ?? "");
  useEffect(() => {
    setStart(value.start);
    setEnd(value.end ?? "");
  }, [value.start, value.end]);

  const error = start && end && end < start ? "La hora de fin no puede ser antes que la de inicio." : undefined;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });

  function intentarGuardar(nuevoStart: string, nuevoEnd: string): void {
    if (!nuevoStart) return;
    if (nuevoEnd && nuevoEnd < nuevoStart) return; // no se guarda un rango inválido
    onCommit(nuevoEnd ? { kind: "dateTimeRange", start: nuevoStart, end: nuevoEnd } : { kind: "dateTimeRange", start: nuevoStart });
  }

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo} error={error}>
      <div className="flex flex-col gap-2 sm:flex-row" id={id} aria-describedby={describedBy}>
        <label className="flex flex-1 flex-col gap-1 text-ui-eyebrow text-ui-ink-muted">
          Empieza
          <input
            type="datetime-local"
            value={start}
            className={CLASES_CONTROL}
            onChange={(e) => {
              setStart(e.target.value);
              intentarGuardar(e.target.value, end);
            }}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-ui-eyebrow text-ui-ink-muted">
          Termina (opcional)
          <input
            type="datetime-local"
            value={end}
            className={CLASES_CONTROL}
            onChange={(e) => {
              setEnd(e.target.value);
              intentarGuardar(start, e.target.value);
            }}
          />
        </label>
      </div>
    </FieldShell>
  );
}
