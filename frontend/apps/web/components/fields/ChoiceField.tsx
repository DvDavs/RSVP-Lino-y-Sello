"use client";

// components/fields/ChoiceField.tsx — campo del tipo de bloque `choice`. Opciones CURADAS (P7): solo
// las que declara `ChoiceSpec.options`, nunca texto libre.
//
// El corte de las cinco opciones es el de `11 §5`: `RadioGroup` con opción grande hasta cinco (todo
// visible, sin abrir nada) y `Combobox` con búsqueda a partir de seis (el `Select` del sistema es
// para listas cortas y fijas). Los dos exponen el patrón ARIA correcto — `radiogroup`/`radio` y
// `combobox`+`listbox` — y los dos son controles PROPIOS: aquí no queda ningún `<select>` nativo.
import { Combobox, RadioGroup } from "@invitaciones/ui";
import type { ChoiceSpec, ChoiceValue } from "@/lib/block-types.ts";
import { es_MX } from "@/lib/i18n.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

export interface ChoiceFieldProps {
  id: string;
  spec: ChoiceSpec;
  value: string | null; // optionId
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: ChoiceValue) => void;
}

export function ChoiceField({ id, spec, value, esContenidoDeEjemplo, onCommit }: ChoiceFieldProps) {
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"] });
  const etiqueta = spec.label["es-MX"];
  const opciones = spec.options.map((op) => ({ value: op.id, label: op.label["es-MX"] }));

  return (
    <FieldShell
      id={id}
      label={etiqueta}
      help={spec.help?.["es-MX"]}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
    >
      {spec.options.length <= 5 ? (
        <RadioGroup
          id={id}
          aria-label={etiqueta}
          aria-describedby={describedBy}
          value={value ?? undefined}
          onValueChange={(v) => onCommit({ kind: "choice", optionId: v })}
          opciones={opciones}
        />
      ) : (
        <Combobox
          id={id}
          aria-label={etiqueta}
          aria-describedby={describedBy}
          value={value ?? undefined}
          onValueChange={(v) => onCommit({ kind: "choice", optionId: v })}
          opciones={opciones}
          placeholder={es_MX.editor.campo.elegirOpcion}
        />
      )}
    </FieldShell>
  );
}
