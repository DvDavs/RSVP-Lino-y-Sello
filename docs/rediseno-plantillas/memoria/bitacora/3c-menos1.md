# Bitácora · fase 3-C, bloque -1 (seguridad heredada) — N-01 y N-02

Rama `claude/fase-3c-identidad-visual-wqg0d2`. Árbol de partida `cf24b6c`. Sin commits (los hace el
orquestador raíz). Todo lo que sigue está medido; donde no lo esté, lo digo.

---

## 1. Qué había que cerrar

Las dos altas que dejaron la fase 3-B **NO CERRABLE** (`handoffs/3b-adv.md`):

- **N-01 (crítica)** · `POST /auth/request-password-reset` devolvía el `resetToken` en el cuerpo, sin
  autenticar; enumeraba cuentas (`400` vs `200`); no pasaba por el limitador. Dos peticiones y la
  cuenta es tuya, **incluida una MASTER**.
- **N-02 (alta)** · El origen del sitio y la CSP del lienzo se hornean en el `build`. El mismo
  artefacto servido en otro puerto mata la vista previa **en silencio** y reparte enlaces muertos.

N-01 se toca bajo **excepción explícita del dueño** sobre `modules/auth`, de la misma clase que la de
I-02 y acotada a estos dos extremos. No se ha tocado nada más de `auth`.

---

## 2. N-01 — qué se cambió

`ADR-3C-N01-01` (propuesta). Cuatro ficheros de producción, todos en `modules/auth`:

| fichero | cambio |
|---|---|
| `presentation/model/response/RecoveryPasswordSentResponse.kt` | pierde `resetToken`; queda sólo `message` |
| `service/ResetPasswordService.kt` | `comprobar` antes de la base · siempre `200` con `MENSAJE_RECUPERACION` · el camino «no existe» acuña igualmente un token y lo tira · `registrarIntento` después · inyecta `AuthThrottleService` |
| `service/AuthThrottleService.kt` | `enum AmbitoIntentos(ACCESO, RECUPERACION, REGISTRO)`; las claves de cuenta y de IP llevan prefijo de ámbito; sobrecargas `comprobar/registrarIntento/registrarExito` con ámbito, y las de siempre delegando en `ACCESO` |
| `service/CustomerService.kt` | `signUp` bajo el limitador en el ámbito `REGISTRO`: `comprobar` antes de tocar la base, `registrarIntento` en los dos caminos que rechazan, `registrarExito` en el alta correcta y en la reactivación |

`AuthController.kt` **no se toca** (el trabajo vive en los servicios) y `SecurityConfig.kt` sólo se
leyó: `/auth/**` sigue siendo `permitAll`, que es lo correcto para estos extremos.

**Por qué prefijo de ámbito y no contador compartido.** Con contador único, cinco peticiones de
recuperación sobre el correo de una víctima la dejarían sin poder **entrar** quince minutos: se
habría cambiado una toma de cuenta por una denegación de servicio nueva. Con prefijo, agotar la
recuperación agota exactamente la recuperación. Está medido (§3, pasos 6, 8 y 9).

**El `429` no lo convierte nadie en otra cosa.** Comprobado leyendo el código: `GeneralExceptionHandler`
declara un `@ExceptionHandler(DemasiadosIntentosException::class)` con `@ResponseStatus(429)`
(`:57-68`); ningún advice de la aplicación captura `RuntimeException` ni `Exception` salvo
`Templates2ExceptionHandler`, que está acotado con
`@RestControllerAdvice(basePackages = ["…modules.templates2.api"])` (`:55`) y no alcanza a
`AuthController`. Verificado además por HTTP contra el backend real: cuerpo del `429` idéntico al de
`/auth/token`.

**Lo que NO se pudo igualar.** El camino «el correo no existe» acuña el token igual que el otro, pero
no puede fabricar la escritura en la base que sí ocurre cuando la cuenta existe. Queda una diferencia
de tiempo residual, mucho menor que el `400`/`200` que había, **no medida con 30 muestras** (el brief
no lo exigía). Anotada en `preguntas-abiertas.md`.

---

## 3. N-01 — evidencia contra el backend REAL

Salida literal completa, antes y después, en
`evidencia/fase-3c/bloque-menos1/n01-antes-despues.txt`. Lo esencial:

**ANTES** (backend en `cf24b6c`, `127.0.0.1:6003`):

