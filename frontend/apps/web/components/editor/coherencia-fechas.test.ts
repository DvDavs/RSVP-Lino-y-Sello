// components/editor/coherencia-fechas.test.ts — U-4: «dos fechas distintas en la misma invitación,
// sin aviso». Reproduce EXACTAMENTE lo que hizo la clienta: cambió la ceremonia del 18 de abril al
// 22 de mayo en el itinerario y la portada siguió diciendo 18 de abril.
import { describe, expect, it } from "vitest";
import type { ComposedDocument, TemplateManifest } from "@invitaciones/schema";
import { fechasDiscrepantes } from "./coherencia-fechas.ts";

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
  momentos: Array<{ start: string; visible?: boolean; provenance?: "user" | "default" }>,
): ComposedDocument {
  return {
    sections: [
      {
        key: "cover",
        visible: true,
        blocks: [{ id: "cover.date", value: { kind: "date", value: fechaPortada, formatted: fechaPortada } }],
      },
      {
        key: "rsvp",
        visible: true,
        // Una fecha límite muy distinta: si la comparación fuera «cualquier date», esto daría un
        // aviso falso en TODAS las invitaciones.
        blocks: [{ id: "rsvp.deadline", value: { kind: "date", value: "2027-03-01", formatted: "1 de marzo" } }],
      },
      {
        key: "event",
        visible: momentos[0]?.visible ?? true,
        blocks: [
          {
            id: "event.cards",
            type: "group",
            items: momentos.map((m, i) => ({
              itemId: `item-${i}`,
              blocks: [{ id: "when", provenance: m.provenance ?? "user", value: { kind: "dateTimeRange", start: m.start, formatted: m.start } }],
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
    expect(r?.diaPortada).toBe("2027-04-18");
    expect(r?.diaItinerario).toBe("2027-05-22");
    expect(r?.sectionKey).toBe("event");
  });

  it("no avisa cuando las dos dicen lo mismo, aunque la hora cambie", () => {
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-04-18T19:30" }]))).toBeNull();
  });

  it("compara contra el PRIMER momento del itinerario, no contra el último", () => {
    // Boda de un día con tres momentos: el primero manda; el resto no genera aviso.
    const r = fechasDiscrepantes(
      manifiesto(),
      compuesto("2027-04-18", [{ start: "2027-04-18T17:00" }, { start: "2027-04-18T20:00" }, { start: "2027-04-19T01:00" }]),
    );
    expect(r).toBeNull();
  });

  it("la fecha límite para confirmar NO cuenta como fecha del evento (sería un aviso falso)", () => {
    // La portada (18 de abril) y el itinerario (18 de abril) coinciden; `rsvp.deadline` es el 1 de
    // marzo y no debe disparar nada.
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-04-18T17:00" }]))).toBeNull();
  });

  it("una sección oculta no contradice a la portada: ningún invitado la ve", () => {
    expect(fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2027-05-22T17:00", visible: false }]))).toBeNull();
  });

  it("no avisa sobre un itinerario que la clienta nunca tocó (contenido de ejemplo)", () => {
    // `boda-clasica@1.0.0` trae de ejemplo el 12 de diciembre de 2026 y la fecha de negocio de
    // cualquier invitación real es otra: comparar contra eso avisaría en TODAS las invitaciones
    // recién empezadas (medido con E-01, `bitacora/3-8.md` §7).
    expect(
      fechasDiscrepantes(manifiesto(), compuesto("2027-04-18", [{ start: "2026-12-12T17:30", provenance: "default" }])),
    ).toBeNull();
  });

  it("sin manifiesto no inventa avisos", () => {
    expect(fechasDiscrepantes(null, compuesto("2027-04-18", [{ start: "2027-05-22T17:00" }]))).toBeNull();
    expect(fechasDiscrepantes(manifiesto(), null)).toBeNull();
  });
});
