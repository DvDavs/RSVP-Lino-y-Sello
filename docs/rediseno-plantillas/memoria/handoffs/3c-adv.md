# 3c-adv → orquestador · revisión adversarial del cierre de la fase 3-C

Worktree `/home/user/wt-3c/adv`, rama `wt/adv` desde `1a81b7e`. Sin commit ni push. Puertos usados y
liberados: backend 6111, web 3111, LCP 3141/3142. Detalle completo: `bitacora/3c-adv.md`.

## Veredicto: **CERRABLE** una vez integrado el arreglo de A-01 (va en esta rama)

Sin ese arreglo la fase **NO** era cerrable: el producto se servía con tipografía genérica.

## Objeciones por gravedad

| # | Grav. | Qué | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| A-01 | **ALTA** | `/fonts/*.woff2` → **404** en `pnpm --filter web run build`, en el `webServer` de las dos configs de Playwright y en el job `e2e` de CI. `document.fonts`: `Fraunces\|unloaded`, `Onest\|unloaded`, `Red Hat Mono\|unloaded`; el `<h1>` se pintaba con **Georgia**. Regresión visual de la galería: **124 fallos** sin fuentes, **168 verdes** con ellas | `bitacora/3c-adv.md §1` | **ARREGLADA** + compuerta |
| A-02 | MEDIA | La compuerta de 24 px (2.5.8) solo recorría la galería. En el producto: marca **109,4 × 23,4**, enlace de salto enfocado **123,6 × 21** (su `px-4 py-2` lo anulaba `not-sr-only`), «Volver a mis invitaciones» **160,6 × 18** | `§2` | **ARREGLADA** + compuerta |
| M-01 | MEDIA | Foco invisible en la invitación pública: «Cómo llegar» con `outline: 0px` y `box-shadow: none`; cuatro enlaces con cuatro indicadores distintos | `§3.1` | **NO** (es `packages/sections`, zona prohibida) |
| M-02 | MEDIA | `e2e/util/contraste.ts` no ve capas hermanas (`Composition`): bajo el `<h1>` de `/ayuda` hay **40 colores de fondo** y mide **uno**. Hoy sin defecto (peor real **13,47** vs umbral 4,5) | `§3.2`, `§5.3` | **NO** (decisión de método, en `preguntas-abiertas.md`) |
| M-03 | MEDIA | `e2e/a11y-publico.spec.ts` flakea bajo paralelismo pese al `document.fonts.ready` de 3-6: 1 roja de 2 pasadas con `--workers=2`, 3/3 verdes en solitario | `§6` | **NO** (pregunta abierta) |
| B-01 | BAJA | `/design` a 400 % de zoom: `scrollWidth 333` vs `clientWidth 320` (13 px de barra horizontal). Las demás pantallas limpias a 200 % y 400 % | `§3.3` | **NO** |
| B-02 | BAJA | El presupuesto solo pesa JS: `/` descarga **148,2 KB gz JS + ~13 KB gz CSS + 177,2 KB de woff2** ≈ 338 KB. La voz display sola pesa 121 KB (81 % del techo de JS) | `§3.4` | **NO** |
| B-03 | BAJA | `CDN_ORIGIN` y `remotePatterns` por omisión apuntan al puerto fijo `6003`: sin exportarla en el proceso del servidor el lienzo no pinta (**5 e2e en rojo**) | `§3.5`, `§6` | **NO** |

## Lo que intenté tumbar y se sostiene

- Contraste sobre la pila renderizada: **0 por debajo de umbral** en 9 pantallas (63/21/37/4/2/113/46/71/17 elementos medidos).
- La compuerta no es vacua: saboteando `--ui-ink`, **27 / 9 / 25** elementos caen en `/`, `/acceso`, `/ayuda` (peor 1,00).
- `prefers-reduced-motion`: 1 animación viva → **0** con `reduce`. Reflow 200 % y 400 % limpio salvo B-01.
- Presupuesto idéntico a `3c-8`: `/i/[publicToken]` **142,0 KB**, `/` **148,2 KB**, `/editor/[id]` **419,3 KB**.
- LCP N=9: `/i/<token>` **mediana 2201,8 ms** (rango 2027,3–2789,3) · `/` **mediana 1845,2 ms** (rango 1747,2–2101,7). Los dos CUMPLEN. Máquina con carga 4-10 (otros dos worktrees sirviendo): son cifras pesimistas y el rango de la ruta pública es mucho más ancho que el de `3c-8`.
- N-01 y N-02 **siguen cerradas** (mismo mensaje y 200 para correo existente e inexistente; `frame-ancestors http://127.0.0.1:3111` con un build hecho sin `NEXT_PUBLIC_EDITOR_ORIGIN`).
- Chrome nuevo limpio: 0 emojis en `frontend/**`, 0 hex sueltos, 0 `--inv-*`, ningún `dangerouslySetInnerHTML` (el único de `apps/web` es el del lienzo aislado de la fase 3-B), `/design` con `noindex`. Solo se descargan las 3 fuentes del sistema; ni Inter, ni Bricolage, ni Outfit.

## Qué entrego (6 ficheros, sin commit)

- `frontend/apps/web/package.json` — `build`/`dev` copian las fuentes antes de Next (A-01).
- `frontend/apps/web/components/sitio/{MarcoSitio,CabeceraSitio}.tsx` y `app/(chrome)/(sitio)/ayuda/page.tsx` — los tres objetivos < 24 px (A-02).
- `frontend/apps/web/e2e/landing.spec.ts` — compuerta nueva: las tres voces se sirven por HTTP y el navegador las carga.
- `frontend/apps/web/e2e/a11y-producto.spec.ts` — compuerta nueva: ≥ 24 px en landing, acceso, ayuda y editor, más el enlace de salto medido con el foco puesto.
- `decisiones.md` → **ADR-3C-ADV-01** (`propuesta`) · `preguntas-abiertas.md` → sección `3c-adv` (5 supuestos) · `evidencia/fase-3c/cierre-adv/` (LCP y presupuesto literales).

## Compuertas al terminar (todas verdes)

`typecheck` 10/10 · `lint` 6/6 · `test` 10/10 (**2 585** pruebas: 527+653+179+654+55+517) · `build` 5/5 ·
`playwright --project=chromium --workers=1` **71/71** · `--config=playwright.design.config.ts` **279/279** ·
`scripts/smoke.sh` **19/19**.

## Para reproducir

```
TPL_DEV_PORT=6111 TPL_DEV_DB=invitaciones_adv TPL_TEST_STATE_DIR=/tmp/pg-adv \
  TPL_DEV_PIDFILE=/tmp/adv.pid scripts/dev-backend.sh start
TPL_DEV_BASE=http://127.0.0.1:6111 TPL_DEV_PORT=6111 TPL_DEV_DB=invitaciones_adv \
  TPL_TEST_STATE_DIR=/tmp/pg-adv scripts/seed-demo.sh        # OJO: TPL_DEV_BASE, no TPL_DEV_PORT
cd frontend/apps/web && NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6111 pnpm run build
PORT=3111 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6111 CDN_ORIGIN=http://127.0.0.1:6111 \
  NEXT_PUBLIC_EDITOR_ORIGIN=http://127.0.0.1:3111 pnpm run start   # CDN_ORIGIN aquí, no en playwright
PW_PORT=3111 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6111 TPL_DEV_DB=invitaciones_adv \
  TPL_TEST_STATE_DIR=/tmp/pg-adv pnpm exec playwright test --project=chromium --workers=1
```
