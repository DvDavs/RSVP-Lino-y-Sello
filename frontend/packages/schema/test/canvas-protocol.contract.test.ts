// packages/schema/test/canvas-protocol.contract.test.ts
// Contrato del protocolo `postMessage` v1 (`04 §9`, ADR-1R-F-03). Un caso POSITIVO y uno NEGATIVO por
// cada uno de los 16 mensajes (8 por sentido), más el escenario U-15 de `04 §20.1`.
//
// El protocolo NO se reexporta desde `index.ts` (`04 §3`): se importa por su ruta, igual que hará la
// app a través del entrypoint `@invitaciones/schema/canvas`.
import { describe, expect, it } from "vitest";
import {
  BlockRef,
  CANVAS_NONCE_LENGTH,
  CANVAS_PROTOCOL_TAG,
  CANVAS_PROTOCOL_VERSION,
  CanvasInbound,
  CanvasOutbound,
  classifyInbound,
  classifyOutbound,
  configureZodForCanvas,
} from "../src/canvas-protocol.ts";
import { CANVAS_ZOD_JITLESS } from "../src/canvas-runtime.ts";
import type { ComposedDocument } from "../src/composed.ts";
import { loadJson } from "./golden.ts";

const composed = loadJson<ComposedDocument>("templates/boda-clasica-1.0.0/compuesto.json");
const nonce = "a".repeat(CANVAS_NONCE_LENGTH);
const ref = { sectionKey: "cover", blockId: "cover.title" };
const sobre = (seq = 0) => ({ p: CANVAS_PROTOCOL_TAG, v: CANVAS_PROTOCOL_VERSION, seq });

/** [mensaje, caso válido, caso inválido, por qué es inválido] */
const INBOUND: [string, unknown, unknown, string][] = [
  [
    "HELLO",
    { ...sobre(), t: "HELLO", nonce },
    { ...sobre(), t: "HELLO", nonce: "corto" },
    "nonce de longitud distinta de 32",
  ],
  [
    "RENDER",
    { ...sobre(1), t: "RENDER", composed, revision: 7 },
    { ...sobre(1), t: "RENDER", composed, revision: 1.5 },
    "revision no entera",
  ],
  [
    "PATCH",
    {
      ...sobre(2),
      t: "PATCH",
      entries: [{ ref, value: { kind: "text", value: "Camila & Antonio" }, provenance: "user", pending: true }],
    },
    { ...sobre(2), t: "PATCH", entries: [] },
    "entries vacío (min 1)",
  ],
  [
    "SELECT_BLOCK",
    { ...sobre(3), t: "SELECT_BLOCK", ref: null },
    { ...sobre(3), t: "SELECT_BLOCK", ref: { sectionKey: "cover" } },
    "BlockRef sin blockId",
  ],
  [
    "SCROLL_TO_SECTION",
    { ...sobre(4), t: "SCROLL_TO_SECTION", sectionKey: "gallery" },
    { ...sobre(4), t: "SCROLL_TO_SECTION", sectionKey: "" },
    "sectionKey vacía",
  ],
  [
    "SET_VIEWPORT",
    { ...sobre(5), t: "SET_VIEWPORT", width: "mobile" },
    { ...sobre(5), t: "SET_VIEWPORT", width: "tablet" },
    "viewport fuera del enum",
  ],
  [
    "PREVIEW_THEME",
    { ...sobre(6), t: "PREVIEW_THEME", paletteId: "olive", fontSetId: null },
    { ...sobre(6), t: "PREVIEW_THEME", paletteId: "Olive", fontSetId: null },
    "Ident con mayúscula",
  ],
  [
    "PING",
    { ...sobre(7), t: "PING", id: "p-1" },
    { ...sobre(7), t: "PING" },
    "PING sin id (espera respuesta)",
  ],
];

