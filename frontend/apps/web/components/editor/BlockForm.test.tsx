// components/editor/BlockForm.test.tsx — 04 §6.3, §7.1 paso 5: variante de sección y bloques
// de solo lectura (business/fixed) mostrados CON explicación, nunca deshabilitados y mudos.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { BlockForm } from "./BlockForm.tsx";

function manifiesto(): TemplateManifest {
  return {
    manifestVersion: 1,
    slug: "boda-clasica",
    version: "1.0.0",
    name: { "es-MX": "Boda clásica" },
    eventKinds: ["wedding"],
    minPlanTier: 1,
    locales: ["es-MX"],
    capabilities: [],
    sections: [
      {
        key: "event",
        type: "event",
        title: { "es-MX": "Ceremonia" },
        variants: ["timeline", "cards"],
        defaultVariant: "timeline",
        required: false,
        defaultVisible: true,
        blocks: [
          {
            id: "eventDate",
            role: "eventDate",
            label: { "es-MX": "Fecha" },
            required: true,
            editable: false,
            source: "business",
            aiEditable: false,
            type: "date",
            formatId: "long",
          },
        ],
      },
    ],
    assets: [],
    migrationsFrom: [],
  };
}

describe("BlockForm", () => {
  it("un bloque source:business se muestra de solo lectura CON explicación, nunca deshabilitado y mudo", () => {
    useEditorStore.setState({
      selection: { sectionKey: "event", blockId: "event" },
      document: { content: { eventDate: { kind: "date", value: "2026-12-12" } } } as never,
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [
          {
            key: "event",
            type: "event",
            variant: "timeline",
            visible: true,
            title: "Ceremonia",
            blocks: [{ id: "eventDate", role: "eventDate", type: "date", label: "Fecha", provenance: "business", value: { kind: "date", value: "2026-12-12", formatted: "12 de diciembre de 2026" } }],
          },
        ],
      } as never,
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null } as never,
    });

    render(<BlockForm invitationId={3} manifest={manifiesto()} manifestStatus="ready" />);

    expect(screen.getByText("12 de diciembre de 2026")).toBeTruthy();
    expect(screen.getByText(/se toma de los datos de tu invitación/i)).toBeTruthy();
    // Nunca un <input disabled> mudo: es texto normal, no un control de formulario apagado.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("con más de una variante muestra el selector «Diseño de la sección»", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      selection: { sectionKey: "event", blockId: "event" },
      document: { content: {} } as never,
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [{ key: "event", type: "event", variant: "timeline", visible: true, title: "Ceremonia", blocks: [] }],
      } as never,
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null } as never,
    });
    const espia = vi.spyOn(useEditorStore.getState(), "setSectionVariant");

    render(<BlockForm invitationId={3} manifest={manifiesto()} manifestStatus="ready" />);
    expect(screen.getByText("Diseño de la sección")).toBeTruthy();
    await usuario.click(screen.getByRole("radio", { name: /tarjetas/i }));
    expect(espia).toHaveBeenCalledWith("event", "cards");
  });

  it("«Volver a secciones» limpia la selección", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      selection: { sectionKey: "event", blockId: "event" },
      document: { content: {} } as never,
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [{ key: "event", type: "event", variant: "timeline", visible: true, title: "Ceremonia", blocks: [] }],
      } as never,
      report: { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null } as never,
    });
    render(<BlockForm invitationId={3} manifest={manifiesto()} manifestStatus="ready" />);
    await usuario.click(screen.getByRole("button", { name: /volver a secciones/i }));
    expect(useEditorStore.getState().selection).toBeNull();
    expect(useEditorStore.getState().panel).toBe("sections");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// D1 (bloque 3-7, ADR-3-7-01) · el síntoma que se veía en pantalla
//
// Esta prueba FALLA sin el arreglo de 3-7. Reproduce el flujo real de `04 §13.2`: el bloque
// `cover.image` empieza SIN valor, `ImageField` termina la subida y llama a `onCommit` (=
// `setBlock`), y la respuesta del servidor llega con el `composed` ya resuelto (§12.4). Antes,
// `document.content["cover.image"]` seguía vacío, `ScalarBlockField.tsx:74` no encontraba el
// `assetId` y `ImageField` recibía `value: null`: el botón se quedaba en «Elegir foto» y
// `alCambiarAlt` (`if (!value) return`) dejaba de mandar nada hasta recargar la página.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const ASSET = "as_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const FOTO = { kind: "image", assetId: ASSET, alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } } as never;

