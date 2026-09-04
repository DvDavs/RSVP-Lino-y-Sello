// packages/schema/test/invariant-gaps.contract.test.ts — cada `constraints.*` declarada en
// src/blocks.ts debe tener un fichero de casos que la ejercite, en golden/invariants/ o en
// golden/blocks/ (06 §4.1, decisión X-06: "quedan 0 huecos").
//
// REESCRITO EN LA REVISIÓN 2-0a-REV (objeción O-03). La versión de 2-0a comprobaba cada restricción
// con un predicado sobre el TEXTO del fichero: tres de las seis eran `raw => raw.length > 0` (un
// fichero JSON no vacío: no puede fallar) y otras dos casaban una subcadena que aparece en el NOMBRE
// de un caso ("reductor", "focal"). Es decir: la prueba que sostiene la afirmación "0 huecos" de
// 06 §4.1 no podía ponerse en rojo. Aquí cada restricción se comprueba ejecutando el esquema o el
// validador real sobre los casos golden.
//
// ACTUALIZADO EN LA REVISIÓN 2-ADV (objeción ADV-07). Las tres restricciones de asset quedaron como
// `it.todo` mientras `operations-reducer.ts` no existía (ADR-2-0a-03), con la instrucción explícita
// de sustituirlas cuando 2-0b/2-2 lo escribieran. El reductor existe desde 2-2 y `image.maxBytes` y
// `image.aspect` ya tenían caso en `golden/operations/setBlock.cases.json`, pero los tres `todo`
// seguían ahí: la compuerta de "0 huecos" declaraba huecos que ya no lo eran y —lo grave— habría
// seguido diciendo `todo` en vez de rojo si alguien retirase esas comprobaciones del reductor.
// `audio.maxBytes` sí era un hueco real (no tenía caso golden); se le añadió uno en
// `scripts/gen-golden-operations.ts` y aquí se comprueban las tres ejecutando el reductor real.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BlockSpec } from "../src/blocks.ts";
import { Operation } from "../src/operations.ts";
import { applyOperation, type ReducerContext } from "../src/operations-reducer.ts";
import { validateValueAgainstSpec } from "../src/invariants.ts";
import { loadCases } from "./golden.ts";

type InvCase = { name: string; fn: string; spec: any; input: any; path: string; expect: string[] };
type BlockCase = { name: string; tag: string; spec: any; value: any; path: string; expectZodValid: boolean };
type OpCase = { name: string; tag: string; operation: unknown; expectZodValid: boolean; reducerResult: unknown };

/** El mismo fixture emitido que consume Kotlin (`golden/fixtures/operations-base.json`). */
function loadFixture(): any {
  const ruta = fileURLToPath(new URL("../golden/fixtures/operations-base.json", import.meta.url));
  return JSON.parse(readFileSync(ruta, "utf8"));
}

