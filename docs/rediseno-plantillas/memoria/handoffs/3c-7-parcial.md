# 3c-7 → orquestador y 3C-8 · chrome del editor y publicación (fase 3-C, bloque 3)

Worktree `/home/user/wt-3c/b3-7`, rama `wt/b3-7` desde `e8cc8ac`. **Sin commit ni push.** El fichero
se llama «parcial» por petición del coordinador; el encargo del brief está **terminado y
verificado**: nada a medias, nada que no compile. Detalle: `bitacora/3c-7.md`. ADR: `ADR-3C-7-01`.

## 1. Estado verificado (cifras re-ejecutadas al final)
- `pnpm run test` 10/10 tareas: tokens 55/55 · icons 179/179 · schema 527/527 · ui 654/654 ·
  sections 653/653 · **web 388/388** (52 ficheros). `typecheck` 10/10 · `lint` 6/6 (0 errores;
  1 aviso preexistente en `e2e/flujo-principal.spec.ts:94`) · `build` 5/5.
- **e2e con backend real (6107) y `next start` (3107): 28/28 en verde** en una pasada con los 13
  specs del brief (nucleo 4, paneles 1, secciones 2, deshacer 2, imagenes 2, publicar 3, conflicto 2,
  teclado 3, movil 4, fecha 2, paleta 1, foto 1, red 1); más `a11y` 2/2, `a11y-pantallas-nuevas` 5/5
  y el nuevo `editor-3c-evidencia` 2/2 (axe AA sin `critical`/`serious`).
- `node scripts/check-budget.mjs`: `/editor/[invitationId]` **395,8 KB gz** (límite 600).
- Grep en mi área: **0** nombres de la capa de compatibilidad, **0** `lucide-react`, **0** emojis.
  Capturas en `evidencia/fase-3c/bloque-3/3c-7/`; `evidencia/fase-3/**` revertido (no es mío).

## 2. Qué se entrega (todo el brief)
- **Barra**: nombre humano de la invitación (`tituloDe(composed)`, D-6), «← Mis invitaciones»,
  deshacer/rehacer (`Button variant="icono"` + iconos propios + `Tooltip`), `SaveIndicator`
  (`role="status"`), `ViewportToggle`, «Ver» → `/preview/{id}` y `PublishDialog`. Móvil (U-8): dos
  filas, pestañas Editar/Vista previa, 0 px de desborde a 390 y a 320 (`editor-movil.spec.ts`).
- **Secciones**: `SectionRow` con asa `IconoArrastrar`, icono por tipo (`iconos-de-seccion.ts`, mapa
  TOTAL sobre `SectionType`), `Badge` «Ejemplo» (de `report.stillDefault`) y «Siempre visible»,
  `Switch` del sistema y menú `⋮` (`MenuDeFila.tsx`). La fila entera es objetivo (ADR-3C-7-01).
- **Panel de bloque**: `RadioGroup` con `VariantDiagram` (`fill-ui-primary-soft` + `currentColor`),
  los 14 campos sobre `Input`/`Textarea`/`Combobox`/`RadioGroup`/`Switch`, contador, aviso
  «contenido de ejemplo» y `SoloLectura` con `IconoCandado`.
- **`ThemePicker`**: presets del PAQUETE de plantilla; cada muestra se pinta con `palette.tokens` y
  `fontSet.heading.family` por `style` en línea — nunca con tokens del chrome. **`PhotoManager`**:
  zona de soltar, `ProgressRing`, errores `role="alert"`, controles sobre papel opaco (`11 §3.4` R5),
  U-7 intacto. **`PublishDialog`**: `Dialog` del sistema, lista de revisión con iconos de estado,
  motivo visible junto al botón deshabilitado, `Toast` «Enlace copiado…», enlace, «Ver como
  invitado» y WhatsApp. **`ConflictDialog`**: `Dialog` con `busy` + explicación visible.
- **`lib/i18n.ts`**: `publicar.yaSeVe` sin U+2705 y ~90 claves nuevas (`editor.barra|seccion|campo|
  fotos|conflicto|avisos|estados`); cero cadenas de interfaz en el JSX de mi área.
- `components/ui/`: `dropdown-menu|progress|radio-group|switch` **borrados**. `button.tsx` queda como
  **shim traductor** (`primary|secondary|ghost` → `primario|secundario|terciario`) y `FieldShell`
  conserva `CLASES_CONTROL` `@deprecated`, porque `app/(chrome)/acceso/page.tsx` y
  `app/(chrome)/editor/page.tsx` (3C-5 / 3C-6) aún los importan. **Al migrar esas dos pantallas,
  bórrense: `grep -rn "components/ui/" apps/web` debe quedar en 0.**

## 3. Specs que cambian (para 3C-8)
`e2e/conflicto.spec.ts:96` y `e2e/teclado-editor.spec.ts:138,143,154` → `getByRole("dialog", { name:
… })` / `[role="dialog"]` (el título y el aspa los pinta el panel de `Dialog`, no el nodo con
`data-testid`) · `components/editor/editor-chrome.test.tsx:141` → `aria-checked` en vez de `.checked`
(el radio ya es Radix) · NUEVO `e2e/editor-3c-evidencia.spec.ts` (axe + capturas; excluye el
`<iframe>` del lienzo, que es `packages/sections`).

## 4. Cómo verificar
```
cd frontend && pnpm install --frozen-lockfile && pnpm run test && pnpm run typecheck && pnpm run lint && pnpm run build
export TPL_DEV_PORT=6107 TPL_DEV_DB=invitaciones_3c7 TPL_TEST_STATE_DIR=/tmp/pg-3c7 TPL_DEV_PIDFILE=/tmp/3c7.pid TPL_DEV_FRONTEND_URL=http://127.0.0.1:3107
scripts/dev-backend.sh start && TPL_DEV_BASE=http://127.0.0.1:6107 scripts/seed-demo.sh
cd frontend/apps/web && PW_PORT=3107 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6107 NEXT_PUBLIC_CDN_ORIGIN=http://127.0.0.1:6107 \
  pnpm exec playwright test --project=chromium editor-nucleo paneles secciones deshacer imagenes publicar \
  conflicto teclado-editor editor-movil cambiar-fecha paleta-preview foto-grande-avisa red-cortada editor-3c-evidencia
scripts/dev-backend.sh stop   # con las MISMAS variables
```

## 5. Deuda declarada (detalle en `preguntas-abiertas.md § Fase 3-C · 3c-7`)
`@invitaciones/ui` sin componente de menú (`MenuDeFila.tsx` es el sustituto) · `Dialog` no reenvía
`data-*` · el preset no emite utilidades de duración (se usa `duration-100/200/300`) · `<Toaster />`
montado en la página del editor hasta que 3C-5 lo suba al layout · el shim de `button.tsx` y
`CLASES_CONTROL` · `aria-hidden-focus` (serious) en `.RsvpSection-module__…__backdrop`, de
`packages/sections`.
