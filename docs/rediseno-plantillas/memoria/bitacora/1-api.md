# Bitácora — 1-api (fase 1)

## Qué hice
Diseñé `diseno/03-api.md`: 11 rutas (edición/publicación/render público) con contratos de request/response, tabla de 13 códigos de error tipados `TPL_*`, reglas de preflight de publicación (mata H-03 en la vía de publicación: bloquea publicar bloques `required` que siguen en contenido de demo), caché del render público por `ETag`=`contentHash`, y el diseño de `public_token` (opaco, estable, en `tpl_document`, nunca `invitationId`) para que el enlace público nunca exponga ni acepte un id interno (mata H-13 también en esta capa). Ajusté `02-persistencia-y-catalogo.md` (columna `public_token`, corregí una longitud de `VARCHAR` mal calculada en el primer borrador de esa columna). Registré ADR-013…016.

## Evidencia
`handoffs/0-resumen-auditoria-api.md` (H-13,14,39,40,44,45,46,48,52); `handoffs/1-aura-lecciones.md` (lección 3: publicación como artefactos precompilados).

## Decisión no trivial
Operaciones humanas (`OperationBatch`) son todo-o-nada; solo el pipeline de IA (07) descarta operación por operación. Lo dejé explícito en `03 §3.3` para que 1-ia y el verificador adversarial no asuman que ambos caminos comparten esa semántica.

## Qué no pude hacer / limitaciones
No definí el contrato HTTP de "editar con IA" (rutas, streaming) — corresponde a `07-extension-ia.md`, que es un contrato de aplicación de operaciones, no de transporte; dejé una nota de que la superficie HTTP de IA queda reservada y sin diseñar en esta fase (P: "diseña el contrato, no lo implementes").

## Riesgos / preguntas abiertas
Cuota de assets por invitación (200, supuesto conservador) y validación de `minPlanTier` en `:choose-template` (supuesto: sí se valida) — ambos en `preguntas-abiertas.md`.

## Archivos tocados
`diseno/03-api.md`, `diseno/02-persistencia-y-catalogo.md` (edición), `memoria/decisiones.md` (ADR-013…016), este archivo.
