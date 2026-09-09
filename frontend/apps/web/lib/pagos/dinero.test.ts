import { describe, expect, it } from "vitest";
import { formatearImporte } from "./dinero.ts";

describe("formatearImporte", () => {
  it("formatea centavos MXN con Intl.NumberFormat('es-MX') — resultado fijado", () => {
    expect(formatearImporte(89900, "MXN")).toBe("$899.00");
  });

  it("nunca redondea de más: 1 centavo sigue siendo dos decimales", () => {
    expect(formatearImporte(149901, "MXN")).toBe("$1,499.01");
  });

  it("cero centavos formatea a cero, no a una cadena vacía", () => {
    expect(formatearImporte(0, "MXN")).toBe("$0.00");
  });

  it("otra moneda usa el código cuando Intl no tiene un símbolo distinto de '$' para es-MX", () => {
    // Intl separa "USD" del importe con un espacio de no separación (U+00A0), no uno normal.
    expect(formatearImporte(50000, "USD")).toBe("USD 500.00");
  });
});
