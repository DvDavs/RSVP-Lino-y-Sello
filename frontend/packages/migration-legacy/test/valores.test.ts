import { describe, expect, it } from "vitest";
import { fechaEs, hora, normalizarVisible, plataformaDeIcono, richDoc, tipoRegalo, urlHttp } from "../src/valores.ts";

describe("fechaEs — las formas REALES de F1", () => {
  it("«Miércoles 31, Diciembre» con el año de invitation.date", () => {
    expect(fechaEs("Miércoles 31, Diciembre", 2025).valor).toBe("2025-12-31");
  });
  it("«26 de Julio, 2023» trae su propio año", () => {
    expect(fechaEs("Fecha límite para confirmar tu asistencia 26 de Julio, 2023.", null).valor).toBe("2023-07-26");
  });
  it("ISO se respeta tal cual", () => {
    expect(fechaEs("2025-12-31T16:30:00", null).valor).toBe("2025-12-31");
  });
  it("sin año y sin invitation.date NO se inventa (R5), con el motivo exacto", () => {
    const c = fechaEs("Miércoles 31, Diciembre", null);
    expect(c.valor).toBeNull();
    expect(c.motivo).toBe('fecha sin año ("Miércoles 31, Diciembre") y sin `invitation.date` del que tomarlo (05 §4.3 decisión 3)');
  });
  it("sin mes reconocible falla con el motivo exacto", () => {
    expect(fechaEs("Por definir", 2025).motivo).toBe('no contiene un mes en español reconocible: "Por definir"');
  });
  it("con mes pero sin día falla con el motivo exacto", () => {
    expect(fechaEs("Diciembre", 2025).motivo).toBe('no contiene día: "Diciembre"');
  });
});

describe("hora", () => {
  it("«4:30 PM» → 16:30 y «12:15 am» → 00:15", () => {
    expect(hora("4:30 PM").valor).toBe("16:30");
    expect(hora("12:15 am").valor).toBe("00:15");
    expect(hora("16:30").valor).toBe("16:30");
  });
  it("lo que no es una hora falla con el motivo exacto", () => {
    expect(hora("por la tarde").motivo).toBe('no es una hora reconocible: "por la tarde"');
    expect(hora("99:99").motivo).toBe('hora fuera de rango: "99:99"');
  });
});

describe("urlHttp — `HttpUrl` de common.ts", () => {
  it("acepta http(s) absolutas", () => {
    expect(urlHttp("https://maps.app.goo.gl/x").valor).toBe("https://maps.app.goo.gl/x");
  });
  it('rechaza "#", que es lo que traen las 9 plantillas en el botón de portada', () => {
    expect(urlHttp("#").motivo).toBe('no es una URL http(s) absoluta y `HttpUrl` la rechazaría: "#"');
  });
  it("rechaza una URL de más de 2048 caracteres", () => {
    expect(urlHttp("https://x.com/" + "a".repeat(2100)).motivo).toBe("URL de más de 2048 caracteres");
  });
});

describe("richDoc", () => {
  it("un párrafo por línea no vacía, sin marcas inventadas", () => {
    const d = richDoc(["uno", "  ", "dos\ntres"]).valor!;
    expect(d.content).toHaveLength(3);
    expect(d.content[0]!.content[0]!.text).toBe("uno");
    expect(d.content[0]!.content[0]).not.toHaveProperty("marks");
  });
  it("más de 40 párrafos no cabe en RichDoc", () => {
    expect(richDoc(Array.from({ length: 41 }, (_, i) => `p${i}`)).motivo).toBe("41 párrafos: `RichDoc` admite 40 como máximo");
  });
  it("sin texto devuelve null", () => { expect(richDoc(["", " "]).motivo).toBe("sin texto"); });
});

describe("choice: no se coacciona (I-02)", () => {
  it("`fab fa-facebook` → facebook", () => { expect(plataformaDeIcono("fab fa-facebook").valor).toBe("facebook"); });
  it("un icono sin plataforma falla con el motivo exacto", () => {
    expect(plataformaDeIcono("fas fa-star").motivo)
      .toBe('icono sin plataforma reconocible en el `choice` `hashtagPlatform`: "fas fa-star"');
  });
  it("cash|digital|store y nada más", () => {
    expect(tipoRegalo("cash").valor).toBe("cash");
    expect(tipoRegalo("banco").motivo)
      .toBe('`giftOptionKind` sólo declara cash|digital|store y el legado trae "banco" (I-02: no se coacciona)');
  });
});

describe("normalizarVisible (05 §6.2)", () => {
  it("colapsa espacios, quita acentos y comillas tipográficas, y no usa umbral difuso", () => {
    expect(normalizarVisible("  Confirmación  de   “asistencia” ")).toBe("confirmacion de 'asistencia'");
    expect(normalizarVisible("Damas")).not.toBe(normalizarVisible("Dama"));
  });
});
