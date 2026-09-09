# Issues del CI (GitHub Actions)

**Coste de una corrida completa: ~28 minutos de Actions** (los cuatro jobs sumados; ~10 min de
reloj porque van en paralelo). Por eso los disparadores de `push` son ramas de INTEGRACIÓN y no
comodines: `main`, las de fase (2, 3, `claude/fase-4-kit-de-autor`, `claude/fase-5-producto`) y las
de estas tareas de CI. Una rama de sesión que empuja diez veces al día costaría ~4,5 h de Actions
diarias ella sola. Un `pull_request` hacia las ramas de fase 4 y 5 tampoco dispara: si se quiere,
se añaden a `on.pull_request.branches`.

Formato: `I-CI-nn` · qué se observa · dónde · qué se hizo · qué falta decidir.
Ninguna de estas issues justifica saltarse una prueba: la política anti-flake (`contratos.md §6`,
ADR-1R-C-11) prohíbe la cuarentena sin issue, y aquí no hay ninguna prueba en cuarentena.

## I-CI-01 · La suite e2e no está aislada: la invitación sembrada es compartida — **CERRADA** (2026-09-09)

- **Qué era.** `e2e/preparar.ts:68` `invitacionSembrada()` devuelve LA MISMA invitación de la
  demostración a ocho ficheros. `editor-3c-evidencia.spec.ts` la abría **sin** el mutex
  `conLockDeInvitacionSembrada` (`preparar.ts:110`): sus dos pruebas entraban a la vez en la misma
  invitación y la segunda se quedaba sin `.lienzo-raiz`. Era el único fallo que sobrevivía a dos
  workers en el runner ([34052672869](https://github.com/DvDavs/RSVP---Lino-Sello/actions/runs/34052672869)).
- **Cómo se cerró** (`bitacora/ci-i-ci-01.md`):
  · La prueba de `axe` del chrome crea AHORA su propia cuenta y su propia invitación y las borra al
    terminar (`conEditorPropio`) — aislamiento de verdad, el que pide `06 §8.2` punto 4.
  · La de CAPTURAS se queda en la sembrada pero **dentro del mutex**: es evidencia versionada que
    debe enseñar la invitación con su arte, y el lienzo de una invitación nueva es un render en frío
    que agotó 30 s dos veces en el runner ([34299786630](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34299786630)).
    Excepción razonada y anotada en el propio fichero, no un descuido.
  · `a11y-publico.spec.ts` no compartía datos: dejó de purgar la caché ISR (eso SÍ era escritura
    compartida, y `render-publico.spec.ts:207` mide justo ese HIT) y ahora muestrea `axe` con la
    página quieta (`document.fonts.ready` + un fotograma, con tope) y reintenta con `expect.poll`.
  · `preparar.ts`: `invitacionConDocumento` limpia su fila si `:choose-template` falla, y
    `borrarInvitacion` avisa en vez de callar.
- **Verificado.** Los dos specs pasan en el runner con dos workers (34304958215) y la suite completa
  pasa **en local** con `--workers=4 --timeout=60000 --fail-on-flaky-tests`: 79/79 en 1,3 min, dos
  veces. Ninguna prueba saltada, omitida ni en cuarentena: siguen siendo 79.
- **Corridas verdes con el aislamiento ya cerrado** (1 worker, `--fail-on-flaky-tests`, las 79):
  [34306781190](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34306781190) (`dbf4609`; el job `e2e` verde a la primera, la corrida quedó en verde tras
  relanzar el flake de la galería) y [34308150542](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34308150542) (`6824be3`, verde entera a la primera,
  9 min 45 s de reloj; `e2e` 9 m 41 s, del que el paso de pruebas son **2 m 57 s**).
- **Lo que NO se consiguió, y por qué está en I-CI-03.** Subir los workers del CI. Cerrado el
  aislamiento, el runner sigue en rojo con dos workers por otra causa medida: el lienzo del editor
  no pinta dentro de su presupuesto. Es reloj, no datos, y vive en pruebas fuera del territorio de
  esta tarea.

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
  podía tocar dos specs. Sí se quitaron dos consumos de CPU evitables, y **no bastaron**:
  · la prueba de capturas de `editor-3c-evidencia.spec.ts` volvió a la invitación sembrada (lienzo
    caliente) en vez de rendir en frío las doce secciones de una invitación nueva;
  · `scripts/ci-backend.sh` arranca el backend desde el **jar** en vez de con `./gradlew bootRun`:
    de CUATRO procesos java vivos durante las pruebas (el runner los enumera al limpiar) a UNO.
    Tercera corrida con dos workers y aun así roja
    ([34305882574](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34305882574)).
  El job se queda por tanto en `--workers=1`, ahora por RELOJ y no por aislamiento, y
  `playwright.config.ts` dice `workers: CI ? 1` para no mentir sobre lo que el runner sostiene.
- **No es solo el job `e2e`.** El job `design` corre 279 pruebas con **4 workers** en su propia
  config (sin backend ni Postgres) y ahí también apareció una prueba de temporización: `design-axe`
  «componente-tabs · light» reportó `focusable-content`/`focusable-element` sobre el `tablist` del
  panel del editor —el nodo aún sin hijos enfocables— y pasó en el reintento
  ([34306781190](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34306781190), 278 + 1
  flaky). Misma familia: aserciones sensibles al instante en un runner saturado.
- **Qué falta decidir.** Tres caminos, todos fuera de esta tarea: (a) subir el tope del
  `toBeVisible` del lienzo en las pruebas afectadas (es máquina, no producto); (b) dejar de grabar
  vídeo en CI y quedarse con la traza del reintento, que exige enmendar `06 §8.2` punto 7;
  (c) medir por qué el primer pintado del lienzo cuesta tanto y arreglarlo en el producto, que es
  lo único que también mejora la experiencia real. Hasta entonces, el número de workers del job
  `e2e` es un compromiso, no un óptimo.
