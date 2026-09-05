import { describe, expect, it } from "vitest";
import { PAQUETE } from "../src/index.ts";

describe("esqueleto", () => {
  it("el paquete existe y exporta su nombre", () => {
    expect(PAQUETE).toBe("@invitaciones/tokens");
  });
});
