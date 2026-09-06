import { describe, expect, it } from "vitest";
import type { ComposedDocument } from "@invitaciones/schema";
import {
  camposDeDatosBasicos,
  esFechaIso,
  esHoraIso,
  operacionesDeDatos,
  valoresIniciales,
} from "./datos-basicos.ts";

/**
 * Documentos compuestos de juguete con la MISMA forma que devuelve el backend (verificada contra
 * `GET /editor/invitations/3/document` del clúster de este worktree: `cover.title` con rol
 * `coverTitle`, `couple.groom`/`couple.bride` con roles `celebrantA`/`celebrantB` y tipo `person`,
 * y `eventPlace` DENTRO del grupo `event.cards`).
 */
function documento(secciones: unknown[]): ComposedDocument {
  return { composedVersion: 1, template: { slug: "x", version: "1.0.0" }, locale: "es-MX", theme: {}, sections: secciones } as unknown as ComposedDocument;
}

const BODA = documento([
  {
    key: "cover",
    blocks: [
      { id: "cover.title", role: "coverTitle", type: "text", label: "Nombres en portada", value: { kind: "text", value: "Ana & Luis" } },
      { id: "cover.image", role: "coverImage", type: "image", label: "Foto", value: null },
    ],
  },
  {
    key: "couple",
    blocks: [
      { id: "couple.groom", role: "celebrantA", type: "person", label: "Novio", value: { kind: "person", name: "Diego Márquez" } },
      { id: "couple.bride", role: "celebrantB", type: "person", label: "Novia", value: { kind: "person", name: "Ana Sofía" } },
    ],
  },
  {
    key: "event",
    blocks: [
      { id: "event.title", role: "sectionTitle", type: "text", label: "Título", value: { kind: "text", value: "El día" } },
      {
        id: "event.cards",
        role: "eventCards",
        type: "group",
        label: "Momentos del día",
        items: [
          {
            itemId: "01M1THB0G4ESDG604HSR4W6Z59",
            blocks: [
              { id: "title", role: "eventTitle", type: "text", label: "Nombre", value: { kind: "text", value: "Ceremonia" } },
              { id: "place", role: "eventPlace", type: "location", label: "Dónde", value: { kind: "location", name: "Parroquia de San Juan" } },
            ],
          },
        ],
      },
    ],
  },
]);

const XV = documento([
  {
    key: "cover",
    blocks: [{ id: "cover.title", role: "coverTitle", type: "text", label: "Nombre en portada", value: { kind: "text", value: "Mariana" } }],
  },
  {
    key: "celebrants",
    blocks: [{ id: "xv.honoree", role: "honoree", type: "person", label: "Quinceañera", value: { kind: "person", name: "Mariana" } }],
  },
]);

describe("camposDeDatosBasicos — se derivan por ROL, no por id de una plantilla concreta", () => {
  it("en una boda ofrece los dos celebrantes con la etiqueta que pone la PLANTILLA", () => {
    const campos = camposDeDatosBasicos(BODA);
    const quienes = campos.filter((c) => c.grupo === "quienes");
    expect(quienes.map((c) => c.etiqueta)).toEqual(["Novio", "Novia"]);
    expect(quienes.map((c) => c.destino)).toEqual([
      { tipo: "person", blockId: "couple.groom" },
      { tipo: "person", blockId: "couple.bride" },
    ]);
  });

  it("en unos XV ofrece a la homenajeada (`honoree`), sin tocar el archivo", () => {
    const quienes = camposDeDatosBasicos(XV).filter((c) => c.grupo === "quienes");
    expect(quienes).toHaveLength(1);
    expect(quienes[0].etiqueta).toBe("Quinceañera");
    expect(quienes[0].destino).toEqual({ tipo: "person", blockId: "xv.honoree" });
  });

  it("sin celebrantes ni homenajeada cae al título de portada, que toda plantilla tiene", () => {
    const soloPortada = documento([
      { key: "cover", blocks: [{ id: "cover.title", role: "coverTitle", type: "text", label: "Nombres en portada", value: null }] },
    ]);
    const quienes = camposDeDatosBasicos(soloPortada).filter((c) => c.grupo === "quienes");
    expect(quienes).toHaveLength(1);
    expect(quienes[0].destino).toEqual({ tipo: "text", blockId: "cover.title" });
  });

  it("encuentra el lugar DENTRO del primer ítem del grupo de momentos del día", () => {
    const donde = camposDeDatosBasicos(BODA).find((c) => c.grupo === "donde");
    expect(donde?.etiqueta).toBe("Dónde");
    expect(donde?.destino).toEqual({
      tipo: "locationEnItem",
      groupId: "event.cards",
      itemId: "01M1THB0G4ESDG604HSR4W6Z59",
      blockId: "place",
    });
    expect(donde?.valorInicial).toBe("Parroquia de San Juan");
  });

  it("una plantilla sin lugar no pinta el campo (en vez de un campo que no guarda nada)", () => {
    expect(camposDeDatosBasicos(XV).some((c) => c.grupo === "donde")).toBe(false);
  });

  it("los valores iniciales del formulario están VACÍOS: el contenido de ejemplo no se copia", () => {
    const campos = camposDeDatosBasicos(BODA);
    expect(Object.values(valoresIniciales(campos)).every((v) => v === "")).toBe(true);
  });
});

