import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { construirPaquete } from "../src/construir.ts";
import { DIR_F1_POR_DEFECTO, raizRepo } from "../src/f1.ts";
import { generarGolden, textoVisible, verificarTextoVisible, documentoVacio, negocioNeutro } from "../src/golden.ts";
import { PLANTILLAS } from "../src/plantillas.ts";
import { comprobarAA, ErrorContraste, hslAHex, nombreDeMatiz, oscurecerHastaAA, rgbAHsl, hexARgb } from "../src/tema.ts";
import { compose } from "@invitaciones/schema";

const DIR = path.join(raizRepo(), DIR_F1_POR_DEFECTO);
const DECISIONES = { "dresscode-bullet": "concatenar-a-detalle", "listtext-elemento-largo": "omitir-elemento" };

describe("WCAG 2.2 AA: se corrige el color, nunca el umbral", () => {
  it("las 9 paletas emitidas pasan las 7 parejas", () => {
    for (const p of PLANTILLAS) {
      const paq = construirPaquete(p.templateId, { dirDatos: DIR, decisiones: DECISIONES });
      const filas = paq.informeDePerdidas.contrasteMedido;
      expect(filas.length, p.slug).toBe(7);
      for (const f of filas) expect(f.ratio, `${p.slug} ${f.pareja}`).toBeGreaterThanOrEqual(f.umbral);
    }
  }, 60_000);
  it("una paleta saboteada revienta con la medición literal", () => {
    try {
      comprobarAA({ bg: "#FFFFFF", surface: "#FFFFFF", ink: "#EEEEEE", accent: "#EEEEEE", accentInk: "#FFFFFF", muted: "#EEEEEE" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorContraste);
      expect((e as Error).message).toContain("La paleta no cumple WCAG 2.2 AA y el umbral NO se toca (ADR-3-2d-04)");
      expect((e as Error).message).toContain("FALLA AA: ink/bg 1.16:1 < 4.5:1");
    }
  });
  it("la corrección conserva matiz y saturación y sólo baja la luminosidad", () => {
    const c = oscurecerHastaAA("#F14E95", ["#FFFFFF"], 4.5)!;
    const [h0, s0, l0] = rgbAHsl(...hexARgb("#F14E95"));
    const [h1, s1, l1] = rgbAHsl(...hexARgb(c));
    expect(Math.abs(h1 - h0)).toBeLessThan(1.5);
    expect(Math.abs(s1 - s0)).toBeLessThan(0.02);
    expect(l1).toBeLessThan(l0);
  });
  it("devuelve null si ni el negro alcanza el umbral", () => {
    // Ningún nivel de luminosidad cumple 7:1 contra negro Y contra blanco a la vez (el máximo
    // simultáneo posible es ~4,58:1).
    expect(oscurecerHastaAA("#888888", ["#000000", "#FFFFFF"], 7)).toBeNull();
  });
  it("nombreDeMatiz da un id con sentido, no `paleta1`", () => {
    expect(nombreDeMatiz(rgbAHsl(...hexARgb("#9400D3"))[0]).id).toBe("violeta");
    expect(nombreDeMatiz(340).id).toBe("rojo");
    expect(hslAHex(0, 0, 1)).toBe("#FFFFFF");
  });
});

describe("golden de composición GENERADO (06 §3)", () => {
  it("el golden de `bautizo-elegante` que está en disco se reproduce byte a byte", () => {
    const ruta = path.join(raizRepo(), "frontend/packages/migration-legacy/golden/bautizo-elegante-1.0.0.golden.json");
    const paq = construirPaquete(7, { dirDatos: DIR });
    const g = generarGolden(paq, 7, "baptism", 2);
    expect(JSON.stringify(g, null, 2) + "\n").toBe(fs.readFileSync(ruta, "utf8"));
  });
  it("compose() sobre content:{} no deja nada requerido sin valor ni valores inválidos", () => {
    const paq = construirPaquete(7, { dirDatos: DIR });
    const r = compose({ manifest: paq.manifest, theme: paq.theme, defaults: paq.defaults },
      documentoVacio(paq), negocioNeutro("baptism", 2), {}, "es-MX");
    expect(r.report.invalidValues).toEqual([]);
    expect(r.report.orphanContent).toEqual([]);
    expect(r.report.orphanSections).toEqual([]);
    expect(r.report.missingRequired).toEqual([]);
    expect(textoVisible(r).length).toBeGreaterThan(30);
  }, 60_000);
  it("verificación por TEXTO VISIBLE: cero faltantes en las 9 plantillas", () => {
    for (const p of PLANTILLAS) {
      const paq = construirPaquete(p.templateId, { dirDatos: DIR, decisiones: DECISIONES });
      const v = verificarTextoVisible(paq, generarGolden(paq, p.templateId, p.eventKind, p.planId));
      expect(v.faltantes.map((f) => `${p.slug} ${f.legacyPointer} = ${f.texto}`), p.slug).toEqual([]);
      expect(v.comprobados, p.slug).toBeGreaterThan(20);
    }
  }, 60_000);
  it("es idempotente: dos generaciones dan el mismo golden", () => {
    const paq = construirPaquete(13, { dirDatos: DIR, decisiones: DECISIONES });
    expect(JSON.stringify(generarGolden(paq, 13, "generic", 2)))
      .toBe(JSON.stringify(generarGolden(paq, 13, "generic", 2)));
  }, 60_000);
});

describe("frontera con el módulo antiguo (ADR-1R-C-01)", () => {
  it("ni un solo `import` del modelo Kotlin en el código del paquete", () => {
    const dir = path.join(raizRepo(), "frontend/packages/migration-legacy/src");
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0]).join("\n");
      expect(imports, f).not.toMatch(/EditorModels|DefaultContentConfig|InvitationConfig/);
    }
  });
  it("F1 se lee con JSON.parse, no por ningún modelo tipado", () => {
    const src = fs.readFileSync(path.join(raizRepo(), "frontend/packages/migration-legacy/src/f1.ts"), "utf8");
    expect(src).toContain("JSON.parse");
  });
});
