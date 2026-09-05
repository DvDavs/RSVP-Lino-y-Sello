"use client";

// components/fields/RichTextField.tsx — editor PROPIO mínimo del tipo de bloque `richText`
// (negrita, cursiva, enlace — `lib/rich-text.ts`). NO usa Tiptap (`preguntas-abiertas.md`).
import { zodResolver } from "@hookform/resolvers/zod";
import { Bold, Italic, Link2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { RichTextSpec, RichTextValue } from "@/lib/block-types.ts";
import { CLASES_CONTROL, FieldShell, describedByPara } from "./FieldShell.tsx";
import { longitudVisible, richDocATextoAMarcado, textoAMarcadoARichDoc } from "@/lib/rich-text.ts";

export interface RichTextFieldProps {
  id: string;
  spec: RichTextSpec;
  value: RichTextValue["doc"];
  esContenidoDeEjemplo?: boolean;
  onCommit: (value: RichTextValue) => void;
}

export function RichTextField({ id, spec, value, esContenidoDeEjemplo, onCommit }: RichTextFieldProps) {
  const maxLength = spec.constraints.maxLength;
  const textoInicial = richDocATextoAMarcado(value);
  const schema = z.object({
    texto: z.string().refine((t) => longitudVisible(textoAMarcadoARichDoc(t)) <= maxLength, {
      message: `Como máximo ${maxLength} caracteres de texto visible.`,
    }),
  });
  const { register, formState, reset, trigger, getValues, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { texto: textoInicial },
    mode: "onChange",
  });
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (document.activeElement === areaRef.current) return;
    reset({ texto: richDocATextoAMarcado(value) });
  }, [textoInicial]);

  const error = formState.errors.texto?.message;
  const describedBy = describedByPara(id, {
    help: spec.help?.["es-MX"] ?? "Selecciona texto y usa los botones para resaltarlo o convertirlo en enlace.",
    error,
  });
  const { ref: rhfRef, onChange: rhfOnChange, ...registrados } = register("texto");

  async function alCambiar(): Promise<void> {
    const ok = await trigger("texto");
    if (!ok) return;
    const texto = getValues("texto");
    onCommit({ kind: "richText", doc: textoAMarcadoARichDoc(texto) });
  }

  function envolverSeleccion(izquierda: string, derecha: string = izquierda): void {
    const area = areaRef.current;
    if (!area) return;
    const inicio = area.selectionStart;
    const fin = area.selectionEnd;
    const actual = getValues("texto");
    const seleccionado = actual.slice(inicio, fin) || "texto";
    const nuevo = `${actual.slice(0, inicio)}${izquierda}${seleccionado}${derecha}${actual.slice(fin)}`;
    setValue("texto", nuevo, { shouldDirty: true, shouldValidate: true });
    void alCambiar();
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(inicio + izquierda.length, inicio + izquierda.length + seleccionado.length);
    });
  }

  const longitud = longitudVisible(textoAMarcadoARichDoc(getValues("texto") ?? textoInicial));

  return (
    <FieldShell
      id={id}
      label={spec.label["es-MX"]}
      help={spec.help?.["es-MX"] ?? "Selecciona texto y usa los botones para resaltarlo o convertirlo en enlace."}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
      counter={`${longitud}/${maxLength}`}
      error={error}
    >
      <div className="flex gap-1" role="toolbar" aria-label="Formato de texto">
        <button
          type="button"
          aria-label="Negrita"
          onClick={() => envolverSeleccion("**")}
          className="flex size-9 items-center justify-center rounded-ui-control border border-ui-border-field text-ui-ink hover:bg-ui-bg-alt"
        >
          <Bold aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Cursiva"
          onClick={() => envolverSeleccion("_")}
          className="flex size-9 items-center justify-center rounded-ui-control border border-ui-border-field text-ui-ink hover:bg-ui-bg-alt"
        >
          <Italic aria-hidden="true" className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Enlace"
          onClick={() => envolverSeleccion("[", "](https://)")}
          className="flex size-9 items-center justify-center rounded-ui-control border border-ui-border-field text-ui-ink hover:bg-ui-bg-alt"
        >
          <Link2 aria-hidden="true" className="size-4" />
        </button>
      </div>
      <textarea
        id={id}
        rows={4}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={`${CLASES_CONTROL} h-auto min-h-24 resize-y py-2.5`}
        {...registrados}
        onChange={(e) => {
          void rhfOnChange(e);
          void alCambiar();
        }}
        ref={(el) => {
          rhfRef(el);
          areaRef.current = el;
        }}
      />
    </FieldShell>
  );
}