describe("operacionesDeDatos", () => {
  const campos = camposDeDatosBasicos(BODA);

  it("un campo vacío no genera operación", () => {
    expect(operacionesDeDatos(campos, valoresIniciales(campos))).toEqual([]);
  });

  it("escribir el MISMO valor que ya había tampoco (no se gasta una revisión ni se promueve el ejemplo)", () => {
    expect(operacionesDeDatos(campos, { "quienes-0": "Diego Márquez" })).toEqual([]);
  });

  it("genera setBlock `person` para los nombres y setItemBlock `location` para el lugar", () => {
    const operaciones = operacionesDeDatos(campos, {
      "quienes-0": "Luis Hernández",
      "quienes-1": "  Ana Torres  ",
      donde: "Hacienda Los Morales",
    });
    expect(operaciones).toEqual([
      { op: "setBlock", blockId: "couple.groom", value: { kind: "person", name: "Luis Hernández" } },
      { op: "setBlock", blockId: "couple.bride", value: { kind: "person", name: "Ana Torres" } },
      {
        op: "setItemBlock",
        groupId: "event.cards",
        itemId: "01M1THB0G4ESDG604HSR4W6Z59",
        blockId: "place",
        value: { kind: "location", name: "Hacienda Los Morales" },
      },
    ]);
  });

  it("recorta a la longitud máxima en vez de mandar un valor que el servidor rechazaría", () => {
    const largo = "A".repeat(400);
    const [operacion] = operacionesDeDatos(campos, { "quienes-0": largo });
    expect(operacion).toEqual({ op: "setBlock", blockId: "couple.groom", value: { kind: "person", name: "A".repeat(120) } });
  });

  it("un `coverTitle` (texto) se escribe como setBlock `text`", () => {
    const soloPortada = documento([
      { key: "cover", blocks: [{ id: "cover.title", role: "coverTitle", type: "text", label: "Nombres", value: null }] },
    ]);
    const suyos = camposDeDatosBasicos(soloPortada);
    expect(operacionesDeDatos(suyos, { "quienes-0": "Ana & Luis" })).toEqual([
      { op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "Ana & Luis" } },
    ]);
  });
});

describe("formatos que exige `PUT …/event`", () => {
  it("la fecha solo es válida como YYYY-MM-DD", () => {
    expect(esFechaIso("2027-04-18")).toBe(true);
    expect(esFechaIso("18/04/2027")).toBe(false);
    expect(esFechaIso("2027-13-01")).toBe(false);
    expect(esFechaIso("")).toBe(false);
  });

  it("la hora solo es válida como HH:mm en 24 h", () => {
    expect(esHoraIso("17:00")).toBe(true);
    expect(esHoraIso("24:00")).toBe(false);
    expect(esHoraIso("5:00 pm")).toBe(false);
  });
});
