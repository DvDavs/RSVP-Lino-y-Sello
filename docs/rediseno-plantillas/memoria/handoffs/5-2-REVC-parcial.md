# 5-2 REV-C — revisión Opus de `/editor/[invitationId]/invitados` (cerrada)

Agente `E2-REV-C2`, continuación del revisor que murió por límite de API. Rama `claude/fase-5-invitados`.
Alcance revisado: `c58d390` + los cambios sin commitear del revisor anterior sobre
`lib/invitados/{api,types,textos}.ts`, `components/invitados/**` y
`app/(chrome)/editor/[invitationId]/invitados/**`. Ningún comando de git de escritura.

## 1. Los tres rojos heredados: cerrados, sin tocar lo que afirman

Causa **única** de los tres: el revisor anterior puso `aria-label={t.tabla.editarA(nombre)}`
(«Editar a María Fernanda Cruz») en el disparador de edición de la fila
(`TablaInvitados.tsx:60-66`) y con eso cambió el **nombre accesible** del botón. Las tres pruebas
usaban `findByRole("button", { name: "María Fernanda Cruz" })` como **ancla de espera** («la lista ya
está pintada»), no como aserción; el ancla dejó de casar y las tres morían en el `waitFor` siguiente
sin que la búsqueda, el filtro ni el campo Jóvenes tuvieran nada que ver.

Dictamen: el arreglo del revisor anterior es **correcto y se conserva** (está cubierto por
`TablaInvitados.test.tsx:58-61`). Lo que faltaba era terminar el ancla. Arreglado en
`PantallaInvitados.test.tsx:108,126,149` → `findAllByRole("button", { name: /María Fernanda Cruz/ })`
(regex porque el nombre lleva prefijo; `All` porque en jsdom se pintan a la vez tabla y tarjetas).
Cero pruebas borradas, cero aserciones relajadas.

## 2. Hallazgos

| Sev | Fichero:línea | Hallazgo | Estado |
|-----|---------------|----------|--------|
| Alta | `components/invitados/TablaInvitados.tsx:63` (antes) | El anillo de foco del revisor anterior escribía `var(--ui-surface-raised)`/`var(--ui-focus)` a mano en `components/**`: fuga de la frontera chrome/invitación, **rompía `test/tokens-no-leak.test.ts`** (rojo que en el encargo figuraba como ajeno y era de esta pantalla). | Arreglado: utilidades del preset `focus-visible:ring-[3px] ring-ui-focus ring-offset-2 ring-offset-ui-surface-raised`, el mismo anillo que `components/editor/SectionRow.tsx:84`. Prueba: `TablaInvitados.test.tsx` («anillo de foco del chrome», afirma además que la clase NO contiene `--ui-`). |
| Alta | `PantallaInvitados.tsx:53-76` | Búsqueda contra el backend **sin guardia de respuesta tardía**: el rebote de 300 ms no impide dos peticiones en vuelo, y la lenta de «Ro» pisaba los resultados de «Rocío». | Arreglado (`ultimaPeticion`, se descarta lo que llega tarde en éxito y en error). Prueba nueva, verificada en rojo al quitar el guardia. |
| Media | `lib/invitados/api.ts:74` (antes) | El 401/403 tiraba el token **antes** de leer el cuerpo: un 401/403 *con* `code` (fallo de la ruta, no de la sesión) echaba a la clienta de la aplicación. Hoy el backend del panel no emite 403 con código, pero el criterio contradecía al de `api-client`. | Arreglado: el olvido va en la rama sin `code`. Dos pruebas nuevas en `api.test.ts`. |
| Media | `lib/invitados/api.ts:145` (antes) | Un **2xx cuyo cuerpo no es JSON** (HTML de proxy) salía como `SyntaxError` pelado: ninguna de las tres clases del proyecto, así que `error instanceof ApiError\|SessionError` fallaba. | Arreglado: `UnknownApiError` con el cuerpo crudo. Prueba nueva. |
| Media | `AccionesInvitado.tsx`, `TarjetasInvitados.tsx` | «Copiar enlace», «Ver el enlace», «WhatsApp», «Correo», «Compartir» y «Editar» se repiten una vez **por invitado** con texto idéntico: un lector de pantalla no sabe de quién es el enlace que va a mandar. | Arreglado: `aria-label` con el nombre, empezando por el texto visible (WCAG 2.5.3). Textos nuevos en `textos.ts`. 5 pruebas nuevas. |
| Media | `FormularioInvitado.tsx:151-160` | Al pasar al paso de confirmación de borrado, el disparador pulsado se desmonta y **el foco cae al `<body>`** dentro de un diálogo abierto; además el botón destructivo ocupa el sitio donde estaba «Guardar cambios» (clic por inercia = borrado). | Arreglado: el foco va a «Cancelar» (opción segura). Prueba nueva. |
| Media | `PantallaInvitados.tsx:173-179` | El esqueleto no reservaba el hueco de la fila de búsqueda/filtro/acciones: al terminar la carga la fila aparecía de golpe y empujaba la tabla (`ui-pantalla` §7). | Arreglado: hueco con las medidas reales (46/44 px, `sm:w-64`/`sm:w-44`). Prueba nueva. |
| Baja | `components/invitados/utilidades.ts:30` | `formatoRelativo` devolvía «un momento» sin el «hace» de los otros tres tramos; en la tabla se leía «· un momento». | Arreglado + prueba. |
| Baja | `PantallaInvitados.tsx:137-154` | `URL.revokeObjectURL` se llama **inmediatamente** tras `enlace.click()`; en Firefox ese patrón ha cortado descargas. Sí manda `Authorization` y sí libera la URL. | No arreglado: meterlo en un `setTimeout` obliga a un temporizador en la prueba y el riesgo es de un navegador concreto. Queda anotado. |
| Baja | `Contadores.tsx:25` | Los contadores cambian en vivo tras alta/edición/borrado y no se anuncian (`aria-live`). | No arreglado: el dato también está en la tabla, que sí se relee; añadirlo dispararía un anuncio por cada guardado. |
| Baja | `lib/invitados/api.ts` | Un fallo de red (`fetch` rechaza) sale como `TypeError` sin envolver — **igual que `lib/api-client.ts`**, que tampoco lo envuelve. | No arreglado a propósito: cambiarlo aquí y no allí crearía dos disciplinas distintas. Decisión del orquestador. |

