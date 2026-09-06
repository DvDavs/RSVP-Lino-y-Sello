"use client";

// components/fields/ListTextField.tsx — campo del tipo de bloque `listText` (lista corta de textos:
// hashtags, reglas de código de vestir…). Sin arrastre: es una lista corta (≤ 12) y el orden rara vez
// importa aquí, así que basta con Subir/Bajar — la misma alternativa de un solo puntero de §14.4.
import { useEffect, useId, useState } from "react";
import { Button, Input } from "@invitaciones/ui";
import { IconoAgregar, IconoBajar, IconoBorrar, IconoSubir } from "@invitaciones/icons";
import type { ListTextSpec, ListTextValue } from "@/lib/block-types.ts";
import { es_MX } from "@/lib/i18n.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";

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
            <Input
              type="text"
              value={texto}
              aria-label={es_MX.editor.campo.elementoDe(i + 1, spec.label["es-MX"])}
              maxLength={maxItemLength}
              onChange={(e) => {
                const copia = [...items];
                copia[i] = e.target.value;
                commit(copia);
              }}
            />
            <Button
              variant="icono"
              size="sm"
              aria-label={es_MX.editor.campo.moverArriba(i + 1)}
              disabled={i === 0}
              onClick={() => {
                const copia = [...items];
                [copia[i - 1], copia[i]] = [copia[i] as string, copia[i - 1] as string];
                commit(copia);
              }}
            >
              <IconoSubir size={18} tone="mono" />
            </Button>
            <Button
              variant="icono"
              size="sm"
              aria-label={es_MX.editor.campo.moverAbajo(i + 1)}
              disabled={i === items.length - 1}
              onClick={() => {
                const copia = [...items];
                [copia[i], copia[i + 1]] = [copia[i + 1] as string, copia[i] as string];
                commit(copia);
              }}
            >
              <IconoBajar size={18} tone="mono" />
            </Button>
            <Button
              variant="icono"
              size="sm"
              aria-label={es_MX.editor.campo.quitarElemento(i + 1)}
              onClick={() => commit(items.filter((_, j) => j !== i))}
              className="text-ui-danger-text hover:bg-ui-danger-soft"
            >
              <IconoBorrar size={18} tone="mono" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secundario" size="sm" disabled={items.length >= maxItems} onClick={() => commit([...items, ""])} className="self-start">
        <IconoAgregar size={18} tone="mono" />
        {es_MX.editor.fotos.agregar}
      </Button>
    </FieldShell>
  );
}
