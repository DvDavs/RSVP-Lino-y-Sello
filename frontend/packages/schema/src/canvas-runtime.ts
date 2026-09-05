// packages/schema/src/canvas-runtime.ts — configuración de Zod para el realm del LIENZO.
//
// **Este módulo tiene un efecto de importación y debe evaluarse ANTES que cualquier esquema.**
// Lo importan como PRIMERA declaración `import` DOS módulos: `canvas-protocol.ts` y —desde I-03 /
// H-ADV-03— `common.ts`. En ESM las dependencias se evalúan en el orden en que aparecen, así que
// ponerlo el primero garantiza que `jitless` esté puesto antes de que se construya un solo
// `z.object`/`z.strictObject`. Si alguien reordena esos imports (un linter de orden alfabético, por
// ejemplo), la compuerta A4 vuelve a fallar. No es un adorno.
//
// POR QUÉ TAMBIÉN EN `common.ts` Y NO SOLO EN EL PROTOCOLO (I-03, medido sobre el bundle SERVIDO de
// `apps/web`, no supuesto — bitacora/3b-i03.md §2): el orden de ESM es una garantía del lenguaje,
// no del empaquetador. Turbopack funde `common.ts` con el grupo de módulos de Zod en un mismo chunk
// y lo evalúa al cargar ese chunk, mientras que `canvas-protocol.ts` y este archivo caían en OTRO
// chunk que corría después. Traza literal de la medición, con el arreglo puesto y sin él:
//   sin arreglo:  common.ts (chunk 3g60x6shd6vqj) jitless=undefined → allowsEval YA resuelto
//                 canvas-runtime (chunk 3ewyhf6bd0f13) llega tarde  → 1 violación script-src/eval
//   con arreglo:  canvas-runtime (chunk 0rjz0aw7qoqpd) jitless=true → allowsEval SIN resolver
//                 common.ts (mismo chunk) jitless=true              → 0 violaciones
// `common.ts` es la raíz del grafo del paquete (todo lo demás lo importa), así que es el único sitio
// donde la garantía se sostiene sea cual sea el empaquetador.
//
// EFECTO COLATERAL ASUMIDO Y DECLARADO: el paquete entero —no solo el lienzo— valida sin la ruta
// JIT de Zod, porque cualquier consumidor de `@invitaciones/schema` evalúa `common.ts`. Es el precio
// de que A4 se cumpla en el producto y no solo en un spike; lo fija `test/zod-jitless.contract.test.ts`.
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
