// packages/template-kit/src/bloques.ts — `plantilla bloque [<tipo>]`: la forma de un tipo de bloque.
//
// Por qué existe: la prueba cronometrada de la bitácora 4-5 (§4 y «cosas que tuve que adivinar» #1)
// se atascó en un bloque `richText` porque su forma —`doc` con párrafos, tres niveles de anidamiento—
// no estaba escrita en ningún sitio que un autor pueda leer: ni en la guía, ni en `plantilla
// secciones` (que dice de qué TIPO es cada hueco, pero no qué se escribe dentro), ni en el mensaje de
// `check`. El vocabulario ya existía: `describeBlockType` de `@invitaciones/schema` (handoffs/4-0b.md)
// deriva de Zod la rama del `oneOf` y su ejemplo mínimo. Aquí sólo se imprime, sin transcribir nada.
import { BLOCK_TYPES, RichSpan, describeBlockType, describeField } from "@invitaciones/schema";

/** JSON con sangría de dos espacios, indentado dentro del bloque de texto de la terminal. */
function bonito(valor: unknown, sangria: string): string {
  return JSON.stringify(valor, null, 2).split("\n").join(`\n${sangria}`);
}


// ---------------------------------------------------------------------------------------------
// Marcas de `richText` (negrita, cursiva, enlace).
//
// Por qué existe: la segunda prueba ciega (bitácora 4-5b, «cosas que tuve que adivinar» #1) escribió
// `"marks": [{"type":"bold"}]` —calcando los nodos `text`/`paragraph`, donde todo lleva `type`— y la
// forma correcta es `"marks": ["bold"]`, una lista de CADENAS. Ni la guía ni esta ficha enseñaban
// entonces un solo ejemplo con una marca aplicada, así que la única salida era el tanteo.
//
// La lista de marcas se DERIVA del esquema (`RichSpan.marks`, packages/schema/src/blocks.ts:14) con
// `describeField`, nunca se teclea: mismo criterio que `familiasAutoalojadas()` de check.ts
// (ADR-4-6-02). Si mañana el esquema añade una tercera marca, sale sola aquí y en el mensaje de
// `check`, y la prueba que fija el texto literal (`test/usabilidad-4-1d.test.ts`) se pone roja en vez
// de dejar la ayuda vieja en silencio.
// ---------------------------------------------------------------------------------------------

/** Lo único transcrito: cómo se llama cada marca en español. Una marca nueva cae a su nombre crudo. */
const PALABRA_DE_MARCA: Readonly<Record<string, string>> = { bold: "negrita", italic: "cursiva" };

/**
 * Enlace de ejemplo. El esquema exige `http(s)` (`HttpUrl`) y `check` exige que el contenido de
 * demostración no enlace a un dominio ajeno (`TPL_THIRD_PARTY_LINK`, ADR-4-9-01): tiene que ser
 * `example.com` para que el ejemplo, pegado tal cual, deje el paquete en verde.
 */
const ENLACE_DE_EJEMPLO = "https://www.example.com/como-llegar";

export interface MarcasDeRichText {
  /** Los valores del enum `RichSpan.marks`, en el orden del esquema. */
  readonly nombres: readonly string[];
  /** Cuántas marcas admite un mismo fragmento (`.max()` del array), si el esquema lo limita. */
  readonly maximo: number | undefined;
}

/** Las marcas que admite hoy un fragmento de `richText`, leídas del esquema. */
export function marcasDeRichText(): MarcasDeRichText {
  const campo = describeField("marks", RichSpan.shape.marks);
  return { nombres: campo.element?.enumValues ?? [], maximo: campo.constraints?.maxLength };
}

/** La primera marca del esquema (hoy `bold`), para los ejemplos de una sola marca. */
function primeraMarca(): string {
  return marcasDeRichText().nombres[0] ?? "bold";
}

/** Un fragmento con UNA marca aplicada, copiable tal cual dentro de `content` de un párrafo. */
export function fragmentoConMarca(): Record<string, unknown> {
  return { type: "text", text: "14 de noviembre", marks: [primeraMarca()] };
}

