# 3c-6 → orquestador y quien siga · asistente de creación de `/editor` (fase 3-C, bloque 3)

Worktree `/home/user/wt-3c/b3-6`, rama `wt/b3-6` (desde `e8cc8ac`). **Sin commits.** El encargo del
brief está **terminado**; «parcial» es el nombre que pidió el coordinador, no el estado.

## 1. TERMINADO y verificado (cifras literales)

- `pnpm --filter web run typecheck` → **0 errores**. `pnpm --filter web run lint` → **0 errores, 1
  aviso preexistente y ajeno** (`e2e/flujo-principal.spec.ts:94` `campoFoto` sin usar).
- `pnpm exec vitest run --coverage` en `apps/web` → **60 ficheros, 473 pruebas, 473 en verde**
  (antes de este trabajo: 52/388). Cobertura global 76,55 % sentencias · 68,33 % ramas · 74,40 %
  funciones · 80,25 % líneas (umbrales 60/50/65/60). Del asistente: **8 ficheros, 85 pruebas**.
- e2e contra backend REAL (:6106) y `next start` (:3106), servidor levantado por el propio
  Playwright: **32 pruebas, 32 en verde** sobre `asistente`, `a11y`, `a11y-pantallas-nuevas`,
  `clienta-sin-sesion`, `flujo-principal`, `deshacer`, `secciones`, `paneles`, `imagenes`,
  `cambiar-fecha`, `conflicto`, `red-cortada`, `editor-nucleo`, `publicar`.
- `next build` en verde (38 páginas). `/editor`: **326,4 KB gz** de primera carga (**311,8 KB**
  antes de este trabajo, +14,6 KB), límite del editor 600 KB. `/i/[publicToken]` sigue en 145,6 KB.
- Capturas a 390 y 1440 (14 PNG) en `evidencia/fase-3c/bloque-3/3c-6/`: los cuatro pasos, la
  tarjeta bloqueada por plan, el catálogo vacío para un tipo y la redirección sin sesión.

## 2. Qué se entrega

**Ruta `/editor`** = asistente de 4 pasos con el estado en la URL (`?paso=evento|plantilla|datos|
listo`, `?tipo=<EventKind>`, `?inv=<id>`, `?plantilla=<slug>`): así funcionan «atrás» del navegador,
recarga a media faena y los círculos ya hechos del `WizardProgress` como enlaces.

- `app/(chrome)/editor/page.tsx` — armazón: `EncabezadoSitio` + `<Suspense>` (obligatorio por
  `useSearchParams`). `loading.tsx` (esqueletos) y `error.tsx` (`EmptyState` `error-generico`).
- `components/asistente/` (nuevo, **API pública**):
  - `AsistenteDeCreacion.tsx` — orquestador (sin props).
  - `PasoTipoEvento.tsx` `{seleccionado, alSeleccionar, conteo, tipoDeLaInvitacion, idTitulo}` —
    grupo de radios ARIA con tabulación itinerante; 8 tarjetas con icono propio y `Image`
    placeholder (`data-imagen-pendiente="asistente/tipo-*"`).
  - `PasoPlantilla.tsx` `{items, plan, filtros, alCambiarFiltros, alElegir, ocupada, elegida,
    alElegirOtroTipo}`; `PasoDatos.tsx`; `PasoListo.tsx`; `MisInvitaciones.tsx` (+ `fechaLegible`).
  - Lógica pura: `tipos-de-evento.ts` (`TIPOS_DE_EVENTO`, `eventKindDeNombre`, `esEventKind`,
    `nombreDeTipo`), `catalogo.ts` (`nivelDePlan`, `entraEnElPlan`, `conteoPorTipo`,
    `capacidadesDisponibles`, `filtrarPlantillas`, `SIN_FILTROS`), `datos-basicos.ts`
    (`camposDeDatosBasicos`, `operacionesDeDatos`, `esFechaIso`, `esHoraIso`),
    `invitaciones.ts` (`cargarInvitaciones`, `invitacionObjetivo`, `sinPlantilla`).
- **i18n**: nueva rama `es_MX.asistente.*` (pasos, evento, plantilla, datos, listo,
  sinInvitaciones, sesión) y cinco claves añadidas a `es_MX.editor.catalogo.*` (`sinFecha`,
  `sinAcceso`, `numero`, `unaConPlantilla`, `todasConPlantilla`). Ninguna clave existente se borró
  ni se cambió: `editor.catalogo.titulo` sigue viva porque la usa `editor/[invitationId]/page.tsx`.
