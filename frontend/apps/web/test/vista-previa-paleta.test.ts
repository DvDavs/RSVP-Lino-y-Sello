// test/vista-previa-paleta.test.ts — bloque 3-5b, mitad del PADRE de la vista previa de paleta
// (`04 §7.1` paso 8, `04 §9.3` `PREVIEW_THEME`). La mitad del LIENZO está en
// `app/(canvas)/editor/[invitationId]/canvas/LienzoCliente.test.tsx`.
//
// Lo que protege, y por qué existe: `PREVIEW_THEME` solo transporta IDENTIFICADORES y el lienzo no
// puede resolverlos (no tiene `theme.json`, no puede pedirlo bajo `connect-src 'none'` y sin
// credenciales). La resolución `paletteId → tokens` ocurre aquí, con el catálogo que `GET
// .../document` entrega desde 3-4b, y los tokens viajan en un `RENDER` EFÍMERO. Las tres reglas que
// no se pueden romper: cambia al instante, NO escribe nada (ni operación, ni undo, ni `composed`),
// y al retirar el ratón vuelve el tema real.
import { describe, expect, it, vi } from "vitest";
import type { ComposedDocument } from "@invitaciones/schema";
import { createEditorStore, leerThemeSpec, type StoreDeps } from "@/lib/store.ts";
import { resolverTema } from "@/lib/composed-patch.ts";
import type { CanvasSink } from "@/lib/store.ts";
import { composedFixture, documentFixture } from "./fixtures/composed.ts";
import { THEME_BODA_CLASICA } from "./fixtures/manifest.ts";
import type { GetDocumentResponse } from "@/lib/api-types.ts";

const BLUSH = THEME_BODA_CLASICA.palettes.find((p) => p.id === "blush")!;
const OLIVE = THEME_BODA_CLASICA.palettes.find((p) => p.id === "olive")!;
const MODERNA = THEME_BODA_CLASICA.fontSets.find((f) => f.id === "moderna")!;

function documentoBlush(): ComposedDocument {
  const base = composedFixture();
  return { ...base, theme: { ...base.theme, paletteId: "blush", fontSetId: "serif-elegante", tokens: BLUSH.tokens } };
}

/** `GET .../document` tal y como responde el backend desde 3-4b: con `manifest` y `theme`. */
function respuestaDocumento(conTema: boolean): GetDocumentResponse {
  const cuerpo = {
    document: documentFixture(),
    composed: documentoBlush(),
    report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null },
    revision: 3,
    templateVersion: { slug: "boda-clasica", version: "1.0.0", status: "published" },
    publicToken: "pub_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    publicUrl: "http://x/i/pub_ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    activeRelease: null,
    ...(conTema ? { theme: THEME_BODA_CLASICA } : {}),
  };
  return cuerpo as unknown as GetDocumentResponse;
}

function sinkEspia(): CanvasSink & { renders: { composed: ComposedDocument; revision: number }[]; previews: [string | null, string | null][] } {
  const renders: { composed: ComposedDocument; revision: number }[] = [];
  const previews: [string | null, string | null][] = [];
  return {
    renders,
    previews,
    render: (composed, revision) => renders.push({ composed, revision }),
    patch: () => {},
    select: () => {},
    scrollToSection: () => {},
    viewport: () => {},
    previewTheme: (p, f) => previews.push([p, f]),
  };
}

async function editorListo(conTema = true) {
  const sink = sinkEspia();
  const store = createEditorStore({
    getDocument: vi.fn(async () => respuestaDocumento(conTema)),
    setTimeoutImpl: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimeoutImpl: () => {},
    now: () => 1_000_000,
  } as Partial<StoreDeps>);
  store.getState().attachCanvas(sink);
  await store.getState().load(5);
  store.getState().onCanvasReady("build-de-prueba"); // el lienzo saludó: `canvas.status = "ready"`
  sink.renders.length = 0; // el `RENDER` de la carga inicial no interesa aquí
  return { store, sink };
}

describe("resolverTema (puro)", () => {
  const actual = documentoBlush().theme;

  it("resuelve paletteId → tokens con el catálogo de la plantilla", () => {
    const t = resolverTema(THEME_BODA_CLASICA, actual, "olive", null);
    expect(t?.paletteId).toBe("olive");
    expect(t?.tokens).toEqual(OLIVE.tokens);
    // La tipografía no se tocó: la vista previa de paleta no cambia las fuentes.
    expect(t?.fontSetId).toBe(actual.fontSetId);
    expect(t?.fonts).toEqual(actual.fonts);
  });

  it("resuelve fontSetId → fonts sin tocar los colores", () => {
    const t = resolverTema(THEME_BODA_CLASICA, actual, null, "moderna");
    expect(t?.fontSetId).toBe("moderna");
    expect(t?.fonts).toEqual({ heading: MODERNA.heading, body: MODERNA.body });
    expect(t?.tokens).toEqual(actual.tokens);
  });

  it("devuelve null (no inventa nada) sin catálogo, sin ids o con un id que la versión no declara", () => {
    expect(resolverTema(null, actual, "olive", null)).toBeNull();
    expect(resolverTema(THEME_BODA_CLASICA, actual, null, null)).toBeNull();
    expect(resolverTema(THEME_BODA_CLASICA, actual, "paleta-que-no-existe", null)).toBeNull();
  });
});

