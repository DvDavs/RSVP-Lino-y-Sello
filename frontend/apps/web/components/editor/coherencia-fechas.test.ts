// components/editor/coherencia-fechas.test.ts — U-4 («dos fechas distintas en la misma invitación,
// sin aviso») y su reapertura G-04 en el recorrido de UX del cierre de la fase 3-C: se publicó con
// la portada en 20-mar-2027 y el itinerario en 14-nov-2026, y la revisión dijo «Todo listo para
// publicar», porque el guardián descartaba los momentos con `provenance: "default"`.
import { describe, expect, it } from "vitest";
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";
import { correccionesParaUsarLaFechaDelEvento, fechasDiscrepantes, sumarDias } from "./coherencia-fechas.ts";

/** Manifiesto mínimo con la misma FORMA que `boda-clasica@1.0.0` en lo que aquí importa. */
function manifiesto(): TemplateManifest {
  return {
    sections: [
      {
        key: "cover",
        blocks: [{ id: "cover.date", type: "date", source: "business", businessField: "invitation.date" }],
      },
      {
        key: "rsvp",
        // Sin `businessField`: la fecha límite para confirmar es OTRA cosa y no debe compararse.
        blocks: [{ id: "rsvp.deadline", type: "date", source: "user" }],
      },
      {
        key: "event",
        blocks: [{ id: "event.cards", type: "group", itemBlocks: [{ id: "when", type: "dateTimeRange" }] }],
      },
    ],
  } as unknown as TemplateManifest;
}

function compuesto(
  fechaPortada: string,
  momentos: Array<{ start: string; end?: string; visible?: boolean; provenance?: "user" | "default" }>,
): ComposedDocument {
  return {
    sections: [
      {
        key: "cover",
        visible: true,
        title: "Portada",
        blocks: [{ id: "cover.date", value: { kind: "date", value: fechaPortada, formatted: fechaPortada } }],
      },
      {
        key: "rsvp",
        visible: true,
        title: "Confirmación",
        // Una fecha límite muy distinta: si la comparación fuera «cualquier date», esto daría un
        // aviso falso en TODAS las invitaciones.
        blocks: [{ id: "rsvp.deadline", value: { kind: "date", value: "2027-03-01", formatted: "1 de marzo" } }],
      },
      {
        key: "event",
        visible: momentos[0]?.visible ?? true,
        title: "Cuándo y dónde",
        blocks: [
          {
            id: "event.cards",
            type: "group",
            items: momentos.map((m, i) => ({
              itemId: `item-${i}`,
              blocks: [
                {
                  id: "when",
                  provenance: m.provenance ?? "user",
                  value: { kind: "dateTimeRange", start: m.start, ...(m.end ? { end: m.end } : {}), formatted: m.start },
                },
              ],
            })),
          },
        ],
      },
    ],
  } as unknown as ComposedDocument;
}

describe("fechasDiscrepantes · el error más caro que puede cometer una novia", () => {
  it("detecta el caso REAL de la revisión: portada el 18 de abril, ceremonia el 22 de mayo", () => {
    const r = fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-05-22T17:00" }]));
    expect(r).not.toBeNull();
    expect(r?.diaEvento).toBe("2027-04-18");
    expect(r?.momentos[0]?.dia).toBe("2027-05-22");
    expect(r?.sectionKey).toBe("event");
  });

  it("G-04 · el caso EXACTO del cierre: portada 20-mar-2027, itinerario de EJEMPLO 14-nov-2026", () => {
    // Es el que se publicó con «Todo listo para publicar» (`bitacora/3c-ux.md §4`, captura `m43`):
    // el itinerario seguía siendo el del paquete, y la invitada leía 14-nov-2026.
    const r = fechasDiscrepantes(
      manifiesto(),
      compuesto("2027-03-20", [
        { start: "2026-11-14T16:30", end: "2026-11-14T17:30", provenance: "default" },
        { start: "2026-11-14T19:00", provenance: "default" },
      ]),
    );
    expect(r).not.toBeNull();
    expect(r?.diaEvento).toBe("2027-03-20");
    expect(r?.momentos).toHaveLength(2);
    expect(r?.soloEjemplo).toBe(true);
    // No es corregible de un toque: los ítems solo existen en los defaults (`TPL_ITEM_UNKNOWN`).
    expect(r?.sePuedeAplicar).toBe(false);
    expect(correccionesParaUsarLaFechaDelEvento(r!)).toEqual([]);
  });

  it("no avisa cuando las dos dicen lo mismo, aunque la hora cambie", () => {
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-04-18T19:30" }]))).toBeNull();
  });

  it("una boda de dos días no genera aviso: basta con que UN momento caiga el día del evento", () => {
    const r = fechasDiscrepantes(
      manifiesto(),
      compuesto("2027-04-18", [{ start: "2027-04-17T20:00" }, { start: "2027-04-18T17:00" }, { start: "2027-04-19T11:00" }]),
    );
    expect(r).toBeNull();
  });

  it("la fecha límite para confirmar NO cuenta como fecha del evento (sería un aviso falso)", () => {
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-04-18T17:00" }]))).toBeNull();
  });

  it("una sección oculta no contradice a la portada: ningún invitado la ve", () => {
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-05-22T17:00", visible: false }]))).toBeNull();
  });

  it("sin manifiesto no inventa avisos", () => {
    expect(fechasDiscrepantes(null, compuesto("2027-04-18", [{ start: "2027-05-22T17:00" }]))).toBeNull();
    expect(fechasDiscrepantes(manifiesto(), null)).toBeNull();
  });
});

describe("correccionesParaUsarLaFechaDelEvento · «Usar la fecha del evento en el itinerario»", () => {
  it("desplaza TODOS los momentos el mismo número de días y conserva las horas", () => {
    const r = fechasDiscrepantes(
      manifiesto(),
      compuesto("2027-04-18", [
        { start: "2027-05-22T16:30", end: "2027-05-22T17:30" },
        { start: "2027-05-22T19:30", end: "2027-05-23T02:00" },
      ]),
    );
    expect(r?.sePuedeAplicar).toBe(true);
    expect(correccionesParaUsarLaFechaDelEvento(r!)).toEqual([
      { groupId: "event.cards", itemId: "item-0", blockId: "when", value: { kind: "dateTimeRange", start: "2027-04-18T16:30", end: "2027-04-18T17:30" } },
      { groupId: "event.cards", itemId: "item-1", blockId: "when", value: { kind: "dateTimeRange", start: "2027-04-18T19:30", end: "2027-04-19T02:00" } },
    ]);
  });

  it("sumarDias cruza meses y años sin tocar la hora", () => {
    expect(sumarDias("2026-12-31T23:15", 1)).toBe("2027-01-01T23:15");
    expect(sumarDias("2027-03-01T08:00", -1)).toBe("2027-02-28T08:00");
  });
});