- **`lib/api-client.ts` NO se tocó**: `getCatalog(query)` ya aceptaba `eventKind` (`CatalogQuery`);
  lo que faltaba era mandarlo. UX-N-02 se cierra en el paso 2 con `getCatalog({ eventKind })`.

## 3. Decisiones que otro agente debe conocer

1. **Sin sesión, `/editor` redirige** a `/acceso?volver=%2Feditor` (`04 §7.1` paso 1). Por eso
   cambian dos specs ajenas, ya adaptadas y en verde: `e2e/a11y.spec.ts:16` y
   `e2e/clienta-sin-sesion.spec.ts` (pasos 1-4: ahora entra por `/acceso`, pulsa «Continuar con
   Boda» → «Usar esta plantilla» → «Lo lleno después» → «Abrir mi invitación»).
2. `e2e/preparar.ts`: `invitacionSinDocumento(templateId = TEMPLATE_BODA_PREMIUM)` (antes fijo a 5)
   + constantes `TEMPLATE_BODA_BASICO=4`, `TEMPLATE_BODA_PREMIUM=5`, `TEMPLATE_QUINCE_PREMIUM=6`.
   Compatible hacia atrás. `vitest.config.ts` suma `components/asistente/**` a la cobertura.
3. **Filtros por estilo/color: no se ofrecen.** El catálogo (`03 §3.1`) no publica ningún metadato
   de estilo ni color; los chips filtran por lo que SÍ existe: plan y las cinco `Capability` del
   manifiesto. Inventar etiquetas de estilo habría sido presentación en el frontend sobre datos
   inexistentes (anotado en `preguntas-abiertas.md § Fase 3-C · 3C-6`).
4. **Paso 3 deriva sus campos por ROL** del documento compuesto (`celebrantA`/`celebrantB`, si no
   `honoree`, si no `coverTitle`; `eventPlace` también dentro del primer ítem de grupo). Escribe con
   `POST …/document/operations` y la fecha con `PUT …/event` (I-06). Ningún campo es obligatorio.
5. Deuda conocida, no bloqueante: a 390 px «Mis invitaciones» queda por encima de la rejilla de
   tipos, así que el objetivo del paso 1 cae bajo el pliegue; `scripts/check-budget.mjs` no vigila
   `/editor` (medido a mano, ver §1); `playwright.config.ts` no excluye `design*.spec.ts`, así que
   la suite principal las corre y crea capturas `*-chromium-linux.png` espurias (se limpiaron).

## 4. Cómo verificar (comandos exactos)

```
cd /home/user/wt-3c/b3-6
TPL_DEV_PORT=6106 TPL_DEV_DB=invitaciones_3c6 TPL_TEST_STATE_DIR=/tmp/pg-3c6 \
  TPL_DEV_PIDFILE=/tmp/3c6.pid TPL_DEV_FRONTEND_URL=http://127.0.0.1:3106 scripts/dev-backend.sh start
TPL_DEV_BASE=http://127.0.0.1:6106 TPL_DEV_PORT=6106 TPL_DEV_DB=invitaciones_3c6 \
  TPL_TEST_STATE_DIR=/tmp/pg-3c6 TPL_DEV_PIDFILE=/tmp/3c6.pid scripts/seed-demo.sh
cd frontend && pnpm --filter web run typecheck && pnpm --filter web run lint
cd apps/web && pnpm exec vitest run --coverage
# e2e: NO levantes tú el servidor. `NEXT_PUBLIC_E2E_HOOKS` se inyecta en el BUILD y solo el
# webServer de Playwright lo pone; con un `next start` a mano fallan 11 specs del editor.
PW_PORT=3106 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6106 NEXT_PUBLIC_CDN_ORIGIN=http://127.0.0.1:6106 \
  TPL_DEV_DB=invitaciones_3c6 TPL_TEST_STATE_DIR=/tmp/pg-3c6 pnpm exec playwright test e2e/asistente.spec.ts …
cd /home/user/wt-3c/b3-6 && TPL_DEV_PORT=6106 TPL_DEV_DB=invitaciones_3c6 \
  TPL_TEST_STATE_DIR=/tmp/pg-3c6 TPL_DEV_PIDFILE=/tmp/3c6.pid scripts/dev-backend.sh stop
```

`flujo-principal.spec.ts` y `clienta-sin-sesion.spec.ts` REESCRIBEN `evidencia/fase-3/**` en cada
corrida; en esta rama esos PNG se revirtieron a propósito (`git checkout -- …/evidencia/fase-3`).
