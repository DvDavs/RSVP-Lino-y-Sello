# Bitácora — 1-migracion (fase 1)

## Qué hice
Diseñé `diseno/05-migracion.md`: proceso de conversión de las 8 plantillas sembradas (5 pasos, reutilizando el catálogo de `01`), extracción de `invitation_configs` existentes con golden files, criterio explícito de procedencia (demo vs. real, umbral de 12 caracteres + cola de revisión humana en vez de auto-clasificación), comparación de regresión por texto/imagen visible (no por JSON crudo), corte por invitación sin lote global (ADR-023) y plan de retiro del módulo antiguo (documentado, no ejecutado). Registré ADR-022/023.

## Corrección importante sobre el primer borrador de ADR-022
Mi primer borrador de ADR-022 decía que el golden `before` se obtenía "re-ejecutando el generador actual". Lo corregí antes de cerrar: por H-09 (el seed pisa `default_visual_*` en cada arranque), re-ejecutar hoy puede no reproducir lo que la invitación mostró realmente. El golden `before` correcto es el documento YA ALMACENADO en `invitation_configs`. Edité `decisiones.md` para reflejar esto antes de que ninguna otra ADR lo citara mal.

## Evidencia
`handoffs/0-resumen-auditoria-migracion.md` (H-03,06,09,11,42,47,54,59,60); `01-dominio-y-esquema.md` §3 (catálogo de secciones/bloques que sustenta el mapeo); `02-persistencia-y-catalogo.md` (tabla `tpl_document`, columna `uses_templates2`).

## Qué no pude hacer / limitaciones
No releí `fases/A-modelo-datos.md` completo para traer los nombres exactos de los 7 `templateId` restantes (economía de tokens del brief común; no es necesario para diseñar el PROCESO de migración, solo para ejecutarlo en fase 4). No tengo acceso a producción para estimar volumen real de invitaciones a migrar.

## Riesgos
El umbral de 12 caracteres para "candidato a placeholder" es un supuesto conservador sin verificación estadística contra datos reales (no accesibles desde este repo) — en `preguntas-abiertas.md`.

## Archivos tocados
`diseno/05-migracion.md`, `memoria/decisiones.md` (ADR-022/023, corrección de contexto), este archivo.
