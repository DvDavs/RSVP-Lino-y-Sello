// components/editor/BlockForm.test.tsx — 04 §6.3, §7.1 paso 5: variante de sección y bloques
// de solo lectura (business/fixed) mostrados CON explicación, nunca deshabilitados y mudos.
import { render, screen } from "@testing-library/react";
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
