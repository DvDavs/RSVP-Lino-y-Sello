// packages/sections/test/schema-values.ts — los cinco esquemas Zod de `@invitaciones/schema` como
// VALOR, para construir fixtures VALIDADAS con `.parse()` en vez de un `as ComposedSection` a ciegas
// (handoffs/3-2a.md §5).
//
// Vive en `test/` y NO en `src/` a propósito (bloque 3-3b, defecto D2). Mientras el re-export estaba
// en `src/schema-types.ts`, cualquier import de `@invitaciones/sections` arrastraba el grafo entero
// de Zod al navegador: 87,8 KB gz en la primera carga de `/i/[publicToken]`, el 38 % de un
// presupuesto de 150 KB, en una ruta pública que no valida nada. `@invitaciones/schema` construye
// sus esquemas al cargarse y su `package.json` no declara `sideEffects: false`, así que ningún
// empaquetador puede eliminarlo por análisis: la única forma segura de que no viaje es que `src/**`
// no lo importe como valor NUNCA — lo que afirma `test/lint-guards.test.ts`.
//
// Zod sigue disponible en tiempo de EJECUCIÓN para las pruebas: es este módulo el que lo carga.
export {
  ComposedBlock as ComposedBlockSchema,
  ComposedGroup as ComposedGroupSchema,
  ComposedSection as ComposedSectionSchema,
  ResolvedTheme as ResolvedThemeSchema,
  ResolvedValue as ResolvedValueSchema,
} from "@invitaciones/schema";
