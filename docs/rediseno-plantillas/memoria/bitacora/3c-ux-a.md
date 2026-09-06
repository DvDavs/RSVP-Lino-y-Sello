# 3C-UX-A · correcciones graves del ASISTENTE de creación (cierre de la fase 3-C)

Worktree `/home/user/wt-3c/ux-a`, rama `wt/ux-a` desde `9b4bb9e`. **Sin commit ni push.** Backend
propio en `:6113` (`invitaciones_uxa`) y web en `:3113`, ambos parados al terminar; sin procesos
vivos. Encargo: **G-02**, **G-03**, la mitad de **G-06** que vive en `MisInvitaciones.tsx`, el
`?tipo=` de la portada y lo pequeño de `bitacora/3c-ux.md` §4 que caiga en el asistente.

## 1. Qué estaba roto y qué hace ahora

| # | Antes (medido en `bitacora/3c-ux.md`) | Ahora |
|---|---|---|
| **G-02** | Con todas las invitaciones ya diseñadas, el paso 1 era «¿Qué vamos a celebrar?» **sin nada que elegir** y «Continuar» inhabilitado para siempre | La pantalla deja de fingir que es el paso 1: título «Todas tus invitaciones ya tienen diseño» (o «Tu invitación…» en singular), una frase de por qué, y «Mis invitaciones» con cada fila. Sin progreso de 4 pasos, sin barra de acción, **sin un solo control inhabilitado** (comprobado en el e2e con `button:disabled` → 0) |
| **G-02b** | `?tipo=xv-anos` de la portada **se ignoraba** | Se lee: la portada enlaza slugs en español y ninguno era un `EventKind`, así que se descartaban los siete. Con varias invitaciones libres, además, elige la registrada con ESE tipo; si no hay ninguna, preselecciona igual y sale el aviso «Tu invitación está registrada como …» |
| **G-03** | Rellenar «¿Dónde?» → `422 TPL_ITEM_UNKNOWN`, el lote entero al suelo (los nombres incluidos) y «Continuar» que no continuaba pese a decir «Puedes continuar» | El paso 3 guarda con **200** en una invitación recién creada, con el itinerario de ejemplo intacto; y si falla, el aviso ofrece exactamente los dos botones que salen debajo |
| **G-06** (mitad) | «Mis invitaciones» no decía si estaba publicada ni enseñaba el enlace: había que volver a publicar para recuperarlo | Cada fila lleva tipo de evento, insignia «En edición»/«Publicada» y, si está publicada, el enlace con «Copiar» y «Ver como invitada» |
| M-07 (segunda mitad) | La barra de acción del **paso 3** desbordaba a 390 px: tres botones en 342 px de contenido, «Continuar» fuera de pantalla | `flex-wrap` en la barra: `scrollW 390 = clientW 390` medido |
| Deuda de `3c-6` §3.5 | A 390 px «Mis invitaciones» empujaba la rejilla de tipos —el objetivo del paso— bajo el pliegue | La rejilla va primero; la lista queda debajo, como contexto |
| B-19 (parcial) | `?tipo=quince`, `?tipo=baptism`: identificadores internos a la vista | El asistente escribe el slug en español (el mismo que enlaza la portada) y sigue aceptando el `EventKind` crudo |

## 2. G-02 — el paso 1 siempre tiene salida

`AsistenteDeCreacion.tsx` gana un solo concepto: `sinSalidaDeAsistente` (`!cargando && !hayObjetivo`).
Cuando es cierto no se pinta ni el `WizardProgress` ni la barra fija, el `<h1>` es el de la
situación real y el cuerpo es `MisInvitaciones`. Cubre los dos casos —cero invitaciones y todas con
plantilla— y también el paso 2 sin invitación objetivo, que antes enseñaba el estado vacío
«Todavía no tienes invitaciones» **aunque sí las tuviera**.

Las claves `editor.catalogo.todasConPlantilla` / `unaConPlantilla` se borran: eran un párrafo debajo
de una pregunta sin respuestas y ahora lo dice el propio título.

## 3. G-03 — cómo se escribe en un ítem que solo existe en los *defaults*

**Lo primero fue mirar cómo lo hace el editor real, y la respuesta es que no lo hace:**
`components/editor/GroupField.tsx:110` llama a `useEditorStore().setItemBlock(groupId, item.itemId, …)`
con el `itemId` del compuesto y `lib/store.ts:1004` lo encola tal cual, sin materializar nada. Con
`content` vacío eso es el MISMO `422` — el defecto no es del asistente, es de todo el frontend.
Queda declarado en `preguntas-abiertas.md § UX-A` (no toqué `components/editor/**`: es de otro
agente en esta misma fase).

Por qué falla, con la línea normativa: `itemsDe(doc, groupId)` devuelve `[]` mientras
`content[groupId]` no exista —`OperationReducer.kt:347`, «los `defaults` **no** se copian: el escalón
de default opera a nivel de bloque de grupo completo (`01 §5.3`); mezclarlo por ítem resucitaría
H-02»— y su espejo `operations-reducer.ts:187`. Los `itemId` que se ven en el compuesto de una
invitación nueva son los del paquete de plantilla.

