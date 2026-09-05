// packages/schema/test/zod-jitless.contract.test.ts — I-03 / H-ADV-03.
//
// El criterio **A4** de la compuerta A1-A8 (ADR-1R-F-02, `contratos.md §8`) exige CERO
// `securitypolicyviolation` en el documento del lienzo. La única que quedaba era la sonda
// `new Function("")` con que Zod decide si puede compilar validadores rápidos: bajo la CSP del
// lienzo (`script-src` sin `'unsafe-eval'`) el navegador la bloquea y emite el evento aunque Zod
// atrape el error y valide igual.
//
// ADR-3-0b-02 lo resolvió con `z.config({ jitless: true })` en `canvas-runtime.ts`, importado el
// primero por `canvas-protocol.ts`. Eso basta en el spike aislado de 3-0b y NO en `apps/web`: el
// orden de ESM es una garantía del lenguaje, no del empaquetador, y Turbopack funde `common.ts` con
// el grupo de módulos de Zod y lo evalúa al cargar ese chunk, antes de que corra el cuerpo de
// `canvas-protocol.ts` (medido sobre el bundle servido; traza en `bitacora/3b-i03.md §2`).
// `LocalizedText` se construía entonces con `jitless` sin poner y disparaba la sonda.
//
// El arreglo es de ORDEN: `common.ts` —la raíz del grafo del paquete: todo lo demás la importa—
// importa `./canvas-runtime.ts` como su primera dependencia. Esta prueba fija ese invariante SIN
// pasar por `canvas-protocol.ts`: importa solo el índice público, que es lo que carga cualquier
// consumidor.
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
        "registra un securitypolicyviolation de script-src/eval (I-03 / H-ADV-03)",
    ).toBe(true);
  });

  // ESTA es la aserción que de verdad cubre A4, y no la de arriba: comprueba el ORDEN, no la
  // bandera. `util.allowsEval` es un `cached()` de Zod (`zod/v4/core/util.js:32-44`, `:148`): mientras
  // nadie lea `.value`, la propiedad sigue siendo un GETTER; en cuanto alguien la lee, el getter se
  // sustituye por una propiedad de datos con el resultado. Y solo se lee desde
  // `zod/v4/core/schemas.js:1087` (`const fastEnabled = jit && allowsEval.value`), que cortocircuita
  // cuando `jitless` está puesto. Por tanto: si sigue siendo un getter después de construir TODOS los
  // esquemas del paquete, la sonda `new Function("")` no se ejecutó ni una vez — que es exactamente
  // lo que el navegador mide como violación. Con el `import` de `common.ts` revertido esta prueba
  // falla en Node, sin necesidad de navegador ni de CSP.
  it("la sonda `new Function(\"\")` no llegó a ejecutarse: `allowsEval` sigue sin resolver", () => {
    const descriptor = Object.getOwnPropertyDescriptor(z.util.allowsEval, "value");
    expect(
      typeof descriptor?.get,
      "`allowsEval` ya está resuelto: algún esquema se construyó ANTES de que `canvas-runtime.ts` " +
        "pusiera `jitless`, y en el navegador eso es un securitypolicyviolation de script-src/eval. " +
        `Descriptor observado: ${JSON.stringify(descriptor)}`,
    ).toBe("function");
  });

  it("los esquemas del paquete se comportan igual sin la ruta JIT", () => {
    expect(LocalizedText.safeParse({ "es-MX": "Hola" }).success).toBe(true);
    expect(LocalizedText.safeParse({ "en-US": "Hi" }).success).toBe(false);
    expect(BlockId.safeParse("cover.title").success).toBe(true);
    expect(BlockId.safeParse("Cover.Title").success).toBe(false);
  });
});