describe("invariant-gaps (06 §4.1: 0 huecos)", () => {
  it("RichTextSpec.constraints.maxLength: I-16 trae un caso richText que la viola de verdad", () => {
    const cases = loadCases<InvCase>("invariants", "I-16-text-too-long.json");
    const rich = cases.filter(c => c.spec?.type === "richText");
    expect(rich.length).toBeGreaterThan(0);
    const violador = rich.find(c => c.expect.includes("I-16_TEXT_TOO_LONG"));
    expect(violador, "ningún caso richText de I-16 viola I-16").toBeDefined();
    // Se ejecuta el validador real: el fichero no solo lo DICE, la función lo hace.
    expect(validateValueAgainstSpec(violador!.spec, violador!.input, violador!.path).map(v => v.code))
      .toContain("I-16_TEXT_TOO_LONG");
  });

  it("TextSpec.constraints.multiline: I-30 trae multiline:false que viola y multiline:true que no", () => {
    const cases = loadCases<InvCase>("invariants", "I-30-text-multiline-not-allowed.json");
    const viola = cases.find(c => c.spec?.constraints?.multiline === false && c.expect.includes("I-30_TEXT_MULTILINE_NOT_ALLOWED"));
    const noViola = cases.find(c => c.spec?.constraints?.multiline === true && c.expect.length === 0);
    expect(viola, "falta el caso multiline:false que viola I-30").toBeDefined();
    expect(noViola, "falta el caso multiline:true que no viola").toBeDefined();
    expect(validateValueAgainstSpec(viola!.spec, viola!.input, viola!.path).map(v => v.code))
      .toContain("I-30_TEXT_MULTILINE_NOT_ALLOWED");
    expect(validateValueAgainstSpec(noViola!.spec, noViola!.input, noViola!.path)).toEqual([]);
  });

  it("ChoiceSpec.options[].label no vacía: Zod la rechaza de verdad", () => {
    const spec = loadCases<BlockCase>("blocks", "choice.cases.json")[0]!.spec;
    expect(BlockSpec.safeParse(spec).success).toBe(true);
    const roto = structuredClone(spec);
    roto.options[0].label["es-MX"] = "";
    expect(BlockSpec.safeParse(roto).success).toBe(false);
  });

  it("ImageSpec/AudioSpec declaran las tres restricciones que el reductor debe verificar", () => {
    // Lo único comprobable HOY: que las restricciones siguen declaradas en los spec de los golden.
    // Si alguien las retirara del esquema, esta prueba se pone en rojo y las tres entradas `todo`
    // de abajo dejarían de tener sentido — que es exactamente el aviso que hace falta.
    const img = loadCases<BlockCase>("blocks", "image.cases.json")[0]!.spec;
    const aud = loadCases<BlockCase>("blocks", "audio.cases.json")[0]!.spec;
    expect(img.constraints).toHaveProperty("aspect");
    expect(img.constraints).toHaveProperty("maxBytes");
    expect(aud.constraints).toHaveProperty("maxBytes");
  });

  // Las tres restricciones de asset, cada una con su caso golden y ejecutando el reductor real
  // (`contratos.md §6`: "las tres restricciones de asset se prueban como casos del reductor").
  // Se distingue `image.maxBytes` de `audio.maxBytes` por el bloque, porque el `constraint` del
  // error es el mismo en las dos.
  const RESTRICCIONES: Array<{ nombre: string; blockId: string; constraint: string }> = [
    { nombre: "ImageSpec.constraints.aspect", blockId: "cover.image", constraint: "aspect" },
    { nombre: "ImageSpec.constraints.maxBytes", blockId: "cover.image", constraint: "maxBytes" },
    { nombre: "AudioSpec.constraints.maxBytes", blockId: "cover.music", constraint: "maxBytes" },
  ];

  for (const r of RESTRICCIONES) {
    it(`${r.nombre} → TPL_ASSET_SPEC_MISMATCH: hay caso golden y el reductor lo rechaza`, () => {
      const casos = loadCases<OpCase>("operations", "setBlock.cases.json");
      const caso = casos.find(
        c =>
          (c.operation as any)?.blockId === r.blockId &&
          (c.reducerResult as any)?.ok === false &&
          (c.reducerResult as any)?.error?.code === "TPL_ASSET_SPEC_MISMATCH" &&
          (c.reducerResult as any)?.error?.constraint === r.constraint,
      );
      expect(caso, `falta el caso golden de ${r.nombre}`).toBeDefined();

      // Y se vuelve a ejecutar el reductor sobre el fixture emitido: el golden no solo lo DICE.
      const base = loadFixture();
      const meta = base.assetMeta[(caso!.operation as any).value.assetId];
      expect(meta, "el assetMeta del fixture no describe el asset del caso").toBeDefined();
      const ctx: ReducerContext = {
        pkg: { manifest: base.manifest, theme: base.theme, defaults: base.defaults },
        newUlid: () => base.ulidSeed,
        assetMeta: (id: string) => base.assetMeta[id] ?? null,
      };
      const salida = applyOperation(base.documento, Operation.parse(caso!.operation), ctx);
      expect(salida.ok).toBe(false);
      expect((salida as any).error.code).toBe("TPL_ASSET_SPEC_MISMATCH");
      expect((salida as any).error.constraint).toBe(r.constraint);
    });
  }

  it("TextSpec.constraints.pattern NO existe en el esquema (retirada en X-06)", () => {
    // La constraint se retiró (dos motores de regex discrepan, P1). Se comprueba que de verdad NO
    // está: un spec de texto con `pattern` debe ser rechazado por el `strictObject` de TextSpec.
    const spec = structuredClone(loadCases<InvCase>("invariants", "I-30-text-multiline-not-allowed.json")[0]!.spec);
    expect(BlockSpec.safeParse(spec).success).toBe(true);
    spec.constraints.pattern = "^[A-Z]+$";
    expect(BlockSpec.safeParse(spec).success).toBe(false);
  });
});
