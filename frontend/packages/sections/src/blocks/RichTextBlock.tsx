// packages/sections/src/blocks/RichTextBlock.tsx — tipo 2/14 (04 §5.3, §17.6).
//
// PROHIBIDO `dangerouslySetInnerHTML` y PROHIBIDO serializar a cadena HTML (regla de lint dura,
// 04 §19.3). `RichDoc` solo admite `bold`, `italic` y `href` (blocks.ts:11-19): se construye el
// árbol React A MANO, elemento a elemento — <p> por párrafo, <strong>/<em> por marca, <a> por
// href. La prueba U-04 afirma sobre el HTML SERIALIZADO que no hay `innerHTML` en ningún nodo.
import type { ReactNode } from "react";
import type { BlockComponentProps } from "./types.ts";
import type { RichParagraph, RichSpan } from "../schema-types.ts";
import { isSafeHttpUrl } from "./url.ts";
import { activationAttrs } from "./activation.ts";
import styles from "./RichTextBlock.module.css";
import shared from "../styles/shared.module.css";

function renderSpan(span: RichSpan, key: number) {
  const marks = span.marks ?? [];
  let node: ReactNode = span.text;
  if (marks.includes("italic")) node = <em>{node}</em>;
  if (marks.includes("bold")) node = <strong>{node}</strong>;
  // `HttpUrl` (esquema) ya exige `^https?://…`, pero un bloque de render nunca confía ciegamente
  // en la validación de arriba: contenido de cliente, defensa en profundidad (04 §17.6).
  if (span.href !== undefined && isSafeHttpUrl(span.href)) {
    node = (
      <a className={styles.link} href={span.href} target="_blank" rel="noopener noreferrer">
        {node}
      </a>
    );
  }
  return <span key={key}>{node}</span>;
}

function renderParagraph(paragraph: RichParagraph, key: number) {
  return (
    <p key={key} className={styles.paragraph}>
      {paragraph.content.map((span, index) => renderSpan(span, index))}
    </p>
  );
}

export function RichTextBlock({ block, mode, onActivate, ref_, pending }: BlockComponentProps) {
  if (block.value === null || block.value.kind !== "richText") return null;
  const { doc } = block.value;
  if (doc.content.length === 0) return null;
  return (
    <div
      className={`${styles.doc} ${shared.measure} ${shared.focusRing} ${shared.transition}`}
      {...activationAttrs(mode, ref_, onActivate, pending)}
    >
      {doc.content.map((paragraph, index) => renderParagraph(paragraph, index))}
    </div>
  );
}
