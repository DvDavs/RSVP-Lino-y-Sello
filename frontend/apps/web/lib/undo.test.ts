// lib/undo.test.ts — U-09 (inversa correcta), U-10 (coalescencia) y U-11 (reescritura tempId→ULID)
// de `04 §20.1`, más el resto del catálogo de inversas.
import { describe, expect, it } from "vitest";
import {
  applyIdMapToEntries,
  applyIdMapToOperations,
  coalesceKeyOf,
  COALESCE_WINDOW_MS,
  invertOperation,
  isImmediateOperation,
  labelForOperation,
  newTempId,
  pushUndo,
  removeFromDraft,
  swapId,
  UNDO_LIMIT,
  type UndoEntry,
} from "./undo.ts";
import type { Operation } from "@invitaciones/schema";
import { ULID_A } from "../test/fixtures/composed.ts";

const texto = (v: string) => ({ kind: "text", value: v }) as Extract<Operation, { op: "setBlock" }>["value"];

function entrada(parcial: Partial<UndoEntry> & { apply: Operation[]; revert: Operation[] }): UndoEntry {
  return { label: "x", at: 0, ...parcial };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-09 — Reductor `setBlock` sobre un bloque en `default`: la inversa es `clearBlock`
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-09 · la inversa de setBlock NUNCA promueve contenido de demostración (ADR-1R-F-04)", () => {
  const op: Operation = { op: "setBlock", blockId: "cover.title", value: texto("Ana y Luis") };

  it("provenance 'default' ⇒ clearBlock, NO setBlock(valorPorDefecto)", () => {
    const inversa = invertOperation(op, {
      kind: "block",
      before: { value: null, provenance: "default" },
    });
    expect(inversa).toEqual([{ op: "clearBlock", blockId: "cover.title" }]);
    // La aserción que cierra H-03: ni una sola `setBlock` en la inversa.
    expect(inversa.some((o) => o.op === "setBlock")).toBe(false);
  });

  it("provenance 'empty' ⇒ clearBlock", () => {
    expect(invertOperation(op, { kind: "block", before: { value: null, provenance: "empty" } })).toEqual([
      { op: "clearBlock", blockId: "cover.title" },
    ]);
  });

  it("provenance 'business'/'fixed' ⇒ clearBlock (I-21: no son editables, pero nunca se promueven)", () => {
    for (const p of ["business", "fixed"] as const) {
      expect(invertOperation(op, { kind: "block", before: { value: texto("del negocio"), provenance: p } })).toEqual([
        { op: "clearBlock", blockId: "cover.title" },
      ]);
    }
  });

  it("provenance 'user' con valor previo ⇒ setBlock con ESE valor", () => {
    expect(
      invertOperation(op, { kind: "block", before: { value: texto("Ana & Luis"), provenance: "user" } }),
    ).toEqual([{ op: "setBlock", blockId: "cover.title", value: texto("Ana & Luis") }]);
  });

  it("un `default` con valor de demostración presente TAMPOCO se restaura con setBlock", () => {
    // El caso trampa: el compuesto SÍ trae un valor (el de demostración) y `provenance:"default"`.
    const inversa = invertOperation(op, {
      kind: "block",
      before: { value: texto("Nuestra boda"), provenance: "default" },
    });
    expect(inversa).toEqual([{ op: "clearBlock", blockId: "cover.title" }]);
  });
});

describe("U-09 (gemela, ADR-1R-X-01) · setItemBlock sin valor previo ⇒ clearItemBlock", () => {
  const op: Operation = {
    op: "setItemBlock",
    groupId: "gallery.photos",
    itemId: ULID_A,
    blockId: "caption",
    value: texto("En la playa"),
  };

  it("sin valor previo ⇒ clearItemBlock (la undécima operación existe justo para esto)", () => {
    expect(invertOperation(op, { kind: "itemBlock", before: { value: null } })).toEqual([
      { op: "clearItemBlock", groupId: "gallery.photos", itemId: ULID_A, blockId: "caption" },
    ]);
  });

  it("con valor previo ⇒ setItemBlock con ese valor", () => {
    expect(invertOperation(op, { kind: "itemBlock", before: { value: texto("Antes") } })).toEqual([
      { op: "setItemBlock", groupId: "gallery.photos", itemId: ULID_A, blockId: "caption", value: texto("Antes") },
    ]);
  });

  it("ninguna entrada de undo queda 'no deshacible'", () => {
    for (const previo of [null, texto("Antes")]) {
      expect(invertOperation(op, { kind: "itemBlock", before: { value: previo } })).toHaveLength(1);
    }
  });
});

