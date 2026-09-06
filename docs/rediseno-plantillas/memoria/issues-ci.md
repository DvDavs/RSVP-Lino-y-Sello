# Issues abiertas del CI (GitHub Actions)

Formato: `I-CI-nn` · qué se observa · dónde · qué se hizo · qué falta decidir.
Ninguna de estas issues justifica saltarse una prueba: la política anti-flake (`contratos.md §6`,
ADR-1R-C-11) prohíbe la cuarentena sin issue, y aquí no hay ninguna prueba en cuarentena.

## I-CI-01 · `a11y-publico.spec.ts` flakea con más de un worker — abierta

- **Qué se observa.** Con `fullyParallel: true` y dos o más workers, `e2e/a11y-publico.spec.ts`
  falla de forma intermitente. Detectado en la fase 3-C y anotado como trampa en
  `handoffs/3c-para-siguiente.md` §1 (*«`a11y-publico.spec.ts` flakea con dos workers»*).
- **Dónde.** `frontend/apps/web/e2e/a11y-publico.spec.ts`; configuración
  `frontend/apps/web/playwright.config.ts` (`workers: process.env.CI ? 4 : undefined`).
- **Qué se hizo en el CI.** El job `e2e` invoca Playwright **dos veces**: la primera excluye ese
  fichero y conserva los 4 workers; la segunda corre **solo ese fichero con `--workers=1`**. Las dos
  llevan `--fail-on-flaky-tests`, así que el spec **se ejecuta y su fallo rompe el job igual que
  cualquier otro**. No es `test.skip`, no es `test.fixme`, no hay cuarentena: es aislamiento de
  concurrencia, declarado aquí y comentado en el propio `ci.yml`.
- **Qué falta.** La causa raíz. `06 §8.2` punto 4 es explícito: *«si una prueba solo pasa con
  `workers: 1`, es un fallo de aislamiento, no una excepción a conceder»*. El candidato es que este
  spec navegue al render público de **la invitación sembrada por `seed-demo.sh`** (compartida entre
  pruebas) en vez de crear la suya con el endpoint de fixture. Arreglarlo es trabajo de producto
  (`frontend/**`), fuera del alcance de la tarea de CI; queda para la fase 4/6, que debe quitar el
  segundo paso del workflow en cuanto el spec quede aislado.

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
