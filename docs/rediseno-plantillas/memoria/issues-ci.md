# Issues abiertas del CI (GitHub Actions)

Formato: `I-CI-nn` · qué se observa · dónde · qué se hizo · qué falta decidir.
Ninguna de estas issues justifica saltarse una prueba: la política anti-flake (`contratos.md §6`,
ADR-1R-C-11) prohíbe la cuarentena sin issue, y aquí no hay ninguna prueba en cuarentena.

## I-CI-01 · La suite e2e no está aislada: la invitación sembrada es compartida — abierta

- **Qué se observa.** Con `fullyParallel: true` y más de un worker, la suite falla de forma no
  determinista. Medido en el runner sobre el MISMO commit (`f9dcfe6` y `0932c81`): **4 workers → 5
  fallos + 2 flaky** ([34052024407](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34052024407));
  **2 workers → 1 fallo + 1 flaky** ([34052672869](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34052672869)).
- **Causa raíz, verificada en el código.** `e2e/preparar.ts:68` `invitacionSembrada()` devuelve
  **LA MISMA** invitación de la demostración a ocho ficheros de pruebas. El bloque 3-6 ya lo
  documentó y añadió un mutex real entre procesos, `conLockDeInvitacionSembrada`
  (`e2e/preparar.ts:110`), pero **`editor-3c-evidencia.spec.ts` no lo usa**: su `abrirEditor()`
  llama a `invitacionSembrada()` a pelo, y sus dos pruebas entran a la vez en la misma invitación —
  la segunda se queda sin `.lienzo-raiz` y agota los 30 s. `a11y-publico.spec.ts` es el caso
  hermano que ya venía anotado como flaky con dos workers (`handoffs/3c-para-siguiente.md` §1).
- **Qué se hizo en el CI.** El job invoca Playwright **una vez con `--workers=1`** (ADR-CI-01): sin
  concurrencia entre procesos la interferencia es imposible. Ninguna prueba se salta: corren las 79
  y `--fail-on-flaky-tests` sigue rompiendo el job. No hay `test.skip` ni `test.fixme` en el árbol.
- **Qué falta, y es de `frontend/**`.** `06 §8.2` punto 4 no admite `workers: 1` como solución:
  *«si una prueba solo pasa con `workers: 1`, es un fallo de aislamiento, no una excepción a
  conceder»*. Lo mínimo: envolver `abrirEditor()` de `editor-3c-evidencia.spec.ts` (y el tramo
  equivalente de `a11y-publico.spec.ts`) en `conLockDeInvitacionSembrada`. Lo correcto: que cada
  prueba cree su propia invitación en vez de compartir la sembrada. Hecho eso, el CI puede volver a
  subir los workers y esta issue se cierra.

## I-CI-03 · El lienzo del editor tarda demasiado bajo paralelismo — abierta

- **Qué se observa.** Con más de un worker, las pruebas que esperan a que PINTE el lienzo
  (`.lienzo-raiz` dentro del iframe) agotan sus esperas de 20-30 s, y pasan en el reintento en
  ~5 s. Medido en el runner: con 4 workers, `editor-nucleo` E-N2/E-N3/E-N4, `paleta-preview` y
  `lienzo-csp` ([34052024407](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34052024407));
  con 2 workers, `teclado-editor` E-10a — 22,3 s en el primer intento y **5,2 s en el reintento**
  ([34299786630](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34299786630)).
- **Qué NO es.** No es aislamiento de datos: la prueba que falla y la que pasa miran la misma
  invitación sin escribirla, y el reintento a solas va sobrado. Es reloj — 4 vCPU compartidos por la
  JVM del backend, `next start`, Postgres, dos Chromium y el `ffmpeg` que graba vídeo de TODAS las
  pruebas (`video: retain-on-failure`, `06 §8.2` punto 7).
- **Qué se hizo.** Nada en esas pruebas: están fuera del territorio de la tarea de I-CI-01, que solo
  podía tocar dos specs. Lo que sí se quitó es un pico de CPU evitable: la prueba de capturas de
  `editor-3c-evidencia.spec.ts` volvió a la invitación sembrada (lienzo caliente) en vez de rendir
  en frío las doce secciones de una invitación nueva.
- **Qué falta decidir.** Tres caminos, todos fuera de esta tarea: (a) subir el tope del
  `toBeVisible` del lienzo en las pruebas afectadas (es máquina, no producto); (b) dejar de grabar
  vídeo en CI y quedarse con la traza del reintento, que exige enmendar `06 §8.2` punto 7;
  (c) medir por qué el primer pintado del lienzo cuesta tanto y arreglarlo en el producto, que es
  lo único que también mejora la experiencia real. Hasta entonces, el número de workers del job
  `e2e` es un compromiso, no un óptimo.

## I-CI-02 · Las capturas de referencia atan el CI a Chromium 1194 — abierta

- **Qué se observa.** Las 124 capturas de `e2e/design.spec.ts-snapshots/` se generaron con el
  Chromium **1194** (141.0.7390.37) que el entorno de desarrollo trae preinstalado en
  `/opt/pw-browsers`, no con el 1234 que instalaría `@playwright/test@1.62.1`. Comparar píxeles
  contra otra versión de Chrome no mide una regresión del diseño, mide un cambio de motor.
- **Dónde.** `frontend/apps/web/playwright.config.ts` y `playwright.design.config.ts`
  (`executablePath` condicionado a que exista la ruta local).
- **Qué se hizo en el CI.** El job `design` instala **esa misma revisión** (`playwright-core@1.56.0`
  la fija) y la señala con `PW_CHROMIUM_PATH`, la variable que ambas configs ya leían. Runner y
  local renderizan con el mismo binario.
- **Qué falta.** Decidir el dueño de la referencia: o el proyecto sube `@playwright/test` y
  regenera las 124 capturas con el navegador pineado (y el entorno local deja de usar el de
  `/opt/pw-browsers`), o se documenta que la revisión 1194 es parte del contrato de la galería. Hoy
  es lo segundo, de facto y sin escribirlo. Decisión de la fase 6.