```
POST /auth/request-password-reset {"email":"n01.victima@example.com"}
  → 200 {"message":"…","resetToken":"CKZd8D97E1DChtkRhDqIdwgYspD1sqpX…"}   (171 chars)
POST /auth/reset-password {resetToken, newPassword:"Atacante1234!"}
  → 200 {"message":"La contraseña se actualizo correctamente"}
POST /auth/token  password=Atacante1234! (atacante)  → 200
POST /auth/token  password=Victima1234!  (victima)   → 401
request-password-reset  correo QUE EXISTE   → 200
                        correo QUE NO EXISTE → 400 "No existe un usuario con el email proporcionado"
12 request-password-reset seguidos → 200 ×12   (ni un 429)
 8 signup seguidos del mismo correo → 400 ×8   (ni un 429)
y sobre demo.master@example.com     → 200 {"resetToken":"IpBDNGrBlY0FXQCqwWUx…"}
```

**DESPUÉS** (mismo backend, recompilado):

```
POST /auth/request-password-reset {"email":"n01.victima2@example.com"}
  → 200 {"message":"Si el correo corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña"}
y sobre demo.master@example.com  → 200, el MISMO cuerpo
correo QUE EXISTE    → 200 + mismo cuerpo
correo QUE NO EXISTE → 200 + mismo cuerpo
8 request-password-reset seguidos → 200 200 200 200 200 429 429 429
   cuerpo del 429: {"statusCode":429,"errors":{"error":"Demasiados intentos. Espera unos minutos e inténtalo de nuevo."}}
8 signup seguidos del correo ya tomado → 400 400 400 400 400 429 429 429
ÁMBITOS · 5 recuperaciones de demo.boda@example.com → 200×5, la 6.ª → 429
          y la dueña legítima POST /auth/token      → 200
          registro agotado de n01.victima2 y su POST /auth/token → 200
FLUJO LEGÍTIMO · token leído de customer.resettoken (171 chars)
          POST /auth/reset-password → 200 · POST /auth/token con la nueva → 200
```

El recorrido de toma de cuenta **se queda sin primer paso**: de la respuesta ya no sale nada con lo
que llamar a `/auth/reset-password`.

---

## 4. N-01 — pruebas

- **`src/test/kotlin/…/modules/auth/RequestPasswordResetContractTest.kt`** (nueva, 8 casos). Contrato
  HTTP con `MockMvcBuilders.standaloneSetup` y el `GeneralExceptionHandler` **real** enganchado, sobre
  los servicios **reales** (`ResetPasswordService`, `CustomerService`, `AuthThrottleService`) con el
  repositorio simulado. Cubre las cuatro exigencias del encargo:
  (a) el JSON **servido** no contiene `resetToken` ni el valor del token — afirmado sobre la cadena
  cruda y sobre el árbol, no sobre el tipo de Kotlin, más una prueba de serialización del DTO con
  `ObjectMapper` que exige que su único campo sea `message`;
  (b) `200` y **el mismo cuerpo** para un correo que existe y para uno que no, más que el camino
  inexistente acuña el token (`verify(jwtUtil).generateSecureToken()`) y **no** escribe
  (`verify(repositorio, never()).save(...)`);
  (c) `429` al sexto intento en `request-password-reset` **y** en `signup`, con el `429` decidido
  **antes** de tocar la base (`verify(repositorio, times(5))`, no 6), y un alta correcta limpiando su
  contador;
  (d) el recorrido de `bitacora/3b-adv.md §6.1` sin primer paso, comprobando que el token acuñado
  (`TOKEN-171-CHARS-QUE-ABRE-LA-CUENTA`) está en la fila y **no** en ninguno de los valores del JSON.
- **`AuthThrottleServiceTest.kt`** (+5 casos): los ámbitos no comparten contador ni por cuenta ni por
  IP; el `429` es el mismo mensaje en los tres; `registrarExito` de un ámbito no limpia otro. Los 11
  casos anteriores siguen intactos y en verde.

---

## 5. N-02 — qué se cambió

`ADR-3C-N02-01` (propuesta). Cinco ficheros de `apps/web`:

