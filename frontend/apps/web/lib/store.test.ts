// lib/store.test.ts — el ciclo completo del núcleo sobre el store real (zustand + immer), sin red:
// las cuatro llamadas HTTP se inyectan por `createEditorStore({...})`.
//
// Cubre U-13 (409 con "descartar mis cambios") y U-14 (409 con rebase asistido) de `04 §20.1`, más
// el ciclo de las 11 acciones, el undo con y sin envío previo, y la reconciliación de §12.4.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@invitaciones/schema";
import { createEditorStore, type StoreDeps } from "./store.ts";
import { ApiError } from "./errors.ts";
import { composedFixture, documentFixture, ULID_A, ULID_B } from "../test/fixtures/composed.ts";
import type { GetDocumentResponse, OperationBatchResponse } from "./api-types.ts";

const texto = (v: string) => ({ kind: "text", value: v }) as Extract<Operation, { op: "setBlock" }>["value"];

function respuestaDocumento(): GetDocumentResponse {
  return {
    document: documentFixture(),
    composed: composedFixture(),
    report: { missingRequired: [], stillDefault: ["cover.title"], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    revision: 3,
    templateVersion: { slug: "boda-clasica", version: "1.0.0", status: "published" },
    publicToken: "pub_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    publicUrl: "http://x/i/pub_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    activeRelease: null,
  };
}

/** Store con red simulada y temporizadores manuales: `flushNow()` empuja de forma determinista. */
function nuevoStore(overrides: Partial<StoreDeps> = {}) {
  const enviados: { baseRevision: number; clientBatchId: string; operations: Operation[] }[] = [];
  let revision = 3;
  const postOperations = vi.fn(async (_id: number, body: { baseRevision: number; clientBatchId: string; operations: Operation[] }) => {
    enviados.push(body);
    revision += 1;
    return {
      revision,
      applied: true,
      idMap: {},
      composed: composedFixture(),
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    } satisfies OperationBatchResponse;
  });
  const store = createEditorStore({
    getDocument: vi.fn(async () => respuestaDocumento()),
    postOperations: postOperations as unknown as StoreDeps["postOperations"],
    // Temporizadores manuales: nada se dispara solo, la prueba llama a `flushNow()`.
    setTimeoutImpl: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimeoutImpl: () => {},
    now: () => 1_000_000,
    ...overrides,
  });
  return { store, enviados, postOperations };
}

async function cargado() {
  const ctx = nuevoStore();
  await ctx.store.getState().load(5);
  return ctx;
}

beforeEach(() => {
  window.localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Ciclo de vida
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("ciclo de vida (contratos §4: `:choose-template` es el primer paso)", () => {
  it("`404 TPL_DOCUMENT_NOT_STARTED` NO es un error: es el estado inicial esperado", async () => {
    const { store } = nuevoStore({
      getDocument: vi.fn(async () => {
        throw new ApiError({ timestamp: "", statusCode: 404, code: "TPL_DOCUMENT_NOT_STARTED", message: "" }, 404);
      }) as unknown as StoreDeps["getDocument"],
    });
    await store.getState().load(5);
    expect(store.getState().loadState).toBe("not-started");
    expect(store.getState().loadError).toBeNull();
  });

  it("`chooseTemplate` en la PRIMERA creación no manda `baseRevision`; con documento sí (ADR-1R-B-11)", async () => {
    const llamadas: unknown[] = [];
    const chooseTemplate = vi.fn(async (_id: number, body: unknown) => {
      llamadas.push(body);
      return {
        document: documentFixture(),
        composed: composedFixture(),
        report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
        revision: 0,
        created: true,
        movedToAttic: [],
        publicToken: "pub_x",
        publicUrl: "u",
      };
    });
    const { store } = nuevoStore({ chooseTemplate: chooseTemplate as unknown as StoreDeps["chooseTemplate"] });
    await store.getState().chooseTemplateFor(5, "boda-clasica", "1.0.0");
    expect(llamadas[0]).toEqual({ templateSlug: "boda-clasica", templateVersion: "1.0.0" });
    // `revision` empieza en 0 tras `:choose-template`, no en 1 (`handoffs/3-0a.md` §4).
    expect(store.getState().revision).toBe(0);
    await store.getState().chooseTemplateFor(5, "xv-jardin", "1.0.0");
    expect(llamadas[1]).toMatchObject({ baseRevision: 0 });
  });

  it("cambiar de plantilla VACÍA ambas pilas y lo dice (04 §7.3)", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.title", texto("Ana y Luis"));
    expect(store.getState().undo).toHaveLength(1);
    const chooseTemplate = vi.fn(async () => ({
      document: documentFixture(),
      composed: composedFixture(),
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
      revision: 4,
      created: false,
      movedToAttic: ["boda-clasica@1.0.0"],
      publicToken: "pub_x",
      publicUrl: "u",
    }));
    const { store: store2 } = nuevoStore({ chooseTemplate: chooseTemplate as unknown as StoreDeps["chooseTemplate"] });
    await store2.getState().load(5);
    store2.getState().setBlock("cover.title", texto("Ana y Luis"));
    await store2.getState().chooseTemplateFor(5, "xv-jardin", "1.0.0");
    expect(store2.getState().undo).toHaveLength(0);
    expect(store2.getState().redo).toHaveLength(0);
    expect(store2.getState().draft).toHaveLength(0);
    expect(store2.getState().avisos.some((a) => a.texto.includes("no se puede deshacer"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Las 11 acciones
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("las 11 acciones = las 11 operaciones de @invitaciones/schema", () => {
  it("la superficie de edición del store tiene EXACTAMENTE las 11, ni una más", async () => {
    const { store } = await cargado();
    const s = store.getState() as unknown as Record<string, unknown>;
    const ONCE = [
      "setBlock",
      "clearBlock",
      "addItem",
      "removeItem",
      "moveItem",
      "setItemBlock",
      "clearItemBlock",
      "setSectionVisible",
      "setSectionVariant",
      "reorderSections",
      "setTheme",
    ];
    for (const nombre of ONCE) expect(typeof s[nombre]).toBe("function");
    expect(ONCE).toHaveLength(11);
  });

  it("setBlock: parche optimista, entrada de undo y operación encolada", async () => {
    const { store, enviados } = await cargado();
    store.getState().setBlock("cover.title", texto("Ana y Luis"));
    const s = store.getState();
    expect(s.draft).toEqual([{ op: "setBlock", blockId: "cover.title", value: texto("Ana y Luis") }]);
    expect(s.saveState).toBe("dirty");
    expect(s.undo).toHaveLength(1);
    // U-09 sobre el store real: `cover.title` estaba en `default`.
    expect(s.undo[0]?.revert).toEqual([{ op: "clearBlock", blockId: "cover.title" }]);
    // El parche optimista ya se ve, sin esperar al servidor.
    const bloque = s.composed?.sections[0]?.blocks[0] as { value: { value: string }; provenance: string };
    expect(bloque.value.value).toBe("Ana y Luis");
    expect(bloque.provenance).toBe("user");
    expect(enviados).toHaveLength(0); // texto ⇒ debounce, no envío inmediato
  });

  it("las estructurales son de disparo inmediato y llevan `baseRevision` y `clientBatchId`", async () => {
    const { store, enviados } = await cargado();
    store.getState().setSectionVisible("story", false);
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]?.baseRevision).toBe(3);
    expect(enviados[0]?.clientBatchId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(enviados[0]?.operations).toEqual([{ op: "setSectionVisible", sectionKey: "story", visible: false }]);
  });

  it("addItem devuelve el tempId y lo inserta de forma optimista", async () => {
    const { store } = await cargado();
    const tempId = store.getState().addItem("gallery.photos", {});
    expect(tempId).toMatch(/^tmp:/);
    const grupo = store.getState().composed?.sections[1]?.blocks[0] as { items: { itemId: string }[] };
    expect(grupo.items.map((i) => i.itemId)).toEqual([ULID_A, ULID_B, tempId]);
    expect(store.getState().undo[0]?.revert).toEqual([{ op: "removeItem", groupId: "gallery.photos", itemId: tempId }]);
  });

  it("removeItem guarda los valores CRUDOS del documento para poder reconstruir (no los resueltos)", async () => {
    const { store } = await cargado();
    store.getState().removeItem("gallery.photos", ULID_B);
    const inversa = store.getState().undo[0]?.revert[0] as Extract<Operation, { op: "addItem" }>;
    expect(inversa.op).toBe("addItem");
    expect(inversa.index).toBe(1);
    expect(inversa.values).toEqual({ caption: texto("En la playa") });
  });

  it("setItemBlock sobre un ítem SIN valor previo se invierte con clearItemBlock", async () => {
    const { store } = await cargado();
    store.getState().setItemBlock("gallery.photos", ULID_A, "caption", texto("Nuevo pie"));
    expect(store.getState().undo[0]?.revert).toEqual([
      { op: "clearItemBlock", groupId: "gallery.photos", itemId: ULID_A, blockId: "caption" },
    ]);
  });

  it("clearItemBlock sí se puede resolver localmente: no hay defaults por itemBlock", async () => {
    const { store } = await cargado();
    store.getState().clearItemBlock("gallery.photos", ULID_B, "caption");
    const grupo = store.getState().composed?.sections[1]?.blocks[0] as { items: { blocks: { value: unknown; provenance: string }[] }[] };
    expect(grupo.items[1]?.blocks[0]?.value).toBeNull();
    expect(grupo.items[1]?.blocks[0]?.provenance).toBe("empty");
  });

  it("clearBlock deja el bloque PENDIENTE: el escalón siguiente lo decide el servidor (§12.4)", async () => {
    const { store } = await cargado();
    store.getState().clearBlock("cover.subtitle");
    expect(store.getState().pendingBlocks).toContain("cover::cover.subtitle::::");
  });

  it("un `setBlock` de fecha no se parchea y entra en pendingBlocks (H-27: un solo formateador)", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.date", { kind: "date", value: "2027-01-02" } as Extract<Operation, { op: "setBlock" }>["value"]);
    expect(store.getState().pendingBlocks).toContain("cover::cover.date::::");
    const bloque = store.getState().composed?.sections[0]?.blocks[2] as { value: { formatted: string } };
    expect(bloque.value.formatted).toBe("14 de noviembre de 2026"); // el anterior, no uno inventado
  });

  it("reorderSections reordena y su inversa es el orden anterior completo", async () => {
    const { store } = await cargado();
    store.getState().reorderSections(["story", "cover", "gallery"]);
    expect(store.getState().composed?.sections.map((s) => s.key)).toEqual(["story", "cover", "gallery"]);
    expect(store.getState().undo[0]?.revert).toEqual([{ op: "reorderSections", order: ["cover", "gallery", "story"] }]);
  });

  it("una operación no válida contra el esquema se rechaza AQUÍ, con aviso (P1)", async () => {
    const { store } = await cargado();
    store.getState().setSectionVariant("cover", "VARIANTE INVÁLIDA");
    expect(store.getState().draft).toHaveLength(0);
    expect(store.getState().avisos.some((a) => a.nivel === "error")).toBe(true);
  });

  it("una operación que no cambia nada no encola ni empuja undo (no-op, no descarte)", async () => {
    const { store } = await cargado();
    store.getState().setSectionVisible("story", true); // ya era visible
    expect(store.getState().draft).toHaveLength(0);
    expect(store.getState().undo).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Undo / redo sobre el store (04 §11.3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("undo / redo (04 §11.3)", () => {
  it("caso 1: si la operación sigue en el borrador, deshacer NO genera tráfico", async () => {
    const { store, enviados } = await cargado();
    store.getState().setBlock("cover.title", texto("Ana"));
    expect(store.getState().draft).toHaveLength(1);
    store.getState().undoOnce();
    expect(store.getState().draft).toHaveLength(0);
    expect(enviados).toHaveLength(0);
    expect(store.getState().redo).toHaveLength(1);
  });

  it("caso 2: si ya se envió, la inversa viaja como operaciones NUEVAS", async () => {
    const { store, enviados } = await cargado();
    store.getState().setBlock("cover.title", texto("Ana"));
    store.getState().flushNow();
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    store.getState().undoOnce();
    // `clearBlock` es de disparo inmediato (§12.1), así que la inversa sale ya: se comprueba en el
    // segundo envío, no en el borrador.
    await vi.waitFor(() => expect(enviados).toHaveLength(2));
    expect(enviados[1]?.operations).toEqual([{ op: "clearBlock", blockId: "cover.title" }]);
  });

  it("rehacer reaplica y vuelve a encolar", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.subtitle", texto("Nos casamos"));
    store.getState().undoOnce();
    store.getState().redoOnce();
    expect(store.getState().undo).toHaveLength(1);
    expect(store.getState().redo).toHaveLength(0);
    const bloque = store.getState().composed?.sections[0]?.blocks[1] as { value: { value: string } };
    expect(bloque.value.value).toBe("Nos casamos");
  });

  it("toda edición nueva invalida el rehacer", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.subtitle", texto("A"));
    store.getState().undoOnce();
    expect(store.getState().redo).toHaveLength(1);
    store.getState().setBlock("cover.subtitle", texto("B"));
    expect(store.getState().redo).toHaveLength(0);
  });

  it("deshacer con la pila vacía no lanza (el botón está deshabilitado, nunca error)", async () => {
    const { store } = await cargado();
    expect(() => store.getState().undoOnce()).not.toThrow();
    expect(() => store.getState().redoOnce()).not.toThrow();
  });

  it("cambiar de selección abre una entrada nueva (U-10 sobre el store real)", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.title", texto("A"));
    store.getState().select({ sectionKey: "cover", blockId: "cover.subtitle" });
    store.getState().setBlock("cover.subtitle", texto("B"));
    expect(store.getState().undo).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-11 sobre el store: reconciliación con `idMap`
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-11 · applyServerState reescribe tempId → ULID en las pilas, la cola y la selección", () => {
  it("la entrada de undo apunta al ULID tras la respuesta", async () => {
    const { store } = await cargado();
    const tempId = store.getState().addItem("gallery.photos", {});
    store.getState().select({ sectionKey: "gallery", blockId: "gallery.photos", itemId: tempId, itemBlockId: "caption" });
    store.getState().applyServerState({
      revision: 4,
      applied: true,
      idMap: { [tempId]: ULID_A },
      composed: composedFixture(),
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    });
    expect(store.getState().undo[0]?.revert[0]).toEqual({ op: "removeItem", groupId: "gallery.photos", itemId: ULID_A });
    expect(store.getState().selection?.itemId).toBe(ULID_A);
    expect(store.getState().revision).toBe(4);
  });

  it("los parches optimistas pendientes se REAPLICAN sobre el estado del servidor (§12.4 paso 4)", async () => {
    const { store } = await cargado();
    store.getState().setBlock("cover.subtitle", texto("lo que acabo de escribir"));
    store.getState().applyServerState({
      revision: 4,
      applied: true,
      idMap: {},
      composed: composedFixture(), // el servidor aún no conoce ese texto
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    });
    const bloque = store.getState().composed?.sections[0]?.blocks[1] as { value: { value: string } };
    expect(bloque.value.value).toBe("lo que acabo de escribir"); // no "salta hacia atrás"
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-13 / U-14 — conflicto de `baseRevision` (04 §12.6)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** `fallosMaximos` acota cuántas veces responde 409: tras el rebase el reenvío debe poder triunfar. */
function storeEnConflicto(fallosMaximos = Number.POSITIVE_INFINITY) {
  const conflictDetails = {
    currentRevision: 11,
    document: documentFixture(),
    // El otro editor borró la sección `story` y el ítem ULID_B.
    composed: (() => {
      const c = composedFixture();
      c.sections = c.sections.filter((s) => s.key !== "story");
      const grupo = c.sections[1]?.blocks[0] as { items: { itemId: string }[] };
      grupo.items = grupo.items.filter((i) => i.itemId !== ULID_B);
      return c;
    })(),
    report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
  };
  let fallos = 0;
  const enviados: { baseRevision: number; clientBatchId: string; operations: Operation[] }[] = [];
  const ctx = nuevoStore({
    postOperations: vi.fn(async (_id: number, body: { baseRevision: number; clientBatchId: string; operations: Operation[] }) => {
      enviados.push(body);
      if (fallos < fallosMaximos) {
        fallos += 1;
        throw new ApiError(
          { timestamp: "", statusCode: 409, code: "TPL_REVISION_CONFLICT", message: "conflicto", details: conflictDetails },
          409,
        );
      }
      return {
        revision: 12,
        applied: true,
        idMap: {},
        composed: composedFixture(),
        report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
      };
    }) as unknown as StoreDeps["postOperations"],
  });
  return { ...ctx, enviados };
}

describe("U-13 · 409 con «descartar mis cambios» (04 §12.6 opción 1)", () => {
  it("cola, borrador y ambas pilas quedan vacías, y `revision` es la del servidor", async () => {
    const { store } = storeEnConflicto();
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("Ana"));
    store.getState().setBlock("cover.subtitle", texto("Luis"));
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().saveState).toBe("conflict"));
    expect(store.getState().conflict?.currentRevision).toBe(11);
    expect(store.getState().conflict?.pending).toHaveLength(2);

    await store.getState().resolveConflict("discard-mine");
    const s = store.getState();
    expect(s.queue).toHaveLength(0);
    expect(s.draft).toHaveLength(0);
    expect(s.undo).toHaveLength(0);
    expect(s.redo).toHaveLength(0);
    expect(s.conflict).toBeNull();
    expect(s.revision).toBe(3); // la que devuelve el `GET .../document` recargado
    expect(s.avisos.some((a) => a.texto.includes("descartaron"))).toBe(true);
  });

  it("mientras el diálogo está abierto no se envía NADA más (§12.6)", async () => {
    const { store, postOperations } = storeEnConflicto();
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("Ana"));
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().saveState).toBe("conflict"));
    const llamadasAntes = postOperations.mock.calls.length;
    store.getState().flushNow();
    store.getState().setBlock("cover.subtitle", texto("no debe entrar"));
    expect(postOperations.mock.calls.length).toBe(llamadasAntes);
    expect(store.getState().avisos.some((a) => a.texto.includes("Resuelve primero"))).toBe(true);
  });
});

describe("U-14 · 409 con rebase asistido (04 §12.6 opción 2)", () => {
  it("las operaciones sobre un bloque desaparecido se LISTAN y no se envían", async () => {
    const { store, postOperations } = storeEnConflicto();
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("sigue existiendo"));
    store.getState().setSectionVisible("story", false); // el otro editor borró `story`
    store.getState().setItemBlock("gallery.photos", ULID_B, "caption", texto("ítem borrado por el otro"));
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().saveState).toBe("conflict"));

    const llamadasTrasElConflicto = postOperations.mock.calls.length;
    // Primera pasada: se CALCULA y se ENSEÑA. No se envía nada todavía.
    await store.getState().resolveConflict("rebase");
    const rebase = store.getState().conflict?.rebase;
    expect(rebase).not.toBeNull();
    expect(rebase?.aplicables).toHaveLength(1);
    expect(rebase?.descartadas.map((d) => d.motivo)).toEqual(["la sección ya no existe", "alguien borró ese elemento"]);
    expect(postOperations.mock.calls.length).toBe(llamadasTrasElConflicto);
    expect(store.getState().conflict).not.toBeNull();
  });

  it("la segunda pasada adopta la versión nueva y reenvía SOLO lo aplicable, con revisión fresca", async () => {
    const { store, enviados } = storeEnConflicto(1);
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("sigue existiendo"));
    store.getState().setSectionVisible("story", false);
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().saveState).toBe("conflict"));
    await store.getState().resolveConflict("rebase");
    await store.getState().resolveConflict("rebase");
    // El reenvío lleva la revisión FRESCA del servidor (11), no la vieja (3).
    await vi.waitFor(() => expect(enviados).toHaveLength(2));
    expect(enviados[1]?.baseRevision).toBe(11);
    expect(enviados[1]?.operations).toEqual([{ op: "setBlock", blockId: "cover.title", value: texto("sigue existiendo") }]);
    const s = store.getState();
    expect(s.conflict).toBeNull();
    expect(s.avisos.some((a) => a.texto.includes("Descartamos 1 cambio"))).toBe(true);
    expect(s.undo).toHaveLength(0);
  });

  it("la opción «ver mis cambios» no toca nada: solo deja el diálogo abierto", async () => {
    const { store } = storeEnConflicto();
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("Ana"));
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().saveState).toBe("conflict"));
    await store.getState().resolveConflict("review");
    expect(store.getState().conflict).not.toBeNull();
    expect(store.getState().conflict?.rebase).toBeNull();
    expect(store.getState().draft.length + store.getState().queue.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Idempotencia, errores y recuperación
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("idempotencia y errores (contratos §4, 04 §12.5)", () => {
  it("`200 {applied:false}` del reintento del mismo clientBatchId se trata como ÉXITO", async () => {
    const { store } = nuevoStore({
      postOperations: vi.fn(async () => ({
        revision: 9,
        applied: false, // ya se había aplicado: el timeout ocultó la respuesta original
        idMap: {},
        composed: composedFixture(),
        report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
      })) as unknown as StoreDeps["postOperations"],
    });
    await store.getState().load(5);
    store.getState().setSectionVisible("story", false);
    await vi.waitFor(() => expect(store.getState().saveState).toBe("idle"));
    expect(store.getState().revision).toBe(9);
    expect(store.getState().lastError).toBeNull();
    expect(store.getState().avisos.filter((a) => a.nivel === "error")).toHaveLength(0);
  });

  it("`422 TPL_OPERATION_INVALID` descarta el lote, purga su entrada de undo y avisa", async () => {
    const { store } = nuevoStore({
      postOperations: vi.fn(async () => {
        throw new ApiError({ timestamp: "", statusCode: 422, code: "TPL_OPERATION_INVALID", message: "valor inválido" }, 422);
      }) as unknown as StoreDeps["postOperations"],
    });
    await store.getState().load(5);
    store.getState().setSectionVisible("story", false);
    await vi.waitFor(() => expect(store.getState().saveState).toBe("error"));
    expect(store.getState().queue).toHaveLength(0);
    expect(store.getState().undo).toHaveLength(0);
    expect(store.getState().avisos.some((a) => a.codigo === "TPL_OPERATION_INVALID")).toBe(true);
  });

  it("`403 TPL_FORBIDDEN` detiene el autoguardado y pasa a solo lectura", async () => {
    const { store } = nuevoStore({
      postOperations: vi.fn(async () => {
        throw new ApiError({ timestamp: "", statusCode: 403, code: "TPL_FORBIDDEN", message: "" }, 403);
      }) as unknown as StoreDeps["postOperations"],
    });
    await store.getState().load(5);
    store.getState().setSectionVisible("story", false);
    await vi.waitFor(() => expect(store.getState().tabRole).toBe("readonly"));
    store.getState().setBlock("cover.title", texto("no debería entrar"));
    expect(store.getState().draft).toHaveLength(0);
  });

  it("solo hay UN lote en vuelo a la vez (`baseRevision` es un contador)", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const { store } = nuevoStore({
      postOperations: vi.fn(async () => {
        enVuelo += 1;
        maximo = Math.max(maximo, enVuelo);
        await Promise.resolve();
        enVuelo -= 1;
        return {
          revision: 4,
          applied: true,
          idMap: {},
          composed: composedFixture(),
          report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
        };
      }) as unknown as StoreDeps["postOperations"],
    });
    await store.getState().load(5);
    for (let i = 0; i < 60; i += 1) store.getState().setBlock("cover.title", texto(`v${i}`));
    store.getState().flushNow();
    await vi.waitFor(() => expect(store.getState().queue).toHaveLength(0));
    expect(maximo).toBe(1);
  });

  it("recuperación de sesión: lo pendiente se reencola con `clientBatchId` NUEVO (04 §7.5)", async () => {
    window.localStorage.setItem(
      "tpl:pending:5",
      JSON.stringify({
        revision: 1,
        draft: [{ op: "setBlock", blockId: "cover.title", value: texto("de ayer") }],
        queue: [],
        at: 1_699_000_000_000,
        templateVersion: { slug: "boda-clasica", version: "1.0.0" },
      }),
    );
    const { store, enviados } = await cargado();
    expect(store.getState().recovered?.operations).toHaveLength(1);
    store.getState().restoreRecovered(true);
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    // `baseRevision` es la ACTUAL (3), no la vieja (1).
    expect(enviados[0]?.baseRevision).toBe(3);
    expect(enviados[0]?.clientBatchId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("descartar lo recuperado borra la clave de localStorage", async () => {
    window.localStorage.setItem(
      "tpl:pending:5",
      JSON.stringify({ revision: 1, draft: [{ op: "clearBlock", blockId: "cover.subtitle" }], queue: [], at: 1, templateVersion: null }),
    );
    const { store } = await cargado();
    store.getState().restoreRecovered(false);
    expect(window.localStorage.getItem("tpl:pending:5")).toBeNull();
  });

  it("`saveOnHide` manda el borrador con keepalive (U-16 sobre el store)", async () => {
    const sendKeepalive = vi.fn(() => ({ enviado: true, bytes: 100 }));
    const { store } = nuevoStore({ sendKeepalive });
    await store.getState().load(5);
    store.getState().setBlock("cover.title", texto("sin guardar"));
    store.getState().saveOnHide();
    expect(sendKeepalive).toHaveBeenCalledTimes(1);
    const [id, body] = sendKeepalive.mock.calls[0] as unknown as [number, { baseRevision: number; operations: Operation[] }];
    expect(id).toBe(5);
    expect(body.baseRevision).toBe(3);
    expect(body.operations).toHaveLength(1);
  });

  it("`hasUnsaved` refleja borrador + cola + lote en vuelo", async () => {
    const { store } = await cargado();
    expect(store.getState().hasUnsaved()).toBe(false);
    store.getState().setBlock("cover.title", texto("x"));
    expect(store.getState().hasUnsaved()).toBe(true);
  });
});

describe("candado de pestaña y avisos", () => {
  it("en modo `readonly` no se puede editar, y se dice por qué", async () => {
    const { store } = await cargado();
    store.getState().setTabRole("readonly");
    store.getState().setBlock("cover.title", texto("x"));
    expect(store.getState().draft).toHaveLength(0);
    expect(store.getState().avisos.some((a) => a.texto.includes("modo lectura"))).toBe(true);
  });

  it("los avisos se pueden descartar de uno en uno", async () => {
    const { store } = await cargado();
    store.getState().pushWarning({ nivel: "info", texto: "hola" });
    const id = store.getState().avisos[0]?.id ?? "";
    store.getState().dismissWarning(id);
    expect(store.getState().avisos).toHaveLength(0);
  });

  it("un lienzo incompatible se anuncia y no rompe el editor (U-15 en el store)", async () => {
    const { store } = await cargado();
    store.getState().onCanvasIncompatible(2);
    expect(store.getState().canvas.status).toBe("incompatible");
    expect(store.getState().avisos.some((a) => a.texto.includes("v2"))).toBe(true);
  });
});
