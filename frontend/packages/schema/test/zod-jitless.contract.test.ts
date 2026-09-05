// packages/schema/test/zod-jitless.contract.test.ts — H-ADV-03.
//
// El criterio **A4** de la compuerta A1-A8 (ADR-1R-F-02, contrato §8) exige CERO
// `securitypolicyviolation` en el documento del lienzo. La única que aparecía era la sonda
// `new Function("")` con que Zod decide si puede compilar validadores rápidos: bajo la CSP del
// lienzo (`script-src` sin `'unsafe-eval'`) el navegador la bloquea y emite el evento.
//
// ADR-3-0b-02 lo resolvió poniendo `z.config({ jitless: true })` en `canvas-runtime.ts` y haciendo
// que `canvas-protocol.ts` lo importe el primero. Eso basta en el spike aislado y **no** en
// `apps/web`: Turbopack funde `common.ts` con el chunk de Zod y lo evalúa al cargarlo, ANTES de que
// corra el cuerpo de `canvas-protocol.ts` — así que `LocalizedText`, el primer `z.object` del
// paquete, se construía con `jitless` sin poner y disparaba la sonda (medido con una pila de
// llamadas real en Chromium: `Module.object → new ZodObject → get value → new Function`).
//
// El arreglo es de ORDEN: `common.ts` —la raíz del grafo de este paquete: todo lo demás lo
// importa— importa `./canvas-runtime.ts` como su primera dependencia. Esta prueba fija ese
// invariante SIN pasar por `canvas-protocol.ts`: importa sólo el índice público del paquete, que es
// lo que carga cualquier consumidor. Sin el import en `common.ts`, `z.config().jitless` sale
// `undefined` y la prueba falla.
//
// Vive en su propio fichero A PROPÓSITO: vitest aísla el registro de módulos por fichero, así que
// aquí no hay ningún `import` de `canvas-protocol.ts` que pudiera poner `jitless` por la puerta de
// atrás y dejar la prueba vacua.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LocalizedText, BlockId } from "../src/index.ts";

describe("A4 · Zod queda en `jitless` por el solo hecho de cargar @invitaciones/schema", () => {
  it("importar el índice del paquete deja `jitless` puesto", () => {
    expect(
      z.config().jitless,
      "sin esto, el primer z.object() del paquete dispara `new Function()` y la CSP del lienzo " +
        "registra un securitypolicyviolation de script-src/eval (H-ADV-03)",
    ).toBe(true);
  });

  it("los esquemas del paquete se comportan igual sin la ruta JIT", () => {
    expect(LocalizedText.safeParse({ "es-MX": "Hola" }).success).toBe(true);
    expect(LocalizedText.safeParse({ "en-US": "Hi" }).success).toBe(false);
    expect(BlockId.safeParse("cover.title").success).toBe(true);
    expect(BlockId.safeParse("Cover.Title").success).toBe(false);
  });
});
