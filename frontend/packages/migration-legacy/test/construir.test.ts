// Construcción del paquete sobre los 9 pares REALES. Nada de fixtures inventadas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DefaultsFile, TemplateManifest, ThemeSpec } from "@invitaciones/schema";
import { BLOQUES_ESTATICOS, bloqueDe, SECCIONES } from "../src/catalogo.ts";
import { construirPaquete } from "../src/construir.ts";
import { escribirPaquete } from "../src/escribir.ts";
import { DIR_F1_POR_DEFECTO, raizRepo } from "../src/f1.ts";
import { packageHash, ulidDeterminista } from "../src/hash.ts";
import { ErrorBloqueante } from "../src/perdidas.ts";
import { PLANTILLAS, plantillaPorId } from "../src/plantillas.ts";
import { REGLAS_CONTENIDO } from "../src/reglas-contenido.ts";
import { REGLAS_VISUAL } from "../src/reglas-visual.ts";

const DIR = path.join(raizRepo(), DIR_F1_POR_DEFECTO);
/** Decisiones de producto necesarias para que las 9 construyan; cada una se registra en el informe. */
const DECISIONES = {
  "dresscode-bullet": "concatenar-a-detalle",
  "listtext-elemento-largo": "omitir-elemento",
} as const;

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
}

describe("catálogo y tabla de reglas casan por los dos lados", () => {
  it("todo destino de una regla existe en el catálogo", () => {
    for (const r of [...REGLAS_VISUAL, ...REGLAS_CONTENIDO]) {
      const d = r.destino;
      if (!d || (d.tipo !== "bloque" && d.tipo !== "itemBloque" && d.tipo !== "itemIdLegado")) continue;
      const ref = d.ref.replace(/\{\d+(\+\d+)?\}/g, "1");
      const b = bloqueDe(ref);
      expect(b, `${r.id} → ${ref}`).not.toBeNull();
      if (d.tipo === "itemBloque") {
        expect((b!.itemBlocks ?? []).map((x) => x.id), `${r.id} → ${ref}.${d.itemBlock}`).toContain(d.itemBlock);
      }
    }
  });
  it("todo bloque del catálogo es destino de alguna regla (si no, nunca se podría rellenar)", () => {
    const refs = new Set([...REGLAS_VISUAL, ...REGLAS_CONTENIDO]
      .map((r) => r.destino)
      .filter((d) => d && (d.tipo === "bloque" || d.tipo === "itemBloque" || d.tipo === "itemIdLegado"))
      .map((d) => (d as { ref: string }).ref.replace(/\{\d+(\+\d+)?\}/g, "1")));
    for (const b of BLOQUES_ESTATICOS) expect(refs.has(b.id), b.id).toBe(true);
  });
  it("toda sección del catálogo tiene su `defaultVariant` dentro de `variants` (I-08)", () => {
    for (const s of SECCIONES) expect(s.variantes, s.key).toContain(s.variantePorDefecto);
  });
});

describe("las 9 plantillas construyen y validan contra Zod", () => {
  for (const p of PLANTILLAS) {
    it(`templateId ${p.templateId} (${p.slug})`, () => {
      const paq = construirPaquete(p.templateId, { dirDatos: DIR, decisiones: DECISIONES });
      expect(() => TemplateManifest.parse(paq.manifest)).not.toThrow();
      expect(() => ThemeSpec.parse(paq.theme)).not.toThrow();
      expect(() => DefaultsFile.parse(paq.defaults)).not.toThrow();
      expect(paq.informeDePerdidas.resumen.patronesSinMapear).toBe(0);
      expect(paq.informeDePerdidas.bloqueante).toHaveLength(0);
      // I-10: toda clave de defaults.json es un blockId del manifiesto
      const ids = new Set(paq.manifest.sections.flatMap((s) => s.blocks).map((b) => b.id));
      for (const k of Object.keys(paq.defaults.content)) expect(ids.has(k), k).toBe(true);
      // I-13: blockId único en TODO el manifiesto
      expect(ids.size).toBe(paq.manifest.sections.reduce((n, s) => n + s.blocks.length, 0));
    });
  }
});

describe("los roles de boda y no-boda no se cruzan en el manifiesto emitido", () => {
  const BODA = ["celebrantA", "celebrantB", "celebrantAPhoto", "celebrantBPhoto", "celebrantAText", "celebrantBText"];
  for (const p of PLANTILLAS) {
    it(`templateId ${p.templateId} (${p.cohorte})`, () => {
      const paq = construirPaquete(p.templateId, { dirDatos: DIR, decisiones: DECISIONES });
      const roles = paq.manifest.sections.flatMap((s) => s.blocks).map((b) => b.role);
      if (p.cohorte === "boda") {
        expect(roles).not.toContain("honoree");
        expect(roles).not.toContain("honoreePhoto");
      } else {
        for (const r of BODA) expect(roles, r).not.toContain(r);
      }
    });
  }
});

