"use client";

// components/fields/ListTextField.tsx — campo del tipo de bloque `listText` (lista corta de textos:
// hashtags, reglas de código de vestir…). Sin arrastre: es una lista corta (≤ 12) y el orden rara vez
// importa aquí, así que basta con Subir/Bajar — la misma alternativa de un solo puntero de §14.4.
import { useEffect, useId, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ListTextSpec, ListTextValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";

export interface ListTextFieldProps {
  id: string;
  spec: ListTextSpec;
  value: string[];
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: ListTextValue) => void;
}

export function ListTextField({ id, spec, value, esContenidoDeEjemplo, onCommit }: ListTextFieldProps) {
  const { minItems, maxItems, maxItemLength } = spec.constraints;
  const [items, setItems] = useState<string[]>(value);
  const idBase = useId();

  useEffect(() => setItems(value), [value]);

  function commit(nuevo: string[]): void {
    setItems(nuevo);
    onCommit({ kind: "listText", items: nuevo });
  }

  const errorLargo = items.find((t) => t.length > maxItemLength) !== undefined;
  const errorPocos = items.length < minItems;
  const error = errorLargo
    ? `Cada elemento admite como máximo ${maxItemLength} caracteres.`
    : errorPocos
      ? `Agrega al menos ${minItems} elemento(s).`
      : undefined;
  const describedBy = describedByPara(id, { help: spec.help?.["es-MX"], error });

  return (
    <FieldShell
      id={id}
      label={spec.label["es-MX"]}
      help={spec.help?.["es-MX"]}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
      counter={`${items.length}/${maxItems}`}
      error={error}
    >
      <ul id={id} aria-describedby={describedBy} className="flex flex-col gap-2">
        {items.map((texto, i) => (
          <li key={`${idBase}-${i}`} className="flex items-center gap-1.5">
            <input
              type="text"
              value={texto}
              aria-label={`Elemento ${i + 1} de ${spec.label["es-MX"]}`}
              maxLength={maxItemLength}
              onChange={(e) => {
                const copia = [...items];
                copia[i] = e.target.value;
                commit(copia);
              }}
              className={CLASES_CONTROL}
            />
            <button
              type="button"
              aria-label={`Mover el elemento ${i + 1} arriba`}
              disabled={i === 0}
              onClick={() => {
                const copia = [...items];
                [copia[i - 1], copia[i]] = [copia[i] as string, copia[i - 1] as string];
                commit(copia);
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-ui-control text-ui-ink-muted hover:bg-ui-bg-alt disabled:opacity-30"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Mover el elemento ${i + 1} abajo`}
              disabled={i === items.length - 1}
              onClick={() => {
                const copia = [...items];
                [copia[i], copia[i + 1]] = [copia[i + 1] as string, copia[i] as string];
                commit(copia);
              }}
              className="flex size-9 shrink-0 items-center justify-center rounded-ui-control text-ui-ink-muted hover:bg-ui-bg-alt disabled:opacity-30"
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Quitar elemento ${i + 1}`}
              onClick={() => commit(items.filter((_, j) => j !== i))}
              className="flex size-9 shrink-0 items-center justify-center rounded-ui-control text-ui-danger hover:bg-red-50"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={items.length >= maxItems}
        onClick={() => commit([...items, ""])}
        className="flex h-9 items-center gap-1.5 self-start rounded-ui-control border border-dashed border-ui-border-field px-3 text-ui-aux font-semibold text-ui-accent disabled:opacity-40"
      >
        <Plus aria-hidden="true" className="size-4" /> Agregar
      </button>
    </FieldShell>
  );
}
