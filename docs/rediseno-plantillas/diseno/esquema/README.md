# Esquema de referencia — MOVIDO

Los 10 archivos `.ts` (Zod 4.5.4) que vivían en esta carpeta se **movieron** en la fase 2 (sub-agente
2-0a) a su ubicación definitiva del monorepo `frontend/`, tal como preveía la nota original de este
README ("en la fase 3 se copian tal cual a `frontend/packages/schema/src/`" — se adelantó a la fase 2
porque el paquete `@invitaciones/schema` es un cimiento del backend nuevo, no solo del editor).

- Los 9 archivos de esquema y superficie pública: `frontend/packages/schema/src/`
  (`common.ts`, `blocks.ts`, `manifest.ts`, `document.ts`, `operations.ts`, `composed.ts`,
  `invariants.ts`, `compose.ts`, `index.ts`).
- El emisor de JSON Schema: `frontend/packages/schema/scripts/emit-json-schema.ts` (con sus imports
  reescritos de `./manifest.ts` a `../src/manifest.ts`, etc. — es el único cambio de contenido; la
  lógica no se tocó).

Esta carpeta se conserva solo como referencia histórica de diseño (contexto de las decisiones ADR-1R-D-*
citadas en `../01-dominio-y-esquema.md` y en `../06-pruebas-y-calidad.md`). **No** es la fuente de verdad:
para desarrollo, pruebas y emisión del JSON Schema usa siempre `frontend/packages/schema/`.

Detalle de la migración, comandos de verificación y estado de las pruebas:
`docs/rediseno-plantillas/memoria/bitacora/2-0a.md` y `docs/rediseno-plantillas/memoria/handoffs/2-0a.md`.
