# Bitácora — I-CI-01: aislar la suite e2e y medir el paralelismo en el runner

Rama `claude/ci-github-actions-jobs-9qyd9z`, sobre `c4326e5`. Tocado: los dos specs del encargo,
`e2e/preparar.ts` (limpieza), `playwright.config.ts` **solo `workers`**, `.github/workflows/ci.yml`,
`scripts/ci-backend.sh`, `README.md` y esta memoria. Cero cambios en producto y en otras pruebas.

## 1. El defecto era real, y era uno de dos
- **`editor-3c-evidencia.spec.ts` — aislamiento.** `abrirEditor()` abría `invitacionSembrada()` —la
  invitación compartida por ocho ficheros— sin `conLockDeInvitacionSembrada`; sus dos pruebas se
  pisaban. Era el único fallo que sobrevivía a 2 workers (corrida 34052672869).
- **`a11y-publico.spec.ts` — NO era aislamiento.** `bitacora/3c-adv.md` §6.2 ya lo tenía medido:
  `color-contrast` en los mismos cuatro nodos, 3 de 3 en verde ejecutando el fichero solo. Carrera
  de MUESTREO. Lo que sí compartía era otra cosa: su `beforeAll` purgaba la caché ISR, que es justo
  lo que mide `render-publico.spec.ts:207` (`x-nextjs-cache: HIT`) sin mutex.

## 2. Qué se hizo
`conEditorPropio`: la prueba de `axe` crea su cuenta y su invitación y las borra (`06 §8.2` p. 4).
La de CAPTURAS se queda en la sembrada **con mutex**, por dos razones medidas: las cinco capturas
están versionadas y deben enseñar la invitación con su arte, y el lienzo de una invitación nueva es
un render en frío que agotó 30 s dos veces en el runner. `a11y-publico`: fuera la purga ISR; se
muestrea con la página quieta (`fonts.ready` + un fotograma, con tope) y se reintenta con
`expect.poll` (8 s, para que quepa en el `timeout: 30_000` local). `preparar.ts`:
`invitacionConDocumento` borra su fila si `:choose-template` falla; `borrarInvitacion` avisa.
`scripts/ci-backend.sh` arranca el **jar** en vez de `bootRun`: de cuatro procesos java vivos
durante las pruebas a uno.

## 3. Medido
| Dónde | Invocación | Resultado |
|---|---|---|
| Local | `--workers=4 --timeout=60000 --fail-on-flaky-tests` | **79/79**, 1,3 min (dos veces) |
| Local | `--workers=2` idem | **79/79**, 2,0 min |
| Runner | 2 workers, [34299786630](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34299786630) | capturas (lienzo en frío 30 s ×2) + `teclado-editor` E-10a (20 s; 5,2 s al reintentar) |
| Runner | 2 workers, [34304958215](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34304958215) | 78/79: `editor-nucleo` E-N2 en el `expect` de 5 s. **Mis dos specs pasan** |
| Runner | 2 workers + jar, [34305882574](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34305882574) | rojo igual |
| Runner | **1 worker**, [34306781190](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34306781190) | `e2e` verde; la corrida cayó por un flake de axe en la galería y quedó verde al relanzarlo |
| Runner | **1 worker**, [34308150542](https://github.com/DvDavs/RSVP-Lino-y-Sello/actions/runs/34308150542) | **verde entera a la primera**: 9 m 45 s; `e2e` 9 m 41 s, las 79 pruebas en 2 m 57 s |

## 4. Qué NO se consiguió
Las dos corridas verdes **con paralelismo** no están. Cerrado el aislamiento, el runner sigue rojo
con dos workers por otra causa: el lienzo no pinta dentro de presupuestos que fijan la config
(`expect` 5 s) y pruebas de otros ficheros (20 s), **fuera del territorio** de este encargo. En
local, con 4 workers, todo pasa: es la máquina. Se deja `--workers=1` —la única configuración con
verde repetido— y la causa queda como **I-CI-03**.

## 5. Revisión
Un segundo Opus levantó 11 objeciones; se corrigieron las de fondo (purga ISR, tope del poll,
espera de fotograma sin cota, comentario que prometía de más sobre el falso verde, invitación
huérfana, `catch {}` mudos, tres comentarios obsoletos del YAML). Su objeción sobre las capturas
versionadas es la que, con la medición del runner, devolvió esa prueba a la sembrada con mutex.