## 3. Para el orquestador (fuera de mi territorio)

1. **`vitest.config.ts`, cobertura**: `components/invitados/**` NO entra en `coverage.include`, así que
   sus 41 pruebas no cuentan para el umbral, mientras `components/editor/**`, `components/public/**` y
   `components/fields/**` sí entran. Es el mismo tipo de código y tiene el mismo tipo de prueba.
   **Debe entrar**: una línea, `"components/invitados/**/*.{ts,tsx}",` junto a las otras tres.
2. **`lib/api-client.ts`, señal de sesión caducada**: `lib/invitados/api.ts` puede tirar el token
   (`clearAuthToken`, público) pero **no** puede levantar la bandera `sesionCaducada` (privada). Tras
   un 401 en la pantalla de invitados, `editor/[invitationId]/page.tsx:198-201` dirá «inicia sesión»
   en vez de «tu sesión caducó» (el defecto U-1 que esa bandera existe para evitar). Arreglo real:
   exportar `marcarSesionCaducada()` desde `lib/api-client.ts` y llamarla desde
   `olvidarSesionCaducada()` en `lib/invitados/api.ts:67-70`.
3. **Contrato**: `5-2-contrato-invitados.md` §0.3 dice `…/guests/{guestId}/enlace` y §1 dice `/link`.
   El backend y el cliente usan `/link`; corregir §0.3 en el documento.
4. `lib/invitados/rsvp.ts:68` tiene un aviso de eslint (`RSVP_ERROR_CODES` solo usado como tipo). Es
   del otro agente; no lo toqué.

## 4. Verificación (salida real)

- `pnpm --filter web exec vitest run --coverage` → **709 pruebas, 708 en verde, 1 roja**: solo
  `components/sitio/portada.test.tsx` (ajena, rota desde `bfdcbaa`). Verdes ya: los 3 rojos de este
  encargo, `test/tokens-no-leak.test.ts` y los 2 de `PantallaInvitado.test.tsx` del otro agente.
- `pnpm -r run typecheck` → los 6 paquetes en verde.
- `pnpm --filter web exec eslint components/invitados lib/invitados 'app/(chrome)/editor/[invitationId]/invitados'`
  → 0 errores; 1 aviso, en `lib/invitados/rsvp.ts` (ajeno).
- Emojis en todo lo nuevo (código, comentarios y pruebas): **0**. Las 11 apariciones que caza un
  barrido amplio son la flecha tipográfica `→` en comentarios, que no es un emoji y es el estilo del
  repositorio. Hex sueltos: **0**. Cadenas `--ui-` fuera de `app/(chrome)/**`: **0** (era 1).