describe("package_hash", () => {
  it("es reproducible byte a byte entre dos corridas independientes", () => {
    const a = tmp(), b = tmp();
    const p1 = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const p2 = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const h1 = escribirPaquete(p1, path.join(a, "templates"), path.join(a, "ev")).packageHash;
    const h2 = escribirPaquete(p2, path.join(b, "templates"), path.join(b, "ev")).packageHash;
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/);
    fs.rmSync(a, { recursive: true }); fs.rmSync(b, { recursive: true });
  });
  it("cambia si cambia un solo byte de theme.json (ADR-1R-D-03: cubre el paquete entero)", () => {
    const d = tmp();
    const p = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const e = escribirPaquete(p, path.join(d, "templates"), path.join(d, "ev"));
    const antes = e.packageHash;
    const th = JSON.parse(fs.readFileSync(path.join(e.dirVersion, "theme.json"), "utf8")) as ThemeSpec;
    th.palettes[0]!.tokens.bg = "#FAFAFB";
    fs.writeFileSync(path.join(e.dirVersion, "theme.json"), JSON.stringify(th, null, 2) + "\n");
    expect(packageHash(e.dirVersion)).not.toBe(antes);
    fs.rmSync(d, { recursive: true });
  });
  it("NO cambia si sólo se reformatea un .json (los .json se canonicalizan)", () => {
    const d = tmp();
    const p = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const e = escribirPaquete(p, path.join(d, "templates"), path.join(d, "ev"));
    const antes = e.packageHash;
    const th = JSON.parse(fs.readFileSync(path.join(e.dirVersion, "theme.json"), "utf8")) as unknown;
    fs.writeFileSync(path.join(e.dirVersion, "theme.json"), JSON.stringify(th));   // sin sangría
    expect(packageHash(e.dirVersion)).toBe(antes);
    fs.rmSync(d, { recursive: true });
  });
  it("los `itemId` son ULID nuevos y deterministas, jamás el `id` legado (ADR-1R-C-02)", () => {
    const p = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const traza = p.informeDePerdidas.trazaDeItems;
    expect(traza.length).toBeGreaterThan(0);
    for (const t of traza) {
      expect(t.itemId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      for (const l of t.legacyIds) expect(t.itemId).not.toBe(l);
    }
    expect(ulidDeterminista("x")).toBe(ulidDeterminista("x"));
    expect(ulidDeterminista("x")).not.toBe(ulidDeterminista("y"));
  });
});

describe("una entrada bloqueante aborta la construcción", () => {
  it("`bullet` del código de vestimenta bloquea el templateId 4 mientras no haya decisión", () => {
    expect(() => construirPaquete(4, { dirDatos: DIR })).toThrowError(ErrorBloqueante);
    try {
      construirPaquete(4, { dirDatos: DIR });
      expect.unreachable();
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toContain("La construcción NO produce paquete: 2 entrada(s) BLOQUEANTE(S) — contenido visible sin destino (P1).");
      expect(m).toContain("/config/sectionDresscode/items/0/bullet/content = \"Vestido largo/corto o traje elegante.\"");
      expect(m).toContain("se desbloquea con --decision dresscode-bullet=concatenar-a-detalle|descartar");
    }
  });
  it("un `listText` con un elemento de más de 200 caracteres bloquea el templateId 10", () => {
    try {
      construirPaquete(10, { dirDatos: DIR, decisiones: { "dresscode-bullet": "descartar" } });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("/texts/familyIntro");
      expect((e as Error).message).toContain("1 entrada(s) BLOQUEANTE(S)");
    }
  });
  it("una decisión con una opción no declarada se rechaza con su mensaje", () => {
    expect(() => construirPaquete(4, { dirDatos: DIR, decisiones: { "dresscode-bullet": "inventada" } }))
      .toThrowError("--decision dresscode-bullet=inventada no es una opción declarada (concatenar-a-detalle|descartar).");
  });
  it("un templateId fuera de las cohortes A/B se rechaza nombrando las 9", () => {
    expect(() => plantillaPorId(17)).toThrowError(
      "templateId 17 no pertenece a las cohortes A/B. Reconstruibles desde el repositorio: 4, 5, 6, 7, 8, 9, 10, 11, 13 (ADR-1R-C-07).");
  });
});

describe("nada se descarta en silencio", () => {
  it("toda colisión de fuentes deja las dos en el informe, con los dos punteros", () => {
    const p = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const col = p.informeDePerdidas.aRevisar.find((e) => e.legacyPointer === "/config/sectionCover/button/content");
    expect(col?.detalle).toContain("COLISIÓN de fuentes");
    expect(col?.detalle).toContain("/texts/coverButton");
    expect(col?.valor).toBe("Save the date");
  });
  it("toda URL externa queda anotada en vez de desaparecer (no se descarga nada)", () => {
    const p = construirPaquete(7, { dirDatos: DIR, decisiones: DECISIONES });
    const img = p.informeDePerdidas.aRevisar.filter((e) => e.detalle?.includes("URL externa de F1"));
    expect(img.length).toBeGreaterThan(10);
    expect(Object.keys(p.defaults.content)).not.toContain("cover.image");
  });
  it("`itemsSinglePlace` sólo llega leyendo F1 crudo, y llega (H-12)", () => {
    const p = construirPaquete(5, { dirDatos: DIR, decisiones: DECISIONES });
    expect(p.manifest.capabilities).toContain("singlePlace");
    expect(Object.keys(p.defaults.content)).toContain("event.singlePlaceCards");
  });
});
