# Contratos vigentes

Solo el orquestador edita este archivo, a partir de ADR aceptadas.

## 1. Rama y organización del repositorio
- Rama de trabajo: `claude/agent-network-invitation-41nx5y`.
- Backend nuevo: paquete propio dentro de `src/main/kotlin/mx/evolutiondev/invitaciones/modules/` (nombre a fijar por ADR en fase 1). No se toca el módulo antiguo ni RSVP/invitados/auth/pagos.
- Frontend nuevo: carpeta `frontend/` en la raíz del repositorio (monorepo TypeScript), salvo ADR que diga lo contrario.
- Memoria: `docs/rediseno-plantillas/memoria/`.

## 2. Stack por defecto (sección 7 del prompt maestro; cambiable solo por ADR)
Monorepo TypeScript (pnpm) · Next.js App Router + React + Tailwind · Zod como fuente única de esquema → JSON Schema para Kotlin · editor a medida · Zustand + Immer (+ undo) · react-hook-form + Zod · dnd-kit · shadcn/ui · PostgreSQL con JSONB (sin Mongo en el módulo nuevo) · documento de 4 capas (paquete de plantilla → theme → structure → content) · semver estricto · InvitationRelease inmutable · sin colaboración en tiempo real · contrato de IA como operaciones estructuradas.

## 3. Esquema de plantilla y documento
(pendiente: fase 1)

## 4. API del editor y del render público
(pendiente: fase 1)

## 5. Persistencia
(pendiente: fase 1)

## 6. Pruebas y umbrales
(pendiente: fase 1)

## 7. Entorno de ejecución de esta sesión (verificado por el orquestador)
- Java 21, Node 22.22, pnpm 10.33, npm 10.9. Chromium preinstalado para Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; no ejecutar `playwright install`).
- **Docker no disponible** (daemon apagado): Testcontainers no funciona. PostgreSQL 16 está instalado localmente (`/usr/lib/postgresql/16/bin/initdb`, `pg_ctl`); las pruebas de integración deben poder arrancar un clúster local o usar H2 en modo Postgres solo cuando no dependan de JSONB.
- Sin acceso a `gh`; GitHub solo vía herramientas MCP del orquestador raíz.