| fichero | cambio |
|---|---|
| `proxy.ts` | `origenDeLaAplicacion(request)`: `EDITOR_ORIGIN` (servidor) → `x-forwarded-*` → `Host` → `nextUrl.origin`. CDN igual con `CDN_ORIGIN`. Validación de host contra un patrón y contra `new URL` antes de pegarlo en la cabecera |
| `lib/canvas-client.ts` | `origenDelPadre()`: `opts` → `location.ancestorOrigins[0]` → `document.referrer` → constante horneada como último recurso |
| `lib/enlace-publico.ts` | `origenPublico()` pone `window.location.origin` PRIMERO; comentario de cabecera reescrito; nueva `motivoDeOrigenDesalineado()` |
| `instrumentation.ts` | aplica las dos guardas y **aborta de verdad** (recuadro en `stderr` + `process.exit(1)`) |
| `frontend/apps/web/scripts/capturas-cierre-3b.mjs` | `eslint-disable no-undef` (ver §8: rojo PREEXISTENTE) |

**`canvas-bridge.ts` (lado padre) no se toca, y está bien.** Valida por `event.source` + nonce y
nunca por origen, que es lo correcto porque el lienzo tiene origen opaco: la línea que lo dice y lo
hace es `canvas-bridge.ts:10-11` («Validación en el padre por `event.source === iframe.contentWindow`
+ `nonce`, **NUNCA por `event.origin`**») y su implementación en el manejador de `READY`. El que sí
estaba horneado era el **hijo** (`canvas-client.ts:73`, `opts.expectedParentOrigin ??
process.env.NEXT_PUBLIC_EDITOR_ORIGIN`), y era el segundo candado del mismo defecto: con la CSP ya
arreglada, el hijo seguiría descartando el `HELLO` del padre legítimo servido en otro puerto.

**El protocolo v1 no cambia.** `HelloMessage` sigue siendo `{envelope, t:"HELLO", nonce}`
(`packages/schema/src/canvas-protocol.ts:62-66`). El origen se aprende del navegador
(`ancestorOrigins`/`referrer`), no del mensaje, justamente para no tocar el contrato.

**La CSP no se afloja.** Hosts explícitos, sin `'self'`, `connect-src 'none'`, nonce por petición,
`TOLERADAS = []` intacto en `e2e/lienzo-csp.spec.ts`. `test/proxy-origen.test.ts` lo afirma también
por lo negativo (`not.toContain("'self'")`, `not.toMatch(/unsafe-eval|unsafe-inline/)`).

---

## 6. N-02 — el hallazgo colateral: `throw` en `register()` no impide arrancar

Primera corrida de la A/B, con el `instrumentation.ts` que lanzaba una excepción (el diseño del
bloque 3-8):

```
   se intenta servir el build de :3050 en :3000 SIN la puerta de escape
   salida del proceso: (sigue vivo)
   [arranque] El origen del build no es el que se va a servir: NEXT_PUBLIC_EDITOR_ORIGIN se horneó …
   AVISO: el proceso NO murió. La aserción de arranque no está haciendo su trabajo.
…
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
```

`next@16` **captura** la excepción de `register()`, la imprime como un error más del registro y sigue
sirviendo — el `EADDRINUSE` del intento siguiente demuestra que el servidor había quedado escuchando.
Consecuencia para la memoria: la guarda de arranque de U-6 (`ADR-3-8-03`, bloque 3-8) llevaba desde
entonces siendo un mensaje en un log que nadie mira, no una guarda. Corregido con recuadro en
`stderr` + `process.exit(1)`, que sí mata el proceso:

```
   salida del proceso: 1
   ARRANQUE ABORTADO · el origen del build no es el que se va a servir (N-02)
   el proceso murió: la aserción de arranque SÍ impide servir un build desalineado.
```

---

## 7. N-02 — la A/B sobre el MISMO build en dos puertos

Guion reproducible: `evidencia/fase-3c/bloque-menos1/ab-origen.mjs`. Salida literal:
`ab-origen-salida.txt`. Capturas: `capturas/editor-3050.png` y `capturas/editor-3000.png`.
Construye UNA vez horneando `NEXT_PUBLIC_EDITOR_ORIGIN=NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3050`,
sirve ese mismo `.next` en los dos puertos con el backend y la siembra vivos, y mide con el Chromium
de `/opt/pw-browsers`. El enlace **no lo calcula el guion**: abre el diálogo de publicado del producto
y lee «Copiar enlace», «Ver como invitado» y el `href` de WhatsApp.

