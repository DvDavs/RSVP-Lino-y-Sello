// test/kit-scaffold.test.ts — T3 de 4-0B: ¿se puede GENERAR una plantilla desde el catálogo?
//
// Reconstruye programáticamente, sin ninguna plantilla de referencia delante, el manifiesto mínimo
// de 5 secciones que en la fase 3 costó 7 min 29 s y CUATRO intentos escribir a mano
// (`evidencia/fase-3/i08-plantilla-minima/README.md`), y comprueba que valida A LA PRIMERA:
// `TemplateManifest.parse` + las 30 invariantes de `validateManifest`.
//
// Lo importante no es que pase, es CÓMO se construye: los campos de cada bloque salen de
// `describeBlockType(type).spec.required` (introspección del esquema Zod), no de una lista escrita
// aquí. Si `blocks.ts` añade un campo obligatorio, este generador lanza en vez de emitir JSON
// inválido, y esta prueba se pone en rojo.
import { describe, expect, it } from "vitest";
import {
  DefaultsFile, TemplateManifest, ThemeSpec, describeBlockType, explainBlockSpec, validateManifest,
} from "@invitaciones/schema";
import { blockIdFor, scaffoldSlots, sectionCatalog } from "../catalog/index.ts";
import type { CatalogSlot } from "../catalog/index.ts";

type Json = Record<string, unknown>;

/** Valor de UN campo obligatorio de la rama del `oneOf`, a partir del hueco del catálogo. */
function campoObligatorio(campo: string, slot: CatalogSlot, blockId: string): unknown {
  switch (campo) {
    case "id": return blockId;
    case "type": return slot.type;
    case "role": return slot.role;
    case "label": return { "es-MX": slot.purpose };
    case "itemLabel": return { "es-MX": slot.itemLabel };
    case "itemBlocks": return (slot.itemBlocks ?? []).filter(i => i.scaffold).map(i => bloque(i, i.blockId));
    case "options": return [{ id: "opcion-1", label: { "es-MX": "Primera opción" } }];
    default:
      throw new Error(
        `andamio: el esquema exige el campo "${campo}" en un bloque "${slot.type}" y el kit no sabe rellenarlo`,
      );
  }
}

/** Un `BlockSpec` completo, derivado de la introspección + el hueco del catálogo. */
function bloque(slot: CatalogSlot, blockId: string): Json {
  const rama = describeBlockType(slot.type).spec;
  const out: Json = {};
  for (const campo of rama.required) out[campo] = campoObligatorio(campo, slot, blockId);
  if (slot.required) out["required"] = true;
  if (slot.type === "group") { out["min"] = slot.min; out["max"] = slot.max; }
  if (slot.source) { out["source"] = slot.source; out["editable"] = false; out["aiEditable"] = false; }
  if (slot.businessField) out["businessField"] = slot.businessField;
  return out;
}

/** Una `SectionSpec` con los huecos que el catálogo marca para el andamio. */
function seccion(type: keyof typeof sectionCatalog): Json {
  const ficha = sectionCatalog[type];
  return {
    key: type,
    type,
    title: { "es-MX": ficha.name },
    variants: ficha.variants.map(v => v.id),
    defaultVariant: ficha.defaultVariant,
    required: ficha.cardinality === "1",
    defaultVisible: true,
    blocks: scaffoldSlots(type).map(slot => bloque(slot, blockIdFor(type, slot))),
  };
}

const LAS_CINCO = ["cover", "celebrant", "event", "rsvp", "footer"] as const;

function manifiesto(): Json {
  return {
    manifestVersion: 1,
    slug: "andamio-minimo",
    version: "1.0.0",
    name: { "es-MX": "Andamio mínimo" },
    eventKinds: ["baptism"],
    locales: ["es-MX"],
    sections: LAS_CINCO.map(seccion),
  };
}

const TEMA: Json = {
  palettes: [{
    id: "cielo", name: { "es-MX": "Cielo" },
    tokens: { bg: "#F4F8FC", surface: "#FFFFFF", ink: "#26323D", accent: "#3D6488", accentInk: "#FFFFFF", muted: "#5A6B7A" },
  }],
  fontSets: [{
    id: "clasica", name: { "es-MX": "Clásica" },
    heading: { family: "Cormorant Garamond", weights: [400, 600], source: "bundled" },
    body: { family: "Inter", weights: [400, 600], source: "bundled" },
  }],
  defaultPaletteId: "cielo",
  defaultFontSetId: "clasica",
};

describe("andamio del kit: del catálogo a un manifiesto válido a la primera", () => {
  it("genera 5 secciones y pasa TemplateManifest.parse sin un solo intento fallido", () => {
    const crudo = manifiesto();
    const parsed = TemplateManifest.parse(crudo);          // <- «a la primera»
    expect(parsed.sections).toHaveLength(5);
    expect(parsed.sections.map(s => s.key)).toEqual([...LAS_CINCO]);
    const bloques = parsed.sections.flatMap(s => s.blocks);
    expect(bloques.length).toBeGreaterThanOrEqual(9);
    const json = JSON.stringify(crudo, null, 2);
    // Evidencia comparable con la medición de I-08 (106 líneas, 5 secciones, 11 bloques).
    console.log(
      `[andamio] secciones=${parsed.sections.length} bloques=${bloques.length} ` +
      `líneas=${json.split("\n").length} ids=${bloques.map(b => b.id).join(",")}`,
    );
  });

  it("no viola ninguna de las invariantes del paquete (validateManifest = 0 violaciones)", () => {
    const parsed = TemplateManifest.parse(manifiesto());
    const tema = ThemeSpec.parse(TEMA);
    const defaults = DefaultsFile.parse({ templateSlug: "andamio-minimo", templateVersion: "1.0.0", content: {} });
    const violaciones = validateManifest(parsed, tema, defaults);
    expect(violaciones).toEqual([]);
  });

  it("cada bloque generado pasa la explicación del oneOf sin faltas ni sobras", () => {
    for (const seccionJson of (manifiesto()["sections"] as Json[])) {
      for (const b of seccionJson["blocks"] as Json[]) {
        const e = explainBlockSpec(b);
        expect(e.known, JSON.stringify(b)).toBe(true);
        expect(e.missing, `${String(b["id"])}: faltan campos`).toEqual([]);
        expect(e.unknown, `${String(b["id"])}: campos no admitidos`).toEqual([]);
        expect(e.suggestions.role).toBeUndefined();
      }
    }
  });

  it("el grupo generado trae itemBlocks reales y respeta I-07 y I-25", () => {
    const parsed = TemplateManifest.parse(manifiesto());
    const evento = parsed.sections.find(s => s.key === "event")!;
    const grupo = evento.blocks.find(b => b.type === "group");
    expect(grupo).toBeDefined();
    if (grupo?.type !== "group") throw new Error("el andamio de `event` debe traer un grupo");
    expect(grupo.role).toBe("eventCards");
    expect(grupo.min).toBeLessThanOrEqual(grupo.max);
    expect(grupo.itemBlocks.map(i => i.id)).toEqual(["title", "when", "place"]);
    for (const i of grupo.itemBlocks) expect(i.source).toBe("user");   // I-22
  });

  it("un campo obligatorio nuevo en el esquema rompe el andamio en vez de emitir JSON inválido", () => {
    // Simula lo que pasaría si `blocks.ts` añadiese un campo obligatorio que el kit no conoce.
    const hueco = sectionCatalog.cover.slots[0];
    expect(() => campoObligatorio("campoNuevo", hueco, "cover.title"))
      .toThrowError(/el kit no sabe rellenarlo/);
  });
});
