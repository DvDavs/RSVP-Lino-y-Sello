# Handoff — 1-frontend → 1-pruebas, 1-ia, verificadores adversariales

Entregable: `diseno/04-frontend-y-editor.md`. ADR-017…019 en `decisiones.md`.

## Lo que otros roles deben reutilizar
- Estructura de carpetas exacta de `frontend/` (§1) — 1-pruebas la usa para ubicar `vitest`/`playwright` configs; el kit de autor de fase 4 vive fuera de `packages/sections` (no diseñado aquí).
- Catálogo de mensajes `postMessage` (§3) — si 1-ia necesita que el chrome muestre un diff antes de aplicar una propuesta de IA, reutiliza `RENDER`/`HIGHLIGHT_BLOCK`, no inventa un canal nuevo.
- El reductor de operaciones vive en `apps/web/lib/store.ts` del lado cliente y en `templates2.api` del lado servidor — 1-ia debe usar la MISMA validación (`invariants.ts`/`Invariants.kt`), no reimplementarla.

## Pendiente
- Biblioteca de recorte de imagen (no bloquea el contrato de datos).
- Edición táctil del editor (supuesto: fuera de alcance de fase 1, desktop-first).

## Lo que no pude determinar
Ver `04 §8`.
