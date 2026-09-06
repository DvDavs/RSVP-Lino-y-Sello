// components/editor/SectionList.test.tsx — E-03/E-04/E-05 en miniatura (04 §14): el menú ⋮ (sin
// arrastre) produce la MISMA `reorderSections` que produciría el asa. El arrastre real de ratón y de
// teclado se prueba en `e2e/secciones.spec.ts` contra el backend real — jsdom no simula bien
// PointerEvent con `getBoundingClientRect`.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TemplateManifest } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { SectionList } from "./SectionList.tsx";

function seccion(key: string, title: string) {
  return { key, type: "cover" as const, variant: "full", visible: true, title, blocks: [] };
}

/** Manifiesto mínimo que CONFIRMA que `sectionKey` no es obligatoria (`required: false`). */
function manifiestoConSeccionOpcional(sectionKey: string): TemplateManifest {
  return {
    manifestVersion: 1,
    slug: "x",
    version: "1.0.0",
    name: { "es-MX": "x" },
    eventKinds: ["wedding"],
    minPlanTier: 1,
    locales: ["es-MX"],
    capabilities: [],
    sections: [
      {
        key: sectionKey,
        type: "story",
        title: { "es-MX": "x" },
        variants: ["default"],
        defaultVariant: "default",
        required: false,
        defaultVisible: true,
        blocks: [
          {
            id: `${sectionKey}.title`,
            role: "sectionTitle",
            label: { "es-MX": "Título" },
            required: false,
            editable: true,
            source: "user",
            aiEditable: true,
            type: "text",
            constraints: { minLength: 0, maxLength: 60, multiline: false },
          },
        ],
      },
    ],
    assets: [],
    migrationsFrom: [],
  };
}

describe("SectionList", () => {
  it("el menú ⋮ «Bajar» de la primera fila llama a reorderSections con el nuevo orden completo", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [seccion("cover", "Portada"), seccion("event", "Ceremonia"), seccion("gallery", "Galería")],
      } as never,
      selection: null,
    });
    const espia = vi.spyOn(useEditorStore.getState(), "reorderSections");

    render(<SectionList manifest={null} />);
    await usuario.click(screen.getByTestId("section-menu-cover"));
    await usuario.click(await screen.findByTestId("section-bajar-cover"));

    expect(espia).toHaveBeenCalledWith(["event", "cover", "gallery"]);
  });

  it("«Mover al final» produce el orden correcto", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [seccion("cover", "Portada"), seccion("event", "Ceremonia"), seccion("gallery", "Galería")],
      } as never,
      selection: null,
    });
    const espia = vi.spyOn(useEditorStore.getState(), "reorderSections");

    render(<SectionList manifest={null} />);
    await usuario.click(screen.getByTestId("section-menu-cover"));
    await usuario.click(await screen.findByRole("menuitem", { name: "Mover al final" }));

    expect(espia).toHaveBeenCalledWith(["event", "gallery", "cover"]);
  });

  it("una fila con setSectionVisible se llama al cambiar el interruptor", async () => {
    const usuario = userEvent.setup();
    useEditorStore.setState({
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [seccion("story", "Nuestra historia")],
      } as never,
      selection: null,
    });
    const espia = vi.spyOn(useEditorStore.getState(), "setSectionVisible");
    render(<SectionList manifest={manifiestoConSeccionOpcional("story")} />);
    await usuario.click(screen.getByTestId("section-visible-story"));
    expect(espia).toHaveBeenCalledWith("story", false);
  });

  it("sin manifiesto (todavía sin sembrar) NINGUNA fila ofrece interruptor: el valor conservador es «obligatoria», nunca «opcional» a ciegas", () => {
    useEditorStore.setState({
      composed: {
        composedVersion: 1,
        template: { slug: "x", version: "1.0.0" },
        locale: "es-MX",
        theme: {} as never,
        sections: [seccion("story", "Nuestra historia")],
      } as never,
      selection: null,
    });
    render(<SectionList manifest={null} />);
    expect(screen.queryByTestId("section-visible-story")).toBeNull();
    // M-11 (`bitacora/3c-ux.md §4`): debajo de `sm` el candado lleva el mismo texto para lectores de
    // pantalla y a partir de `sm` la insignia — ambos viven en el DOM a la vez.
    expect(screen.getAllByText("Siempre visible").length).toBeGreaterThan(0);
  });
});
