# 3-C bloque -1 → orquestador — **N-01 y N-02 CERRADAS**, medidas ejecutando

Las dos altas que dejaron la 3-B `NO CERRABLE` están cerradas. ADR propuestas `ADR-3C-N01-01` y `ADR-3C-N02-01`; salidas literales en `bitacora/3c-menos1.md` y `evidencia/fase-3c/bloque-menos1/`. Sin commits.

## N-01 · toma de cuenta por `/auth/request-password-reset`
- `RecoveryPasswordSentResponse` pierde `resetToken`: la respuesta es `{"message": …}` y nada más; el token se sigue
  acuñando y viaja **sólo** por el `resetUrl` del correo.
- Siempre `200` con el mismo cuerpo, exista o no la cuenta; el camino «no existe» acuña igualmente un token y lo tira,
  para no cambiar el oráculo de estado por uno de tiempo evidente.
- `request-password-reset` y `signup` bajo `AuthThrottleService` **con prefijo de ámbito** (`ACCESO`/`RECUPERACION`/
  `REGISTRO`): mismos límites y mismo `429` mudo, contadores separados, para que agotar la recuperación de una víctima
  no le cierre el acceso — denegación de servicio que el propio arreglo habría creado. En `signup` un alta correcta
  limpia su contador.
- Medido contra el backend real (`n01-antes-despues.txt`). ANTES: `200` con `resetToken` de 171 chars → `reset-password`
  `200` → `token` con la contraseña del atacante `200`, con la de la víctima `401`; igual sobre `demo.master@example.com`.
  DESPUÉS: `200` sin token; mismo cuerpo exista o no la cuenta; `429` al sexto intento en los dos extremos; con la
  recuperación agotada la dueña legítima entra (`200`); y el flujo legítimo sigue entero (token de la fila →
  `reset-password` → `token`, `200`). Compuertas: `RequestPasswordResetContractTest` (8 casos por HTTP, `MockMvc` + el
  `GeneralExceptionHandler` real, afirmando sobre el **JSON serializado**) y 5 casos de ámbito en
  `AuthThrottleServiceTest`. `SecurityConfig.kt` sólo se leyó; ningún advice convierte el `429`.

## N-02 · origen y CSP horneados (y U-6 cerrada de verdad)
- `proxy.ts` compone la CSP con el origen de la **petición**: `EDITOR_ORIGIN` (servidor) → `x-forwarded-proto`/`-host` →
  `Host` → `nextUrl.origin`; CDN igual con `CDN_ORIGIN`. Sin aflojar nada: hosts explícitos, sin `'self'`, `connect-src
  'none'`, nonce por petición, `TOLERADAS = []`.
- `canvas-client.ts` (hijo) valida `event.origin` contra `location.ancestorOrigins[0]` / `document.referrer`, no contra
  la constante horneada: era el **segundo candado** del mismo defecto. El padre (`canvas-bridge.ts:10-11`) ya validaba
  por `event.source` + nonce y **no** por origen: está bien, no se tocó. **El protocolo v1 no cambia.**
- `origenPublico()` pone `window.location.origin` **antes** que `NEXT_PUBLIC_SITE_URL`. Aserción de arranque
  `motivoDeOrigenDesalineado` en `instrumentation.ts` con `PERMITIR_ORIGEN_DESALINEADO=1`; `motivoDeArranqueInvalido` y
  `PERMITIR_ORIGEN_LOCAL=1`, intactos.
- **A/B sobre el MISMO build** (horneado con `:3050`) servido en `:3050` y `:3000`, backend y siembra vivos
  (`ab-origen-salida.txt`, capturas en `capturas/`): en **los dos** puertos → iframe presente, `frames /canvas = 1`,
  lienzo pintado `true`, `frame-ancestors` = el puerto navegado, **0** violaciones de CSP en consola y **0** dentro del
  lienzo, y «Copiar enlace» / «Ver como invitado» / WhatsApp con el puerto de la clienta abriendo `HTTP 200`. Antes, en
  `:3000`: `frames /canvas = 0` y `lienzo pintado = false`. No es un e2e porque el arnés reconstruye con el origen del
  puerto que sirve —el punto ciego de N-02—; queda reproducible en `ab-origen.mjs`.

## HALLAZGO que el orquestador debe conocer
**`throw` dentro de `register()` NO impide arrancar en `next@16`**: Next captura la excepción, la imprime como un error
del log y **sigue sirviendo** (medido: quedó escuchando en `:3000`, lo delató un `EADDRINUSE`), así que la guarda de
arranque de U-6 (`ADR-3-8-03`) llevaba desde 3-8 siendo un mensaje en un log. Cambiada por recuadro en `stderr` +
`process.exit(1)`, que sí mata el proceso (salida `1`). **Enmienda de facto la mitad de arranque de `ADR-3-8-03`.**

## Compuertas (salida real)
`./gradlew test` **1 271 · 0 fallos · 0 omitidas** (93,60 % líneas / 80,21 % ramas) · frontend `test` 4/4 (**1 559**:
527 esquema · 653 secciones · **379** web) · `typecheck` 4/4 · `lint` 3/3 con **0 errores** · `build` 2/2 · `smoke.sh`
**19/19 · exit 0** dos veces · `playwright test` **50/50** (`lienzo-csp` 3/3, `clienta-sin-sesion` 1/1) · A/B exit 0.

## Riesgos que quedan (ninguno bloquea)
1. Oráculo de temporización **residual** en `request-password-reset` (se iguala la acuñación del token, no la escritura
   en base; no medido con muestra). **El bloqueo de cuenta como denegación de servicio SIGUE ABIERTO** dentro de cada
   ámbito: fuera de alcance, ya listado en `3-para-fase-4.md §4`.
2. `ancestorOrigins` no existe en **Firefox**: ahí manda `document.referrer`, que una `Referrer-Policy` estricta podría
   vaciar; no medible aquí (sólo Chromium). La defensa transversal sigue siendo `frame-ancestors`, ya correcto.
3. `Host`/`x-forwarded-host` los controla el cliente (sólo afectan a su propia respuesta): en producción **hay que
   declarar `EDITOR_ORIGIN`**. `app/(public)/layout.tsx` sigue tomando `metadataBase` de `NEXT_PUBLIC_SITE_URL`; no
   tocado, por alcance.
4. `pnpm run lint` estaba **en rojo antes de este bloque** (3 `no-undef` en `scripts/capturas-cierre-3b.mjs`, comprobado
   con `git stash`); arreglado con la convención de `capturas-editor.mjs:2`. **Sin medición nueva de LCP ni de JS.**
