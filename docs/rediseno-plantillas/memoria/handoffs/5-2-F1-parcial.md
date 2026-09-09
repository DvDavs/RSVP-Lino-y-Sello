# 5-2-F1 · `e2e/invitados.spec.ts` — bitácora (TERMINADA)

**Con cifras**: los 6 `test()` (7 casos del encargo: 1 y 3 van combinados) pasan en verde:
- `--workers=1`: 6/6.
- `--workers=4 --repeat-each=2`: 12/12, dos corridas seguidas sin intermitencias.

Detalle y salida real completa en el reporte final entregado al orquestador.

**Nota de entorno para quien lea esto después**: el `webServer` que arranca `playwright test` solo
(`pnpm run build && pnpm run start`) se me cayó a media corrida sin volcar traza (conexión rehusada
en :3000) en dos intentos; arrancando `pnpm run start` a mano en segundo plano antes de
`playwright test` (con `reuseExistingServer`, que ya lo recoge) las mismas 6 pruebas corrieron
limpias dos veces seguidas. Puede ser ruido de este contenedor, no un fallo del spec — si el
orquestador ve el mismo síntoma, ese es el rodeo.

**Fichero**: `frontend/apps/web/e2e/invitados.spec.ts` (7 casos del encargo en 6 `test()`, cada uno
crea su propia invitación con `crearInvitacionPublicable(jwtDemo())` y limpia en `finally`).
Ayudante propio: `frontend/apps/web/e2e/preparar-invitados.ts` —
`borrarInvitacionConInvitados` (borra `invitation_guest` ANTES de `borrarInvitacion`: esa tabla
referencia `invitation.id` sin `ON DELETE CASCADE` y sin este paso `preparar.ts` traga el error de
FK en silencio y deja invitaciones huérfanas) y `crearInvitadoDirecto` (alta por HTTP real, para
sembrar datos de apoyo en los casos de búsqueda/filtro sin pasar por la UI).

**Qué falta**:
- Correr los casos 2, 4, 5, 6, 7 sueltos con `--workers=1`.
- Correr el fichero completo `--workers=4 --repeat-each=2` (la verificación que decide integración).
- Pegar la salida real en el reporte final.

**Comandos exactos**:
```bash
scripts/dev-backend.sh status   # ya arriba en este entorno; si no, start
cd frontend
pnpm --filter web exec playwright test e2e/invitados.spec.ts --workers=1 --reporter=line
pnpm --filter web exec playwright test e2e/invitados.spec.ts --workers=4 --repeat-each=2
```
