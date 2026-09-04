# Resumen de auditoría para el rol "Migración" (fase 1, sub-agente 5)

Fuente completa: `docs/analisis-plantillas/ANALISIS-GENERACION-PLANTILLAS.md` §4.1 (6 vías de alta comparadas), §6.4-6.5 (costo de agregar plantilla, qué vive fuera de Git). Detalle: `fases/A-modelo-datos.md` (inventario de plantillas 4-17), `fases/J-inventario-json.md` (matriz de campos JSON↔TS), `fases/B-alta-plantillas.md`.

## Hallazgos H-xx relevantes

- **H-03**: sin datos del usuario se publican los **datos de demo** de la plantilla (nombres, historia de una pareja ficticia) — cualquier migración debe distinguir "placeholder de demo" de "dato real capturado", porque hoy son indistinguibles en el documento almacenado → informe §5.2 H-03.
- **H-06**: mesa de regalos vacía y visible cuando el usuario no capturó ninguna — un caso de migración con "sección vacía" a decidir (ocultar vs. mostrar vacía) → §5.2 H-06.
- **H-09**: el seed pisó en cada arranque las plantillas 4-10 y 13; **hay dos cohortes de invitaciones bajo el mismo `templateId` con diseños distintos posiblemente** — la migración debe verificar, por invitación, contra qué versión visual se generó, no asumir la versión actual → §5.2 H-09.
- **H-11 / H-42**: plantillas 12 y 14 solo existen como números mágicos en Kotlin, sin fila Flyway ni JSON; ids 11, 13, 16, 17 **no son reproducibles desde el repositorio** (solo en Postgres/Mongo de producción, NO DETERMINABLE su contenido exacto desde aquí) → §5.2 H-11/H-42, y §6.5 "qué vive fuera de Git".
- **H-47**: `HOTFIX_ADD_TEMPLATES_CAMBIOS.md` contradice al código en ≥7 afirmaciones — no usarlo como fuente de verdad para migrar, solo como pista → §5.2 H-47.
- **H-54**: 607/2743 líneas comentadas en el generador, 3 funciones duplicadas con reglas de precedencia **distintas** de la versión viva — al migrar la lógica de merge, usar solo el código vivo, el comentado desinforma activamente (caso: `contentTemplate.giftRegistry` solo aparece comentado) → §5.2 H-54.
- **H-59 / H-60**: 358 KB de `payload-template-*.json` sin ninguna referencia en código (posiblemente nunca ejecutados contra la API); un `.ts` que diverge de su JSON — verificar antes de tratarlos como fuente de migración → §5.2 H-59/H-60.

## Inventario de plantillas a migrar (resumen de `fases/A-modelo-datos.md`, ampliar ahí)

8 plantillas **sembradas** con id 4-10 y 13 (versionadas en Flyway + JSON en `src/main/resources/data/mongo/`); ids **11, 12, 14, 16, 17 solo existen en producción/scripts/código**, no reproducibles desde este repo (H-11, H-42, §6.5). Los 5 `data*Premium.ts` de la raíz del repositorio (bautizo/comunión/confirmación/cumpleaños/XV, ~2775-3186 líneas cada uno) son, con alta probabilidad, la exportación de una invitación real de demostración (id 82) de la que se derivaron los `default_visual_*.json` — relación **no declarada en ningún código** (informe §6.5, `fases/J-inventario-json.md` §4).

## Contrato implícito a preservar o migrar explícitamente (informe §6.1-6.2)

Toda regla de §6 de este informe (emparejamiento familia por texto/posición, `items[0]`=estilo único de galería, claves `texts` reconocidas, títulos hardcodeados, banco con ≥9 body) es **comportamiento tácito hoy**, no un esquema declarado. La migración de las 8 plantillas + invitaciones existentes debe: (1) producir golden files del JSON actual por plantilla antes de tocar nada (recomendación transversal del informe, §9.3, último punto); (2) convertir cada `invitation_configs` en `content`+`theme`+`structure` separando dato real de placeholder de demo (riesgo "Alto" según investigación de tecnologías §7 riesgo 6); (3) verificar automáticamente que el render nuevo reproduce textos e imágenes del render antiguo por invitación.

## 3 opciones de rediseño y su impacto en migración (informe §9.2, 3 líneas)

- **Opción A**: no exige migrar datos (arregla solo generación futura); las invitaciones ya generadas quedan rotas para siempre porque no hay regeneración (H-04) — es la razón por la que A es insuficiente.
- **Opción B**: exige convertir cada documento existente en un conjunto de anulaciones, **sin metadato que distinga usuario de plantilla** en los documentos actuales — riesgo de migración marcado "Alto" en el propio informe (§9.2 opción B).
- **Opción C** (**la adoptada**): exige el extractor más agresivo — separar completamente contenido de presentación por invitación — pero es el único que deja un resultado estable a largo plazo; coste 10×+, en gran parte de migración y verificación de regresión visual sobre las 8 plantillas (investigación §7 riesgo 6).
