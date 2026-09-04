import { describe, expect, it } from "vitest";
import { es_MX } from "./i18n.ts";

describe("es_MX (cadenas del chrome, sin biblioteca)", () => {
  it("errores.codigo interpola el code recibido", () => {
    expect(es_MX.errores.codigo("TPL_REVISION_CONFLICT")).toContain("TPL_REVISION_CONFLICT");
  });

  it("editor.catalogo.resultados pluraliza correctamente", () => {
    expect(es_MX.editor.catalogo.resultados(1)).toBe("1 resultado");
    expect(es_MX.editor.catalogo.resultados(3)).toBe("3 resultados");
  });
});
