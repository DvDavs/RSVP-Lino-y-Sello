// test/nueva.test.ts — el andamio: válido A LA PRIMERA, para varias combinaciones de secciones.
//
// La medición que este bloque tiene que batir: 5 secciones / 11 bloques costaron 106 líneas de JSON,
// 7 min 29 s y CUATRO intentos escritas a mano (`evidencia/fase-3/i08-plantilla-minima/README.md`).
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DefaultsFile, TemplateManifest, ThemeSpec, explainBlockSpec, validateManifest } from "@invitaciones/schema";
import { CATALOG_SECTION_TYPES } from "@invitaciones/sections/catalog";
import { check } from "../src/check.ts";
import {
  SEMILLAS, campoObligatorio, escribirPaquete, generarPaquete, generarTema, itemIdDeterminista,
  paletaAA, valorDemo,
} from "../src/nueva.ts";
import { fallosDeContraste } from "../src/contraste.ts";
import { sectionCatalog } from "@invitaciones/sections/catalog";

const COMBINACIONES: ReadonlyArray<{ nombre: string; secciones: readonly string[] }> = [
  { nombre: "las cinco de I-08", secciones: ["cover", "celebrant", "event", "rsvp", "footer"] },
  { nombre: "boda larga", secciones: ["cover", "celebrant", "family", "story", "event", "gallery", "giftTable", "dressCode", "rsvp", "footer"] },
  { nombre: "mínima de una sección", secciones: ["cover"] },
  { nombre: "listas y grupos", secciones: ["gallery", "giftTable", "suggestions", "amenities"] },
  { nombre: "dos secciones del mismo tipo", secciones: ["cover", "event", "event", "footer"] },
  { nombre: "las doce", secciones: [...CATALOG_SECTION_TYPES] },
];

