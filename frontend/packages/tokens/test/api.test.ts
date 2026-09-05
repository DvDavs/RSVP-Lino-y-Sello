// test/api.test.ts — la API pública del paquete: lo que van a importar `packages/ui`, `packages/
// icons`, la galería y cualquier módulo futuro.
import { describe, expect, it } from "vitest";
import { PAQUETE, ROLES_COLOR, semanticaResuelta, varDe, type Token, type SemanticColorRole } from "../src/index.ts";

describe("API pública", () => {
  it("el paquete se identifica y expone su nombre", () => {
    expect(PAQUETE).toBe("@invitaciones/tokens");
  });

  it("`varDe` es la única forma de meter color en un componente", () => {
    const token: Token = "--ui-primary";
    expect(varDe(token)).toBe("var(--ui-primary)");
  });

  it("`semanticaResuelta` da los dos temas de una paleta (lo que consume la galería)", () => {
    const resuelta = semanticaResuelta("a");
    expect(Object.keys(resuelta)).toEqual(["light", "dark"]);
    expect(resuelta.light.primary).not.toBe(resuelta.dark.primary);
    for (const tema of ["light", "dark"] as const) {
      expect(Object.keys(resuelta[tema]).sort()).toEqual([...ROLES_COLOR].sort());
    }
  });

  it("los tipos de rol son exhaustivos en tiempo de compilación", () => {
    // Si alguien añade un rol a ROLES_COLOR sin tocar el tipo, esto deja de compilar.
    const todos: Record<SemanticColorRole, true> = Object.fromEntries(
      ROLES_COLOR.map((rol) => [rol, true]),
    ) as Record<SemanticColorRole, true>;
    expect(Object.keys(todos)).toHaveLength(ROLES_COLOR.length);
  });
});