function manifiestoConFoto(): TemplateManifest {
  return {
    ...manifiesto(),
    sections: [
      {
        key: "cover",
        type: "cover",
        title: { "es-MX": "Portada" },
        variants: ["centrada"],
        defaultVariant: "centrada",
        required: true,
        defaultVisible: true,
        blocks: [
          {
            id: "cover.image",
            role: "coverImage",
            label: { "es-MX": "Foto de portada" },
            required: false,
            editable: true,
            source: "user",
            aiEditable: true,
            type: "image",
            constraints: { aspect: "free", maxBytes: 8_388_608 },
          },
        ],
      },
    ],
  } as TemplateManifest;
}

/** `composed` de la portada; `foto` decide si el bloque ya trae la imagen RESUELTA (con `url`). */
function composedPortada(foto: boolean) {
  return {
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: {} as never,
    sections: [
      {
        key: "cover",
        type: "cover",
        variant: "centrada",
        visible: true,
        title: "Portada",
        blocks: [
          {
            id: "cover.image",
            role: "coverImage",
            type: "image",
            label: "Foto de portada",
            provenance: foto ? "user" : "empty",
            value: foto ? { kind: "image", url: "https://cdn/foto.webp", alt: "Ana y Luis", focal: { x: 0.5, y: 0.5 } } : null,
          },
        ],
      },
    ],
  } as never;
}

const INFORME_VACIO = { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null } as never;

describe("D1 · tras subir una foto, el panel refleja la foto nueva SIN recargar (3-7, ADR-3-7-01)", () => {
  it("el botón pasa a «Cambiar foto» y el texto alternativo vuelve a guardar", async () => {
    const usuario = userEvent.setup();
    // El autoguardado dispara `setBlock` de imagen de inmediato (§12.1). La red se simula aquí:
    // esta prueba mide el ESTADO del panel, no el transporte.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ revision: 4, applied: true, idMap: {}, composed: composedPortada(true), report: INFORME_VACIO }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    useEditorStore.setState({
      invitationId: 3,
      loadState: "ready",
      revision: 3,
      selection: { sectionKey: "cover", blockId: "cover.image" },
      // El bloque empieza SIN valor: es el caso de una invitación recién creada.
      document: { content: {}, structure: { sections: [{ key: "cover", variant: "centrada", visible: true }] }, theme: { paletteId: "p", fontSetId: "f" } } as never,
      composed: composedPortada(false),
      report: INFORME_VACIO,
      draft: [],
      queue: [],
      inFlight: null,
      undo: [],
      redo: [],
      saveState: "idle",
      tabRole: "editor",
    });

    render(<BlockForm invitationId={3} manifest={manifiestoConFoto()} manifestStatus="ready" />);
    expect(screen.getByRole("button", { name: "Elegir foto" })).toBeTruthy();

    // Lo que hace `ImageField.onCommit` en cuanto termina de subir y recortar (04 §13.2 paso 5).
    useEditorStore.getState().setBlock("cover.image", FOTO);
    // …y lo que devuelve el servidor ≤ 2 s después: `composed` resuelto, SIN el documento crudo.
    useEditorStore.getState().applyServerState({ revision: 4, applied: true, idMap: {}, composed: composedPortada(true), report: INFORME_VACIO } as never);

    // ANTES de 3-7 este `findByRole` fallaba: el botón seguía diciendo «Elegir foto».
    expect(await screen.findByRole("button", { name: "Cambiar foto" })).toBeTruthy();

    // Y el texto alternativo volvía a ser un campo muerto: `alCambiarAlt` hacía `if (!value) return`.
    const alt = screen.getByLabelText("Texto alternativo");
    await usuario.clear(alt);
    await usuario.type(alt, "Ana y Luis en la playa");
    await waitFor(() => {
      const ops = useEditorStore.getState().document?.content["cover.image"] as { alt?: string } | undefined;
      expect(ops?.alt).toBe("Ana y Luis en la playa");
    });
  });
});
