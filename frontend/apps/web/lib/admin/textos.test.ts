// lib/admin/textos.test.ts — la compuerta de la regla dura «nunca emojis» y «ningún texto vacío»
// (`identidad-visual/SKILL.md`). Recorre `textosAdmin` entero: si alguien añade un texto vacío o
// con un emoji en cualquier nivel de profundidad, esta prueba cae.
import { describe, expect, it } from "vitest";
import { textosAdmin } from "./textos.ts";

// Rango de pictogramas Unicode (emoticones, símbolos y pictogramas variados, mahjong/naipes,
// transporte, símbolos técnicos —relojes «⏰⌚⏳»—, formas geométricas —«▶»—, símbolos y
// pictogramas suplementarios, extensión A, dingbats, banderas por indicador regional, flechas) más
// el selector de variación (`\u{FE0F}`, el que convierte «▶» en «▶️»), sacado de la clase de
// caracteres y puesto como alternativa (`eslint(no-misleading-character-class)`: un selector de
// variación dentro de `[...]` se trata como carácter combinado y lo rechaza). No incluye
// puntuación tipográfica normal (guiones, comillas, signos de interrogación en español) para no
// generar falsos positivos con los propios textos de interfaz.
const RANGO_EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}]|\u{25B6}|\u{FE0F}/u;

function recorrer(valor: unknown, ruta: string, visitar: (ruta: string, texto: string) => void): void {
  if (typeof valor === "string") {
    visitar(ruta, valor);
    return;
  }
  if (typeof valor === "function") return; // ningún texto de hoy es una función; no debe romper si aparece una
  if (Array.isArray(valor)) {
    valor.forEach((hijo, indice) => recorrer(hijo, `${ruta}[${indice}]`, visitar));
    return;
  }
  if (valor !== null && typeof valor === "object") {
    for (const [clave, hijo] of Object.entries(valor as Record<string, unknown>)) {
      recorrer(hijo, ruta ? `${ruta}.${clave}` : clave, visitar);
    }
  }
}

describe("textosAdmin — compuerta de identidad visual (nunca emojis, nunca texto vacío)", () => {
  it("ningún texto del objeto entero está vacío", () => {
    const vacios: string[] = [];
    recorrer(textosAdmin, "", (ruta, texto) => {
      if (texto.trim().length === 0) vacios.push(ruta);
    });
    expect(vacios).toEqual([]);
  });

  it("ningún texto del objeto entero trae un emoji", () => {
    const conEmoji: string[] = [];
    recorrer(textosAdmin, "", (ruta, texto) => {
      if (RANGO_EMOJI.test(texto)) conEmoji.push(ruta);
    });
    expect(conEmoji).toEqual([]);
  });

  it("el rango también caza los emojis que quedaban fuera antes de esta revisión (5-E5-R1 MEDIA-5)", () => {
    for (const emoji of ["⏰", "⌚", "⏳", "▶", "🀄"]) {
      expect(RANGO_EMOJI.test(emoji)).toBe(true);
    }
  });

  it("el recorrido visitó una cantidad real de textos (el objeto no está vacío ni el recorrido roto)", () => {
    let contador = 0;
    recorrer(textosAdmin, "", () => {
      contador += 1;
    });
    expect(contador).toBeGreaterThan(40);
  });

  it("las cinco pestañas del wireframe (12-producto-completo.md §B3.6) están presentes", () => {
    expect(Object.keys(textosAdmin.pestanas)).toEqual(["resumen", "clientas", "invitaciones", "pagos", "plantillas"]);
    for (const etiqueta of Object.values(textosAdmin.pestanas)) {
      expect(etiqueta.length).toBeGreaterThan(0);
    }
  });

  it("cada tabla tiene su propio estado vacío, distinto del de las demás (regla dura del wireframe: por tabla, no por página)", () => {
    const vaciosDeTabla = [
      textosAdmin.clientas.vacio.sinFiltro,
      textosAdmin.invitaciones.vacio.sinFiltro,
      textosAdmin.pagos.vacio.sinFiltro,
      textosAdmin.planes.vacio,
      textosAdmin.plantillas.vacio,
    ];
    expect(new Set(vaciosDeTabla).size).toBe(vaciosDeTabla.length);
  });

  it("los mensajes de error de bloque tienen título, cuerpo y una acción — nunca 'algo salió mal' a secas", () => {
    const bloquesConError = [
      textosAdmin.resumen.error,
      textosAdmin.clientas.error,
      textosAdmin.invitaciones.error,
      textosAdmin.invitaciones.alternarError,
      textosAdmin.pagos.error,
      textosAdmin.planes.error,
      textosAdmin.plantillas.error,
    ];
    for (const bloque of bloquesConError) {
      expect(bloque.titulo.length).toBeGreaterThan(0);
      expect(bloque.cuerpo.length).toBeGreaterThan(0);
      expect(bloque.accion.length).toBeGreaterThan(0);
      expect(bloque.titulo.toLowerCase()).not.toBe("algo salió mal");
      expect(bloque.cuerpo.toLowerCase()).not.toContain("algo salió mal");
    }
  });
});