/**
 * Un VALOR `richText` completo con una marca por cada una de las que el esquema admite y un enlace.
 * Se construye a partir de la lista derivada: una marca nueva aparece en el ejemplo sola.
 */
export function ejemploRichTextConMarcas(): Record<string, unknown> {
  const { nombres } = marcasDeRichText();
  const fragmentos: Record<string, unknown>[] = [{ type: "text", text: "Un fragmento normal, uno " }];
  nombres.forEach((marca, i) => {
    fragmentos.push({ type: "text", text: `en ${PALABRA_DE_MARCA[marca] ?? marca}`, marks: [marca] });
    fragmentos.push({ type: "text", text: i === nombres.length - 1 ? " y un " : ", uno " });
  });
  fragmentos.push({ type: "text", text: "enlace", href: ENLACE_DE_EJEMPLO });
  fragmentos.push({ type: "text", text: "." });
  return { kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: fragmentos }] } };
}

/**
 * La regla de las marcas en una frase, para el mensaje de `check` (`TPL_DEFAULTS_INVALID`) y para la
 * ficha de `plantilla bloque richText`: la misma explicación escrita UNA sola vez.
 */
export function fraseDeMarcas(): string {
  const { nombres, maximo } = marcasDeRichText();
  const uno = primeraMarca();
  return `Las marcas de un fragmento de \`richText\` son una LISTA DE CADENAS, no objetos: se escribe ` +
    `"marks": ${JSON.stringify([uno])} y NUNCA "marks": [{"type": "${uno}"}]. ` +
    `Marcas que admite el esquema: ${nombres.join(", ")}` +
    `${maximo === undefined ? "" : ` (máximo ${maximo} por fragmento)`}. ` +
    `Un enlace no es una marca: es el campo "href" del propio fragmento, con http(s).`;
}

/** Ficha de UN tipo de bloque: qué es, qué se escribe en defaults.json y qué en template.json. */
export function fichaDeBloque(tipo: string): string {
  const info = describeBlockType(tipo);
  const lineas: string[] = [
    `${info.type} — ${info.summary}`,
    "",
    `  EL VALOR, en defaults.json bajo "<blockId>" (campos obligatorios: ${info.value.required.join(", ")}${
      info.value.optional.length > 0 ? `; opcionales: ${info.value.optional.join(", ")}` : ""}):`,
    `    ${bonito(info.minimalValue, "    ")}`,
    "",
  ];
  // `richText` es el único tipo con marcas, y el único que la prueba ciega no pudo escribir sin
  // tantear: su ficha lleva un segundo ejemplo CON marcas aplicadas (bitácora 4-5b).
  if (info.type === "richText") {
    lineas.push(
      "  LAS MARCAS (negrita, cursiva) Y LOS ENLACES:",
      `    ${fraseDeMarcas()}`,
      "",
      "  EL VALOR CON MARCAS Y ENLACE, en defaults.json, copiable tal cual:",
      `    ${bonito(ejemploRichTextConMarcas(), "    ")}`,
      "",
    );
  }
  lineas.push(
    `  EL BLOQUE, en template.json dentro de \`sections[].blocks\` (campos obligatorios: ${info.spec.required.join(", ")}):`,
    `    ${bonito(info.minimalSpec, "    ")}`,
    "",
    `  Roles que admiten este tipo: ${info.roles.length > 0 ? info.roles.join(", ") : "(ninguno declarado)"}.`,
  );
  return lineas.join("\n");
}

/** Los 14 tipos, con su resumen y el valor mínimo en una línea. */
export function listaDeBloques(): string {
  const lineas: string[] = [
    `Los ${BLOCK_TYPES.length} tipos de bloque. \`pnpm plantilla bloque <tipo>\` da la ficha completa de uno.`,
    "",
  ];
  for (const t of BLOCK_TYPES) {
    const info = describeBlockType(t);
    lineas.push(`${t} — ${info.summary}`);
    lineas.push(`  valor mínimo: ${JSON.stringify(info.minimalValue)}`);
  }
  return lineas.join("\n");
}
