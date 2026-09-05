// lib/rich-text.ts — editor PROPIO mínimo sobre `RichDoc` (`esquema/blocks.ts`), no Tiptap
// (`preguntas-abiertas.md`, supuesto tomado en fase 1: "editor propio mínimo… se reevalúa si el
// catálogo de marcas crece"). `RichDoc` solo admite `bold`/`italic`/`href` (`RichSpan.marks`), así
// que el editor usa una sintaxis de texto plano mínima — `**negrita**`, `_cursiva_`,
// `[texto](https://…)` — que estas dos funciones puras convierten en `RichDoc` y de vuelta. NUNCA hay
// HTML de por medio (17.6: "prohibido `dangerouslySetInnerHTML`, prohibido serializar a cadena
// HTML"): aquí no existe ni una etiqueta, solo texto y una estructura de datos.
import type { RichDoc } from "./block-types.ts";

const PATRON_TOKEN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|_([^_]+)_/g;

/** Texto plano (con marcadores) → `RichDoc`. Párrafos separados por una línea en blanco. */
export function textoAMarcadoARichDoc(texto: string): RichDoc {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parrafos.length === 0) return { type: "doc", content: [] };

  return {
    type: "doc",
    content: parrafos.slice(0, 40).map((parrafo) => ({
      type: "paragraph",
      content: tokenizarParrafo(parrafo),
    })),
  };
}

function tokenizarParrafo(parrafo: string): RichDoc["content"][number]["content"] {
  const spans: RichDoc["content"][number]["content"] = [];
  let ultimo = 0;
  PATRON_TOKEN.lastIndex = 0;
  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = PATRON_TOKEN.exec(parrafo)) !== null) {
    if (coincidencia.index > ultimo) {
      spans.push({ type: "text", text: parrafo.slice(ultimo, coincidencia.index) });
    }
    const [, textoEnlace, href, textoNegrita, textoCursiva] = coincidencia;
    if (textoEnlace !== undefined && href !== undefined) {
      spans.push({ type: "text", text: textoEnlace, href });
    } else if (textoNegrita !== undefined) {
      spans.push({ type: "text", text: textoNegrita, marks: ["bold"] });
    } else if (textoCursiva !== undefined) {
      spans.push({ type: "text", text: textoCursiva, marks: ["italic"] });
    }
    ultimo = coincidencia.index + coincidencia[0].length;
  }
  if (ultimo < parrafo.length) spans.push({ type: "text", text: parrafo.slice(ultimo) });
  if (spans.length === 0) spans.push({ type: "text", text: parrafo });
  return spans.slice(0, 50);
}

/** `RichDoc` → texto plano con marcadores, para poblar el `<textarea>` del editor. */
export function richDocATextoAMarcado(doc: RichDoc): string {
  return doc.content
    .map((parrafo) =>
      parrafo.content
        .map((span) => {
          if (span.href) return `[${span.text}](${span.href})`;
          if (span.marks?.includes("bold")) return `**${span.text}**`;
          if (span.marks?.includes("italic")) return `_${span.text}_`;
          return span.text;
        })
        .join(""),
    )
    .join("\n\n");
}

/** Longitud de texto visible (sin marcadores), para comparar contra `RichTextSpec.constraints.maxLength`. */
export function longitudVisible(doc: RichDoc): number {
  return doc.content.reduce((total, p) => total + p.content.reduce((t, s) => t + s.text.length, 0), 0);
}
