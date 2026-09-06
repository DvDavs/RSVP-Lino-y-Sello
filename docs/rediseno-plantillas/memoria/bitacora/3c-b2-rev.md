# 3c-b2-rev — revisión Opus de coherencia y accesibilidad del bloque 2
Árbol principal, rama `claude/fase-3c-identidad-visual-wqg0d2`, sin commit. Galería servida en 3141
(`PW_DESIGN_PORT`), servidor muerto por PID al terminar.
## Cifras
- Partida (orquestador): proyecto `design` **233 passed, 15 failed**. Llegada: **279 passed, 0
  failed**, DOS pasadas seguidas sin `--update-snapshots` (`verify-A/B.log`, 1,8 min cada una).
  279 = 233 + las 15 recuperadas + 31 del gate nuevo. 124 capturas (62 a 390 + 62 a 1440).
- Monorepo verde: `test` 10/10 tareas (tokens 55 · icons 179 · schema 527 · sections 653 · ui 654 ·
  web 388) · `typecheck` 10/10 · `lint` 6/6 · `build` 5/5.
- Reglas duras: hex fuera de pruebas en `packages/ui/src` **0** · `--inv-` **0** · emojis por code
  point en `packages/{ui,icons,tokens}` y `app/(chrome)/design` **0** (solo `→` tipográfica) ·
  fuentes genéricas solo como último recurso tras las caras `*-Fallback`, como fijó el bloque 1.
## Causas raíz
1. **Tailwind no miraba `packages/ui`** (descubre clases por el árbol y nunca `node_modules`, por
   donde entran los paquetes del monorepo; faltaba `@source`). Medido sobre el CSS construido:
   **28 de 51** utilidades `*-ui-*` del paquete no se generaban (`text-ui-on-accent`,
   `bg-ui-danger-soft`, `bg-ui-success`, `ring-ui-surface`…) y los componentes salían a medio pintar
   en silencio. Con el `@source` faltan **0**; compuerta
   `test/utilidades-del-paquete-ui.test.ts` (sabotaje comprobado: sin `@source`, cae).
2. **Familia `accent` secuestrada** por la capa de compatibilidad (fondo `primary` + tinta
   `on-accent`): **2,57 claro / 1,75 oscuro** en el botón «Acento». Migrada la familia vieja del
   chrome a los nombres `primary` con valor idéntico (63 sustituciones, 20 ficheros, cero píxel de
   cambio) y borradas las 7 entradas del puente; la pareja mide ahora 7,6. **ADR-3C-B2REV-01**
   (propuesta). Borrada también la línea muerta del puente de `galeria.module.css`.
3. **Historias de superposición**: un `Dialog`/`Sheet`/`Select` abierto marca el resto de la página
   `aria-hidden` (axe «aria-hidden-focus» y «landmark-one-main»), le pone `pointer-events: none` (de
   ahí los 30 s esperando el botón «Oscuro») y se posiciona `fixed` contra la ventana.
   `Dialog`/`Sheet` reciben `modal`/`container`/`onOpenAutoFocus` (API de Radix, con pruebas) y se
   exponen en `EscaparateSuperposicion` (`historias/escaparate.tsx`). `Select` no tiene escape
   (`disableOutsidePointerEvents: true` y `hideOthers` incondicionales, verificado en
   `node_modules`): su panel es una maqueta estática con `CLASES_PANEL_SELECT`/`CLASES_OPCION_SELECT`
   /`ALTO_OPCION_SELECT`, y `Select.test.tsx` obliga al panel real a llevarlas. Cómo se escribe una
   historia así: enmienda en `handoffs/3c-b2-f3.md`.
## Compuertas nuevas (medir, no mirar)
`e2e/design-objetivos.spec.ts` (31 páginas): objetivo interactivo ≥ 24×24 px real
(`getBoundingClientRect`, con la excepción «en línea» de 2.5.8) y foco visible tabulando de verdad
(`outline`/`box-shadow` distintos de los de reposo); axe no cubre ninguna. `design.spec.ts`, antes
de cada captura: nada se sale de su ficha (ignorando geometría dentro de `<svg>` y lo recortado a
propósito por un ancestro) y ningún panel queda recortado por su vitrina. Sabotaje del contraste
re-ejecutado (`*{--ui-ink:#fdf9f7;--ui-on-accent:#d79700}`): caen 22 de 44 en `button · light`.
## Defectos de coherencia corregidos
1. `Button` «Tamaños» desbordaba la ficha por los dos lados a 1440 → la fila envuelve.
2. **Grid blowout** de la ficha: con la columna implícita `auto`, `max-w-full` se medía contra la
   columna ya desbordada (Skeleton «Texto · 3 líneas» y la lista de `Tabs` se salían pese a
   `max-w-full`/`overflow-x-auto`) → `grid-cols-[minmax(0,1fr)]`.
3. `Breadcrumb` se partía en tres renglones con las barras desalineadas → una línea con puntos
   suspensivos en los tramos intermedios (el actual nunca se recorta) y `py-1`, porque el enlace
   medía 20,3 px de alto (2.5.8 pide 24; un tramo de ruta no es un enlace «en línea»).
4. `Select`: el motivo de la opción deshabilitada se partía y se superponía al nombre → nombre
   `truncate`, motivo `shrink-0`.
5. `WizardProgress`: `max-w-[76px]` era solo un techo y con cuatro pasos en 300 px las etiquetas
   chocaban («EVENTOPLANTILLADATOSEDITOR») → `w-full` + `break-words`.
6. Pies de `Dialog`/`Sheet`: marcado a mano, uno con la voz `label` (mono, de cintillo) en una
   acción → `Button` del sistema. Y `Variante.ancho: "completo"` (tipo nuevo) para Dialog, Sheet,
   Breadcrumb y WizardProgress, que en 300 px enseñaban lo que el producto nunca enseña.
7. `/design/formas`: pulgar del deslizador 20 px y pista 22 (2.5.8 pide 24) → 24 y 28; su sombra era
   el literal `rgb(41 32 24 / .3)` → `var(--ui-shadow-1)`.
## Lo que queda para el orquestador
- `Toast` y `Tooltip` no se exponen en su estado visible (solo los disparadores): misma familia de
  problema que el `Select`; la solución buena es una vitrina en `<iframe>` (patrón Storybook).
  `packages/ui/src/componentes/Toast/Toast.historias.tsx:18`, `Tooltip/Tooltip.historias.tsx:14`.
- El chrome viejo no tiene e2e ejecutable aquí (necesita backend): la garantía de que la migración
  de `accent` no mueve un píxel es la equivalencia literal de valores + build/typecheck/lint/388
  pruebas de `web`; conviene una pasada visual del editor cuando haya backend.
  `apps/web/components/ui/*` (shadcn viejo) sigue sin rediseñar: es del bloque 3.