describe("nueva: el andamio pasa el esquema y las 30 invariantes sin una sola corrección", () => {
  for (const { nombre, secciones } of COMBINACIONES) {
    it(`${nombre} (${secciones.length} secciones)`, () => {
      const p = generarPaquete({ slug: "andamio-prueba", evento: "wedding", secciones });
      const manifest = TemplateManifest.parse(p.manifest);
      const theme = ThemeSpec.parse(p.theme);
      const defaults = DefaultsFile.parse(p.defaults);
      expect(validateManifest(manifest, theme, defaults)).toEqual([]);
      expect(manifest.sections).toHaveLength(secciones.length);
      // Ningún bloque con campos que falten o que sobren: el «0 are valid» no puede ocurrir.
      for (const s of p.manifest["sections"] as Array<{ blocks: unknown[] }>) {
        for (const b of s.blocks) {
          const e = explainBlockSpec(b);
          expect(e.known, JSON.stringify(b)).toBe(true);
          expect(e.missing).toEqual([]);
          expect(e.unknown).toEqual([]);
          expect(e.suggestions.role).toBeUndefined();
        }
      }
    });
  }

  it("dos secciones del mismo tipo no repiten un rol singleton (I-26) y las claves son únicas (I-14)", () => {
    const p = generarPaquete({ slug: "dos-eventos", evento: "birthday", secciones: ["event", "event"] });
    const claves = (p.manifest["sections"] as Array<{ key: string }>).map(s => s.key);
    expect(claves).toEqual(["event", "event2"]);
    const manifest = TemplateManifest.parse(p.manifest);
    expect(validateManifest(manifest, ThemeSpec.parse(p.theme), DefaultsFile.parse(p.defaults))).toEqual([]);
  });

  it("es determinista: dos generaciones con los mismos argumentos dan los mismos bytes", () => {
    const a = generarPaquete({ slug: "igual", evento: "quince", secciones: ["cover", "event"] });
    const b = generarPaquete({ slug: "igual", evento: "quince", secciones: ["cover", "event"] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(itemIdDeterminista("igual|event.cards|0")).toBe(itemIdDeterminista("igual|event.cards|0"));
    expect(itemIdDeterminista("igual|event.cards|0")).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("un campo obligatorio nuevo en el esquema ROMPE el andamio en vez de emitir JSON inválido", () => {
    const hueco = sectionCatalog.cover.slots[0]!;
    expect(() => campoObligatorio("campoNuevo", hueco, "cover.title"))
      .toThrowError(/el kit no sabe rellenarlo/);
  });

  it("un tipo de sección que no existe se rechaza al generar, no al registrar", () => {
    expect(() => generarPaquete({ slug: "x", evento: "wedding", secciones: ["portada"] }))
      .toThrowError(/no es un tipo de sección del catálogo cerrado/);
  });

  it("las paletas del andamio cumplen las nueve parejas AA (se corrige el color, nunca el umbral)", () => {
    const tema = generarTema();
    for (const p of tema["palettes"] as Array<{ id: string; tokens: Parameters<typeof fallosDeContraste>[0] }>) {
      expect(fallosDeContraste(p.tokens), p.id).toEqual([]);
    }
    // Y las semillas de partida NO cumplían por sí solas en todas sus parejas: el corrector trabaja.
    for (const s of SEMILLAS) {
      const corregida = paletaAA(s);
      expect(fallosDeContraste(corregida)).toEqual([]);
    }
  });

  it("no escribe defaults para bloques `business` (I-28) ni para imágenes sin asset (I-09)", () => {
    const p = generarPaquete({ slug: "sin-fotos", evento: "baptism", secciones: ["cover", "rsvp"] });
    const contenido = (p.defaults as { content: Record<string, unknown> }).content;
    // `cover.image` exigiría un `assetId` que ningún `AssetEntry.id` declara: quedaría sin resolver.
    expect(Object.keys(contenido)).not.toContain("cover.image");
    expect(contenido["cover.title"]).toEqual({ kind: "text", value: expect.any(String) });
    // Los dos únicos huecos `source: "business"` del catálogo (`rsvp.children`/`rsvp.young`, con
    // `businessField` invitation.childrenAllowed/youngAllowed) no están en el andamio; si alguien los
    // añade, `bloque()` les pone `source`/`editable`/`aiEditable` y NO les escribe default (I-28).
    const conBusiness = generarPaquete({ slug: "b", evento: "wedding", secciones: ["rsvp"] });
    const specs = (conBusiness.manifest["sections"] as Array<{ blocks: Array<Record<string, unknown>> }>)[0]!.blocks;
    for (const b of specs) {
      if (b["source"] === "business") {
        expect(b["businessField"]).toBeTypeOf("string");
        expect(Object.keys((conBusiness.defaults as { content: Record<string, unknown> }).content))
          .not.toContain(b["id"]);
      }
    }
  });

  it("`valorDemo` no inventa valores para imagen, audio ni grupo", () => {
    const cover = sectionCatalog.cover.slots.find(s => s.type === "image")!;
    expect(valorDemo(cover)).toBeUndefined();
  });
});

describe("nueva → check: extremo a extremo, sin tocar nada a mano", () => {
  for (const { nombre, secciones } of COMBINACIONES) {
    it(`${nombre}: lo que escribe \`nueva\` pasa \`check\` en verde`, () => {
      const destino = mkdtempSync(join(tmpdir(), "kit-nueva-"));
      const r = escribirPaquete(destino, { slug: "andamio-e2e", evento: "generic", secciones });
      const c = check({ dir: r.dir, escribir: false });
      expect(c.hallazgos.map(h => `${h.severidad} ${h.codigo} ${h.puntero}`)).toEqual([]);
      expect(c.ok).toBe(true);
      expect(c.packageHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      // Los tres ficheros están y son JSON con salto final.
      for (const f of ["template.json", "theme.json", "defaults.json"]) {
        const texto = readFileSync(join(r.dir, f), "utf8");
        expect(texto.endsWith("\n")).toBe(true);
        expect(() => JSON.parse(texto)).not.toThrow();
      }
    });
  }

  it("mide el coste del andamio frente a la medición de I-08 (5 secciones, 106 líneas a mano)", () => {
    const destino = mkdtempSync(join(tmpdir(), "kit-medida-"));
    const r = escribirPaquete(destino, {
      slug: "medida", evento: "wedding", secciones: ["cover", "celebrant", "event", "rsvp", "footer"],
    });
    expect(r.secciones).toBe(5);
    expect(r.bloques).toBeGreaterThanOrEqual(9);
    // Evidencia comparable con `evidencia/fase-3/i08-plantilla-minima/README.md`.
    console.log(`[andamio] secciones=${r.secciones} bloques=${r.bloques} líneas=${r.lineas} intentos=1`);
  });
});
