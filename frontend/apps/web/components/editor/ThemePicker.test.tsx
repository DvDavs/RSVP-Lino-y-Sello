// components/editor/ThemePicker.test.tsx — 04 §7.1 paso 8: previsualización al pasar el ratón
// (`previewTheme`, sin escribir nada) y `setTheme` al confirmar. Opciones CURADAS (P7): solo las
// paletas/fuentes del `theme.json` de la plantilla activa.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeSpec } from "@/lib/manifest.ts";
import { useEditorStore } from "@/lib/store.ts";
import { ThemePicker } from "./ThemePicker.tsx";

function theme(): ThemeSpec {
  return {
    palettes: [
      { id: "rosa", name: { "es-MX": "Rosa empolvado" }, tokens: { bg: "#ffffff", surface: "#ffffff", ink: "#222222", accent: "#e0a0a0", accentInk: "#ffffff", muted: "#888888" } },
      { id: "olivo", name: { "es-MX": "Olivo" }, tokens: { bg: "#ffffff", surface: "#ffffff", ink: "#222222", accent: "#708238", accentInk: "#ffffff", muted: "#888888" } },
    ],
    fontSets: [{ id: "elegante", name: { "es-MX": "Serif elegante" }, heading: { family: "Georgia", weights: [600], source: "bundled" }, body: { family: "Georgia", weights: [400], source: "bundled" } }],
    defaultPaletteId: "rosa",
    defaultFontSetId: "elegante",
  };
}

describe("ThemePicker", () => {
  beforeEach(() => {
    useEditorStore.setState({
      composed: {
        composedVersion: 1,
        template: { slug: "boda-clasica", version: "1.0.0" },
        locale: "es-MX",
        theme: { paletteId: "rosa", fontSetId: "elegante", tokens: { bg: "#fff", ink: "#222", accent: "#e0a0a0" }, fonts: { heading: { family: "Georgia", weights: [600], source: "bundled" }, body: { family: "Georgia", weights: [400], source: "bundled" } } },
        sections: [],
      } as never,
    });
  });

  it("sin catálogo (theme=null) muestra solo la paleta activa y explica la degradación", () => {
    render(<ThemePicker theme={null} />);
    expect(screen.getByText(/todavía no están disponibles/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("al pasar el ratón por una paleta llama a previewTheme; al salir, lo limpia", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "previewTheme");
    render(<ThemePicker theme={theme()} />);
    const boton = screen.getByTestId("paleta-olivo");
    await usuario.hover(boton);
    expect(espia).toHaveBeenCalledWith("olivo", null);
    await usuario.unhover(boton);
    expect(espia).toHaveBeenCalledWith(null, null);
  });

  it("al hacer clic confirma con setTheme", async () => {
    const usuario = userEvent.setup();
    const espia = vi.spyOn(useEditorStore.getState(), "setTheme");
    render(<ThemePicker theme={theme()} />);
    await usuario.click(screen.getByTestId("paleta-olivo"));
    expect(espia).toHaveBeenCalledWith({ paletteId: "olivo" });
  });

  it("marca la paleta activa con aria-checked", () => {
    render(<ThemePicker theme={theme()} />);
    expect(screen.getByTestId("paleta-rosa").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("paleta-olivo").getAttribute("aria-checked")).toBe("false");
  });
});
