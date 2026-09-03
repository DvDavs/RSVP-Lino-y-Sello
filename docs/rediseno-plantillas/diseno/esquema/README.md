# Esquema de referencia (fase 1)

Archivos `.ts` (Zod 4.5.4) que en la fase 3 se copian tal cual a `frontend/packages/schema/src/` (y `emit-json-schema.ts` a `frontend/packages/schema/scripts/`). Aún no hay proyecto: se validaron en esta fase ejecutándolos con `node --experimental-strip-types` contra los ejemplos de `../ejemplos/` (ver `memoria/bitacora/1-dominio.md`).

| Archivo | Contenido |
|---|---|
| `common.ts` | primitivas: `BlockId`, `SectionKey`, `Semver`, `Ulid`, `AssetId`, `Locale`, `EventKind`, fechas ISO, `HttpUrl` |
| `blocks.ts` | 14 tipos de bloque (valor + spec), catálogo de roles, campos de negocio |
| `manifest.ts` | `TemplateManifest` (template.json), `ThemeSpec` (theme.json), `DefaultsFile` (defaults.json), `MigrationPlan` |
| `document.ts` | `InvitationDocument` (capas 2-4 + attic) |
| `operations.ts` | 10 operaciones del reductor único, `OperationBatch` (autoguardado), `EditProposal` (IA) |
| `composed.ts` | `BusinessSnapshot`, `AssetIndex`, `ComposedDocument`, `CompositionReport` |
| `invariants.ts` | 21 invariantes I-01…I-21 que JSON Schema no expresa; se duplican en Kotlin con tabla de casos común |
| `emit-json-schema.ts` | genera `json-schema/*.schema.json` (draft 2020-12) para el validador Kotlin |

Regla: prohibido `.refine()`/`.superRefine()`/`.transform()` en cualquier esquema exportado (se descartan en silencio al emitir JSON Schema).
