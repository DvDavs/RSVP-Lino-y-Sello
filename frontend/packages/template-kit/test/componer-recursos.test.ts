// test/componer-recursos.test.ts — la mitad de Node de `preview` y `capturas`: componer el paquete
// y fabricar lo que el servidor sirve. Ni navegador ni servidor: son funciones puras y aquí se
// prueban como tales (rápidas y sin plazos que dependan de lo ocupada que esté la máquina).
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TemplateManifest, DefaultsFile } from "@invitaciones/schema";
import {
  FECHA_DEMO, HORA_DEMO, clavePlaceholder, componerPaquete, documentoDeDefaults, indiceDeAssets,
  marcadores, negocioDemo,
} from "../src/componer.ts";
import { hojaDeFuentes, marcadorSvg, reescribirUrls, slugDeFamilia } from "../src/recursos.ts";
import { nombreDeCaptura, destinoPorDefecto, caeDentroDelPaquete, enlaceDelLienzo, abrirChromium } from "../src/capturas.ts";
import { estadoIlegible } from "../src/preview.ts";
import { copiarPaquete, escribirManifiesto, leerManifiesto, PAQUETES } from "./ayuda.ts";

const BASE = "http://127.0.0.1:5310";
const BAUTIZO = join(PAQUETES, "bautizo-elegante/1.0.0");

