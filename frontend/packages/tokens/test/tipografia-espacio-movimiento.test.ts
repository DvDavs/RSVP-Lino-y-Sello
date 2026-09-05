// test/tipografia-espacio-movimiento.test.ts — los tokens no cromáticos. Aquí se vigilan las
// reglas de identidad que un valor suelto rompería sin que nadie lo note: las tres voces, que la
// fuente de cuerpo no titule, el mínimo de 13 px en texto de interfaz y la base 4 del espacio.
import { describe, expect, it } from "vitest";
import {
  ESCALA, FAMILIAS, PESOS, ROLES_TIPOGRAFICOS, VOCES, clampTipografico, enEscritorio, enMovil, varia, variacionesDe,
} from "../src/tipografia.ts";
import { BREAKPOINTS, CONTENEDOR, ESPACIO, RADIOS, RADIOS_SEMANTICOS, SOMBRAS, Z_INDEX } from "../src/espacio.ts";
import { CURVAS, DURACIONES, USO_CURVA, USO_DURACION } from "../src/movimiento.ts";

describe("tipografía", () => {
  it("hay tres voces y ninguna es genérica ni del sistema en primera posición", () => {
    expect(VOCES).toEqual(["display", "text", "label"]);
    for (const voz of VOCES) {
      expect(FAMILIAS[voz].startsWith('"')).toBe(true);
      expect(FAMILIAS[voz]).not.toMatch(/^(?:system-ui|ui-sans-serif|sans-serif|serif|monospace)/);
    }
    expect(FAMILIAS.display).toContain("Fraunces");
    expect(FAMILIAS.text).toContain("Onest");
    expect(FAMILIAS.label).toContain("Red Hat Mono");
  });

  it("los títulos NUNCA van en la voz de cuerpo (11 §2.2)", () => {
    for (const rol of ROLES_TIPOGRAFICOS) {
      const voz = ESCALA[rol].voz;
      if (rol.startsWith("display-") || rol.startsWith("heading-")) expect(voz, rol).toBe("display");
      if (rol.startsWith("text-")) expect(voz, rol).toBe("text");
      if (rol.startsWith("label-")) expect(voz, rol).toBe("label");
    }
  });

  it("los 15 roles traen tamaño, interlineado, tracking y peso, y solo la display trae ejes", () => {
    expect(ROLES_TIPOGRAFICOS).toHaveLength(15);
    for (const rol of ROLES_TIPOGRAFICOS) {
      const r = ESCALA[rol];
      expect(r.movil).toBeGreaterThan(0);
      expect(r.escritorio).toBeGreaterThanOrEqual(r.movil);
      expect(Number(enMovil(r.lineHeight))).toBeGreaterThan(0.9);
      expect(String(enMovil(r.tracking))).toMatch(/^(?:0|-?\d*\.?\d+em)$/);
      expect(Object.values(PESOS)).toContain(r.peso);
      expect(Boolean(r.ejes), rol).toBe(r.voz === "display");
    }
  });

  it("el texto de interfaz no baja de 13 px; 12 y 11 solo en etiquetas mono en mayúsculas", () => {
    for (const rol of ROLES_TIPOGRAFICOS) {
      const r = ESCALA[rol];
      if (r.movil < 13) {
        expect(r.voz, rol).toBe("label");
        expect(r.mayusculas, rol).toBe(true);
      }
    }
    expect(ESCALA["text-xs"].movil).toBe(13);
    expect(PESOS.texto).toBe(450);
    expect(PESOS.textoFuerte).toBe(650);
  });

  it("`clamp()` interpola de 390 a 1024 px y cae al px suelto cuando no hay que interpolar", () => {
    expect(clampTipografico(16, 16)).toBe("16px");
    expect(clampTipografico(40, 64)).toBe("clamp(40px, 25.237px + 3.785vw, 64px)");
    // Comprobación numérica: en los dos extremos vale exactamente lo declarado (± 0,01 px).
    const [, base, vw] = /clamp\(40px, ([\d.]+)px \+ ([\d.]+)vw, 64px\)/.exec(clampTipografico(40, 64))!;
    expect(Number(base) + (Number(vw) / 100) * 390).toBeCloseTo(40, 1);
    expect(Number(base) + (Number(vw) / 100) * 1024).toBeCloseTo(64, 1);
  });

  it("los ejes de Fraunces salen como `font-variation-settings` y `varia()` detecta lo responsivo", () => {
    expect(variacionesDe(ESCALA["display-2xl"])).toBe('"opsz" 96, "SOFT" 70, "WONK" 1');
    expect(variacionesDe(ESCALA["display-lg"])).toBe('"opsz" 48, "SOFT" 50');
    expect(variacionesDe(ESCALA["text-md"])).toBeUndefined();
    expect(varia(ESCALA["display-2xl"].lineHeight)).toBe(true);
    expect(varia(ESCALA["text-md"].lineHeight)).toBe(false);
    expect(enEscritorio(ESCALA["display-2xl"].tracking)).toBe("-0.04em");
  });
});

describe("espacio, forma y movimiento", () => {
  it("el espacio es base 4 y no tiene medidas intermedias inventadas", () => {
    expect(Object.values(ESPACIO)).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96]);
    for (const v of Object.values(ESPACIO)) expect(v % 4).toBe(0);
  });

  it("los radios semánticos salen de la escala cruda y la foto nunca baja de 24 px (11 §3.4)", () => {
    const crudos = new Set(Object.values(RADIOS));
    for (const v of Object.values(RADIOS_SEMANTICOS)) expect(crudos.has(v)).toBe(true);
    expect(RADIOS_SEMANTICOS.media).toBeGreaterThanOrEqual(24);
    expect(RADIOS_SEMANTICOS.control).toBe(8);
  });

  it("las sombras difusas van tintadas de cacao y la de color es plana y desplazada", () => {
    expect(SOMBRAS["1"]).toContain("rgb(41 32 24 /");
    expect(SOMBRAS["2"]).toContain("rgb(41 32 24 /");
    expect(SOMBRAS["1"]).not.toContain("rgb(0 0 0");
    expect(SOMBRAS.color).toBe("8px 8px 0 0 var(--ui-support-2)");
    expect(SOMBRAS.color).not.toContain("blur");
  });

  it("contenedor, capas y puntos de corte", () => {
    expect(CONTENEDOR.max).toBe("1200px");
    expect(CONTENEDOR.canaleta).toBe("clamp(16px, 4vw, 48px)");
    expect(Object.values(Z_INDEX)).toEqual([...Object.values(Z_INDEX)].sort((a, b) => a - b));
    expect(Z_INDEX.toast).toBeGreaterThan(Z_INDEX.dialogo);
    expect(BREAKPOINTS.lg).toBe(1024);
  });

  it("las duraciones y las curvas son las de 11 §6.1 y todas están documentadas", () => {
    expect(DURACIONES).toEqual({ 1: 120, 2: 200, 3: 320, 4: 600, respira: 12_000 });
    expect(CURVAS.out).toBe("cubic-bezier(0.2, 0.7, 0.2, 1)");
    expect(CURVAS["in-out"]).toBe("cubic-bezier(0.6, 0, 0.2, 1)");
    expect(CURVAS.spring).toBe("cubic-bezier(0.34, 1.4, 0.64, 1)");
    expect(Object.keys(USO_DURACION).sort()).toEqual(Object.keys(DURACIONES).sort());
    expect(Object.keys(USO_CURVA).sort()).toEqual(Object.keys(CURVAS).sort());
  });
});
