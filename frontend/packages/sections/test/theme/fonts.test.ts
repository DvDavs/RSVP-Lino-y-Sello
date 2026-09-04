import { describe, expect, it } from "vitest";
import { GOOGLE_FONT_ALLOWLIST, FONT_SUBSETS, isAllowedGoogleFont, fontFamilyCss } from "../../src/theme/fonts.ts";

describe("fonts.ts", () => {
  it("las familias de boda-clasica@1.0.0/xv-jardin@1.0.0 están en la allowlist (verificado [V])", () => {
    for (const family of ["Cormorant Garamond", "Inter", "Playfair Display", "Source Sans 3"]) {
      expect(isAllowedGoogleFont(family)).toBe(true);
    }
  });

  it("una familia arbitraria fuera de la lista no está permitida", () => {
    expect(isAllowedGoogleFont("Comic Sans MS")).toBe(false);
  });

  it("la allowlist no tiene duplicados", () => {
    expect(new Set(GOOGLE_FONT_ALLOWLIST).size).toBe(GOOGLE_FONT_ALLOWLIST.length);
  });

  it("subconjunto es-MX: latin + latin-ext (04 §5.5)", () => {
    expect(FONT_SUBSETS).toEqual(["latin", "latin-ext"]);
  });

  it("fontFamilyCss entrecomilla familias con espacio y añade la pila de reserva", () => {
    const css = fontFamilyCss("Cormorant Garamond", "heading");
    expect(css.startsWith('"Cormorant Garamond",')).toBe(true);
    expect(css).toContain("serif");
  });

  it("fontFamilyCss no entrecomilla una familia de una sola palabra", () => {
    const css = fontFamilyCss("Inter", "body");
    expect(css.startsWith("Inter,")).toBe(true);
    expect(css).toContain("sans-serif");
  });

  it("heading usa pila de reserva serif; body usa sans-serif", () => {
    expect(fontFamilyCss("Foo", "heading")).toContain("serif");
    expect(fontFamilyCss("Foo", "body")).toContain("sans-serif");
  });
});