```
-- 4. medición en :3050                     -- 4. medición en :3000
   iframe del lienzo presente ..... true       iframe del lienzo presente ..... true
   frames /canvas ................ 1          frames /canvas ................ 1
   lienzo pintado ................ true       lienzo pintado ................ true
   frame-ancestors servido ....... :3050      frame-ancestors servido ....... :3000
   violaciones de CSP en consola . 0 []       violaciones de CSP en consola . 0 []
   violaciones dentro del lienzo . 0 []       violaciones dentro del lienzo . 0 []
   «Copiar enlace» ............... :3050/i/…  «Copiar enlace» ............... :3000/i/…
   «Ver como invitado» (href) .... :3050/i/…  «Ver como invitado» (href) .... :3000/i/…
   WhatsApp (href) ............... :3050…     WhatsApp (href) ............... :3000…
   ese enlace abre ............... HTTP 200   ese enlace abre ............... HTTP 200

   :3050 CUMPLE · :3000 CUMPLE  →  N-02 CERRADA          (código de salida 0)
```

Contra lo que medía la 3-B en `:3000`: `frames /canvas = 0`, `lienzo pintado = false`,
`frame-ancestors http://127.0.0.1:3050` y el enlace de WhatsApp con el puerto del build.

**Por qué no es un e2e.** La compuerta que faltaba es precisamente que `playwright.config.ts`
reconstruye con el origen del puerto que va a servir (`webServer.command` = `pnpm run build && pnpm
run start`, con `NEXT_PUBLIC_EDITOR_ORIGIN` derivado del propio `PW_PORT`). Un spec dentro de ese
arnés volvería a medir un build hecho a medida del puerto: es el punto ciego que N-02 describe. Lo que
sí queda encapsulado en pruebas normales es cada mitad del mecanismo (§9). Se valoró un
`webServer: [a, b]` con dos entradas; se descartó porque contamina la corrida normal de e2e (dos
`next start` y un build extra en cada pasada) para cubrir un caso de despliegue, no de producto.

---

## 8. Lo que toqué fuera de lo estrictamente pedido, y por qué

- **`frontend/apps/web/scripts/capturas-cierre-3b.mjs`**: `pnpm run lint` estaba **en rojo antes de
  este bloque** (3 errores `no-undef` por `window`/`document` dentro de `page.evaluate`). Comprobado
  con `git stash` sobre el árbol sin mis cambios: mismos 3 errores. Como «lint en verde» es compuerta
  del encargo, lo arreglé con la **misma convención y por la misma razón** que ya usa su hermano
  `scripts/capturas-editor.mjs:2` (`eslint-disable no-undef` con el motivo escrito). Cero cambio de
  comportamiento. Queda dicho aquí y en el reporte para que no se me apunte como trabajo del bloque.
- **`components/editor/PublishDialog.test.tsx`** y **`publicar-enlace-y-cache.test.tsx`**: un docblock
  `@vitest-environment-options { "url": "https://invitaciones.mx/editor/3" }`. Al invertir el orden de
  `origenPublico()`, en jsdom mandaría `http://localhost:3000` y esas dos pruebas afirmaban un dominio
  público. Declarar el origen de jsdom mantiene su intención (el enlace no es el `publicUrl` del
  servidor) sin debilitar ninguna aserción.
- **NO** se tocaron `playwright.config.ts`, `lighthouserc.cjs`, `scripts/dev-backend.sh` ni
  `scripts/measure-lcp.sh`: se revisaron y **ninguno depende de la variable horneada de forma que deje
  de funcionar** (`playwright.config.ts` deriva `NEXT_PUBLIC_EDITOR_ORIGIN`, `NEXT_PUBLIC_SITE_URL` y
  `PORT` del mismo `ORIGEN`, así que la aserción nueva calla; `dev-backend.sh` usa
  `TPL_DEV_FRONTEND_URL`, que ya era de ejecución; `measure-lcp.sh` sólo maneja `LHCI_PORT`).
- **`evidencia/fase-3/**.png` REVERTIDOS.** La suite completa de e2e regenera por diseño las capturas
  de `evidencia/fase-3/editor|flujo|ux-corregido` (`e2e/editor-nucleo.spec.ts:22`,
  `flujo-principal.spec.ts:22`, `clienta-sin-sesion.spec.ts:27`…), así que correrla dejó 19 PNG
  modificados que **no son evidencia de este bloque** (mismas vistas, otra codificación). Devueltos con
  `git checkout --` para que el diff del bloque contenga sólo lo suyo.
- **NO** se tocó `scripts/smoke.sh`: no usa `/auth/request-password-reset` ni `resetToken`, y su
  `/auth/signup` sigue funcionando (el alta correcta limpia el contador de su ámbito; en la segunda
  pasada el `400` cuenta un intento y el `/auth/token` posterior sigue su camino). Corrido dos veces
  seguidas, 19/19 las dos.

---

## 9. Compuertas — salida real