**Camino elegido (el tercero de los tres que dejó abiertos 3C-UX): `addItem`.** Es la única
operación que materializa el grupo; en cuanto `content[groupId]` existe, la composición deja de
mirar los *defaults* (`compose.ts`, rama `group`). El asistente reenvía **cada** ítem de ejemplo con
su propio `addItem` —el itinerario no se pierde— y mete en el primero el lugar escrito. Un solo
lote, atómico (ADR-014). Los valores se rehidratan del compuesto a `ScalarValue`
(`rehidratarEscalar`), quitando lo que es presentación (`formatted`, `label` de `choice`); si algún
valor **no** se puede rehidratar —`image`/`audio` viajan como `url` y el documento guarda `assetId`,
ADR-021— el campo sencillamente **no se ofrece**, antes que materializar perdiendo una foto.

El mapa de ejemplo NO se hereda: el nombre es otro lugar y quedarse con el `mapHref` del salón de la
demostración mandaría a las invitadas a la dirección equivocada.

**Verificación contra el backend real** (invitación nueva, `boda-clasica@1.0.0`, `content: {}`):

```
ANTES  POST …/document/operations  [setBlock couple.groom, setItemBlock event.cards[01J8DEM…EV1].place]
       → HTTP 422 {"code":"TPL_OPERATION_INVALID","message":"la operación 1 del lote no es aplicable:
         TPL_ITEM_UNKNOWN","details":{"operations":[{"index":1,"code":"TPL_ITEM_UNKNOWN",
         "path":"event.cards[01J8DEM0000000000000000EV1]"}]}}
DESPUÉS POST …/document/operations  [setBlock couple.groom, addItem×2 con el lugar en el primero]
       → HTTP 200  revision 1  applied true
         idMap {tmp:prueba01 → 01M1V3EHJ3V1W2VA5PPS5V4JZK, tmp:prueba02 → 01M1V3EHJ4Q56ZY6EKXV2JNPC5}
         event.cards provenance "user", 2 ítems:
           01M1V3EHJ3V1W2VA5PPS5V4JZK | Ceremonia religiosa | Jardin Las Palmas
           01M1V3EHJ4Q56ZY6EKXV2JNPC5 | Recepción           | Zorba el Griego
```

**Pruebas que fallan si vuelve**: siete casos nuevos en `components/asistente/datos-basicos.test.ts`
(«3C-UX G-03 · el lugar en un grupo que todavía vive en los defaults»), con el documento de juguete
copiado byte a byte de la respuesta real; y en `e2e/asistente.spec.ts` el camino de los cuatro pasos
rellena «¿Dónde?», **exige `status() === 200`** en el lote y comprueba en el documento del servidor
que `event.cards.items[0].values.place` es lo que se escribió y que el ítem conserva su `title`.

**El aviso ya no miente**: decía «Puedes continuar» y no había ningún botón que continuara. Ahora,
tras un fallo, la barra ofrece «Seguir sin guardar» y «Volver a guardar» —los dos que promete el
texto— y un fallo de red se distingue del resto («No hay conexión, así que no pudimos guardar…»).

## 4. G-06 (la mitad de `MisInvitaciones.tsx`)

`cargarInvitaciones` ya llamaba a `GET …/document` para saber si la invitación tenía plantilla; de
esa MISMA respuesta salen ahora `activeRelease` (→ `publicada`), `publicToken` y `publicUrl`. **Cero
peticiones nuevas.** El enlace se arma con `lib/enlace-publico.ts`, el mismo ayudante que usa el
diálogo de publicar (ADR-3C-N02-01), así que nunca es el `http://localhost/i/…` crudo del servidor.
El enlace ocupa su propia línea: compartiendo fila con los dos botones a 390 px se quedaba en «htt…».

`editor.catalogo.seguirEditando` pasa de «Seguir editando» a **«Abrir en el editor»**, que es lo que
pide el encargo y lo que dice la fila tanto si está publicada como si no. Arrastra un cambio de una
línea en `e2e/clienta-sin-sesion.spec.ts:76` (la expresión regular del enlace), ajena a mi área pero
sin dueño declarado en esta fase.

## 5. Compuertas, con salida literal

- `pnpm run test` (turbo, desde `frontend/`): **10/10 tareas**. `web` **64 ficheros, 531 pruebas,
  531 en verde** (antes de este trabajo: 517) · `ui` 654 · `sections` 653 · `schema` 527 · `icons`
  179 · `tokens` 55. Del asistente: **8 ficheros, 99 pruebas** (antes 85).
- `pnpm run typecheck`: **10/10 tareas**, 0 errores. `pnpm run lint`: **6/6 tareas, 0 errores, 1
  aviso preexistente y ajeno** (`e2e/flujo-principal.spec.ts:94`, `campoFoto` sin usar).
