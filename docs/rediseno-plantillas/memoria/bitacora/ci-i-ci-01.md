# Bitácora — I-CI-01: aislar la suite e2e y devolver el paralelismo al CI

Rama `claude/ci-github-actions-jobs-9qyd9z`, sobre `c4326e5`. Alcance tocado: los DOS specs citados
en el encargo (`frontend/apps/web/e2e/editor-3c-evidencia.spec.ts`, `e2e/a11y-publico.spec.ts`),
`.github/workflows/ci.yml`, `README.md` y esta memoria. **No** se tocó `preparar.ts`,
`playwright.config.ts`, código de producto ni ninguna otra prueba.

## 1. Qué estaba roto, y no era lo mismo en los dos ficheros
- **`editor-3c-evidencia.spec.ts` — fallo de aislamiento de datos, el de la issue.** Su
  `abrirEditor()` llamaba a `invitacionSembrada()` a pelo: LA invitación de la demostración, que
  otros ocho ficheros comparten, y sin el mutex `conLockDeInvitacionSembrada` que `preparar.ts:110`
  creó para eso. Sus dos pruebas entraban a la vez en la misma invitación y la segunda se quedaba
  sin `.lienzo-raiz`. Era el ÚNICO fallo que sobrevivía a 2 workers en el runner (corrida
  34052672869) y el que obligó a `--workers=1`.
- **`a11y-publico.spec.ts` — NO era aislamiento.** El encargo lo daba por caso hermano; la medición
  que ya estaba en el árbol dice otra cosa (`bitacora/3c-adv.md` §6.2): falló con `--workers=2` por
  `color-contrast` en los MISMOS cuatro nodos que su propia cabecera documenta como carrera de
  temporización, y pasó 3 de 3 ejecutando el fichero solo. Sus dos pruebas **solo leen** la URL
  pública, y la única que muta la invitación publicada (`render-publico.spec.ts`, la de la sección
  oculta) ya toma el mutex y restaura. Lo que fallaba era el MUESTREO: axe medía con el repintado
  de la tipografía a medias.

## 2. Qué se hizo
- `conEditorPropio()` sustituye a `abrirEditor()`: cada prueba crea su cuenta (`cuentaNueva()`, un
  correo distinto por llamada — evita el 500 de logins concurrentes del módulo `auth` antiguo) y su
  invitación (`invitacionConDocumento()`), y la borra en el `finally`. Es el patrón que ya usa
  `asistente.spec.ts:213`. Cero uso de la invitación sembrada: no entra a la cola del mutex.
  Consecuencia asumida: las capturas de evidencia salen sin fotos (los `assetId` de `defaults.json`
  no se resuelven sin subir el arte, `seed-demo.sh` §4). Miden el CHROME, que es lo suyo.
- `a11y-publico.spec.ts`: `esperarPinturaEstable()` (dos `requestAnimationFrame` tras
  `document.fonts.ready`: el fotograma pintado, no solo la fuente cargada) y `expect.poll` sobre el
  análisis de axe, el mecanismo que `06 §8.2` punto 2 nombra. Mide el estado estable; una violación
  real sigue en cada reintento y rompe el job igual.
- `ci.yml`: el paso de e2e pierde `--workers=1`. `--timeout=60000` se queda (es máquina, no
  aislamiento: 4 vCPU compartidos con la JVM, `next start` y Postgres).

## 3. Medido
