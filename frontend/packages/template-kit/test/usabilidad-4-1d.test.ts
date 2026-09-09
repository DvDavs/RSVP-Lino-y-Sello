// test/usabilidad-4-1d.test.ts — la reserva que dejó la SEGUNDA prueba ciega del kit (bitácora 4-5b).
//
// Aquel autor llegó al final en 2 min 44 s y con veredicto «sí», pero con un hueco concreto: escribió
// `"marks": [{"type":"bold"}]` —calcando los nodos `text`/`paragraph`, donde todo lleva `type`— y la
// forma correcta es `"marks": ["bold"]`, una lista de CADENAS. El `TPL_DEFAULTS_INVALID` de entonces
// le decía DÓNDE estaba el fallo pero no QUÉ escribir («bastó a medias», el único mensaje de toda la
// prueba que no bastó), y ni la guía ni `pnpm plantilla bloque richText` enseñaban un solo ejemplo con
// una marca aplicada.
//
// Cada `it` sabotea, compara la CADENA ENTERA del mensaje (no `toContain`: el formato de tres líneas
// es contrato y la guía lo cita literalmente) y luego pega el ejemplo TAL CUAL para verlo en verde.
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RichSpan, RichTextValue, describeField } from "@invitaciones/schema";
import { ejecutar } from "../src/cli.ts";
import { check } from "../src/check.ts";
import { ejemploRichTextConMarcas, fragmentoConMarca, marcasDeRichText } from "../src/bloques.ts";
import { escribirPaquete } from "../src/nueva.ts";
import { escribirDefaults, escribirManifiesto, leerDefaults, leerManifiesto, mensajeDe } from "./ayuda.ts";

type J = Record<string, any>;

/**
 * El escenario exacto de 4-5b: plantilla de cumpleaños cuyo andamio NO trae ningún hueco `richText`,
 * y el autor le añade uno a mano en `template.json` (bloque `celebrant.message`, rol `honoreeMessage`).
 */
function paqueteConRichText(): string {
  const destino = mkdtempSync(join(tmpdir(), "kit-1d-"));
  const { dir } = escribirPaquete(destino, { slug: "cumple-retro", evento: "birthday", secciones: ["cover", "celebrant"] });
  const m = leerManifiesto(dir) as J;
  m["sections"][1].blocks.push({
    id: "celebrant.message", type: "richText", role: "honoreeMessage", label: { "es-MX": "Mensaje" },
  });
  escribirManifiesto(dir, m);
  return dir;
}

/** Escribe un valor `richText` de un solo párrafo con los fragmentos que se le den. */
function ponerParrafo(dir: string, fragmentos: unknown[]): void {
  const d = leerDefaults(dir) as J;
  d["content"]["celebrant.message"] = {
    kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: fragmentos }] },
  };
  escribirDefaults(dir, d);
}

/** El JSON que la ficha imprime bajo un encabezado, tal como lo copiaría el autor de la terminal. */
function jsonBajo(salida: string, encabezado: string): unknown {
  const lineas = salida.split("\n");
  const i = lineas.findIndex(l => l.includes(encabezado));
  expect(i, `no aparece el encabezado «${encabezado}»`).toBeGreaterThanOrEqual(0);
  const cuerpo: string[] = [];
  for (const l of lineas.slice(i + 1)) {
    if (l.trim() === "") break;
    cuerpo.push(l);
  }
  return JSON.parse(cuerpo.join("\n")) as unknown;
}

