# Guía del repositorio para Claude Code

Producto SaaS de invitaciones digitales con RSVP. Backend Kotlin/Spring (`src/`), frontend TypeScript en `frontend/` (monorepo pnpm: `packages/schema`, `packages/sections`, `apps/web`, y los paquetes de UI/tokens/iconos del sistema de diseño).

## Antes de tocar nada
- Memoria del rediseño (manda): `docs/rediseno-plantillas/memoria/` → `contratos.md` (contratos vigentes), `00-INDICE.md` (estado de fase), `decisiones.md` (ADR), `preguntas-abiertas.md`, `issues-*.md`.
- Prompts por fase: `docs/rediseno-plantillas/prompts/`. Diseño: `docs/rediseno-plantillas/diseno/`.
- Reglas comunes de todo sub-agente: `docs/rediseno-plantillas/memoria/brief-comun.md`.

## Identidad visual y UX (frontend)
Antes de crear o modificar componentes, pantallas, iconos, paleta, tipografía, formularios, flujos o textos de interfaz, carga la skill `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`) y lee `docs/rediseno-plantillas/diseno/10-identidad-visual.md`. Reglas que nunca se rompen: sin emojis en la interfaz; sin tipografía ni controles genéricos; color solo desde tokens con parejas AA; fotos con máscara o forma; chrome del producto separado de los tokens de las plantillas de invitación.

## Reglas de ingeniería
- Módulo nuevo: `modules/templates2` (backend) y `frontend/`. No tocar el módulo antiguo (`modules/user/invitations`, `modules/master/templates`, `MongoDataInitializer`), RSVP, invitados, auth ni pagos salvo autorización explícita registrada como ADR.
- Cero presentación en el backend. Esquema Zod en `frontend/packages/schema` es la fuente; Kotlin es el espejo.
- Sin pruebas en verde con salida real no hay integración. Golden files se generan, nunca se escriben a mano.
- Entorno remoto: sin Docker; Postgres efímero con `scripts/pg-ephemeral.sh`; JDK 21; Chromium preinstalado (no `playwright install`); el proxy bloquea Google Fonts y bancos de imágenes (fuentes por npm/Fontsource).
- Los sub-agentes no pueden lanzar sub-agentes: el orquestador raíz lanza todos.