const OUTBOUND: [string, unknown, unknown, string][] = [
  [
    "READY",
    { ...sobre(), t: "READY", protocolVersion: 1, buildId: "dev", nonce },
    { ...sobre(), t: "READY", protocolVersion: 2, buildId: "dev", nonce },
    "protocolVersion distinta de 1",
  ],
  [
    "BLOCK_CLICKED",
    { ...sobre(1), t: "BLOCK_CLICKED", ref },
    { ...sobre(1), t: "BLOCK_CLICKED", ref: { ...ref, itemId: "no-es-ulid" } },
    "itemId que no es ULID",
  ],
  [
    "SECTION_IN_VIEW",
    { ...sobre(2), t: "SECTION_IN_VIEW", sectionKey: "event" },
    { ...sobre(2), t: "SECTION_IN_VIEW", sectionKey: "event", extra: 1 },
    "clave desconocida (strictObject)",
  ],
  [
    "CANVAS_RESIZED",
    { ...sobre(3), t: "CANVAS_RESIZED", height: 4210 },
    { ...sobre(3), t: "CANVAS_RESIZED", height: -1 },
    "alto negativo",
  ],
  [
    "KEY_COMMAND",
    { ...sobre(4), t: "KEY_COMMAND", command: "undo" },
    { ...sobre(4), t: "KEY_COMMAND", command: "paste" },
    "comando fuera del enum",
  ],
  [
    "RENDER_ERROR",
    { ...sobre(5), t: "RENDER_ERROR", sectionKey: "gallery", message: "boom", digest: "d1" },
    { ...sobre(5), t: "RENDER_ERROR", message: "x".repeat(501) },
    "message de más de 500 caracteres",
  ],
  [
    "RENDER_WARNING",
    { ...sobre(6), t: "RENDER_WARNING", code: "missing-font", detail: "Playfair" },
    { ...sobre(6), t: "RENDER_WARNING", code: "font-missing", detail: "Playfair" },
    "código fuera del enum",
  ],
  [
    "PONG",
    { ...sobre(7), t: "PONG", replyTo: "p-1" },
    { ...sobre(7), t: "PONG" },
    "PONG sin replyTo",
  ],
];