describe("1. las marcas de un `richText` (bitácora 4-5b, «cosas que tuve que adivinar» #1)", () => {
  it("una marca escrita como objeto: el mensaje da la FORMA correcta, no sólo el sitio", () => {
    const dir = paqueteConRichText();
    // El fallo literal de 4-5b, calcado de su bitácora.
    ponerParrafo(dir, [
      { type: "text", text: "Cumplo " },
      { type: "text", text: "30", marks: [{ type: "bold" }] },
    ]);
    expect(mensajeDe(dir, "TPL_DEFAULTS_INVALID")).toBe(
      "ERROR TPL_DEFAULTS_INVALID  defaults.json#/content/celebrant.message/doc/content/0/content/1/marks/0\n" +
      '  Invalid option: expected one of "bold"|"italic" (invalid_value).\n' +
      '  Sugerencia: El bloque "celebrant.message" es de tipo `richText`. Las marcas de un fragmento ' +
      'de `richText` son una LISTA DE CADENAS, no objetos: se escribe "marks": ["bold"] y NUNCA ' +
      '"marks": [{"type": "bold"}]. Marcas que admite el esquema: bold, italic (máximo 2 por ' +
      'fragmento). Un enlace no es una marca: es el campo "href" del propio fragmento, con http(s). ' +
      "Fragmento copiable tal cual, dentro del `content` de un párrafo: " +
      '{"type":"text","text":"14 de noviembre","marks":["bold"]}. ' +
      "El párrafo entero, con marcas y enlace: `pnpm plantilla bloque richText`.",
    );
  });

  it("el fragmento que da el mensaje, pegado tal cual, deja el paquete en verde", () => {
    const dir = paqueteConRichText();
    ponerParrafo(dir, [
      { type: "text", text: "Cumplo " },
      // Copiado literalmente de la sugerencia de arriba, sin tocar una coma.
      JSON.parse('{"type":"text","text":"14 de noviembre","marks":["bold"]}') as unknown,
    ]);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("una marca que no existe también recibe la forma correcta y la lista de marcas", () => {
    const dir = paqueteConRichText();
    ponerParrafo(dir, [{ type: "text", text: "Cumplo 30", marks: ["subrayado"] }]);
    expect(mensajeDe(dir, "TPL_DEFAULTS_INVALID")).toBe(
      "ERROR TPL_DEFAULTS_INVALID  defaults.json#/content/celebrant.message/doc/content/0/content/0/marks/0\n" +
      '  Invalid option: expected one of "bold"|"italic" (invalid_value).\n' +
      '  Sugerencia: El bloque "celebrant.message" es de tipo `richText`. Las marcas de un fragmento ' +
      'de `richText` son una LISTA DE CADENAS, no objetos: se escribe "marks": ["bold"] y NUNCA ' +
      '"marks": [{"type": "bold"}]. Marcas que admite el esquema: bold, italic (máximo 2 por ' +
      'fragmento). Un enlace no es una marca: es el campo "href" del propio fragmento, con http(s). ' +
      "Fragmento copiable tal cual, dentro del `content` de un párrafo: " +
      '{"type":"text","text":"14 de noviembre","marks":["bold"]}. ' +
      "El párrafo entero, con marcas y enlace: `pnpm plantilla bloque richText`.",
    );
  });
});

describe("2. `plantilla bloque richText` enseña un ejemplo CON marcas (bitácora 4-5b §recomendación)", () => {
  it("la ficha trae la regla de las marcas y un segundo ejemplo con negrita, cursiva y enlace", () => {
    const r = ejecutar(["bloque", "richText"]);
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain(
      "  LAS MARCAS (negrita, cursiva) Y LOS ENLACES:\n" +
      '    Las marcas de un fragmento de `richText` son una LISTA DE CADENAS, no objetos: se escribe ' +
      '"marks": ["bold"] y NUNCA "marks": [{"type": "bold"}]. Marcas que admite el esquema: bold, ' +
      'italic (máximo 2 por fragmento). Un enlace no es una marca: es el campo "href" del propio ' +
      "fragmento, con http(s).\n" +
      "\n" +
      "  EL VALOR CON MARCAS Y ENLACE, en defaults.json, copiable tal cual:",
    );
    // El ejemplo que se ve en la terminal es exactamente el que el kit construye.
    expect(jsonBajo(r.salida, "EL VALOR CON MARCAS Y ENLACE")).toEqual(ejemploRichTextConMarcas());
    // …y el ejemplo mínimo de siempre sigue estando, sin marcas (no se ha sustituido, se ha añadido).
    expect(jsonBajo(r.salida, 'EL VALOR, en defaults.json bajo "<blockId>"'))
      .toEqual({ kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }] } });
    // Sólo `richText` gana la sección: los otros 13 tipos no tienen marcas que explicar.
    expect(ejecutar(["bloque", "text"]).salida).not.toContain("LAS MARCAS");
  });

  it("el ejemplo con marcas de la ficha, copiado de la terminal y pegado, deja el paquete en verde", () => {
    const valor = jsonBajo(ejecutar(["bloque", "richText"]).salida, "EL VALOR CON MARCAS Y ENLACE") as J;
    const dir = paqueteConRichText();
    const d = leerDefaults(dir) as J;
    d["content"]["celebrant.message"] = valor;
    escribirDefaults(dir, d);
    const r = check({ dir, escribir: false });
    expect(r.hallazgos).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("3. la lista de marcas se DERIVA del esquema, no se teclea (ADR-4-1D-01, patrón de ADR-4-6-02)", () => {
  it("las marcas que anuncia el kit son EXACTAMENTE las del enum `RichSpan.marks`", () => {
    const delEsquema = describeField("marks", RichSpan.shape.marks).element?.enumValues ?? [];
    expect(delEsquema).toEqual(["bold", "italic"]); // si el esquema cambia, esta prueba lo grita
    expect(marcasDeRichText().nombres).toEqual(delEsquema);
    expect(marcasDeRichText().maximo).toBe(2);
    // Y cada marca del esquema aparece en la frase y en el ejemplo: una marca nueva no se queda fuera.
    const ficha = ejecutar(["bloque", "richText"]).salida;
    for (const marca of delEsquema) expect(ficha, `falta la marca ${marca}`).toContain(`"${marca}"`);
  });

  it("el ejemplo con marcas es un `RichTextValue` válido para el propio esquema", () => {
    expect(RichTextValue.safeParse(ejemploRichTextConMarcas()).success).toBe(true);
    expect(RichSpan.safeParse(fragmentoConMarca()).success).toBe(true);
  });
});