describe("leerThemeSpec", () => {
  it("lee el campo `theme` de `GET .../document` y se degrada a null si no está o no valida", () => {
    expect(leerThemeSpec(respuestaDocumento(true))?.palettes).toHaveLength(3);
    expect(leerThemeSpec(respuestaDocumento(false))).toBeNull();
    expect(leerThemeSpec({ theme: { palettes: "no soy un array" } })).toBeNull();
    expect(leerThemeSpec(null)).toBeNull();
  });
});

describe("previewTheme (04 §7.1 paso 8: el lienzo cambia al instante, sin escribir nada)", () => {
  it("manda al lienzo los TOKENS ya resueltos, no solo el identificador", async () => {
    const { store, sink } = await editorListo();
    store.getState().previewTheme("olive", null);

    expect(sink.previews).toEqual([["olive", null]]); // el mensaje del protocolo sigue saliendo
    expect(sink.renders).toHaveLength(1);
    expect(sink.renders[0]!.composed.theme.tokens).toEqual(OLIVE.tokens);
    expect(sink.renders[0]!.composed.theme.paletteId).toBe("olive");
    // Misma revisión y mismo documento: es un repintado, no una verdad nueva.
    expect(sink.renders[0]!.revision).toBe(store.getState().revision);
    expect(sink.renders[0]!.composed.sections).toEqual(store.getState().composed!.sections);
  });

  it("NO escribe nada: ni `composed`, ni operación en cola, ni entrada de undo", async () => {
    const { store } = await editorListo();
    store.getState().previewTheme("olive", null);
    const s = store.getState();
    expect(s.composed!.theme.paletteId).toBe("blush");
    expect(s.composed!.theme.tokens).toEqual(BLUSH.tokens);
    expect(s.draft).toEqual([]);
    expect(s.queue).toEqual([]);
    expect(s.undo).toEqual([]);
    expect(s.saveState).toBe("idle");
  });

  it("al retirar el ratón vuelve el tema REAL, y no manda nada si no había vista previa", async () => {
    const { store, sink } = await editorListo();

    store.getState().previewTheme(null, null); // salir sin haber entrado: cero tráfico
    expect(sink.renders).toHaveLength(0);

    store.getState().previewTheme("olive", null);
    store.getState().previewTheme(null, null);
    expect(sink.renders).toHaveLength(2);
    expect(sink.renders[1]!.composed.theme.tokens).toEqual(BLUSH.tokens);
    expect(sink.renders[1]!.composed).toBe(store.getState().composed);
  });

  it("sin catálogo (backend sin `theme`) manda el identificador y NO finge un color", async () => {
    const { store, sink } = await editorListo(false);
    store.getState().previewTheme("olive", null);
    expect(sink.previews).toEqual([["olive", null]]);
    expect(sink.renders).toHaveLength(0); // degradación explícita: el lienzo se queda como está
  });

  it("no manda el repintado si el lienzo todavía no está listo (una vista previa caducada es peor)", async () => {
    const sink = sinkEspia();
    const store = createEditorStore({
      getDocument: vi.fn(async () => respuestaDocumento(true)),
      setTimeoutImpl: () => 0 as unknown as ReturnType<typeof setTimeout>,
      clearTimeoutImpl: () => {},
    } as Partial<StoreDeps>);
    store.getState().attachCanvas(sink);
    await store.getState().load(5);
    sink.renders.length = 0; // `canvas.status` sigue en "loading": nunca llegó el READY
    store.getState().previewTheme("olive", null);
    expect(sink.renders).toHaveLength(0);
  });
});

describe("setTheme (04 §7.1 paso 8, confirmar: escribe Y cambia el color al instante)", () => {
  it("el parche optimista resuelve los tokens con el catálogo, sin esperar al RENDER del servidor", async () => {
    const { store, sink } = await editorListo();
    store.getState().setTheme({ paletteId: "olive" });

    const t = store.getState().composed!.theme;
    expect(t.paletteId).toBe("olive");
    expect(t.tokens).toEqual(OLIVE.tokens); // ← sin esto, confirmar volvía al color anterior
    // Confirmar SÍ escribe: operación en el borrador y entrada de undo (al revés que la vista previa).
    expect(store.getState().undo).toHaveLength(1);
    expect([...store.getState().draft, ...store.getState().queue.flatMap((b) => b.ops)]).toContainEqual({
      op: "setTheme",
      paletteId: "olive",
    });
    // Y el lienzo se entera en el acto: `setTheme` es estructural ⇒ `RENDER` completo.
    expect(sink.renders.at(-1)!.composed.theme.tokens).toEqual(OLIVE.tokens);
  });

  it("sin catálogo se queda como antes de 3-5b: identificador sí, tokens los trae el servidor", async () => {
    const { store } = await editorListo(false);
    store.getState().setTheme({ paletteId: "olive" });
    const t = store.getState().composed!.theme;
    expect(t.paletteId).toBe("olive");
    expect(t.tokens).toEqual(BLUSH.tokens);
  });

  it("deshacer una confirmación devuelve también los tokens, no solo el identificador", async () => {
    const { store } = await editorListo();
    store.getState().setTheme({ paletteId: "olive" });
    store.getState().undoOnce();
    const t = store.getState().composed!.theme;
    expect(t.paletteId).toBe("blush");
    expect(t.tokens).toEqual(BLUSH.tokens);
  });
});
