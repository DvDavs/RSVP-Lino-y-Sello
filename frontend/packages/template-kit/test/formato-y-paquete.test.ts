// test/formato-y-paquete.test.ts — el formato de los mensajes (contrato) y la lectura del paquete.
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  contar, formatearHallazgo, formatearHallazgos, ordenar, puntero, resumen, type Hallazgo,
} from "../src/formato.ts";
import {
  CONTENT_TYPES, PATRON_ASSET, leerJson, medirAssets, packageHash, recorrer, serializar, sha256,
} from "../src/paquete.ts";
import { hashDelPaquete } from "../src/check.ts";
import { PAQUETES } from "./ayuda.ts";

const H = (severidad: Hallazgo["severidad"], codigo: string, p: string): Hallazgo =>
  ({ severidad, codigo, puntero: p, problema: "Problema.", sugerencia: "Arréglalo." });

describe("formato: tres líneas, siempre las mismas", () => {
  it("un hallazgo son exactamente tres líneas", () => {
    expect(formatearHallazgo(H("ERROR", "TPL_X", "template.json#/a/0"))).toBe(
      "ERROR TPL_X  template.json#/a/0\n  Problema.\n  Sugerencia: Arréglalo.",
    );
  });

  it("el puntero es RFC 6901 y escapa `/` y `~`", () => {
    expect(puntero("template.json")).toBe("template.json#$");
    expect(puntero("template.json", "sections", 2, "blocks", 0, "role"))
      .toBe("template.json#/sections/2/blocks/0/role");
    expect(puntero("defaults.json", "content", "cover.title"))
      .toBe("defaults.json#/content/cover.title");
    expect(puntero("x.json", "a/b", "c~d")).toBe("x.json#/a~1b/c~0d");
  });

  it("los hallazgos se ordenan por severidad y luego por puntero", () => {
    const hs = [H("CORREGIDO", "C", "b"), H("AVISO", "B", "z"), H("ERROR", "A", "m"), H("ERROR", "A", "a")];
    expect(ordenar(hs).map(h => `${h.severidad}:${h.puntero}`))
      .toEqual(["ERROR:a", "ERROR:m", "AVISO:z", "CORREGIDO:b"]);
  });

  it("el recuento y el resumen dicen lo mismo", () => {
    const hs = [H("ERROR", "A", "a"), H("AVISO", "B", "b"), H("CORREGIDO", "C", "c"), H("ERROR", "D", "d")];
    expect(contar(hs)).toEqual({ errores: 2, avisos: 1, corregidos: 1 });
    expect(resumen(hs)).toBe("2 error(es) · 1 aviso(s) · 1 corregido(s)");
    expect(formatearHallazgos(hs).split("\n\n")).toHaveLength(4);
  });
});

describe("paquete: el `package_hash` es el de 01 §2.1, no una cuarta fórmula", () => {
  // Los tres valores publicados en `memoria/handoffs/4-0a.md §4`, calculados por
  // `frontend/templates/scripts/build-packages.mjs` y confirmados byte a byte por el backend.
  const PUBLICADOS: ReadonlyArray<[string, string]> = [
    ["xv-jardin/1.0.0", "sha256:d805fc53656b58b7a29650b5aecfa75e24e14d6d51479dfe8690ad14f442b5ee"],
    ["boda-clasica/1.0.0", "sha256:02a9a294e889ac04e89d30d559cfee07886d1cde27823aa46f6e7962085d1a96"],
    ["boda-clasica/1.0.1", "sha256:1d99bac4608383204cf3f586edab9240da05c33210b7504bc59c6b40c118cca2"],
  ];
  for (const [relativo, esperado] of PUBLICADOS) {
    it(`${relativo} → ${esperado.slice(0, 22)}…`, () => {
      const dir = join(PAQUETES, relativo);
      const rutas = recorrer(dir).filter(e => !e.esDirectorio).map(e => e.ruta);
      expect(hashDelPaquete(dir, rutas)).toBe(esperado);
    });
  }

  it("un `.json` reformateado NO cambia el hash (se canonicaliza) y un byte de asset SÍ", () => {
    const a = packageHash([{ ruta: "template.json", json: { b: 1, a: 2 } }]);
    const b = packageHash([{ ruta: "template.json", json: { a: 2, b: 1 } }]);
    expect(a).toBe(b);
    const c = packageHash([{ ruta: "assets/x.webp", bytes: Buffer.from("hola") }]);
    const d = packageHash([{ ruta: "assets/x.webp", bytes: Buffer.from("holA") }]);
    expect(c).not.toBe(d);
  });

  it("el orden de las rutas es byte a byte de su UTF-8, no del locale", () => {
    const uno = packageHash([
      { ruta: "assets/z.webp", bytes: Buffer.from("1") },
      { ruta: "assets/a.webp", bytes: Buffer.from("2") },
    ]);
    const dos = packageHash([
      { ruta: "assets/a.webp", bytes: Buffer.from("2") },
      { ruta: "assets/z.webp", bytes: Buffer.from("1") },
    ]);
    expect(uno).toBe(dos);
  });
});

describe("paquete: lectura de disco", () => {
  it("rechaza un JSON con BOM y uno con sintaxis rota, y acepta el bueno", () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-json-"));
    writeFileSync(join(dir, "bom.json"), "﻿{}", "utf8");
    writeFileSync(join(dir, "roto.json"), "{,}", "utf8");
    writeFileSync(join(dir, "bien.json"), '{"a":1}', "utf8");
    expect(leerJson(join(dir, "bom.json")).error).toMatch(/marca de orden de bytes/);
    expect(leerJson(join(dir, "roto.json")).ok).toBe(false);
    expect(leerJson(join(dir, "bien.json")).valor).toEqual({ a: 1 });
  });

  it("mide los assets con su sha256, sus bytes y su contentType", () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-assets-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "assets", "a.png"), "1234", "utf8");
    writeFileSync(join(dir, "assets", "b.raro"), "x", "utf8");
    const medidos = medirAssets(dir);
    expect(medidos).toHaveLength(2);
    expect(medidos[0]).toEqual({
      path: "assets/a.png", sha256: sha256(Buffer.from("1234")), bytes: 4, contentType: "image/png",
    });
    expect(medidos[1]!.contentType).toBeUndefined();
    expect(medirAssets(mkdtempSync(join(tmpdir(), "kit-vacio-")))).toEqual([]);
  });

  it("recorre subdirectorios y devuelve rutas con `/`", () => {
    const dir = mkdtempSync(join(tmpdir(), "kit-arbol-"));
    mkdirSync(join(dir, "migrations"));
    writeFileSync(join(dir, "migrations", "1.0.0-to-1.0.1.json"), "{}", "utf8");
    expect(recorrer(dir).map(e => e.ruta))
      .toEqual(["migrations", "migrations/1.0.0-to-1.0.1.json"]);
  });

  it("el patrón de ruta de asset rechaza subdirectorios, `..` y mayúsculas", () => {
    expect(PATRON_ASSET.test("assets/preview.webp")).toBe(true);
    expect(PATRON_ASSET.test("assets/sub/preview.webp")).toBe(false);
    expect(PATRON_ASSET.test("assets/../secreto")).toBe(false);
    expect(PATRON_ASSET.test("assets/Preview.webp")).toBe(false);
    expect(Object.keys(CONTENT_TYPES)).toContain(".webp");
  });

  it("serializa con dos espacios y salto final", () => {
    expect(serializar({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});
