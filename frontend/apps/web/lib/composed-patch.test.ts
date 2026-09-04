// lib/composed-patch.test.ts — parche optimista (04 §10.3) y el límite declarado de §12.4: los seis
// tipos de valor que el cliente NO puede resolver sin duplicar lógica del servidor.
import { describe, expect, it } from "vitest";
import type { ComposedDocument, Operation } from "@invitaciones/schema";
import {
  applyOperationOptimistic,
  applyPatchEntries,
  findBlock,
  findGroup,
  findItemBlock,
  nombresDe,
  pendingKeysFor,
  refKey,
  resolveScalarLocally,
} from "./composed-patch.ts";
import { composedFixture, ULID_A, ULID_B } from "../test/fixtures/composed.ts";

type ScalarValue = Extract<Operation, { op: "setBlock" }>["value"];

describe("resolución local de un valor (04 §12.4)", () => {
  it("los siete tipos resolubles producen un ResolvedValue equivalente", () => {
    const casos: [ScalarValue, string][] = [
      [{ kind: "text", value: "hola" }, "text"],
      [{ kind: "richText", doc: { blocks: [] } } as unknown as ScalarValue, "richText"],
      [{ kind: "listText", items: ["a", "b"] }, "listText"],
      [{ kind: "link", href: "https://x.test/a" }, "link"],
      [{ kind: "location", name: "Jardín" }, "location"],
      [{ kind: "boolean", value: true }, "boolean"],
      [{ kind: "person", name: "Ana" }, "person"],
    ];
    for (const [valor, kind] of casos) {
      const r = resolveScalarLocally(valor);
      expect(r).not.toBeNull();
      expect(r?.kind).toBe(kind);
    }
  });

  it("los seis que dependen del servidor devuelven null, NO un valor inventado", () => {
    const casos: ScalarValue[] = [
      { kind: "image", assetId: "as_01", alt: "", focal: { x: 0.5, y: 0.5 } } as unknown as ScalarValue,
      { kind: "audio", assetId: "as_02" } as unknown as ScalarValue,
      { kind: "date", value: "2026-01-01" },
      { kind: "time", value: "18:00" },
      { kind: "dateTimeRange", start: "2026-01-01T18:00" } as unknown as ScalarValue,
      { kind: "choice", optionId: "formal" },
    ];
    for (const valor of casos) expect(resolveScalarLocally(valor)).toBeNull();
  });

  it("los campos opcionales solo aparecen si venían (nada se inventa)", () => {
    expect(resolveScalarLocally({ kind: "link", href: "https://x.test/a" })).toEqual({ kind: "link", href: "https://x.test/a" });
    expect(resolveScalarLocally({ kind: "link", href: "https://x.test/a", label: "Mapa" })).toEqual({
      kind: "link",
      href: "https://x.test/a",
      label: "Mapa",
    });
    expect(resolveScalarLocally({ kind: "person", name: "Ana", note: "madrina" })).toEqual({ kind: "person", name: "Ana", note: "madrina" });
    expect(resolveScalarLocally({ kind: "location", name: "N", address: "A", mapHref: "https://m.test/x" })).toEqual({
      kind: "location",
      name: "N",
      address: "A",
      mapHref: "https://m.test/x",
    });
  });
});

describe("búsqueda dentro del compuesto", () => {
  it("distingue bloques escalares de grupos por la presencia de `items`", () => {
    const c = composedFixture();
    expect(findBlock(c, "cover.title")?.section.key).toBe("cover");
    expect(findBlock(c, "gallery.photos")).toBeNull(); // es un grupo
    expect(findGroup(c, "gallery.photos")?.group.items).toHaveLength(2);
    expect(findGroup(c, "cover.title")).toBeNull();
    expect(findItemBlock(c, "gallery.photos", ULID_B, "caption")?.block.label).toBe("Pie de foto");
    expect(findItemBlock(c, "gallery.photos", "no-existe", "caption")).toBeNull();
  });

  it("`refKey` es la misma clave que usa `@invitaciones/sections`", () => {
    expect(refKey({ sectionKey: "cover", blockId: "cover.title" })).toBe("cover::cover.title::::");
    expect(refKey({ sectionKey: "gallery", blockId: "g", itemId: ULID_A, itemBlockId: "caption" })).toBe(`gallery::g::${ULID_A}::caption`);
  });

  it("`nombresDe` devuelve etiquetas legibles, nunca los ids crudos", () => {
    const c = composedFixture();
    expect(nombresDe(c, { op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "x" } })).toEqual({
      bloque: "Título de la portada",
      seccion: "Portada",
    });
    expect(nombresDe(c, { op: "setSectionVisible", sectionKey: "story", visible: false })).toEqual({ seccion: "Nuestra historia" });
    expect(nombresDe(null, { op: "reorderSections", order: [] })).toEqual({});
  });
});

