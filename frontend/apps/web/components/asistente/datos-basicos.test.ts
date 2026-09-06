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
        // `provenance: "user"` = el grupo YA existe en `document.content`, así que su `itemId` es
        // real y `setItemBlock` lo encuentra. Es el estado de una invitación ya editada.
        provenance: "user",
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

/**
 * 3C-UX G-03. El documento de una invitación RECIÉN CREADA: `:choose-template` deja `content`
 * vacío, así que el grupo de momentos del día llega con `provenance: "default"` y sus `itemId` son
 * los del paquete de plantilla, que NO existen en el documento. Es la forma exacta que devolvió
 * `GET /editor/invitations/{id}/document` en el clúster de este worktree tras `:choose-template`.
 */
const BODA_RECIEN_CREADA = documento([
  {
    key: "couple",
    blocks: [
      { id: "couple.groom", role: "celebrantA", type: "person", label: "Novio", provenance: "default", value: { kind: "person", name: "Diego" } },
    ],
  },
  {
    key: "event",
    blocks: [
      {
        id: "event.cards",
        role: "eventCards",
        type: "group",
        label: "Momentos del día",
        provenance: "default",
        items: [
          {
            itemId: "01J8DEM0000000000000000EV1",
            blocks: [
              { id: "title", role: "eventTitle", type: "text", label: "Nombre", provenance: "default", value: { kind: "text", value: "Ceremonia religiosa" } },
              {
                id: "when",
                role: "eventWhen",
                type: "dateTimeRange",
                label: "Cuándo",
                provenance: "default",
                value: { kind: "dateTimeRange", start: "2026-12-12T16:30", end: "2026-12-12T17:30", formatted: "12 de diciembre, 4:30 p.m. a 5:30 p.m." },
              },
              {
                id: "place",
                role: "eventPlace",
                type: "location",
                label: "Dónde",
                provenance: "default",
                value: { kind: "location", name: "Templo de Santo Domingo", mapHref: "https://maps.app.goo.gl/Q84SBQZJ36owN2uz6" },
              },
              { id: "note", role: "eventNote", type: "text", label: "Nota", provenance: "empty", value: null },
            ],
          },
          {
            itemId: "01J8DEM0000000000000000EV2",
            blocks: [
              { id: "title", role: "eventTitle", type: "text", label: "Nombre", provenance: "default", value: { kind: "text", value: "Recepción" } },
              { id: "when", role: "eventWhen", type: "dateTimeRange", label: "Cuándo", provenance: "default", value: { kind: "dateTimeRange", start: "2026-12-12T19:00", formatted: "12 de diciembre, 7:00 p.m." } },
              { id: "place", role: "eventPlace", type: "location", label: "Dónde", provenance: "default", value: { kind: "location", name: "Zorba el Griego" } },
            ],
          },
        ],
      },
    ],
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

/**
 * 3C-UX G-03 — la regresión que rompía el guardado de TODA invitación nueva.
 *
 * Con `content` vacío, `itemsOf(doc, groupId)` es `[]` en el reductor (TS y su espejo Kotlin:
 * «los `defaults` NO se copian»), así que un `setItemBlock` contra el `itemId` que se ve en el
 * compuesto responde `422 TPL_ITEM_UNKNOWN` y tumba el lote ENTERO —los nombres incluidos—.
 * Estas pruebas fallan si vuelve.
 */
describe("3C-UX G-03 · el lugar en un grupo que todavía vive en los defaults", () => {
  const campos = camposDeDatosBasicos(BODA_RECIEN_CREADA);
  const donde = campos.find((c) => c.grupo === "donde");
  let n = 0;
  const tempIdDePrueba = () => `tmp:prueba${(++n).toString().padStart(2, "0")}`;

  it("el campo se ofrece, con la etiqueta y el valor de ejemplo de la plantilla", () => {
    expect(donde?.etiqueta).toBe("Dónde");
    expect(donde?.valorInicial).toBe("Templo de Santo Domingo");
  });

  it("el destino NO es `setItemBlock`: ese `itemId` solo existe en los defaults", () => {
    expect(donde?.destino.tipo).toBe("lugarEnGrupoPorDefecto");
  });

  it("materializa el grupo con `addItem` y mete el lugar escrito en el primer momento", () => {
    n = 0;
    const operaciones = operacionesDeDatos(campos, { donde: "Jardín Las Palmas" }, tempIdDePrueba);

    // Ni una sola operación cita un `itemId` que el servidor no conozca.
    expect(operaciones.some((op) => op.op === "setItemBlock" || op.op === "clearItemBlock")).toBe(false);
    expect(operaciones).toEqual([
      {
        op: "addItem",
        groupId: "event.cards",
        tempId: "tmp:prueba01",
        values: {
          title: { kind: "text", value: "Ceremonia religiosa" },
          when: { kind: "dateTimeRange", start: "2026-12-12T16:30", end: "2026-12-12T17:30" },
          // El nombre es el que escribió la clienta y el mapa del EJEMPLO no se hereda: mandaría a
          // las invitadas a la dirección equivocada.
          place: { kind: "location", name: "Jardín Las Palmas" },
        },
      },
      {
        op: "addItem",
        groupId: "event.cards",
        tempId: "tmp:prueba02",
        values: {
          title: { kind: "text", value: "Recepción" },
          when: { kind: "dateTimeRange", start: "2026-12-12T19:00" },
          place: { kind: "location", name: "Zorba el Griego" },
        },
      },
    ]);
  });

  it("`formatted` (y todo lo demás que es presentación) NO viaja: el objeto del esquema es estricto", () => {
    n = 0;
    const [primera] = operacionesDeDatos(campos, { donde: "Jardín Las Palmas" }, tempIdDePrueba);
    const valores = (primera as { values: Record<string, Record<string, unknown>> }).values;
    expect(Object.values(valores).some((v) => "formatted" in v || "label" in v || "url" in v)).toBe(false);
  });

  it("los `tempId` cumplen el patrón de `packages/schema` y no se repiten", () => {
    n = 0;
    const operaciones = operacionesDeDatos(campos, { donde: "Jardín Las Palmas" }, tempIdDePrueba);
    const ids = operaciones.map((op) => ("tempId" in op ? op.tempId : ""));
    expect(ids.every((id) => /^tmp:[A-Za-z0-9_-]{8,64}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el `tempId` real (sin inyección) también cumple el patrón", () => {
    const operaciones = operacionesDeDatos(campos, { donde: "Jardín Las Palmas" });
    expect(operaciones.every((op) => "tempId" in op && /^tmp:[A-Za-z0-9_-]{8,64}$/.test(op.tempId))).toBe(true);
  });

  it("sin escribir nada, un grupo por defecto no se materializa: el paso sigue siendo opcional", () => {
    expect(operacionesDeDatos(campos, valoresIniciales(campos))).toEqual([]);
  });

  it("si un ítem de ejemplo trae una foto, el campo NO se ofrece en vez de perderla", () => {
    // El compuesto resuelve `image` a una `url` y `addItem` exige el `assetId` (ADR-021): no hay
    // vuelta atrás. Antes que materializar un grupo perdiendo la foto, este paso calla.
    const conFoto = documento([
      {
        key: "event",
        blocks: [
          {
            id: "event.cards",
            role: "eventCards",
            type: "group",
            label: "Momentos",
            provenance: "default",
            items: [
              {
                itemId: "01J8DEM0000000000000000EV1",
                blocks: [
                  { id: "place", role: "eventPlace", type: "location", label: "Dónde", provenance: "default", value: { kind: "location", name: "Templo" } },
                  { id: "foto", role: "eventPhoto", type: "image", label: "Foto", provenance: "default", value: { kind: "image", url: "https://x.test/a.webp", alt: "", focal: { x: 0.5, y: 0.5 } } },
                ],
              },
            ],
          },
        ],
      },
    ]);
    expect(camposDeDatosBasicos(conFoto).some((c) => c.grupo === "donde")).toBe(false);
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
