# Invitaciones digitales con RSVP

SaaS de invitaciones digitales: el cliente compra un plan, elige una plantilla, la personaliza en un
editor y sus invitados abren un enlace público con RSVP. Backend Kotlin 1.9 + Spring Boot 3.4
(Gradle KTS, Postgres con Flyway) en `src/`; frontend TypeScript en `frontend/` (monorepo pnpm:
`packages/schema`, `packages/sections`, `apps/web` y el sistema de diseño `tokens`/`ui`/`icons`).

[![templates2-ci](https://github.com/DvDavs/RSVP---Lino-Sello/actions/workflows/ci.yml/badge.svg?branch=claude/ci-github-actions-jobs-9qyd9z)](https://github.com/DvDavs/RSVP---Lino-Sello/actions/workflows/ci.yml)

## Levantarlo en local

```bash
scripts/dev-backend.sh start && scripts/seed-demo.sh   # backend :6003 + Postgres efímero + siembra
cd frontend && pnpm install --frozen-lockfile
NEXT_PUBLIC_E2E_HOOKS=1 pnpm run build && PORT=3000 pnpm --filter web run start
```

`seed-demo.sh` imprime al final el enlace público de la invitación de demostración. Requisitos: JDK 21,
Node 22.22+, pnpm 10.33, PostgreSQL 16 (no hace falta Docker: `scripts/pg-ephemeral.sh` levanta un
clúster efímero). Detalles y trampas conocidas en
[`docs/rediseno-plantillas/memoria/handoffs/3c-para-siguiente.md`](docs/rediseno-plantillas/memoria/handoffs/3c-para-siguiente.md).

## Guías

- Guía del repositorio para trabajar en él: [`CLAUDE.md`](CLAUDE.md)
- Contratos vigentes y estado del rediseño: [`docs/rediseno-plantillas/memoria/`](docs/rediseno-plantillas/memoria/)
- Diseño por áreas (pruebas, rendimiento, sistema de diseño): [`docs/rediseno-plantillas/diseno/`](docs/rediseno-plantillas/diseno/)
- Identidad visual y reglas de UI: [`docs/rediseno-plantillas/guias/identidad-visual.md`](docs/rediseno-plantillas/guias/identidad-visual.md)

## CI

`.github/workflows/ci.yml` corre cuatro jobs en paralelo: `backend` (JDK 21 + Postgres 16, `check`
con JaCoCo), `frontend` (deriva del JSON Schema y de los golden files, lint, tipos y Vitest con
cobertura), `e2e` (Playwright contra el backend real, sembrado con `scripts/seed-demo.sh`, más LHCI)
y `design` (regresión visual, contraste y axe de la galería `/design`). Lo que hubo que corregir para
que el runner de GitHub se comportara como el entorno local está en
[`memoria/handoffs/ci-github.md`](docs/rediseno-plantillas/memoria/handoffs/ci-github.md).
