// U-06 (04 §20.1): "ThemeProvider con la paleta olive → las seis custom properties --inv-color-*
// con los valores del theme.json."
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "../../src/theme/ThemeProvider.tsx";
import { oliveTheme } from "../fixtures.ts";
import type { ResolvedTheme } from "../../src/schema-types.ts";

describe("U-06 — ThemeProvider: --inv-color-* desde ResolvedTheme", () => {
  it("aplica las seis custom properties con los valores exactos de la paleta olive", () => {
    const { container } = render(
      <ThemeProvider theme={oliveTheme()}>
        <p>contenido</p>
      </ThemeProvider>,
    );
    const root = container.querySelector('[data-theme-palette="olive"]') as HTMLElement | null;
    expect(root).not.toBeNull();

    // Valores tal cual `boda-clasica@1.0.0/theme.json` `palettes[1]` (verificado [V]).
    expect(root!.style.getPropertyValue("--inv-color-bg")).toBe("#F7F5EE");
    expect(root!.style.getPropertyValue("--inv-color-surface")).toBe("#FFFFFF");
    expect(root!.style.getPropertyValue("--inv-color-ink")).toBe("#2F3A2B");
    expect(root!.style.getPropertyValue("--inv-color-accent")).toBe("#6B7B4A");
    expect(root!.style.getPropertyValue("--inv-color-accent-ink")).toBe("#FFFFFF");
    expect(root!.style.getPropertyValue("--inv-color-muted")).toBe("#8A9178");
  });

  it("también emite un <style nonce> con la misma paleta (SSR-seguro, sin FOUC)", () => {
    const { container } = render(
      <ThemeProvider theme={oliveTheme()} nonce="test-nonce-123">
        <p>contenido</p>
      </ThemeProvider>,
    );
    const styleTag = container.querySelector("style");
    expect(styleTag).not.toBeNull();
    expect(styleTag!.getAttribute("nonce")).toBe("test-nonce-123");
    expect(styleTag!.textContent).toContain("--inv-color-ink:#2F3A2B");
  });

  it("resuelve --inv-font-heading/--inv-font-body con la familia + pila de reserva", () => {
    const { container } = render(
      <ThemeProvider theme={oliveTheme()}>
        <p>contenido</p>
      </ThemeProvider>,
    );
    const root = container.querySelector('[data-theme-palette="olive"]') as HTMLElement;
    expect(root.style.getPropertyValue("--inv-font-heading")).toContain("Cormorant Garamond");
    expect(root.style.getPropertyValue("--inv-font-body")).toContain("Inter");
  });

  it("un color fuera de forma (#rrggbb) se omite en vez de inyectarse tal cual (defensa en profundidad)", () => {
    // `HexColor` (esquema) ya rechazaría "not-a-color" en `.parse()` — igual que en U-04, este
    // fixture no pasa por él a propósito: simula un valor mal formado llegando de todas formas.
    const theme = {
      ...oliveTheme(),
      tokens: { bg: "#F7F5EE", surface: "#FFFFFF", ink: "not-a-color", accent: "#6B7B4A", accentInk: "#FFFFFF", muted: "#8A9178" },
    } as unknown as ResolvedTheme;
    const { container } = render(
      <ThemeProvider theme={theme}>
        <p>contenido</p>
      </ThemeProvider>,
    );
    const root = container.querySelector('[data-theme-palette="olive"]') as HTMLElement;
    expect(root.style.getPropertyValue("--inv-color-ink")).toBe("");
    const styleTag = container.querySelector("style")!;
    expect(styleTag.textContent).not.toContain("not-a-color");
  });
});
