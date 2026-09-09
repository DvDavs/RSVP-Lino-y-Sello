// lib/panel/nav.test.ts — lo que tiene que seguir siendo verdad cuando cuatro sesiones escriben a
// la vez en `nav.<area>.ts`. Cada prueba de aquí cae por un error REAL de integración, no por gusto.
import * as iconos from "@invitaciones/icons";
import { describe, expect, it } from "vitest";
import { NAVEGACION_DEL_PANEL, navegacionVisible } from "./nav.ts";
import { es_MX } from "../i18n.ts";

const INVITACION_PUBLICADA = { invitationId: "42", publicada: true } as const;
const INVITACION_BORRADOR = { invitationId: "42", publicada: false } as const;

describe("registro de navegación del panel", () => {
  it("el orden es determinista: por `orden` y, en empate, por `id`", () => {
    const pares = NAVEGACION_DEL_PANEL.map((e) => [e.orden, e.id] as const);
    const esperado = [...pares].sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1].localeCompare(b[1], "es-MX")));
    expect(pares).toEqual(esperado);
  });

  it("dos llamadas devuelven exactamente la misma lista (nada depende del orden de importación)", () => {
    expect(NAVEGACION_DEL_PANEL.map((e) => e.id)).toEqual(["invitados", "compartir", "plan"]);
  });

  it("los ids son únicos en TODO el registro", () => {
    // Si dos áreas eligen el mismo `id`, la clave de React se repite y el resaltado de la ruta
    // activa marca dos entradas. Esta prueba es la que caza ese choque al integrar.
    const ids = NAVEGACION_DEL_PANEL.map((e) => e.id);
    expect(new Set(ids).size, `ids repetidos en ${ids.join(", ")}`).toBe(ids.length);
  });

  it("cada `href` produce una ruta del sitio bien formada y con el id dentro", () => {
    for (const entrada of NAVEGACION_DEL_PANEL) {
      const ruta = entrada.href("42");
      expect(ruta, entrada.id).toMatch(/^\/[A-Za-z0-9\-/[\]]*$/);
      expect(ruta, entrada.id).not.toContain("//");
      expect(ruta, entrada.id).toContain("/42");
      expect(ruta.endsWith("/"), entrada.id).toBe(false);
    }
  });

  it("un id con caracteres raros se escapa en vez de salirse de la ruta", () => {
    for (const entrada of NAVEGACION_DEL_PANEL) {
      expect(entrada.href("a b/c?d"), entrada.id).not.toMatch(/[ ?]/);
    }
  });

  it("cada etiqueta es una clave real de `es_MX.panel.nav`", () => {
    for (const entrada of NAVEGACION_DEL_PANEL) {
      expect(es_MX.panel.nav[entrada.etiqueta], entrada.id).toBeTypeOf("string");
    }
  });

  it("cada icono existe de verdad en `@invitaciones/icons`", () => {
    // El tipo `NombreDeIcono` es una unión escrita a mano: sin esta prueba, un nombre bien escrito
    // en la unión pero inexistente en el paquete pintaría un hueco en la barra.
    //
    // NO se comprueba `toBeTypeOf("function")`: los 82 iconos se generan con `forwardRef`
    // (`packages/icons/src/generated/*.tsx`), y en React 19 `forwardRef` devuelve un OBJETO
    // (`{$$typeof: Symbol(react.forward_ref), render}`), no una función. Esa afirmación fallaba
    // sobre iconos que existen y se pintan perfectamente: medía el envoltorio, no la existencia.
    // Lo que de verdad importa aquí es que el nombre resuelva a algo que React sepa pintar.
    for (const entrada of NAVEGACION_DEL_PANEL) {
      const icono = (iconos as Record<string, unknown>)[entrada.icono];
      expect(icono, `${entrada.icono} no existe en @invitaciones/icons`).toBeDefined();
      const pintable =
        typeof icono === "function" ||
        (typeof icono === "object" && icono !== null && "$$typeof" in icono);
      expect(pintable, `${entrada.icono} no es un componente que React pueda pintar`).toBe(true);
    }
  });
});

describe("visibilidad por estado de la invitación", () => {
  it("«Compartir» no se pinta mientras la invitación no está publicada", () => {
    const ids = navegacionVisible(INVITACION_BORRADOR).map((e) => e.id);
    expect(ids).not.toContain("compartir");
    expect(ids).toContain("invitados");
  });

  it("publicada, se pintan todas y en el mismo orden que el registro", () => {
    const visibles = navegacionVisible(INVITACION_PUBLICADA).map((e) => e.id);
    expect(visibles).toEqual(NAVEGACION_DEL_PANEL.map((e) => e.id));
  });
});
