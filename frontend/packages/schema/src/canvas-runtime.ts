// packages/schema/src/canvas-runtime.ts — configuración de Zod para el realm del LIENZO.
//
// **Este módulo tiene un efecto de importación y debe evaluarse ANTES que cualquier esquema.**
// Por eso `canvas-protocol.ts` lo importa en su PRIMERA declaración `import`: en ESM las
// dependencias se evalúan en el orden en que aparecen, así que ponerlo el primero garantiza que
// `jitless` esté puesto antes de que `common.ts`/`composed.ts` construyan un solo `z.strictObject`.
// Si alguien reordena esos imports (un linter de orden alfabético, por ejemplo), la compuerta A4
// vuelve a fallar. No es un adorno.
//
// POR QUÉ (medido en la compuerta A1-A8 de la fase 3, bloque 3-0b; no es una suposición):
// para decidir si puede compilar validadores rápidos, Zod 4 evalúa `util.allowsEval`, que ejecuta
// `new Function("")` dentro de un `try/catch` (`zod/v4/core/util.cjs:215-231`). Esa lectura ocurre
// **al construir cada objeto** (`zod/v4/core/schemas.cjs:1126-1128`), no al validar. Bajo la CSP del
// lienzo (`script-src <host> 'nonce-…'`, sin `'unsafe-eval'`, `04 §8.4` C2) el navegador bloquea la
// llamada y emite un evento `securitypolicyviolation` con `blockedURI: "eval"` — Zod se recupera
// solo y valida igual, pero A4 exige CERO violaciones, y una CSP que informa de algo que "no pasa
// nada" es una CSP que nadie mirará. Con `jitless` puesto, Zod ni siquiera hace la sonda:
// `const fastEnabled = jit && allowsEval.value` cortocircuita.
//
// Coste: el lienzo valida sin la ruta JIT de Zod. Valida exactamente lo mismo, solo que más
// despacio; el lienzo recibe como mucho un `RENDER` por operación estructural.
import { z } from "zod";

z.config({ jitless: true });

/** Marca de que este módulo se evaluó (útil para aserciones en pruebas). */
export const CANVAS_ZOD_JITLESS = true;