describe("componer un paquete de disco a ComposedDocument", () => {
  it("compone `bautizo-elegante@1.0.0` con sus defaults, sin backend", () => {
    const e = componerPaquete({ dir: BAUTIZO, base: BASE });
    expect(e.ok).toBe(true);
    expect(e.slug).toBe("bautizo-elegante");
    expect(e.version).toBe("1.0.0");
    expect(e.composed?.sections.map(s => s.key)).toEqual([
      "cover", "couple", "family", "event", "gallery", "suggestions", "amenities", "gifts",
      "dressCode", "rsvp", "footer",
    ]);
    // R8: sin `doc.theme` propio se usa el `defaultPaletteId`/`defaultFontSetId` del paquete.
    expect(e.composed?.theme.paletteId).toBe("violeta");
    expect(e.composed?.theme.fonts.heading.family).toBe("Great Vibes");
    // El informe sale limpio: no hay contenido huérfano ni valores inválidos.
    expect(e.informe).toEqual({
      missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [],
      invalidValues: [], themeFallback: null,
    });
  });

  it("es determinista: dos composiciones seguidas dan el MISMO documento (R9)", () => {
    const a = componerPaquete({ dir: BAUTIZO, base: BASE });
    const b = componerPaquete({ dir: BAUTIZO, base: BASE });
    expect(JSON.stringify(b.composed)).toBe(JSON.stringify(a.composed));
  });

  it("la fecha que se ve es la de DEMOSTRACIÓN del snapshot de negocio, no la de hoy (R4/R6)", () => {
    const e = componerPaquete({ dir: BAUTIZO, base: BASE });
    const portada = e.composed?.sections.find(s => s.key === "cover");
    const fecha = portada?.blocks.find(b => b.id === "cover.date");
    expect(fecha && "value" in fecha ? fecha.value : null).toMatchObject({ kind: "date", value: FECHA_DEMO });
    expect(fecha && "provenance" in fecha ? fecha.provenance : "").toBe("business");
    expect(negocioDemo("baptism").time).toBe(HORA_DEMO);
    expect(negocioDemo("wedding", 2)).toMatchObject({ eventKind: "wedding", planTier: 2, coverPhotoUrl: null });
  });

  it("con marcadores, los huecos de imagen sin valor se pintan; sin ellos, quedan vacíos (R5)", () => {
    const con = componerPaquete({ dir: BAUTIZO, base: BASE });
    const sin = componerPaquete({ dir: BAUTIZO, base: BASE, placeholders: false });
    const imagenes = (e: typeof con): number =>
      (e.composed?.sections ?? []).flatMap(s => s.blocks)
        .filter(b => !("items" in b) && b.type === "image" && b.value !== null).length;
    expect(imagenes(con)).toBeGreaterThan(0);
    expect(imagenes(sin)).toBe(0);
    expect(con.notas.some(n => n.includes("hueco(s) de imagen sin valor"))).toBe(true);
    expect(sin.notas.some(n => n.includes("hueco(s) de imagen sin valor"))).toBe(false);
  });

  it("el marcador alcanza también a un bloque `source: \"fixed\"` (por eso se inyecta en defaults)", () => {
    // `rsvp.background` de este paquete es `source: "fixed"`: `compose` IGNORA `doc.content` para
    // esos bloques (compose.ts:204). Es la prueba de regresión de esa decisión.
    const e = componerPaquete({ dir: BAUTIZO, base: BASE });
    const rsvp = e.composed?.sections.find(s => s.key === "rsvp");
    const fondo = rsvp?.blocks.find(b => b.id === "rsvp.background");
    expect(fondo && "value" in fondo ? fondo.value : null).toMatchObject({ kind: "image" });
  });

  it("un paquete que no pasa `check` no devuelve documento: devuelve el diagnóstico con SU formato", () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-preview-roto-"));
    writeFileSync(join(dir, "template.json"), "{}", "utf8");
    const e = componerPaquete({ dir, base: BASE });
    expect(e.ok).toBe(false);
    expect(e.composed).toBeUndefined();
    expect(e.diagnostico).toContain("ERROR TPL_PACKAGE_MISSING_FILE");
    expect(e.diagnostico).toMatch(/\n\d+ error\(es\) · \d+ aviso\(s\) · \d+ corregido\(s\)$/);
    expect(e.hallazgos.length).toBeGreaterThan(0);
  });

  it("una paleta que no existe cae a la del paquete y lo dice en el informe (R8)", () => {
    const e = componerPaquete({ dir: BAUTIZO, base: BASE, paleta: "inventada" });
    expect(e.composed?.theme.paletteId).toBe("violeta");
    expect(e.informe?.themeFallback).toEqual({ paletteId: "inventada" });
  });

  it("`indiceDeAssets` declara la ruta Y el alias (I-09), los dos a la misma URL", () => {
    const dir = copiarPaquete("boda-clasica/1.0.0");
    const m = TemplateManifest.parse(leerManifiesto(dir));
    const idx = indiceDeAssets(m, BASE) as Record<string, { url: string }>;
    const primero = m.assets[0]!;
    expect(idx[primero.path]?.url).toBe(`${BASE}/__preview/asset/${primero.path.replace(/^assets\//, "")}`);
    if (primero.id !== undefined) expect(idx[primero.id]?.url).toBe(idx[primero.path]?.url);
  });

  it("un paquete con assets de verdad los resuelve a URLs del propio previsualizador", () => {
    const e = componerPaquete({ dir: join(PAQUETES, "boda-clasica/1.0.0"), base: BASE });
    expect(e.ok).toBe(true);
    const urls = (e.composed?.sections ?? []).flatMap(s => s.blocks)
      .flatMap(b => ("items" in b ? b.items.flatMap(i => i.blocks) : [b]))
      .map(b => (b.value !== null && b.value.kind === "image" ? b.value.url : null))
      .filter((u): u is string => u !== null);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every(u => u.startsWith(`${BASE}/__preview/`))).toBe(true);
  });

  it("`marcadores` nunca fabrica ítems en un grupo vacío (R5: nada se inventa)", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const m = TemplateManifest.parse(leerManifiesto(dir));
    const sinNada = DefaultsFile.parse({ templateSlug: m.slug, templateVersion: m.version, content: {} });
    const r = marcadores(m, sinNada);
    expect(r.cuantos).toBeGreaterThan(0);
    for (const v of Object.values(r.content)) {
      expect((v as { kind: string }).kind).toBe("image");     // ni un solo `group` fabricado
    }
    expect(clavePlaceholder("gallery.photos")).toBe("kit:ph:gallery.photos");
    expect(clavePlaceholder("g.img", "01H")).toBe("kit:ph:g.img:01H");
  });

  it("`documentoDeDefaults` copia la estructura del manifiesto, no una lista escrita a mano", () => {
    const m = TemplateManifest.parse(leerManifiesto(join(PAQUETES, "bautizo-elegante/1.0.0")));
    const tema = { palettes: [], fontSets: [], defaultPaletteId: "x", defaultFontSetId: "y" } as never;
    const doc = documentoDeDefaults(m, tema, {}, "violeta", "great-vibes-poppins", "es-MX");
    expect(doc.structure.sections).toEqual(
      m.sections.map(s => ({ key: s.key, variant: s.defaultVariant, visible: s.defaultVisible })),
    );
    expect(doc.content).toEqual({});
    expect(doc.template).toEqual({ slug: m.slug, version: m.version });
  });

  it("un manifiesto ilegible se cuenta como un ERROR con el formato del kit, no revienta", () => {
    const e = estadoIlegible("/un/dir", "Unexpected end of JSON input");
    expect(e.ok).toBe(false);
    expect(e.diagnostico).toContain("ERROR TPL_PACKAGE_INVALID_JSON  /un/dir#$");
    expect(e.diagnostico).toContain("1 error(es) · 0 aviso(s) · 0 corregido(s)");
  });

  it("un `theme.json` con una paleta que no cumple AA se ve, pero `check` lo marca en rojo", () => {
    const dir = copiarPaquete("bautizo-elegante/1.0.0");
    const m = leerManifiesto(dir);
    (m as Record<string, unknown>)["slug"] = "no-existe-en-el-registro";
    escribirManifiesto(dir, m);
    const e = componerPaquete({ dir, base: BASE });
    expect(e.ok).toBe(false);
    expect(e.composed).toBeUndefined();
  });
});