- `pnpm run build`: **5/5 tareas**, verde.
- e2e contra el backend REAL (`:6113`) con el `webServer` de Playwright (`PW_PORT=3113`):
  **15 pruebas, 15 en verde** — `asistente.spec.ts` **7/7** (dos nuevas: G-02 y G-06),
  `a11y-producto.spec.ts` 6/6, `flujo-principal.spec.ts` 1/1, `clienta-sin-sesion.spec.ts` 1/1.
- Medidas a 390 px: paso 1 con invitación libre `scrollW 390 = clientW 390`; paso 1 sin ninguna
  libre `390 = 390`; paso 3 con el lugar escrito `390 = 390` y «Continuar» dentro del viewport.
- Una nota de flake honesta: en la PRIMERA corrida de `pnpm run test` cayó
  `components/editor/PublishDialog.test.tsx > con bloqueos…` (1 de 531). Ejecutada sola, 4/4 verde;
  la suite completa repetida dos veces, 531/531. Es ajena a lo que toqué (no comparte ningún módulo
  con el asistente) y queda anotada por si a alguien le vuelve a aparecer.

Capturas (390×844, `fullPage`) en `evidencia/fase-3c/cierre/ux-fix/`: `a-01-paso1-con-invitacion-libre.png`,
`a-02-paso1-sin-invitacion-libre.png`, `a-03-paso3-lugar-escrito.png`, `a-04-paso3-guardado-200.png`
(el nombre lleva el código HTTP que devolvió el lote: 200).

## 6. Ficheros tocados

`components/asistente/{AsistenteDeCreacion,MisInvitaciones}.tsx`,
`components/asistente/{datos-basicos,invitaciones,tipos-de-evento}.ts`, sus cuatro ficheros de
prueba, `lib/i18n.ts` (solo `asistente.*` y `editor.catalogo.*`), `e2e/asistente.spec.ts`,
`e2e/preparar.ts` y una línea de `e2e/clienta-sin-sesion.spec.ts`. Nada de `components/editor/**`,
`components/sitio/**`, `app/(chrome)/{acceso,ayuda}`, `layout.tsx` ni `globals.css`.

## 7. Lo que NO pude / no hice

- **El mismo `422` en el editor** (`GroupField.tsx` + `lib/store.ts`): reproducido y documentado,
  no corregido — no es mi área en esta fase. Es el hallazgo más importante que dejo abierto: mientras
  no se arregle, editar cualquier campo de un grupo que sigue en los *defaults* falla igual.
- **G-01, G-04, G-05** y la otra mitad de G-06 (el panel de publicar) siguen abiertos: no son de mi
  encargo ni de mi área.
- **M-08…M-12, B-13, B-16…B-18, B-20** viven fuera del asistente. De la tabla §4 solo entraban en mi
  área M-07 (la parte del paso 3, corregida) y B-19 (corregida en `?tipo=`; `?inv=` y
  `?plantilla=<slug>` siguen en inglés/slug y no los toqué: `inv` identifica una fila real y
  `plantilla` es el `slug` del catálogo, que es un dato del dominio, no una traducción pendiente).

## 8. Relevo — reverificación con salida real

El trabajo llegó completo (los siete casos de `datos-basicos.test.ts` §3C-UX G-03 ya estaban
escritos) pero sin commit y sin la corrida final confirmada en esta sesión. Repetí las compuertas
desde cero, backend propio en `:6113` (`invitaciones_uxa`):

- `pnpm --filter web run typecheck`: **0 errores**.
- `pnpm --filter web run test`: **64 ficheros, 531 pruebas, 531 en verde** (coincide con §5).
- e2e reales contra `:6113`/`:3113`: `asistente.spec.ts` **7/7** + `clienta-sin-sesion.spec.ts`
  **1/1** = **8/8**, código de salida `0` (incluye la prueba de los cuatro pasos, que exige
  `status() === 200` en el lote del paso 3 — la regresión de G-03 no volvió).
- Dos variables de entorno que `scripts/seed-demo.sh` y los e2e NO heredan de `dev-backend.sh`:
  `seed-demo.sh` lee `TPL_DEV_BASE` (no `TPL_DEV_PORT`) para saber a qué puerto hablar, y
  `playwright test` necesita `TPL_TEST_STATE_DIR` explícito además de en `dev-backend.sh` — sin él
  `e2e/preparar.ts` busca el clúster efímero en `/tmp/templates2-pg/state.env` y los 7 e2e fallan
  con `ENOENT` antes de tocar el navegador. Anotado por si se repite.
- El e2e reescribió ocho PNG de `evidencia/fase-3/ux-corregido/` (captura de pantalla de otra fase,
  ajena a este encargo): revertidos con `git checkout --`. `evidencia/fase-3c/cierre/ux-fix/` es
  evidencia propia de este encargo y se deja.
- Backend parado por PID (`dev-backend.sh stop`); sin procesos vivos de este worktree al terminar.

Sin cambios de código en este relevo: solo verificación y memoria.