| compuerta | resultado |
|---|---|
| `./gradlew test` (sin `clean`) | **1 271 pruebas · 0 fallos · 0 errores · 0 omitidas**, 85 clases. Cobertura JaCoCo **93,60 % líneas / 80,21 % ramas** (idéntica a la de `contratos.md §12.2`) |
| `pnpm run test` (frontend) | **4/4 tareas**. schema 527 · sections 653 · web **379** (eran 355) = **1 559** |
| `pnpm run typecheck` | 4/4 tareas |
| `pnpm run lint` | 3/3 tareas · **0 errores**, 1 aviso preexistente (`flujo-principal.spec.ts:94`, variable sin usar) |
| `pnpm run build` | 2/2 tareas, 11 rutas |
| `scripts/dev-backend.sh start` + `seed-demo.sh` + `smoke.sh` | **19/19 OK · 0 fallidas · exit 0**, dos veces seguidas |
| `playwright test e2e/lienzo-csp.spec.ts` | **3 passed** (`TOLERADAS = []` sin tocar) |
| `playwright test e2e/clienta-sin-sesion.spec.ts` | **1 passed** |
| `playwright test` (suite completa) | **50 passed** en 1,2 min |
| A/B de N-02 | **:3050 CUMPLE · :3000 CUMPLE**, código de salida 0 |
| N-01 antes/después con `curl` | reproducido y cerrado (§3) |

Pruebas nuevas: 13 en Kotlin (8 + 5) y 24 en TypeScript (8 `proxy-origen` + 6 `origenDelPadre` + 10
en `enlace-publico`).

---

## 10. Lo que NO pude, y riesgos que quedan

1. **El oráculo de temporización residual de `request-password-reset` no está medido.** El camino «no
   existe» acuña el token igual, pero no escribe en la base. Es mucho menos que un `400` frente a un
   `200`, pero es distinto de cero. El brief no exigía medirlo con 30 muestras; queda anotado.
2. **El bloqueo de cuenta como denegación de servicio sigue abierto**, ahora también en
   `RECUPERACION`: cinco peticiones ajenas dejan a la dueña sin poder pedir recuperación quince
   minutos. El prefijo de ámbito impide que eso le cierre **el acceso**, que era el riesgo nuevo, pero
   no resuelve la cuestión de fondo, que `handoffs/3-para-fase-4.md §4` ya tenía listada y que este
   bloque deja **fuera de alcance** por acuerdo.
3. **El limitador sigue siendo en memoria y por proceso** (`ADR-3B-I02-01`): un reinicio borra los
   contadores y dos instancias no los comparten. Con tres ámbitos, el techo por IP pasa de 20 a 60
   intentos por ventana; ninguno de los dos nuevos abre sesión.
4. **`Host` y `x-forwarded-host` los controla el cliente.** Falsificarlos sólo cambia la CSP de la
   respuesta de quien los manda (ruta dinámica, nonce por petición, sin caché) y no afloja ninguna
   directiva, pero la recomendación firme para producción es declarar `EDITOR_ORIGIN`. La aserción de
   arranque no puede exigirlo: no sabría distinguir un despliegue detrás de un proxy inverso.
5. **`ancestorOrigins` no existe en Firefox.** Ahí manda `document.referrer`, y una política de
   `Referrer-Policy` muy estricta podría dejarlo vacío; en ese caso el hijo cae en la constante
   horneada y volveríamos al comportamiento anterior en ese navegador. No se ha podido medir: en este
   entorno sólo hay Chromium (`contratos.md §7` prohíbe `playwright install`). **Riesgo real y
   declarado.** La defensa que sí es transversal es `frame-ancestors`, que ya nombra el origen bueno.
6. **`app/(public)/layout.tsx` sigue leyendo `metadataBase` de `NEXT_PUBLIC_SITE_URL`.** Es código de
   servidor —donde la variable es la fuente correcta— pero sigue siendo de compilación. La aserción de
   arranque lo cubre indirectamente (avisa si esa variable no cuadra con lo servido). No se cambió por
   disciplina de alcance.
7. **No se ha vuelto a medir el LCP ni el presupuesto de JS.** `proxy.ts` sólo corre en la ruta del
   lienzo y `enlace-publico.ts` no cambia de tamaño apreciable, pero los márgenes son estrechos (JS
   144,2 KB de 150; LCP mediana 2 241 ms de 2 500) y **este bloque no aporta una medición nueva**. El
   `e2e/presupuesto.spec.ts` sí pasó dentro de la suite completa (3 casos).
