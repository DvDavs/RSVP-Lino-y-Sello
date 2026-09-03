# Preguntas abiertas para el dueño

Formato: `- [Fase N · agente] Pregunta. **Supuesto tomado:** …`

## Dominio y esquema
- [Fase 1 · 1-dominio] ¿Existe algún consumidor externo que dependa hoy de la forma exacta de `InvitationConfig`? No hay frontend en el repositorio para verificarlo. **Supuesto tomado:** no hay compatibilidad de formato que preservar; la compatibilidad se preserva en el *render* (mismos textos e imágenes visibles), nunca en la forma del JSON (`01 §9`).
- [Fase 1 · 1-dominio] Contenido real de las plantillas `templateId` 11, 12, 14, 16, 17 (solo en producción, no reproducibles desde el repo, H-11/H-42). **Supuesto tomado:** se tratan como cohorte aparte de migración, sin bloquear el resto del diseño (`01 §9`, `05 §7`).

## Persistencia
- [Fase 1 · 1-persistencia] Tamaño real esperado de `manifest`/`composed` en producción (catálogo de cuántas plantillas). **Supuesto tomado:** decenas, no miles — el índice GIN sobre `manifest` (`02 §2.2`) se diseñó para ese orden de magnitud (`02 §7`).
- [Fase 1 · 1-persistencia] ¿Quién puede figurar como `tpl_release.published_by` — solo el dueño de la invitación, o cualquier rol autorizado (MASTER/ADMIN publicando en su nombre)? **Supuesto tomado:** el `requesterId` autenticado que ejecuta `POST .../release`, sea o no el dueño (`02 §7`).

## API
- [Fase 1 · 1-api] ¿Hay una cuota de almacenamiento S3 por cliente/plan que la API de assets deba respetar? **Supuesto tomado:** cuota conservadora de 200 assets por invitación, ajustable sin cambiar el contrato (`03 §10`).
- [Fase 1 · 1-api] ¿Debe `:choose-template` bloquear por `minPlanTier` insuficiente, o es solo informativo en el catálogo? **Supuesto tomado:** sí bloquea, `403 TPL_PLAN_TIER_INSUFFICIENT` (`03 §10`).

## Frontend y editor
- [Fase 1 · 1-frontend] ¿El editor debe soportar edición táctil real desde el móvil del propio cliente, o solo previsualizar cómo se ve en móvil? **Supuesto tomado:** el editor es desktop-first (formularios, drag-and-drop); la vista móvil es solo un modo de visualización del lienzo (`04 §8`).
- [Fase 1 · 1-frontend] Biblioteca de recorte de imagen para "recorte básico" (objetivo 5, sección 1 del prompt maestro). **Supuesto tomado:** decisión de fase 3, no bloquea el contrato de datos (`ImageValue.focal` ya es independiente de la herramienta elegida) (`04 §8`).

## Migración
- [Fase 1 · 1-migracion] Nombres visibles exactos de los 7 `templateId` restantes (4, 6, 7, 8, 9, 10, 13) — no releídos en esta fase por economía de tokens. **Supuesto tomado:** fase 4 los obtiene directamente de `invitation_template.name` en Postgres al construir cada paquete, no bloquea el diseño del proceso (`05 §8`).
- [Fase 1 · 1-migracion] Volumen real de invitaciones con `invitation_configs` generado (sin acceso a producción desde esta sesión). **Supuesto tomado:** el diseño de corte por invitación, sin lote global (`05 §4`), es intencionalmente insensible al volumen.
- [Fase 1 · 1-migracion] Umbral para distinguir "contenido de demostración" de "dato real corto" al migrar (¿12 caracteres es el corte correcto?). **Supuesto tomado:** 12 caracteres, conservador, con cola de revisión humana para los casos ambiguos en vez de auto-clasificación (`05 §3.2`, `05 §8`).

## Pruebas
- [Fase 1 · 1-pruebas] ¿El runner de GitHub Actions de este repositorio tiene Docker disponible (habilitaría Testcontainers como alternativa)? **Supuesto tomado:** no se asume — el camino primario (`pg_ctl`/`initdb` local) funciona en cualquier caso; Testcontainers queda como alternativa condicional, no como diseño primario (`06 §8`).

## IA
- [Fase 1 · 1-ia] Proveedor de IA concreto (Vercel AI SDK es la recomendación de `contratos.md`, sin versión ni proveedor fijado). **Supuesto tomado:** decisión de la fase de implementación real, fuera de esta fase de diseño (`07 §6`).

## Orquestación de esta sesión (transversal, no de diseño)
- [Fase 1 · orquestador] Esta sesión no tuvo acceso a una herramienta de sub-agentes (Task/Agent) — el entorno solo expone `mcp__Claude_Code_Remote__create_session` (sesiones remotas completas, pensadas para paralelismo entre sesiones con su propio contenedor, no para reparto fino de tareas de diseño dentro del mismo árbol de trabajo). **Supuesto tomado:** el orquestador ejecutó los 7 roles de diseño y los 2 roles adversariales directamente, en secuencia dentro de la misma sesión, en vez de delegarlos a sub-agentes con modelos distintos como pedía el brief — documentado explícitamente en cada bitácora y en el reporte final del chat, sin ocultar la sustitución.