describe("parche optimista por operación (04 §10.3)", () => {
  function aplicar(op: Operation, c: ComposedDocument = composedFixture()) {
    return { resultado: applyOperationOptimistic(c, op), c };
  }

  it("las operaciones estructurales piden RENDER completo, las escalares PATCH", () => {
    for (const op of [
      { op: "setSectionVisible", sectionKey: "story", visible: false },
      { op: "setSectionVariant", sectionKey: "cover", variant: "otra" },
      { op: "reorderSections", order: ["story", "cover", "gallery"] },
      { op: "setTheme", paletteId: "rosa" },
      { op: "addItem", groupId: "gallery.photos", tempId: "tmp:aaaaaaaa", values: {} },
      { op: "removeItem", groupId: "gallery.photos", itemId: ULID_A },
      { op: "moveItem", groupId: "gallery.photos", itemId: ULID_A, toIndex: 1 },
    ] as Operation[]) {
      expect(aplicar(op).resultado.structural).toBe(true);
    }
    expect(aplicar({ op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "x" } }).resultado.structural).toBe(false);
  });

  it("`reorderSections` conserva al final las secciones que el lote no nombró (P1)", () => {
    const { c } = aplicar({ op: "reorderSections", order: ["gallery", "cover"] });
    expect(c.sections.map((s) => s.key)).toEqual(["gallery", "cover", "story"]);
  });

  it("`addItem` con índice inserta en la posición pedida y hereda la forma del primer ítem", () => {
    const { c } = aplicar({ op: "addItem", groupId: "gallery.photos", tempId: "tmp:aaaaaaaa", values: { caption: { kind: "text", value: "Nueva" } }, index: 0 });
    const grupo = c.sections[1]?.blocks[0] as { items: { itemId: string; blocks: { id: string; value: unknown }[] }[] };
    expect(grupo.items[0]?.itemId).toBe("tmp:aaaaaaaa");
    expect(grupo.items[0]?.blocks[0]?.id).toBe("caption");
    expect(grupo.items[0]?.blocks[0]?.value).toEqual({ kind: "text", value: "Nueva" });
  });

  it("una operación sobre un bloque inexistente no revienta ni ensucia el documento", () => {
    const { resultado, c } = aplicar({ op: "setBlock", blockId: "no.existe", value: { kind: "text", value: "x" } });
    expect(resultado.entries).toHaveLength(0);
    expect(JSON.stringify(c)).toBe(JSON.stringify(composedFixture()));
  });

  it("`setTheme` cambia SOLO los identificadores: los tokens los resuelve el servidor", () => {
    const { c } = aplicar({ op: "setTheme", paletteId: "rosa" });
    expect(c.theme.paletteId).toBe("rosa");
    expect(c.theme.tokens.ink).toBe("#16130f"); // sin `theme.json` no se puede resolver más
  });

  it("`pendingKeysFor` recoge las claves de todo lo que sigue sin confirmar", () => {
    const c = composedFixture();
    const claves = pendingKeysFor(c, [
      { op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "x" } },
      { op: "setItemBlock", groupId: "gallery.photos", itemId: ULID_A, blockId: "caption", value: { kind: "text", value: "y" } },
      { op: "setSectionVisible", sectionKey: "story", visible: false },
    ]);
    expect(claves).toEqual(["cover::cover.title::::", `gallery::gallery.photos::${ULID_A}::caption`]);
  });
});

describe("`applyPatchEntries` (lado lienzo)", () => {
  it("es pura: no muta el documento de entrada", () => {
    const original = composedFixture();
    const antes = JSON.stringify(original);
    const salida = applyPatchEntries(original, [
      { ref: { sectionKey: "cover", blockId: "cover.title" }, value: { kind: "text", value: "Nuevo" }, provenance: "user", pending: false },
    ]);
    expect(JSON.stringify(original)).toBe(antes);
    expect((salida.sections[0]?.blocks[0] as { value: { value: string } }).value.value).toBe("Nuevo");
  });

  it("aplica también dentro de un ítem de grupo", () => {
    const salida = applyPatchEntries(composedFixture(), [
      {
        ref: { sectionKey: "gallery", blockId: "gallery.photos", itemId: ULID_B, itemBlockId: "caption" },
        value: { kind: "text", value: "Otro pie" },
        provenance: "user",
        pending: false,
      },
    ]);
    const grupo = salida.sections[1]?.blocks[0] as { items: { blocks: { value: { value: string } }[] }[] };
    expect(grupo.items[1]?.blocks[0]?.value.value).toBe("Otro pie");
  });

  it("una entrada que no case se ignora sin romper las demás", () => {
    const salida = applyPatchEntries(composedFixture(), [
      { ref: { sectionKey: "x", blockId: "no.existe" }, value: null, provenance: "empty", pending: false },
      { ref: { sectionKey: "cover", blockId: "cover.title" }, value: { kind: "text", value: "Sí" }, provenance: "user", pending: false },
    ]);
    expect((salida.sections[0]?.blocks[0] as { value: { value: string } }).value.value).toBe("Sí");
  });
});
