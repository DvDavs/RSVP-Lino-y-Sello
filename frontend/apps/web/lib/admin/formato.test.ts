// lib/admin/formato.test.ts — casos límite reales de las funciones de presentación: importe 0,
// fecha vacía, hora vacía, moneda distinta de MXN, estado desconocido. Ninguna función debe
// lanzar ante estos casos (son datos legítimos, no errores del backend).
import { describe, expect, it } from "vitest";
import {
  GUION_LARGO,
  etiquetaEstadoInvitacion,
  etiquetaEstadoPago,
  formatearFechaCorta,
  formatearFechaEvento,
  formatearImporte,
} from "./formato.ts";
import { textosAdmin } from "./textos.ts";

describe("formatearImporte", () => {
  it("formatea 0 como un importe válido, no como ausente", () => {
    const esperado = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(0);
    expect(formatearImporte(0, "MXN")).toBe(esperado);
  });

  it("un importe ausente (null/undefined) se trata como cero, sin lanzar", () => {
    const cero = formatearImporte(0, "MXN");
    expect(formatearImporte(undefined, "MXN")).toBe(cero);
    expect(formatearImporte(null, "MXN")).toBe(cero);
  });

  it("usa la moneda del propio dato, no MXN codificada", () => {
    const enDolares = formatearImporte(100, "USD");
    const enPesos = formatearImporte(100, "MXN");
    expect(enDolares).not.toBe(enPesos);
    expect(enDolares).toContain("100.00");
  });

  it("una moneda ausente no lanza: cae a MXN", () => {
    expect(() => formatearImporte(50, undefined)).not.toThrow();
    expect(formatearImporte(50, undefined)).toBe(formatearImporte(50, "MXN"));
  });

  it("un código de moneda que Intl no reconoce no revienta la fila", () => {
    expect(() => formatearImporte(50, "NO-ES-UNA-MONEDA")).not.toThrow();
  });
});

describe("formatearFechaCorta", () => {
  it("una fecha vacía o ausente da el guion largo, nunca 'Invalid Date'", () => {
    expect(formatearFechaCorta("")).toBe(GUION_LARGO);
    expect(formatearFechaCorta(undefined)).toBe(GUION_LARGO);
    expect(formatearFechaCorta(null)).toBe(GUION_LARGO);
  });

  it("una cadena que no es una fecha da el guion largo, no 'Invalid Date'", () => {
    const resultado = formatearFechaCorta("esto-no-es-una-fecha");
    expect(resultado).toBe(GUION_LARGO);
    expect(resultado).not.toContain("Invalid");
  });

  it("un ISO real se formatea en es-MX", () => {
    expect(formatearFechaCorta("2026-03-02T10:00:00Z")).not.toBe(GUION_LARGO);
  });
});

describe("formatearFechaEvento (fecha YYYY-MM-DD + hora HH:mm, las dos pueden venir vacías)", () => {
  it("fecha y hora vacías dan el guion largo", () => {
    expect(formatearFechaEvento("", "")).toBe(GUION_LARGO);
    expect(formatearFechaEvento(null, null)).toBe(GUION_LARGO);
    expect(formatearFechaEvento(undefined, undefined)).toBe(GUION_LARGO);
  });

  it("hora vacía enseña solo la fecha, nunca 'Invalid Date'", () => {
    const resultado = formatearFechaEvento("2026-11-14", "");
    expect(resultado).not.toBe(GUION_LARGO);
    expect(resultado).not.toContain("Invalid");
  });

  it("fecha vacía enseña solo la hora", () => {
    expect(formatearFechaEvento("", "18:00")).toBe("18:00");
    expect(formatearFechaEvento(null, "09:30")).toBe("09:30");
  });

  it("combina fecha y hora cuando las dos vienen", () => {
    const resultado = formatearFechaEvento("2026-11-14", "18:00");
    expect(resultado).toContain("18:00");
    expect(resultado).not.toBe(GUION_LARGO);
  });

  it("una fecha malformada no lanza y no deja pasar 'Invalid Date'", () => {
    const resultado = formatearFechaEvento("no-es-una-fecha", "18:00");
    expect(() => resultado).not.toThrow();
    expect(resultado).not.toContain("Invalid");
  });

  it("una fecha que desborda el rango (mes/día fuera de lo real) no se inventa una fecha creíble (5-E5-R1 MEDIA-1)", () => {
    // Antes de esta corrección: "14 feb 2027, 18:00" — una fecha FALSA pero creíble, peor que
    // no enseñar nada en una consola de administración.
    expect(formatearFechaEvento("2026-13-45", "18:00")).toBe(GUION_LARGO);
  });

  it("una cadena que no tiene forma de fecha no se enseña cruda en pantalla (5-E5-R1 MEDIA-1)", () => {
    // Antes de esta corrección: "no-fecha" — el dato crudo del backend, tal cual, en pantalla.
    expect(formatearFechaEvento("no-fecha", "")).toBe(GUION_LARGO);
  });
});

describe("etiquetaEstadoInvitacion", () => {
  it("traduce los tres estados del contrato", () => {
    expect(etiquetaEstadoInvitacion("publicada")).toBe(textosAdmin.invitaciones.estados.publicada);
    expect(etiquetaEstadoInvitacion("en-edicion")).toBe(textosAdmin.invitaciones.estados.enEdicion);
    expect(etiquetaEstadoInvitacion("deshabilitada")).toBe(textosAdmin.invitaciones.estados.deshabilitada);
  });

  it("un estado desconocido o ausente no lanza y cae al texto genérico", () => {
    expect(etiquetaEstadoInvitacion("lo-que-sea")).toBe(textosAdmin.comun.estadoDesconocido);
    expect(etiquetaEstadoInvitacion(undefined)).toBe(textosAdmin.comun.estadoDesconocido);
    expect(etiquetaEstadoInvitacion(null)).toBe(textosAdmin.comun.estadoDesconocido);
  });
});

describe("etiquetaEstadoPago", () => {
  it("traduce los tres estados del contrato, incluido 'devuelto' (E4 futuro)", () => {
    expect(etiquetaEstadoPago("pagado")).toBe(textosAdmin.pagos.estados.pagado);
    expect(etiquetaEstadoPago("pendiente")).toBe(textosAdmin.pagos.estados.pendiente);
    expect(etiquetaEstadoPago("devuelto")).toBe(textosAdmin.pagos.estados.devuelto);
  });

  it("un estado de pago desconocido o ausente no lanza", () => {
    expect(etiquetaEstadoPago("lo-que-sea")).toBe(textosAdmin.comun.estadoDesconocido);
    expect(etiquetaEstadoPago(undefined)).toBe(textosAdmin.comun.estadoDesconocido);
  });
});
