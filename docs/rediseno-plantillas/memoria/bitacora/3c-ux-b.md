# 3C-UX-B — relevo: correcciones del editor y la publicación (cierre de la fase 3-C)

Continúo el trabajo de UX-B dejado sin commitear (29 ficheros, `pnpm --filter web run typecheck` en
verde, tres graves de `bitacora/3c-ux.md §4` ya implementadas: G-04, G-05, G-06). Mi encargo era
cerrar sus pruebas y verificar contra backend real.

## 1. Lo que encontré ya hecho

`coherencia-fechas.ts` (G-04), `contenido-de-ejemplo.ts` (G-05, nuevo) y `PublishDialog.tsx` (G-06,
estado «Publicada» + «Compartir» en la barra) ya estaban completos y correctos, con sus tres pruebas
unitarias en `PublishDialog.test.tsx` ya escritas (contra lo que decía el último mensaje del agente
anterior — «ahora las pruebas de G-04/05/06» —, ya estaban). También ya estaba el e2e real
(`e2e/publicar.spec.ts`, dos casos nuevos) y una invitación de evidencia sin commitear en
`docs/rediseno-plantillas/evidencia/fase-3c/cierre/ux-fix/` (4 de 8 capturas: el generador,
`e2e/publicar-evidencia-ux-b.spec.ts`, quedó a medias — no estaba en mi encargo, lo dejo tal cual).

## 2. Lo que corregí yo

1. **Revertidos los PNG ajenos** que el agente anterior había dejado modificados en
   `evidencia/fase-3c/bloque-3/3c-7/` y `evidencia/fase-3/` (`git checkout --`, dos veces: el
   e2e-núcleo los volvió a tocar en la verificación del punto 4).
2. **`SectionRow.test.tsx:47` y `SectionList.test.tsx:130`** — `screen.getByText(/siempre visible/i)`
   rompía con "Found multiple elements": la corrección M-11 del agente anterior (candado + texto
   `sr-only` bajo `sm`, insignia completa desde `sm`, `SectionRow.tsx:115-127`) deja el mismo texto
   accesible DOS veces en el DOM (solo CSS decide cuál se ve), así que `getByText` ya no era válido.
   Cambiado a `getAllByText(...).length > 0` en ambos — el comportamiento no cambió, la prueba ya no
   asume que el texto aparece una sola vez.
3. **`PublishDialog.tsx:351`, bug real, no solo de test.** Con G-04 (aviso de fechas) y G-05 (lista
   de contenido de ejemplo) a la vez, el contenido del `Dialog` supera su altura — que no tiene
   `max-height` ni `overflow` (`packages/ui/.../Dialog.tsx:88-92`, `position: fixed` centrado, sin
   límite) — y el botón «Publicar» queda fuera del viewport, **inalcanzable ni con scroll**: no era
   flakiness del e2e, cualquier clienta con una invitación con bastante contenido de ejemplo se
   habría topado con el mismo botón invisible. Corregido con el mismo patrón que ya usa
   `ConflictDialog.tsx` (`max-h-* overflow-y-auto` en el contenido, no en el `Dialog` compartido):
   `max-h-[60vh] overflow-y-auto` en el `div[data-testid=publish-dialog]`. Cabecera y pie del diálogo
   quedan fijos; solo el contenido se desplaza.

## 3. Verificación (backend propio, `TPL_DEV_PORT=6114`, `TPL_DEV_DB=invitaciones_uxb`,
   `TPL_TEST_STATE_DIR=/tmp/pg-uxb`, `PW_PORT=3114`)

- `pnpm --filter web run test`: **533/533** (65 archivos) en verde.
- `pnpm --filter web run typecheck`: limpio.
- `e2e/publicar.spec.ts` + `e2e/cambiar-fecha.spec.ts` + `e2e/editor-nucleo.spec.ts`: primer intento
  **8/11**, los 3 que fallaban eran justo los que ejercitan G-04+G-05 juntos o publican con contenido
  de ejemplo (`publicar.spec.ts:87,123,162`) — el bug del punto 2.3, no flakiness (timeout de 90 s
  intentando hacer clic en un botón fuera del viewport, 180+ reintentos). Tras el fix, **11/11** en
  ~2-5 s cada uno, dos rondas seguidas.
- Backend, clúster efímero y `next dev` parados por PID (`dev-backend.sh stop`; el `next-server` de
  Playwright ya se había cerrado solo al terminar la corrida).

## 4. Sin tocar

Todo lo que no aparece en el punto 2. La decisión de producto pendiente (P-3C-UXB-1: ¿el contenido
de ejemplo opcional debería bloquear, no solo avisar?) la dejó registrada el agente anterior en
`preguntas-abiertas.md` y la conservo tal cual — no es mía de resolver.
