"use client";

// components/fields/ChoiceField.tsx — campo del tipo de bloque `choice`. Opciones CURADAS (P7): solo
// las que declara `ChoiceSpec.options`, nunca texto libre. `radiogroup` para ≤ 5 opciones (04 §18);
// con más, se degrada a `<select>` para no saturar el panel.
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";
import type { ChoiceSpec, ChoiceValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface ChoiceFieldProps {
  id: string;
  spec: ChoiceSpec;
  value: string | null; // optionId
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: ChoiceValue) => void;
}

export function ChoiceField({ id, spec, value, esContenidoDeEjemplo, onCommit }: ChoiceFieldProps) {
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"] });

  if (spec.options.length <= 5) {
    return (
      <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo}>
        <RadioGroup
          id={id}
          aria-describedby={describedBy}
          value={value ?? undefined}
          onValueChange={(v) => onCommit({ kind: "choice", optionId: v })}
          className="flex flex-col gap-2"
        >
          {spec.options.map((op) => (
            <label key={op.id} className="flex cursor-pointer items-center gap-2.5 text-ui-body text-ui-ink">
              <RadioGroupItem value={op.id} id={`${id}-${op.id}`} />
              {op.label["es-MX"]}
            </label>
          ))}
        </RadioGroup>
      </FieldShell>
    );
  }

  return (
    <FieldShell id={id} label={spec.label["es-MX"]} help={spec.help?.["es-MX"]} required={spec.required} esContenidoDeEjemplo={esContenidoDeEjemplo}>
      <select
        id={id}
        aria-describedby={describedBy}
        value={value ?? ""}
        onChange={(e) => onCommit({ kind: "choice", optionId: e.target.value })}
        className={CLASES_CONTROL}
      >
        <option value="" disabled>
          Elige una opción…
        </option>
        {spec.options.map((op) => (
          <option key={op.id} value={op.id}>
            {op.label["es-MX"]}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