describe("catálogo completo de inversas (04 §10.3)", () => {
  it("clearBlock ⇒ setBlock con el valor de usuario previo; sin valor de usuario ⇒ no-op", () => {
    expect(
      invertOperation({ op: "clearBlock", blockId: "b" }, { kind: "block", before: { value: texto("v"), provenance: "user" } }),
    ).toEqual([{ op: "setBlock", blockId: "b", value: texto("v") }]);
    expect(
      invertOperation({ op: "clearBlock", blockId: "b" }, { kind: "block", before: { value: null, provenance: "default" } }),
    ).toEqual([]);
  });

  it("addItem ⇒ removeItem del mismo tempId", () => {
    expect(
      invertOperation({ op: "addItem", groupId: "g", tempId: "tmp:abcdefgh", values: {} }, { kind: "item", before: { values: {}, index: 0 } }),
    ).toEqual([{ op: "removeItem", groupId: "g", itemId: "tmp:abcdefgh" }]);
  });

  it("removeItem ⇒ addItem con los valores y el índice guardados, y un tempId NUEVO (O-09)", () => {
    const inversa = invertOperation(
      { op: "removeItem", groupId: "g", itemId: ULID_A },
      { kind: "item", before: { values: { caption: texto("v") }, index: 2 } },
    );
    expect(inversa).toHaveLength(1);
    const op = inversa[0] as Extract<Operation, { op: "addItem" }>;
    expect(op.op).toBe("addItem");
    expect(op.index).toBe(2);
    expect(op.values).toEqual({ caption: texto("v") });
    expect(op.tempId).toMatch(/^tmp:[A-Za-z0-9_-]{8,64}$/);
    // La limitación declarada: NO se restaura el ULID original.
    expect(op.tempId).not.toBe(ULID_A);
  });

  it("moveItem ⇒ moveItem al índice anterior; al mismo índice ⇒ no-op", () => {
    expect(invertOperation({ op: "moveItem", groupId: "g", itemId: ULID_A, toIndex: 3 }, { kind: "moveItem", fromIndex: 1 })).toEqual([
      { op: "moveItem", groupId: "g", itemId: ULID_A, toIndex: 1 },
    ]);
    expect(invertOperation({ op: "moveItem", groupId: "g", itemId: ULID_A, toIndex: 1 }, { kind: "moveItem", fromIndex: 1 })).toEqual([]);
  });

  it("clearItemBlock sin valor previo ⇒ no-op", () => {
    expect(
      invertOperation({ op: "clearItemBlock", groupId: "g", itemId: ULID_A, blockId: "c" }, { kind: "itemBlock", before: { value: null } }),
    ).toEqual([]);
  });

  it("setSectionVisible / setSectionVariant ⇒ el valor anterior; sin cambio ⇒ no-op", () => {
    expect(
      invertOperation({ op: "setSectionVisible", sectionKey: "story", visible: false }, { kind: "structure", before: { visible: true } }),
    ).toEqual([{ op: "setSectionVisible", sectionKey: "story", visible: true }]);
    expect(
      invertOperation({ op: "setSectionVisible", sectionKey: "story", visible: true }, { kind: "structure", before: { visible: true } }),
    ).toEqual([]);
    expect(
      invertOperation({ op: "setSectionVariant", sectionKey: "cover", variant: "b" }, { kind: "structure", before: { variant: "a" } }),
    ).toEqual([{ op: "setSectionVariant", sectionKey: "cover", variant: "a" }]);
  });

  it("reorderSections ⇒ el orden anterior COMPLETO", () => {
    expect(
      invertOperation({ op: "reorderSections", order: ["b", "a"] }, { kind: "structure", before: { order: ["a", "b"] } }),
    ).toEqual([{ op: "reorderSections", order: ["a", "b"] }]);
  });

  it("setTheme ⇒ la inversa envía AMBOS campos (única operación que cambia dos a la vez)", () => {
    expect(
      invertOperation(
        { op: "setTheme", paletteId: "olivo", fontSetId: "sans" },
        { kind: "structure", before: { paletteId: "rosa", fontSetId: "serif" } },
      ),
    ).toEqual([{ op: "setTheme", paletteId: "rosa", fontSetId: "serif" }]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-10 — Coalescencia: teclear en A, saltar a B, teclear ⇒ DOS entradas, no una
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-10 · coalescencia (04 §11.2, objeción O-07)", () => {
  it("teclear en A, saltar a B y teclear produce DOS entradas de undo", () => {
    const pila: UndoEntry[] = [];
    // Ráfaga en A: tres pulsaciones dentro de la ventana.
    for (let i = 0; i < 3; i += 1) {
      pushUndo(
        pila,
        entrada({
          at: 100 * i,
          coalesceKey: "setBlock:A",
          apply: [{ op: "setBlock", blockId: "A", value: texto("Ana".slice(0, i + 1)) }],
          revert: [{ op: "clearBlock", blockId: "A" }],
        }),
        { barrier: false },
      );
    }
    expect(pila).toHaveLength(1);
    // Salto a B (el store pone `coalesceBarrier` al cambiar de selección) y ráfaga en B.
    for (let i = 0; i < 3; i += 1) {
      pushUndo(
        pila,
        entrada({
          at: 400 + 100 * i,
          coalesceKey: "setBlock:B",
          apply: [{ op: "setBlock", blockId: "B", value: texto("Luis".slice(0, i + 1)) }],
          revert: [{ op: "clearBlock", blockId: "B" }],
        }),
        { barrier: i === 0 },
      );
    }
    expect(pila).toHaveLength(2);
    expect(pila[0]?.coalesceKey).toBe("setBlock:A");
    expect(pila[1]?.coalesceKey).toBe("setBlock:B");
  });

  it("aunque no hubiera barrera, un `coalesceKey` distinto abre entrada nueva (regla 1)", () => {
    const pila: UndoEntry[] = [];
    pushUndo(pila, entrada({ at: 0, coalesceKey: "setBlock:A", apply: [], revert: [{ op: "clearBlock", blockId: "A" }] }), { barrier: false });
    pushUndo(pila, entrada({ at: 10, coalesceKey: "setBlock:B", apply: [], revert: [{ op: "clearBlock", blockId: "B" }] }), { barrier: false });
    expect(pila).toHaveLength(2);
  });

  it("al fusionar, `revert` conserva el de la entrada MÁS ANTIGUA de la ráfaga (error clásico)", () => {
    const pila: UndoEntry[] = [];
    const primero: Operation = { op: "setBlock", blockId: "A", value: texto("A") };
    const revertOriginal: Operation[] = [{ op: "setBlock", blockId: "A", value: texto("original") }];
    pushUndo(pila, entrada({ at: 0, coalesceKey: "setBlock:A", apply: [primero], revert: revertOriginal }), { barrier: false });
    pushUndo(
      pila,
      entrada({
        at: 200,
        coalesceKey: "setBlock:A",
        apply: [{ op: "setBlock", blockId: "A", value: texto("An") }],
        // Un revert que solo deshace el último carácter: NO debe ganar.
        revert: [{ op: "setBlock", blockId: "A", value: texto("A") }],
      }),
      { barrier: false },
    );
    expect(pila).toHaveLength(1);
    expect(pila[0]?.revert).toEqual(revertOriginal);
    expect(pila[0]?.apply).toHaveLength(2);
  });

  it("pasados más de 1500 ms sobre la misma clave se abre entrada nueva (regla 2)", () => {
    const pila: UndoEntry[] = [];
    pushUndo(pila, entrada({ at: 0, coalesceKey: "setBlock:A", apply: [], revert: [{ op: "clearBlock", blockId: "A" }] }), { barrier: false });
    pushUndo(
      pila,
      entrada({ at: COALESCE_WINDOW_MS + 1, coalesceKey: "setBlock:A", apply: [], revert: [{ op: "clearBlock", blockId: "A" }] }),
      { barrier: false },
    );
    expect(pila).toHaveLength(2);
  });

  it("una entrada con `revert` vacío no se empuja (no-op, nada que deshacer)", () => {
    const pila: UndoEntry[] = [];
    pushUndo(pila, entrada({ at: 0, apply: [], revert: [] }), { barrier: false });
    expect(pila).toHaveLength(0);
  });

  it("la pila está acotada a 100 entradas", () => {
    const pila: UndoEntry[] = [];
    for (let i = 0; i < UNDO_LIMIT + 20; i += 1) {
      pushUndo(pila, entrada({ at: i * 5000, apply: [], revert: [{ op: "clearBlock", blockId: `b${i}` }] }), { barrier: true });
    }
    expect(pila).toHaveLength(UNDO_LIMIT);
    expect((pila[pila.length - 1]?.revert[0] as { blockId: string }).blockId).toBe(`b${UNDO_LIMIT + 19}`);
  });

  it("solo los tipos que se teclean tienen `coalesceKey` (regla 4)", () => {
    expect(coalesceKeyOf({ op: "setBlock", blockId: "A", value: texto("x") })).toBe("setBlock:A");
    expect(coalesceKeyOf({ op: "setBlock", blockId: "A", value: { kind: "boolean", value: true } })).toBeUndefined();
    expect(coalesceKeyOf({ op: "setSectionVisible", sectionKey: "s", visible: false })).toBeUndefined();
    expect(coalesceKeyOf({ op: "reorderSections", order: ["a"] })).toBeUndefined();
    expect(coalesceKeyOf({ op: "moveItem", groupId: "g", itemId: ULID_A, toIndex: 1 })).toBe(`moveItem:g:${ULID_A}`);
  });

  it("las operaciones no textuales son de disparo inmediato (04 §12.1)", () => {
    expect(isImmediateOperation({ op: "setBlock", blockId: "A", value: texto("x") })).toBe(false);
    expect(isImmediateOperation({ op: "setBlock", blockId: "A", value: { kind: "boolean", value: true } })).toBe(true);
    expect(isImmediateOperation({ op: "setSectionVisible", sectionKey: "s", visible: false })).toBe(true);
    expect(isImmediateOperation({ op: "setTheme", paletteId: "olivo" })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-11 — `applyIdMap` con un `addItem` deshecho: la entrada apunta al ULID, no al `tmp:`
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-11 · reescritura tempId → ULID (04 §12.3, objeción O-11)", () => {
  it("la entrada de undo de un addItem apunta al ULID tras el idMap", () => {
    const tempId = "tmp:abcdefgh12345678";
    const pila: UndoEntry[] = [
      entrada({
        apply: [{ op: "addItem", groupId: "g", tempId, values: {} }],
        revert: [{ op: "removeItem", groupId: "g", itemId: tempId }],
      }),
    ];
    applyIdMapToEntries(pila, { [tempId]: ULID_A });
    expect(pila[0]?.revert[0]).toEqual({ op: "removeItem", groupId: "g", itemId: ULID_A });
    // `addItem.tempId` NO se reescribe: el lote ya se aplicó y es idempotente por `clientBatchId`;
    // además el esquema exige `^tmp:` en ese campo — un ULID no validaría.
    expect((pila[0]?.apply[0] as { tempId: string }).tempId).toBe(tempId);
  });

  it("reescribe también las operaciones aún en el borrador sobre ese ítem", () => {
    const tempId = "tmp:abcdefgh12345678";
    const draft: Operation[] = [
      { op: "setItemBlock", groupId: "g", itemId: tempId, blockId: "caption", value: texto("v") },
      { op: "moveItem", groupId: "g", itemId: tempId, toIndex: 0 },
      { op: "setBlock", blockId: "otro", value: texto("sin tocar") },
    ];
    expect(applyIdMapToOperations(draft, { [tempId]: ULID_A })).toBe(2);
    expect((draft[0] as { itemId: string }).itemId).toBe(ULID_A);
    expect((draft[1] as { itemId: string }).itemId).toBe(ULID_A);
    expect(draft[2]).toEqual({ op: "setBlock", blockId: "otro", value: texto("sin tocar") });
  });

  it("swapId deja intacto lo que no está en el mapa", () => {
    expect(swapId("tmp:x", { "tmp:x": ULID_A })).toBe(ULID_A);
    expect(swapId("tmp:y", { "tmp:x": ULID_A })).toBe("tmp:y");
    expect(swapId(undefined, {})).toBeUndefined();
  });
});

describe("removeFromDraft (04 §11.3, caso 1)", () => {
  it("cancela las operaciones si TODAS siguen en el borrador", () => {
    const a: Operation = { op: "setBlock", blockId: "A", value: texto("1") };
    const b: Operation = { op: "setBlock", blockId: "A", value: texto("12") };
    const draft: Operation[] = [a, b];
    expect(removeFromDraft(draft, [a, b])).toBe(true);
    expect(draft).toHaveLength(0);
  });

  it("no cancela NADA si alguna ya se encoló (nunca deja un estado a medias)", () => {
    const a: Operation = { op: "setBlock", blockId: "A", value: texto("1") };
    const b: Operation = { op: "setBlock", blockId: "A", value: texto("12") };
    const draft: Operation[] = [b];
    expect(removeFromDraft(draft, [a, b])).toBe(false);
    expect(draft).toEqual([b]);
  });
});

describe("etiquetas es-MX e identificadores temporales", () => {
  it("labelForOperation usa los nombres legibles, nunca los ids crudos", () => {
    expect(labelForOperation({ op: "setBlock", blockId: "cover.title", value: texto("x") }, { bloque: "el título de la portada" })).toBe(
      "Cambiar el título de la portada",
    );
    expect(labelForOperation({ op: "setSectionVisible", sectionKey: "story", visible: false }, { seccion: "Nuestra historia" })).toBe(
      "Ocultar Nuestra historia",
    );
    expect(labelForOperation({ op: "reorderSections", order: ["a"] })).toBe("Reordenar las secciones");
  });

  it("newTempId cumple el patrón `TempId` de common.ts", () => {
    for (let i = 0; i < 20; i += 1) expect(newTempId()).toMatch(/^tmp:[A-Za-z0-9_-]{8,64}$/);
  });
});
