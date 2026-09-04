# Handoff — 1-dominio → 1-persistencia, 1-api, 1-frontend, 1-migracion, 1-ia, verificadores adversariales

Entregable: `diseno/01-dominio-y-esquema.md` + `diseno/esquema/*.ts` + `diseno/ejemplos/{boda-clasica-1.0.0,xv-jardin-1.0.0}/*.json`. ADR-001…008, 020, 021 en `memoria/decisiones.md` (estado propuesta).

## Lo que los demás roles DEBEN reutilizar tal cual (no rediseñar)
- **Nombres**: capas `template`/`theme`/`structure`/`content`; documento = `InvitationDocument{schemaVersion, template, theme, structure, content, attic, meta}`; salida de composición = `ComposedDocument{composedVersion, template, locale, theme, sections[]}` + `CompositionReport`.
- **Catálogo cerrado**: 12 tipos de sección (`01 §3.1`), 14 tipos de bloque (`01 §3.2`), roles (`01 §3.3`). No inventar tipos nuevos sin ADR.
- **`blockId`/`sectionKey`/`assetId`/`itemId`**: patrones exactos en `esquema/common.ts` (ADR-020, ADR-021). `itemId` = ULID generado por el SERVIDOR, nunca por el cliente (relevante para 1-api §"addItem").
- **Reglas de composición R1–R9** (`01 §5.2`, ADR-007): 1-api las invoca en el editor (cada `GET`) y las congela una vez en publicar; 1-migracion las usa para verificar régresión visual; 1-ia solo puede producir `Operation`s que, tras aplicarse, sigan siendo válidas contra estas reglas.
- **`Operation`/`OperationBatch`/`EditProposal`** (`esquema/operations.ts`): el reductor único que 1-api expone por HTTP y 1-frontend consume en el cliente; 1-ia produce `EditProposal` con el mismo tipo `Operation`.

## Decisiones que otros roles deben citar, no repetir
- ADR-004/005: Zod 4 fuente única, `.refine()` prohibido, invariantes duplicadas Kotlin+TS con tabla de casos común — 1-pruebas diseña esa prueba de contrato citando estos IDs.
- ADR-008: registro de plantilla por `packageHash` idempotente — 1-persistencia lo traduce a DDL/índices exactos.
- ADR-021: `assetId` opaco, nunca URL en el documento — 1-api resuelve la URL solo en la respuesta compuesta, nunca la persiste en `tpl_document.doc`.

## Pendiente para otros roles (no lo resolví yo)
- Nombres exactos de tabla/columna Postgres: los until ahora usados en `01` (`tpl_template_version.manifest`, `tpl_document.doc`, `tpl_release.composed`) son de referencia; 1-persistencia los formaliza en DDL — deben coincidir exactamente (ya los usé consistentemente, no los cambies sin ADR nueva).
- Rutas HTTP exactas: 1-api las define; `01` solo asume que existen "cargar", "operaciones", "publicar", "render público".
- `formatDate`/`formatId`: catálogo cerrado de `formatId` ("long", "h12", "long-h12", "month-year") usado en los ejemplos — 1-frontend implementa el formateador real; el catálogo de ids es cerrado, ampliar por ADR.

## Lo que no pude determinar
Ver `01 §9` (contenido real de plantillas 11/12/14/16/17, no reproducible desde el repo) y `bitacora/1-dominio.md` (limitaciones de esta revisión).