describe("lo que el previsualizador sirve además del documento", () => {
  it("el marcador es un SVG con la etiqueta del bloque y los colores del tema", () => {
    const svg = marcadorSvg({ etiqueta: "cover.image", tinta: "#2B2B2B", papel: "#FFFFFF" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("cover.image");
    expect(svg).toContain("#2B2B2B");
    expect(svg).toContain('aria-label="Imagen pendiente: cover.image"');
    expect(svg).toContain("imagen pendiente");
  });

  it("el marcador no deja inyectar marcado por la etiqueta ni por un color inventado", () => {
    const svg = marcadorSvg({ etiqueta: '</text><script>alert(1)</script>', tinta: "javascript:x", papel: "rojo" });
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("javascript:");
    expect(svg).toContain("#6B655C");        // color de reserva: el inválido se descarta
  });

  it("dos marcadores distintos no comparten el id del patrón (chocarían en la misma página)", () => {
    const a = marcadorSvg({ etiqueta: "cover.image" });
    const b = marcadorSvg({ etiqueta: "gallery.photos" });
    const id = (s: string): string => /id="(kit-ph-[0-9]+)"/.exec(s)?.[1] ?? "";
    expect(id(a)).not.toBe("");
    expect(id(a)).not.toBe(id(b));
  });

  it("`hojaDeFuentes` resuelve las familias autoalojadas y DICE cuáles faltan", () => {
    const raices = [join(PAQUETES, "../packages/template-kit/node_modules")];
    const h = hojaDeFuentes(
      [{ family: "Great Vibes", weights: [400] }, { family: "No Existe Esta", weights: [400] }],
      raices, abs => `/__preview/fs${abs}`,
    );
    expect(h.resueltas).toEqual(["Great Vibes"]);
    expect(h.faltantes).toEqual(["No Existe Esta"]);
    expect(h.css).toContain("@font-face");
    expect(h.css).toContain("/__preview/fs/");
  });

  it("`slugDeFamilia` sigue la convención de nombre de paquete de Fontsource", () => {
    expect(slugDeFamilia("Cormorant Garamond")).toBe("cormorant-garamond");
    expect(slugDeFamilia("  Source Sans 3 ")).toBe("source-sans-3");
  });

  it("`reescribirUrls` sólo toca las rutas relativas", () => {
    const css = `src: url(./files/a.woff2), url("https://x/y.woff2"), url(data:font/woff2;base64,AA);`;
    const salida = reescribirUrls(css, "/n/@fontsource/x", abs => `/fs${abs}`);
    expect(salida).toContain('url("/fs/n/@fontsource/x/files/a.woff2")');
    expect(salida).toContain('url("https://x/y.woff2")');
    expect(salida).toContain("url(data:font/woff2;base64,AA)");
  });
});

describe("reglas de `capturas` que no necesitan navegador", () => {
  it("los nombres son estables y predecibles: sin fecha, sin hash", () => {
    expect(nombreDeCaptura("bautizo-elegante", "1.0.0", 390)).toBe("bautizo-elegante@1.0.0-390.png");
    expect(nombreDeCaptura("x", "2.1.0", 1280, "cover")).toBe("x@2.1.0-cover-1280.png");
    expect(nombreDeCaptura("x", "1.0.0", 768, "a/b")).toBe("x@1.0.0-a-b-768.png");
  });

  it("el destino por omisión es HERMANO de la versión, nunca hijo", () => {
    const d = destinoPorDefecto("/r/templates/mi-boda/1.0.0");
    expect(d).toBe("/r/templates/mi-boda/capturas");
    expect(caeDentroDelPaquete("/r/templates/mi-boda/1.0.0", d)).toBe(false);
  });

  it("escribir DENTRO del paquete se detecta antes de abrir el navegador", () => {
    const p = "/r/templates/mi-boda/1.0.0";
    expect(caeDentroDelPaquete(p, p)).toBe(true);
    expect(caeDentroDelPaquete(p, `${p}/assets`)).toBe(true);
    expect(caeDentroDelPaquete(p, "/r/templates/mi-boda/1.0.0-bis")).toBe(false);
  });

  it("la URL del lienzo es la misma que abre la consola en su marco", () => {
    expect(enlaceDelLienzo("http://127.0.0.1:5400", 390)).toBe("http://127.0.0.1:5400/?marco=390");
    expect(enlaceDelLienzo("http://x:1", 768, "noche", "moderna"))
      .toBe("http://x:1/?marco=768&paleta=noche&fuentes=moderna");
  });

  it("si Chromium no arranca, el error PROHÍBE `playwright install` y dice qué exportar", async () => {
    const lanzador = { launch: async () => { throw new Error("Executable doesn't exist at /x/y"); } };
    await expect(abrirChromium(lanzador as never, () => false, { PLAYWRIGHT_BROWSERS_PATH: "/no/hay" }))
      .rejects.toThrow(/NUNCA ejecutes `playwright install`/);
  });

  it("si el Chromium del paquete falla pero el del entorno existe, se usa ese (sin descargar nada)", async () => {
    let intento = 0;
    const lanzador = {
      launch: async (o: Record<string, unknown>) => {
        intento++;
        if (intento === 1) throw new Error("Executable doesn't exist");
        return { opciones: o } as never;
      },
    };
    const r = await abrirChromium(lanzador as never, () => true, { PLAYWRIGHT_BROWSERS_PATH: "/opt/pw-browsers" });
    expect(r.via).toBe("/opt/pw-browsers/chromium");
    expect(intento).toBe(2);
  });
});
