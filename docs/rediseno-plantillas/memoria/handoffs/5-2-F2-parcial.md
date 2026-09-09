# 5-2-F2 (E2) — `e2e/invitado.spec.ts` — bitácora (TERMINADA)

## Qué pasa, con cifras
`frontend/apps/web/e2e/invitado.spec.ts` — 6 casos, los 6 del encargo. Con backend real +
Postgres efímero + `scripts/seed-demo.sh` ya corridos:

```
pnpm --filter web exec playwright test e2e/invitado.spec.ts --workers=1 --reporter=list
  6 passed (18.2s)

pnpm --filter web exec playwright test e2e/invitado.spec.ts --workers=4 --repeat-each=2 --reporter=list
  12 passed (27.4s)
```

La verificación que decide si se integra (`--workers=4 --repeat-each=2`) pasa: 12/12. Sin
aislamiento: cada test crea su propia invitación con `crearInvitacionPublicable` y la borra en un
`finally` (con un paso extra: `DELETE FROM invitation_guest` antes de `borrarInvitacion`, porque esa
tabla no tiene `ON DELETE CASCADE` hacia `invitation`).

## Qué falta
- Nada de los 6 casos por escribir; los 6 corren en verde con workers=1 y workers=4×repeat-each=2.
- Ningún defecto de producto encontrado: los 6 casos pasan contra el backend/frontend reales, sin
  ajustar nada de producción.
- Encargo completo. Queda el reporte final al orquestador (fuera de esta bitácora).

## Comandos exactos
```bash
scripts/dev-backend.sh start && scripts/seed-demo.sh
cd frontend
pnpm --filter web exec playwright test e2e/invitado.spec.ts --workers=4 --repeat-each=2
```

## Trampa de entorno encontrada (no del producto, del runner)
La primera corrida en esta sesión falló con `ERR_CONNECTION_REFUSED` en los 6 casos: el
`webServer` de Playwright (`pnpm run build && pnpm run start`) no llegó a responder dentro de la
corrida. Un `pnpm run build` manual (con caché turbo ya tibia) confirmó que el build en sí es
rápido y que `next start` sirve `/editor` y `/r/[token]` con normalidad. La segunda corrida, con la
caché de build ya caliente, pasó sin tocar nada del spec ni de la config — no parece un defecto de
`playwright.config.ts` sino una caché de build fría en la primera invocación de la sesión.
