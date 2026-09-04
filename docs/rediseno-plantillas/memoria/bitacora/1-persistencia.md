# Bitácora — 1-persistencia (fase 1)

## Qué hice
Diseñé `diseno/02-persistencia-y-catalogo.md`: 7 tablas nuevas (`tpl_template`, `tpl_template_version`, `tpl_asset`, `tpl_document`, `tpl_document_snapshot`, `tpl_release`, `tpl_template_registration`) + 1 columna en `invitation` (`uses_templates2`), como migraciones Flyway `V29`–`V36` (continúan desde `V28`, `handoffs/0-inventario.md` §3). Diseñé el algoritmo de registro idempotente por `packageHash` (ADR-008) como transacción única con tabla de auditoría append-only, y el job de retención de snapshots (ADR-011). Registré ADR-009…012 en `decisiones.md`.

## Evidencia
`handoffs/0-resumen-auditoria-persistencia.md` (H-04,05,07,08,09,15,16,17,21,22,23,36,37,41,42,53); `01-dominio-y-esquema.md` para los nombres de capa que las columnas `JSONB` deben portar (`manifest`, `theme`, `defaults`, `doc`, `composed`).

## Qué no pude hacer / limitaciones
No ejecuté el DDL contra un Postgres real en esta sesión (sin JDK/gradle operativo para correr una prueba de integración en esta fase de diseño, ver `contratos.md` §7); la validación de estas migraciones en un clúster real es tarea de fase 2 (`06-pruebas-y-calidad.md` §6 diseña cómo). Revisión mental línea por línea del DDL contra la sintaxis de Postgres 13/16 (tipos, `CHECK`, índices parciales `WHERE is_active`), sin ejecutarlo.

## Riesgos
Tamaño de `manifest`/`composed` en producción no verificable desde este repo (registrado en `preguntas-abiertas.md`). El `CHECK` de `tpl_asset` (exactamente una FK no nula) asume que nunca se necesitará un asset "genérico" sin dueño — si el kit de autor de fase 4 necesita assets compartidos entre plantillas, esta restricción exige una ADR nueva.

## Archivos tocados
`diseno/02-persistencia-y-catalogo.md`, `memoria/decisiones.md` (ADR-009…012), este archivo.
