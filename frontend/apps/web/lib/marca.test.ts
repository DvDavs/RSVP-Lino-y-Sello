// lib/marca.test.ts — el nombre y el dominio son literales (D-02): esta prueba fija sus valores
// exactos para que un cambio accidental (o un «arreglo» de ortografía) se vea en rojo antes de
// llegar a producción.
import { describe, expect, it } from "vitest";
import { DOMINIO_MARCA, NOMBRE_MARCA, derechosReservados } from "./marca.ts";

describe("identidad literal", () => {
  it("el nombre es exactamente el de D-02, con el amperson y sin abreviar", () => {
    expect(NOMBRE_MARCA).toBe("Lino & Sello");
  });

  it("el dominio es exactamente el de D-02, sin esquema ni barra final", () => {
    expect(DOMINIO_MARCA).toBe("linoysello.com");
    expect(DOMINIO_MARCA.startsWith("http")).toBe(false);
    expect(DOMINIO_MARCA.endsWith("/")).toBe(false);
  });

  it("ningún correo ni número vive en este fichero: es identidad, no configuración", () => {
    const fuente = `${NOMBRE_MARCA}${DOMINIO_MARCA}`;
    expect(fuente).not.toMatch(/@/);
    expect(fuente).not.toMatch(/\d{5,}/);
  });
});

describe("derechosReservados", () => {
  it("compone «© <año> Lino & Sello», con el año que se le pase", () => {
    expect(derechosReservados(2026)).toBe("© 2026 Lino & Sello");
    expect(derechosReservados(2031)).toBe("© 2031 Lino & Sello");
  });
});
