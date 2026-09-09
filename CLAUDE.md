# Guía del repositorio para Claude Code

Producto SaaS de invitaciones digitales con RSVP. Backend Kotlin/Spring (`src/`), frontend TypeScript en `frontend/` (monorepo pnpm: `packages/schema`, `packages/sections`, `apps/web`, y los paquetes de UI/tokens/iconos del sistema de diseño).

## Antes de tocar nada
- Memoria del rediseño (manda): `docs/rediseno-plantillas/memoria/` → `contratos.md` (contratos vigentes), `00-INDICE.md` (estado de fase), `decisiones.md` (ADR), `preguntas-abiertas.md`, `issues-*.md`.
- Prompts por fase: `docs/rediseno-plantillas/prompts/`. Diseño: `docs/rediseno-plantillas/diseno/`.
- Reglas comunes de todo sub-agente: `docs/rediseno-plantillas/memoria/brief-comun.md`.

## Identidad visual y UX (frontend)
Antes de crear o modificar componentes, pantallas, iconos, paleta, tipografía, formularios, flujos o textos de interfaz, carga la skill `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`) y lee `docs/rediseno-plantillas/diseno/10-identidad-visual.md`. Reglas que nunca se rompen: sin emojis en la interfaz; sin tipografía ni controles genéricos; color solo desde tokens con parejas AA; fotos con máscara o forma; chrome del producto separado de los tokens de las plantillas de invitación.
Para el trabajo mecánico de cada encargo, además: `ui-componente`, `ui-pantalla`, `ui-formulario`, `ui-flujo-asistente`, `ui-icono`, `pruebas-producto` (todas en `.claude/skills/`).

## Reglas de ingeniería
- Módulo nuevo: `modules/templates2` (backend) y `frontend/`. No tocar el módulo antiguo (`modules/user/invitations`, `modules/master/templates`, `MongoDataInitializer`), RSVP, invitados, auth ni pagos salvo autorización explícita registrada como ADR.
- Cero presentación en el backend. Esquema Zod en `frontend/packages/schema` es la fuente; Kotlin es el espejo.
- Sin pruebas en verde con salida real no hay integración. Golden files se generan, nunca se escriben a mano.
- Entorno remoto: sin Docker; Postgres efímero con `scripts/pg-ephemeral.sh`; JDK 21; Chromium preinstalado (no `playwright install`); el proxy bloquea Google Fonts y bancos de imágenes (fuentes por npm/Fontsource).
- Los sub-agentes no pueden lanzar sub-agentes: el orquestador raíz lanza todos.
- Presupuesto de contexto por agente: **máximo ~300k tokens**. Los encargos se parten para que quepan; un agente que se acerque al límite (o que lleve más de ~2/3 de un encargo grande) escribe un handoff parcial en `memoria/handoffs/<fase>-<ID>-parcial.md` (terminado, a medias con fichero:línea, pendiente, cómo verificar) y termina; el orquestador lanza un agente nuevo que continúa desde ese handoff. Nunca se reanuda un agente con el contexto lleno.
