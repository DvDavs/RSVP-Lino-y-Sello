import { describe, expect, it } from "vitest";
import { isSafeHttpUrl, hostOf } from "../../src/blocks/url.ts";

describe("isSafeHttpUrl", () => {
  it("acepta http(s) absoluto", () => {
    expect(isSafeHttpUrl("https://ejemplo.mx/x")).toBe(true);
    expect(isSafeHttpUrl("http://ejemplo.mx")).toBe(true);
  });

  it("rechaza esquemas peligrosos u opacos", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeHttpUrl("mailto:a@b.com")).toBe(false);
    expect(isSafeHttpUrl("/ruta/relativa")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });
});

describe("hostOf", () => {
  it("devuelve el host de una URL válida", () => {
    expect(hostOf("https://maps.example.com/lugar?x=1")).toBe("maps.example.com");
  });

  it("con una URL inválida, devuelve el valor tal cual (no lanza)", () => {
    expect(hostOf("no-es-una-url")).toBe("no-es-una-url");
  });
});
