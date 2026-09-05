// test/semantica.test.ts — el mapa de roles. Lo que se comprueba es que el tema oscuro es un MAPA
// COMPLETO (redefine los 46 roles, ni uno menos) y que las reglas de uso del color de 11 §1.5 están
// codificadas, no confiadas a la disciplina de quien pinte el componente.
import { describe, expect, it } from "vitest";
import { MATICES, PALETAS, paletaActiva } from "../src/paletas.ts";
import { PAREJAS, ROLES_COLOR, TEMAS, semantica, variableDe } from "../src/semantica.ts";

describe("roles semánticos", () => {
  it("los dos temas definen exactamente los mismos 46 roles, en las tres paletas", () => {
    expect(ROLES_COLOR).toHaveLength(46);
    expect(new Set(ROLES_COLOR).size).toBe(ROLES_COLOR.length);
    for (const p of Object.values(PALETAS)) {
      for (const tema of TEMAS) {
        const mapa = semantica(p, tema);
        expect(Object.keys(mapa).sort(), `${p.id}/${tema}`).toEqual([...ROLES_COLOR].sort());
        for (const rol of ROLES_COLOR) expect(mapa[rol], `${p.id}/${tema}/${rol}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("el oscuro no es el claro: solo cuatro roles repiten valor, y por una razón cada uno", () => {
    const claro = semantica(paletaActiva(), "light");
    const oscuro = semantica(paletaActiva(), "dark");
    const iguales = ROLES_COLOR.filter((rol) => claro[rol] === oscuro[rol]);
    // `border` es el mismo neutro 500 en los dos temas (pasa 3,0 en ambos, 11 §1.3);
    // `primary-bright` es el 500 decorativo, que nunca lleva texto encima; `on-accent` y
    // `on-warning` son la tinta 950 sobre un cálido claro, que es cálido claro en los dos temas.
    expect(iguales.sort()).toEqual(["border", "on-accent", "on-warning", "primary-bright"]);
    // Los otros 42 sí cambian: el tema oscuro es un mapa completo, no un parche.
    expect(ROLES_COLOR.length - iguales.length).toBe(42);
  });

  it("el 500 decorativo nunca es texto ni fondo de texto (11 §1.5 regla 2)", () => {
    const p = paletaActiva();
    for (const tema of TEMAS) {
      const mapa = semantica(p, tema);
      const quinientos = new Set(MATICES.map((m) => p.escalas[m].pasos[500]));
      for (const pareja of PAREJAS) {
        if (pareja.umbral === null) continue;
        // La única figura que puede ser un 500 es el anillo de foco (elemento gráfico, umbral 3,0),
        // y solo en el tema claro: en oscuro el foco sube al 300.
        const excepcion = pareja.figura === "focus" && tema === "light";
        expect(quinientos.has(mapa[pareja.figura]), `${tema}: ${pareja.figura} es un 500 con umbral`).toBe(excepcion);
        expect(quinientos.has(mapa[pareja.fondo]), `${tema}: ${pareja.fondo} es un 500 y lleva texto`).toBe(false);
      }
      expect(quinientos.has(mapa["primary-bright"]), "primary-bright tiene que ser el 500").toBe(true);
    }
  });

  it("hay 42 parejas, 40 con umbral y 2 informativas, y ninguna mide focus contra primary", () => {
    expect(PAREJAS).toHaveLength(42);
    expect(PAREJAS.filter((p) => p.umbral !== null)).toHaveLength(40);
    expect(PAREJAS.filter((p) => p.umbral === null).map((p) => `${p.figura}/${p.fondo}`).sort()).toEqual([
      "divider/surface",
      "primary-bright/surface",
    ]);
    expect(PAREJAS.some((p) => p.figura === "focus" && p.fondo.startsWith("primary"))).toBe(false);
    // El anillo se mide contra las TRES superficies, que es lo que de verdad toca.
    expect(PAREJAS.filter((p) => p.figura === "focus").map((p) => p.fondo).sort()).toEqual([
      "surface",
      "surface-alt",
      "surface-raised",
    ]);
  });

  it("toda pareja usa roles declarados y todo rol con `on-` tiene su fondo", () => {
    for (const pareja of PAREJAS) {
      expect(ROLES_COLOR).toContain(pareja.figura);
      expect(ROLES_COLOR).toContain(pareja.fondo);
    }
    for (const rol of ROLES_COLOR) {
      if (!rol.startsWith("on-")) continue;
      expect(ROLES_COLOR, `${rol} no tiene fondo`).toContain(rol.slice(3));
      expect(PAREJAS.some((p) => p.figura === rol && p.fondo === rol.slice(3)), `${rol} sin pareja medida`).toBe(true);
    }
  });

  it("el nombre de variable de un rol es su token `--ui-`", () => {
    expect(variableDe("on-primary")).toBe("--ui-on-primary");
  });
});
