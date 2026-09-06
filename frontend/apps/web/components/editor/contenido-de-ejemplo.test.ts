// components/editor/contenido-de-ejemplo.test.ts — G-05: «se publica con “Nombre de la mamá”,
// “Nombre del papá” y secciones vacías con título visible; la revisión solo mira la portada».
import { describe, expect, it } from "vitest";
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";
import { cuantosEjemplos, ejemplosVisibles } from "./contenido-de-ejemplo.ts";

function manifiesto(): TemplateManifest {
  return {
    sections: [
      { key: "cover", required: true, blocks: [] },
      { key: "family", required: false, blocks: [] },
      { key: "event", required: true, blocks: [] },
    ],
  } as unknown as TemplateManifest;
}

/** El compuesto REAL que se publicó en la revisión de uso, reducido a lo que aquí importa. */
function compuesto(): ComposedDocument {
  return {
    sections: [
      {
        key: "cover",
        visible: true,
        title: "Portada",
        blocks: [
          { id: "cover.title", label: "Título", provenance: "user", value: { kind: "text", value: "Valentina" } },
          { id: "cover.date", label: "Fecha", provenance: "business", value: { kind: "date", value: "2027-03-20", formatted: "20 de marzo de 2027" } },
          { id: "cover.ornament", label: "Adorno", provenance: "fixed", value: { kind: "text", value: "~" } },
        ],
      },
      {
        key: "family",
        visible: true,
        title: "Mis papás y padrinos",
        blocks: [
          { id: "family.intro", label: "Introducción", provenance: "default", value: { kind: "text", value: "Con la bendición de" } },
          {
            id: "family.people",
            type: "group",
            label: "Personas",
            provenance: "default",
            items: [
              { itemId: "i1", blocks: [{ id: "name", label: "Nombre", provenance: "default", value: { kind: "person", name: "Nombre de la mamá" } }] },
              { itemId: "i2", blocks: [{ id: "name", label: "Nombre", provenance: "default", value: { kind: "person", name: "Nombre del papá" } }] },
            ],
          },
        ],
      },
      {
        key: "event",
        visible: false,
        title: "Cuándo y dónde",
        blocks: [{ id: "event.note", label: "Nota", provenance: "default", value: { kind: "text", value: "Te esperamos" } }],
      },
    ],
  } as unknown as ComposedDocument;
}

describe("ejemplosVisibles · lo que la invitada leería y nadie escribió", () => {
  it("lista la sección de ejemplo entera, con el texto de muestra y su «Ocultar sección»", () => {
    const r = ejemplosVisibles(compuesto(), manifiesto());
    expect(r).toHaveLength(1);
    expect(r[0]?.sectionKey).toBe("family");
    expect(r[0]?.titulo).toBe("Mis papás y padrinos");
    expect(r[0]?.seccionEntera).toBe(true);
    expect(r[0]?.sePuedeOcultar).toBe(true);
    expect(r[0]?.bloques.map((b) => b.muestra)).toEqual(["Con la bendición de", "Nombre de la mamá"]);
    expect(r[0]?.bloques[1]?.cantidad).toBe(2);
    expect(cuantosEjemplos(r)).toBe(2);
  });

  it("una sección oculta no cuenta: ninguna invitada la ve", () => {
    expect(ejemplosVisibles(compuesto(), manifiesto()).some((s) => s.sectionKey === "event")).toBe(false);
  });

  it("ni la portada de la clienta ni la decoración `fixed` del paquete salen en la lista", () => {
    const r = ejemplosVisibles(compuesto(), manifiesto());
    expect(r.some((s) => s.sectionKey === "cover")).toBe(false);
  });

  it("con UN dato de la clienta la sección ya no es «de ejemplo entera»", () => {
    const c = compuesto();
    (c.sections[1] as { blocks: Array<{ provenance: string }> }).blocks[0]!.provenance = "user";
    const r = ejemplosVisibles(c, manifiesto());
    expect(r[0]?.seccionEntera).toBe(false);
    expect(r[0]?.bloques).toHaveLength(1);
  });

  it("lo que el preflight ya bloquea no se repite en la lista de avisos", () => {
    const r = ejemplosVisibles(compuesto(), manifiesto(), new Set(["family.intro"]));
    expect(r[0]?.bloques.map((b) => b.blockId)).toEqual(["family.people"]);
    // Sigue siendo una sección de ejemplo entera aunque el bloque bloqueado no se repita.
    expect(r[0]?.seccionEntera).toBe(true);
  });

  it("una sección obligatoria del manifiesto no ofrece «Ocultar sección»", () => {
    const c = compuesto();
    (c.sections[1] as { key: string }).key = "event";
    (c.sections[2] as { key: string }).key = "otra";
    const r = ejemplosVisibles(c, manifiesto());
    expect(r[0]?.sectionKey).toBe("event");
    expect(r[0]?.sePuedeOcultar).toBe(false);
  });

  it("sin compuesto no inventa nada", () => {
    expect(ejemplosVisibles(null, manifiesto())).toEqual([]);
  });
});