describe("canvas-protocol · §9.3 padre → lienzo (8 mensajes)", () => {
  it("la unión discrimina exactamente los 8 tipos del catálogo", () => {
    expect(INBOUND.map(([t]) => t)).toEqual([
      "HELLO", "RENDER", "PATCH", "SELECT_BLOCK", "SCROLL_TO_SECTION", "SET_VIEWPORT", "PREVIEW_THEME", "PING",
    ]);
    expect(CanvasInbound.options).toHaveLength(8);
  });

  for (const [t, valido, invalido, motivo] of INBOUND) {
    it(`${t}: caso positivo valida`, () => {
      const r = CanvasInbound.safeParse(valido);
      expect(r.success, `${t} debería validar: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      if (r.success) expect(r.data.t).toBe(t);
    });
    it(`${t}: caso negativo se rechaza — ${motivo}`, () => {
      expect(CanvasInbound.safeParse(invalido).success).toBe(false);
    });
  }
});

describe("canvas-protocol · §9.4 lienzo → padre (8 mensajes)", () => {
  it("la unión discrimina exactamente los 8 tipos del catálogo", () => {
    expect(OUTBOUND.map(([t]) => t)).toEqual([
      "READY", "BLOCK_CLICKED", "SECTION_IN_VIEW", "CANVAS_RESIZED", "KEY_COMMAND", "RENDER_ERROR",
      "RENDER_WARNING", "PONG",
    ]);
    expect(CanvasOutbound.options).toHaveLength(8);
  });

  for (const [t, valido, invalido, motivo] of OUTBOUND) {
    it(`${t}: caso positivo valida`, () => {
      const r = CanvasOutbound.safeParse(valido);
      expect(r.success, `${t} debería validar: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      if (r.success) expect(r.data.t).toBe(t);
    });
    it(`${t}: caso negativo se rechaza — ${motivo}`, () => {
      expect(CanvasOutbound.safeParse(invalido).success).toBe(false);
    });
  }
});

describe("canvas-protocol · BlockRef", () => {
  it("acepta la forma de bloque de ítem (grupo)", () => {
    expect(
      BlockRef.safeParse({
        sectionKey: "gallery",
        blockId: "gallery.photos",
        itemId: "01J8BH3BJCF42DMY0PXDDDK8KE",
        itemBlockId: "photo.image",
      }).success,
    ).toBe(true);
  });
  it("rechaza claves desconocidas", () => {
    expect(BlockRef.safeParse({ ...ref, sectionType: "cover" }).success).toBe(false);
  });
});

describe("canvas-protocol · §9.5 clasificación (P1: nada se descarta en silencio)", () => {
  it("U-15 — un mensaje con v:2 falla el safeParse y el puente pasa a «incompatible»", () => {
    const v2 = { p: CANVAS_PROTOCOL_TAG, v: 2, seq: 0, t: "READY", protocolVersion: 2, buildId: "b", nonce };
    // 1) el esquema v1 lo rechaza…
    expect(CanvasOutbound.safeParse(v2).success).toBe(false);
    // 2) …y el clasificador NO lo confunde con ruido: dice exactamente por qué.
    const verdicto = classifyOutbound(v2);
    expect(verdicto.status).toBe("incompatible");
    if (verdicto.status === "incompatible") expect(verdicto.version).toBe(2);
  });

  it("un mensaje del protocolo v1 válido se clasifica «ok» en los dos sentidos", () => {
    const i = classifyInbound({ ...sobre(), t: "HELLO", nonce });
    expect(i.status).toBe("ok");
    if (i.status === "ok") expect(i.message.t).toBe("HELLO");
    const o = classifyOutbound({ ...sobre(), t: "READY", protocolVersion: 1, buildId: "b", nonce });
    expect(o.status).toBe("ok");
    if (o.status === "ok") expect(o.message.t).toBe("READY");
  });

  it("el ruido sin la marca `inv-canvas` se clasifica «foreign», no «invalid»", () => {
    for (const ruido of [null, undefined, 42, "hola", {}, { type: "webpackHotUpdate" }, { p: "otro", v: 1 }]) {
      expect(classifyInbound(ruido).status, JSON.stringify(ruido)).toBe("foreign");
      expect(classifyOutbound(ruido).status, JSON.stringify(ruido)).toBe("foreign");
    }
  });

  it("marca y versión correctas pero mensaje mal formado → «invalid» con el error de Zod", () => {
    const v = classifyInbound({ ...sobre(), t: "SET_VIEWPORT", width: "tablet" });
    expect(v.status).toBe("invalid");
    if (v.status === "invalid") expect(v.error.issues.length).toBeGreaterThan(0);
    const o = classifyOutbound({ ...sobre(), t: "CANVAS_RESIZED", height: -1 });
    expect(o.status).toBe("invalid");
    if (o.status === "invalid") expect(o.error.issues.length).toBeGreaterThan(0);
  });

  it("un tipo `t` que no existe en el catálogo se rechaza como «invalid»", () => {
    expect(classifyInbound({ ...sobre(), t: "EVAL" }).status).toBe("invalid");
    expect(classifyOutbound({ ...sobre(), t: "EVAL" }).status).toBe("invalid");
  });

  it("un mensaje del sentido contrario NO se acepta (los catálogos son disjuntos)", () => {
    expect(classifyInbound({ ...sobre(), t: "READY", protocolVersion: 1, buildId: "b", nonce }).status).toBe("invalid");
    expect(classifyOutbound({ ...sobre(), t: "HELLO", nonce }).status).toBe("invalid");
  });
});

describe("canvas-protocol · configureZodForCanvas (A4 de la compuerta)", () => {
  it("canvas-runtime se evalúa como dependencia del protocolo", () => {
    expect(CANVAS_ZOD_JITLESS).toBe(true);
  });

  it("`jitless` ya está puesto por el solo hecho de importar el protocolo (orden de imports)", async () => {
    const { z } = await import("zod");
    // `canvas-runtime.ts` es la primera dependencia de `canvas-protocol.ts`: se evalúa antes de que
    // `common.ts`/`composed.ts` construyan un esquema, que es cuando Zod haría la sonda `Function("")`.
    expect(z.config().jitless, "importar el protocolo debe dejar Zod en modo jitless").toBe(true);
    configureZodForCanvas(); // idempotente
    expect(z.config().jitless).toBe(true);
    // Sin JIT el contrato no cambia: mismo veredicto para el mismo mensaje.
    expect(classifyInbound({ ...sobre(), t: "HELLO", nonce }).status).toBe("ok");
    expect(classifyInbound({ ...sobre(), t: "HELLO", nonce: "x" }).status).toBe("invalid");
  });
});

describe("canvas-protocol · ADR-005 y §3: el archivo no contamina el contrato con Kotlin", () => {
  it("no usa .refine/.superRefine/.transform", async () => {
    const fuente = await import("node:fs").then(fs =>
      fs.readFileSync(new URL("../src/canvas-protocol.ts", import.meta.url), "utf8"),
    );
    expect(fuente).not.toMatch(/\.(refine|superRefine|transform)\s*\(/);
  });

  it("index.ts NO reexporta canvas-protocol y emit-json-schema.ts no lo importa", async () => {
    const fs = await import("node:fs");
    const index = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const emisor = fs.readFileSync(new URL("../scripts/emit-json-schema.ts", import.meta.url), "utf8");
    expect(index).not.toMatch(/canvas-protocol|canvas-runtime/);
    expect(emisor).not.toMatch(/canvas-protocol|canvas-runtime/);
  });

  it("package.json expone el entrypoint separado `./canvas`", async () => {
    const fs = await import("node:fs");
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.exports["./canvas"]).toBeDefined();
    expect(JSON.stringify(pkg.exports["./canvas"])).toMatch(/canvas-protocol\.ts/);
  });
});
