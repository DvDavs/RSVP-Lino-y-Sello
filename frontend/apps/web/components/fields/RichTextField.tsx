"use client";

// components/fields/RichTextField.tsx — editor PROPIO mínimo del tipo de bloque `richText`
// (negrita, cursiva, enlace — `lib/rich-text.ts`). NO usa Tiptap (`preguntas-abiertas.md`).
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@invitaciones/ui";
import { IconoEnlace } from "@invitaciones/icons";
import type { RichTextSpec, RichTextValue } from "@/lib/block-types.ts";
import { es_MX } from "@/lib/i18n.ts";
import { FieldShell, describedByPara } from "./FieldShell.tsx";
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
    help: spec.help?.["es-MX"] ?? es_MX.editor.campo.ayudaTextoRico,
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
      help={spec.help?.["es-MX"] ?? es_MX.editor.campo.ayudaTextoRico}
      required={spec.required}
      esContenidoDeEjemplo={esContenidoDeEjemplo}
      counter={`${longitud}/${maxLength}`}
      error={error}
    >
      <div className="flex gap-1" role="toolbar" aria-label={es_MX.editor.campo.formato}>
        <BotonDeFormato etiqueta={es_MX.editor.campo.negrita} onClick={() => envolverSeleccion("**")}>
          {/* Negrita y cursiva se dibujan con la propia voz `display` del sistema, no con un icono
              genérico: son las dos letras que todo el mundo reconoce y ya las tenemos en la fuente. */}
          <span aria-hidden="true" className="font-ui-display text-[17px] font-extrabold leading-none">
            B
          </span>
        </BotonDeFormato>
        <BotonDeFormato etiqueta={es_MX.editor.campo.cursiva} onClick={() => envolverSeleccion("_")}>
          <span aria-hidden="true" className="font-ui-display text-[17px] italic leading-none">
            I
          </span>
        </BotonDeFormato>
        <BotonDeFormato etiqueta={es_MX.editor.campo.enlace} onClick={() => envolverSeleccion("[", "](https://)")}>
          <IconoEnlace size={18} tone="mono" />
        </BotonDeFormato>
      </div>
      <Textarea
        id={id}
        rows={4}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
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

/** Botón de la barra de formato: 44 px de objetivo (2.5.8), anillo de foco del sistema. */
function BotonDeFormato({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-ui-control border-[1.5px] border-ui-border bg-ui-surface-raised text-ui-ink transition-colors duration-100 ease-ui-out hover:bg-ui-surface-alt focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface"
    >
      {children}
    </button>
  );
}
