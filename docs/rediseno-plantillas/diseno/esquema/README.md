# Esquema de referencia (fase 1)

Archivos `.ts` (Zod 4.5.4) que en la fase 3 se copian tal cual a `frontend/packages/schema/src/`
(y `emit-json-schema.ts` a `frontend/packages/schema/scripts/`).

| Archivo | Contenido |
|---|---|
| `common.ts` | primitivas: `BlockId`, `SectionKey`, `Semver`, `Ulid`, `AssetId`, `TempId`, `Locale`, `EventKind`, fechas ISO, `HttpUrl` |
| `blocks.ts` | 14 tipos de bloque (valor + spec), catálogo de roles (`BlockRole`, `GROUP_ROLES`, `SINGLETON_ROLES`), campos de negocio |
| `manifest.ts` | `TemplateManifest` (template.json), `ThemeSpec` (theme.json), `DefaultsFile` (defaults.json), `MigrationPlan` |
| `document.ts` | `InvitationDocument` (capas 2-4 + `attic`) |
| `operations.ts` | **11** operaciones del reductor único (`clearItemBlock` añadida en la dirimición X-05), `OperationBatch` (autoguardado), `EditProposal` (IA) |
| `composed.ts` | `BusinessSnapshot`, `AssetIndex` (**entrada** de `compose`, nunca parte del `ComposedDocument`), `ComposedDocument`, `CompositionReport` |
| `invariants.ts` | **30** invariantes `I-01`…`I-30` que JSON Schema no expresa (`I-30_TEXT_MULTILINE_NOT_ALLOWED` viene de X-06; `I-31_PALETTE_CONTRAST_BELOW_AA` está **reservada**, no declarada, hasta que se acepte ADR-1R-F-06); se duplican en Kotlin con tabla de casos común |
| `compose.ts` | **implementación de referencia** de `compose()` (R1–R9), `formatDate`/`formatRange` deterministas y `canonicalJson` |
| `emit-json-schema.ts` | genera `json-schema/templates2.schema.json` (bundle con `$defs`) + 10 punteros, draft 2020-12 |
| `index.ts` | superficie pública de `@invitaciones/schema` |

## Reglas duras

- **Prohibido `.refine()` / `.superRefine()` / `.transform()` / `z.custom()` / `z.any()`** en cualquier
  esquema exportado: los tres primeros se descartan en silencio al emitir JSON Schema (ni `unrepresentable:
  "throw"` los detecta) y `z.any()` emite `{}`, que acepta cualquier cosa. Toda regla entre campos vive en
  `invariants.ts` y se implementa **dos veces** (aquí y en `templates2/schema/Invariants.kt`).
- **Prohibido `z.string().url()`**: emite `format: "uri"`, que acepta `javascript:` y `data:`. Usa `HttpUrl`.
- **`z.record` descarta la clave `"__proto__"` en silencio** (verificado con `zod@4.5.4`): por eso
  `assertNoReservedKeys` (I-29) se ejecuta sobre el JSON **crudo**, antes de `parse`.

## Cómo se verificó (ronda 1R + dirimición, 2026-09-03)

```
npx tsc --noEmit --strict          # 0 errores
npx tsx emit-json-schema.ts        # bundle + 10 punteros
# cada ejemplo de ../ejemplos/**/*.json validado contra Zod Y contra ajv 8 (2020-12 + ajv-formats)
# compose.ts reproduce byte a byte los dos compuesto.json y es idempotente
```

Tras la dirimición (X-05, X-06, X-16, `AssetIndex`) se volvió a ejecutar la batería completa: `tsc --noEmit
--strict` en 0 errores, bundle + 10 punteros reemitidos, 10/10 ejemplos válidos contra Zod y ajv, `compose`
reproduciendo ambos golden files byte a byte, y los 20 ataques cerrados.

Transcripción literal en `../../memoria/bitacora/1R-dominio.md` y en `../../memoria/bitacora/1R-dirimidor.md`. La nota anterior de este README ("se
validaron ejecutándolos con `node --experimental-strip-types`") era falsa: el paquete no compilaba
(`manifest.ts` importaba `BlockValue` del módulo equivocado).
