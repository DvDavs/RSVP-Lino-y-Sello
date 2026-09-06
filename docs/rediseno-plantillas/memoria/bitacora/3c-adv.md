# 3c-adv — revisión adversarial de accesibilidad y rendimiento del cierre de la fase 3-C

Worktree `/home/user/wt-3c/adv`, rama `wt/adv` desde `1a81b7e`. Backend propio `:6111`
(`TPL_DEV_DB=invitaciones_adv`, `TPL_TEST_STATE_DIR=/tmp/pg-adv`, `TPL_DEV_PIDFILE=/tmp/adv.pid`),
web `:3111`, LCP en `:3141`/`:3142`, Chromium `/opt/pw-browsers/chromium-1194`. Sin commit.
Método: reproducir EJECUTANDO. Toda cifra de aquí sale de una corrida de esta sesión.

## 0. Trampas del entorno que costaron una medición

1. **`scripts/seed-demo.sh` no lee `TPL_DEV_PORT`**, sino `TPL_DEV_BASE` (línea 34). Con las
   variables que prescribe `handoffs/3c-8.md` para el backend, el sembrado muere con
   «el backend no responde en `http://127.0.0.1:6003`» aunque el backend esté perfectamente vivo en
   `:6111`. Hay que exportar además `TPL_DEV_BASE=http://127.0.0.1:6111`.
2. **Máquina compartida.** Durante toda la sesión hubo otros dos worktrees sirviendo (`:3109`,
   `:3110`) y la carga media estuvo entre **4,3 y 9,9**. `measure-lcp.sh` imprime `uptime` justo por
   esto: las cifras de LCP de abajo son PESIMISTAS y no son comparables tal cual con las de
   `handoffs/3c-8.md`, medidas en otra máquina y con otra carga. Una corrida entera del LCP de `/`
   murió con `CHROME_INTERSTITIAL_ERROR` porque el sistema mató por memoria al `next start` que el
   propio `lhci` había levantado — y el script **se negó a dar un número** («no mide y no miente»),
   que es exactamente lo que tiene que hacer.
3. `next start` **no** empieza a servir un fichero nuevo de `public/` por copiarlo con el servidor
   encendido: hay que reconstruir. Cuesta una medición si no se sabe (§1).

---

## 1. A-01 (ALTA, ARREGLADA) · el producto se servía con tipografía genérica: `/fonts/*.woff2` = 404

### 1.1 Lo medido

Levantado exactamente como manda `handoffs/3c-8.md` (`pnpm --filter web run build` +
`PORT=3111 pnpm --filter web run start`):

```
GET /fonts/fraunces-latin-full-normal.woff2      -> 404   (content-type: text/html; charset=utf-8)
GET /fonts/onest-latin-wght-normal.woff2         -> 404
GET /fonts/red-hat-mono-latin-wght-normal.woff2  -> 404
```

Y en el navegador, sobre `/` (Chromium 1194, tras `document.fonts.ready`):

```
document.fonts  ->  Fraunces|unloaded · Onest|unloaded · Red Hat Mono|unloaded
getComputedStyle(h1).fontFamily
   -> "Fraunces Variable", Fraunces, "Fraunces Fallback", Georgia, "Times New Roman", serif
traza de red      ->  404 fraunces-latin-full-normal.woff2
                      404 onest-latin-wght-normal.woff2
                      404 red-hat-mono-latin-wght-normal.woff2
```

Es decir: el chrome entero se pintaba con **Georgia** (display) y **system-ui** (texto), las
fuentes de respaldo del *metric override*. **Tipografía genérica servida**, que es una de las cuatro
reglas que `10 §1` declara innegociables y que `brief-comun.md` repite como rechazo automático.

### 1.2 Por qué ninguna compuerta lo veía

El copiado lo hace `packages/ui/scripts/copiar-fuentes-publicas.ts`, que era un paso del `build` de
`@invitaciones/ui` **y de nada más**. El razonamiento del comentario (`turbo.json`: `build` depende
de `^build`) es correcto… para el único camino que pasa por turbo. Los tres caminos que de verdad
sirven la aplicación no pasan:

| Camino | Qué ejecuta | ¿copia las fuentes? |
| --- | --- | --- |
| `pnpm --filter web run build` (lo que prescribe `handoffs/3c-8.md` para el LCP) | `next build` | **no** |
| `webServer` de `playwright.config.ts` y de `playwright.design.config.ts` | `pnpm run build && pnpm run start` dentro de `apps/web` | **no** |
| job `e2e` de `.github/workflows/ci.yml` | `pnpm install --frozen-lockfile` + `playwright test` | **no** |

Y `apps/web/public/fonts/` **no está versionado** (`git ls-files frontend/apps/web/public` → vacío),
así que un clon limpio no tiene de dónde sacarlas. Las dos pruebas que parecen cubrirlo comprueban
el fichero de **origen** en `node_modules`, nunca el servido:
`packages/ui/test/fuentes.test.ts` (`existsSync(rutaNodeModules)`) y
`apps/web/test/tipografia-chrome.test.ts` («sus ficheros de origen existen»).

### 1.3 Demostración diferencial (la prueba de que nadie lo había visto)

`playwright test --config=playwright.design.config.ts` sobre el MISMO código, cambiando solo si
`public/fonts/` está poblado:

```
sin /fonts servidas :  124 failed   (todas por expect(page).toHaveScreenshot)
con /fonts servidas :  168 passed, 0 failed
```

Las capturas de referencia versionadas se generaron **con** las fuentes; el job de CI las compara
**sin** ellas. Es decir, la compuerta de regresión visual del sistema de diseño no podía estar
verde en CI, y el producto que CI mide no es el producto que se diseñó.

### 1.4 Arreglo y compuerta nueva

- `frontend/apps/web/package.json`: `build` y `dev` ejecutan el copiador antes de Next
  (`node ../../packages/ui/scripts/copiar-fuentes-publicas.ts && next build`). Idempotente (seis
  `copyFileSync`); no cambia nada cuando ya se entró por turbo. ADR `propuesta` **ADR-3C-ADV-01**.
- `frontend/apps/web/e2e/landing.spec.ts` gana «las tres voces autoalojadas se sirven y el navegador
  las carga (nada de tipografía genérica)»: mide **sobre HTTP** (200 y > 10 KB por fichero) y sobre
  `document.fonts` (`Fraunces` y `Onest` en `loaded`, `<h1>` pidiendo `Fraunces`), no sobre el disco.

Después del arreglo, mismo comando de siempre:

```
GET /fonts/fraunces-latin-full-normal.woff2      -> 200  121016 B  font/woff2
GET /fonts/onest-latin-wght-normal.woff2         -> 200   33760 B  font/woff2
GET /fonts/red-hat-mono-latin-wght-normal.woff2  -> 200   22412 B  font/woff2
document.fonts -> Fraunces|loaded · Onest|loaded · Red Hat Mono|loaded
```

### 1.5 Lo que el brief pedía comprobar de las fuentes, ya con ellas servidas

- **`preload` de la voz display**: presente y correcto —
  `<link rel="preload" href="/fonts/fraunces-latin-full-normal.woff2" as="font" crossorigin="anonymous" type="font/woff2">`.
  Next emite además su propia copia normalizada del mismo `<link>`; el navegador las funde y la
  **traza de red trae UNA sola petición** de ese fichero, así que el `crossOrigin` del comentario de
  `layout.tsx` está haciendo su trabajo (no hay descarga doble).
- **Ninguna fuente de la referencia se descarga**: la traza de `/` trae exactamente **tres** `woff2`
  (fraunces, onest, red-hat-mono, subconjunto latino). Ni Inter, ni Bricolage, ni Outfit.
  *Resto suelto (BAJA)*: `@fontsource-variable/{inter,bricolage-grotesque,outfit}` siguen declaradas
  como dependencias en `apps/web/package.json` sin un solo `@import` que las use.

---

## 2. A-02 (MEDIA, ARREGLADA) · la compuerta de los 24 px nunca ha mirado el producto

`e2e/design-objetivos.spec.ts` mide `getBoundingClientRect` ≥ 24 px, pero recorre **solo**
`paginasDeGaleria()`. Los componentes sueltos de `@invitaciones/ui` cumplen ahí; compuestos en las
pantallas reales, no. Medido con el mismo criterio sobre el producto (1280×900):

| Control | Pantalla | Medido | Fuente |
| --- | --- | --- | --- |
| enlace de marca «Invitaciones» | `/`, `/acceso`, `/ayuda` | **109,4 × 23,4 px** | `components/sitio/CabeceraSitio.tsx` |
| enlace de salto «Saltar al contenido», **ya enfocado** | todas las del sitio | **123,6 × 21 px** | `components/sitio/MarcoSitio.tsx` |
| «Volver a mis invitaciones» | `/ayuda` | **160,6 × 18 px** | `app/(chrome)/(sitio)/ayuda/page.tsx` |

El del enlace de salto es además un defecto de causa, no de valor: la utilidad `not-sr-only` de
Tailwind declara `padding: 0` y, con el variante `focus:`, gana en especificidad al `px-4 py-2` sin
variante que el elemento declara. El relleno del enlace de salto **estaba muerto**.

Arreglados los tres (`focus:px-4 focus:py-2`; `inline-flex items-center py-1` en los otros dos: cero
cambio de altura de la cabecera, porque quien la fija es el botón «Entrar»), y añadida la compuerta
que faltaba a `e2e/a11y-producto.spec.ts` — `objetivosDeAlMenos24px` sobre landing, acceso, ayuda y
editor, más `enlaceDeSaltoDeAlMenos24px`, que tabula hasta el enlace de salto y lo mide con el foco
puesto (sin foco es `sr-only` y cualquier medida es mentira).

---

## 3. Objeciones que NO pude cerrar (listadas, no arregladas)

### 3.1 M-01 (MEDIA) · foco invisible en la invitación pública — zona prohibida

Recorrido con Tab sobre `/i/pub_KPPNVC6CQ697HWWKZ7J43FP2EQ`, leyendo `getComputedStyle` del elemento
enfocado en cada pulsación:

```
1 «Ver en el mapa»            outline: 2px solid rgb(176,85,85)
4 «Ver la mesa en Liverpool»  outline: 1px solid rgb(176,85,85)
5 «Cómo llegar»               outline: 0px  solid rgb(176,85,85)   <- SIN anillo, box-shadow: none
6 «Confirmar asistencia»      outline: 1px auto rgb(16,16,16)      <- el del navegador, no del diseño
```

Cuatro enlaces de la misma pantalla con cuatro indicadores de foco distintos, uno de ellos
inexistente (2.4.7/2.4.11). Vive en `packages/sections`, que la fase 3-C tiene **prohibido tocar**
(`brief-comun.md`) y que es estética de plantilla, no del chrome. Se deja anotado: es deuda de la
fase 3-B que sigue viva en la ruta pública del producto.

### 3.2 M-02 (MEDIA) · el contraste «sobre la pila renderizada» no ve las capas hermanas

`e2e/util/contraste.ts` compone el fondo subiendo por los **ancestros** (`background-color` y
paradas de degradado). No ve: (a) `opacity` de la caja, (b) `filter`/`mix-blend-mode`, y sobre todo
(c) **capas hermanas absolutas** — que es justo lo que hace `Composition` de `@invitaciones/ui`, el
recurso característico del sistema (`shape` en un `<div>` absoluto `aria-hidden` DETRÁS del
contenido, `packages/ui/src/shapes/Composition.tsx`). En `/ayuda` el `<h1>` vive dentro de una
`Composition` con `Rays tone="primary-soft"`: si un rayo pasa por debajo del título, el fondo real
no es el que la prueba mide.

Comprobado por PÍXEL (apagar el texto, capturar el rectángulo, comparar el color del texto contra el
peor 10 % de los píxeles del fondo real): **véase §5.3** — hoy no hay ningún caso por debajo del
umbral, así que el hueco es de MÉTODO, no un defecto visible. Pero es un hueco: la compuerta puede
seguir verde el día que una forma pase por detrás de un texto con poco margen.

### 3.3 B-01 (BAJA) · la galería `/design` desborda a 400 % de zoom

`/design` con viewport CSS de 320 px (equivalente a 1280 px al 400 %):
`document.documentElement.scrollWidth = 333` frente a `clientWidth = 320` → **13 px de barra
horizontal** (WCAG 1.4.10). Las demás pantallas medidas están limpias a 200 % y a 400 %
(`/`, `/acceso`, `/ayuda`, los dos 404, `/i/<token>`, `/design/componentes`). `/design` es
documentación interna con `noindex`, por eso BAJA.

### 3.4 B-02 (BAJA) · el presupuesto de «primera carga» solo cuenta JavaScript

`scripts/check-budget.mjs` pesa exclusivamente los `.js` del manifiesto. Lo que el teléfono
descarga de verdad en `/`, medido en esta sesión: **148,2 KB gz de JS + ~13 KB gz de CSS + 177,2 KB
de `woff2`** (121.016 + 33.760 + 22.412 B; el `woff2` ya viene comprimido) ≈ **338 KB**. La voz
display sola (`fraunces-latin-full`, con los ejes SOFT y WONK) pesa **121 KB**, el 81 % del techo
entero de JS; `preload.ts` ya deja anotada la alternativa sin SOFT/WONK (67.304 B). No es un error
—`contratos.md §8` dice «JS de primera carga»— pero citar «150 KB de primera carga» sin el
calificativo describe menos de la mitad de lo que se descarga.

### 3.5 B-03 (BAJA) · restos

- Dependencias muertas: `@fontsource-variable/{inter,bricolage-grotesque,outfit}` en `apps/web`.
- `next.config.ts` fija `remotePatterns` al puerto `6003` y `proxy.ts` cae a `http://127.0.0.1:6003`
  para `CDN_ORIGIN` cuando no hay variable: con un backend en otro puerto (cualquier sesión que siga
  el protocolo de puertos propios) la CSP nombraría el host equivocado para imágenes y fuentes. Se
  arregla exportando `CDN_ORIGIN`; queda anotado porque el defecto por omisión es un puerto fijo.

---

## 4. Lo que intenté tumbar y NO pude (se sostiene)

### 4.1 Contraste sobre la pila renderizada: 0 fallos en nueve pantallas del producto

Con `e2e/util/contraste.ts` —el algoritmo del repositorio, transpilado y ejecutado tal cual dentro
del navegador— sobre el producto servido, tras `document.fonts.ready`:

| Pantalla | elementos medidos | por debajo de su umbral |
| --- | --- | --- |
| `/` | 63 | **0** |
| `/acceso` | 21 | **0** |
| `/ayuda` | 37 | **0** |
| 404 raíz | 4 | **0** |
| 404 público `/i/<inexistente>` | 2 | **0** |
| `/i/<token>` (invitación publicada) | 113 | **0** |
| `/design` | 46 | **0** |
| `/design/componentes` | 71 | **0** |
| `/editor` | 17 | **0** |

### 4.2 La compuerta de contraste NO es vacua (sabotaje)

VER §5.2.

### 4.3 `prefers-reduced-motion`

Sobre `/`, contando `document.getAnimations()` y `animation-name` computado:

```
prefers-reduced-motion: no-preference -> 1 animación viva (ui-forma-respira, SVG de fondo)
prefers-reduced-motion: reduce        -> 0 animaciones, 0 elementos con animation-name
```

`shapes.css` emite el movimiento dentro de `@media (prefers-reduced-motion: no-preference)` y además
lo apaga explícitamente en `reduce`. Correcto.

### 4.4 Reflow a 200 % y 400 %

Sin barra horizontal en `/`, `/acceso`, `/ayuda`, 404 raíz, 404 público, `/i/<token>` y
`/design/componentes`, a los dos niveles de zoom. Única excepción: §3.3.

### 4.5 Nombres accesibles y trampas de foco

Ningún control sin nombre accesible en las nueve pantallas (0/0/0/0/0/0/0/0/0). Ninguna trampa de
foco: el recorrido con Tab cierra en `body` en todas (21, 17, 19, 3, 1, 7, 14, 34 y 5 paradas
respectivamente) y ningún elemento enfocado quedó fuera de la vista. El único punto llamativo del
recorrido —`/acceso`, parada 8, un `<div>` enfocable con el panel entero como nombre— es el
`Tabs.Content` de Radix con `tabIndex=0`, patrón esperado y no un defecto. El foco del editor y del
diálogo de publicar ya lo cubren `e2e/teclado-editor.spec.ts` E-10a/E-10b/E-10c (ida, vuelta y
contención con Escape).

### 4.6 Presupuesto: idéntico a lo que afirma `handoffs/3c-8.md`

```
/i/[publicToken]:      142.0 KB gz de primera carga (límite 150.0 KB)
/:                     148.2 KB gz de primera carga (límite 150.0 KB)
/editor/[invitationId]: 419.3 KB gz de primera carga (límite 600.0 KB)
check-budget: dentro de presupuesto.        (código de salida 0)
```

Evidencia: `evidencia/fase-3c/cierre-adv/check-budget.txt`.

### 4.7 Seguridad ligera del chrome nuevo

- **`dangerouslySetInnerHTML`**: una sola aparición en todo `apps/web`, en
  `app/(canvas)/layout.tsx` — el enganche de `securitypolicyviolation` del lienzo aislado (fase 3-B),
  con `nonce` y contenido constante. **Ninguna en el chrome nuevo.**
- **Emojis**: 0 coincidencias de code point en todo `frontend/**` (rangos 1F000-1FAFF, 2600-27BF,
  FE0F, 2B00-2BFF, 2190-21FF).
- **Hex sueltos**: ninguno en `app/(chrome)/**`, `apps/web/components/**`, `packages/ui/src`,
  `packages/icons/src`. El único literal es `BLANCO = "#ffffff"` en `packages/tokens/src/paletas.ts`,
  que es la fuente de verdad de la paleta.
- **`--inv-*` en el chrome**: cero (las dos coincidencias son un comentario y una aserción de
  `movimiento.test.ts` que comprueba justo eso).
- **`/design` con `noindex`**: `metadata.robots = { index: false, follow: false }` en
  `app/(chrome)/design/layout.tsx`.

### 4.8 N-01 y N-02 siguen cerradas

**N-01** (`POST /auth/request-password-reset` regalaba el token):

```
POST /auth/request-password-reset {"email":"demo.boda@example.com"}      -> 200
   {"message":"Si el correo corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña"}
POST /auth/request-password-reset {"email":"no-existe-adv-3c@example.com"} -> 200
   {"message":"Si el correo corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña"}
```

Sin `resetToken` en el cuerpo y con **el mismo mensaje y el mismo código** para una cuenta que
existe y para una que no: cerrado el regalo del token y cerrada la enumeración por ese extremo.

**N-02** (origen horneado en el build). Build hecho **sin** `NEXT_PUBLIC_EDITOR_ORIGIN`, servido en
`:3111`:

```
GET /editor/3/canvas
content-security-policy: … frame-ancestors http://127.0.0.1:3111 …
```

`proxy.ts` compone la CSP en cada petición (`EDITOR_ORIGIN` → `x-forwarded-*` → `Host` →
`nextUrl.origin`) y `lib/enlace-publico.ts::origenPublico()` antepone `window.location.origin` a
`NEXT_PUBLIC_SITE_URL`. Las dos mitades del defecto, cerradas.

---

## 5. Rendimiento y sabotajes

### 5.1 LCP (`measure-lcp.sh`, N=9, `throttlingMethod: devtools`, puerto propio)

`/i/pub_KPPNVC6CQ697HWWKZ7J43FP2EQ`, puerto 3141, carga media 7,87 al arrancar:

```
#1 2205.9  #2 2027.3  #3 2168.2  #4 2145.0  #5 2789.3  #6 2116.1  #7 2536.4  #8 2450.3  #9 2201.8
N efectivo 9 · descartadas (NO_LCP) 0
Mediana 2201.8 ms · Rango 2027.3 – 2789.3 ms · Presupuesto 2500 ms
RESULTADO: CUMPLE
```

CUMPLE, pero conviene mirar el rango: **762 ms** de dispersión y **dos de las nueve corridas por
encima del presupuesto**, frente al 1975–2014 (39 ms) que reporta `handoffs/3c-8.md`. Dos
diferencias explican la distancia y ninguna es del código: esta máquina estaba a carga 8-10 con
otros dos worktrees sirviendo, y esta corrida descarga de verdad los 177 KB de fuentes que la de
3C-8 pudo no estar descargando (§1). Una medición en máquina tranquila es la única citable como
comparación.

`/` (portada), puerto 3142, carga media 3,47:

```
#1 1847.1  #2 1747.2  #3 1770.4  #4 1802.8  #5 1845.2  #6 2101.7  #7 1883.7  #8 1922.2  #9 1800.9
N efectivo 9 · descartadas (NO_LCP) 0
Mediana 1845.2 ms · Rango 1747.2 – 2101.7 ms · Presupuesto 2500 ms
RESULTADO: CUMPLE
```

Consistente con el 1761,9 (1723,9–1813,5) de `handoffs/3c-8.md`. El primer intento de esta medición
murió entero (`CHROME_INTERSTITIAL_ERROR`, §0.2) y el script no dio número: se repitió con la
máquina más tranquila. Evidencia: `evidencia/fase-3c/cierre-adv/lcp-{i-publictoken,portada}.txt`.

### 5.2 Sabotajes (la compuerta tiene que caer)

**S1 · el token del contraste.** Mismo sabotaje que documenta `design-contraste.spec.ts`
(`* { --ui-ink: #fdf9f7 !important }`), aplicado ahora a las pantallas del PRODUCTO y midiendo con
el algoritmo del repositorio sin tocar una línea de él:

```
/         sin tocar  ->  63 medidos ·   0 por debajo de su umbral
/         SABOTEADO  ->  63 medidos ·  27 por debajo         (peor 1.00)
/acceso   sin tocar  ->  21 medidos ·   0 por debajo
/acceso   SABOTEADO  ->  21 medidos ·   9 por debajo         (peor 1.00)
/ayuda    sin tocar  ->  37 medidos ·   0 por debajo
/ayuda    SABOTEADO  ->  37 medidos ·  25 por debajo         (peor 1.00)
```

**S2 · la compuerta nueva de 24 px.** `playwright test a11y-producto.spec.ts` contra el build
ANTERIOR a mi arreglo (mismo `.next`, mismos comandos):

```
3 failed
  landing (/)      -> objetivos por debajo de 24 x 24 px reales:
                      a.sr-only  «Saltar al contenido»   32 x 16
                      a.heading-sm «Invitaciones»     109,4 x 23,4
  acceso (/acceso) -> los dos mismos
  ayuda (/ayuda)   -> los dos mismos + a.rounded-ui-control «Volver a mis invitaciones» 160,6 x 18
3 passed
```

Con el arreglo, 13/13 en verde. (El `sr-only` sin foco se excluye a propósito: no es un objetivo
mientras está recortado; su medida con el foco puesto la hace `enlaceDeSaltoDeAlMenos24px`.)

**S3 · la compuerta nueva de las fuentes.** Con `public/fonts/` apartado y el servidor reiniciado:

```
1 failed
  landing.spec.ts:145  /fonts/fraunces-latin-full-normal.woff2 no se sirve:
                       el chrome caería a la fuente de respaldo
                       Expected: 200   Received: 404
```

Restaurados los ficheros, verde. Y la prueba diferencial de §1.3 (124 fallos / 168 verdes en la
regresión visual) es el mismo sabotaje al nivel de la galería entera.

### 5.3 Contraste medido por PÍXEL (el método que sí ve las capas hermanas)

El hueco de §3.2 se comprobó apagando el texto (`color: transparent`), capturando el rectángulo de
cada elemento y comparando su color contra los píxeles reales del fondo. El caso más expuesto es el
`<h1>` de `/ayuda`, que vive dentro de una `Composition` con `Rays`:

```
h1 /ayuda «¿En qué te ayudamos?» · color rgb(41,32,24) · 22 px
  colores de fondo DISTINTOS bajo el titular: 40   (253,249,246 · 253,248,245 · 255,235,241 ·
                                                    255,229,239 · 254,241,243 …)
  contraste real por píxel: mínimo 13,47 · máximo 15,26 · umbral 4,5
```

Cuarenta colores de fondo bajo un titular del que la compuerta mide **uno**: el hueco de método es
real y está demostrado. Que hoy no dé un defecto también: 13,47 contra un umbral de 4,5. El barrido
por píxel de `/`, `/acceso`, `/ayuda` y `/design` no encontró NINGÚN texto sobre una forma por
debajo de su umbral (los tres elementos que marcó son artefactos de mi propio arnés: controles de
texto blanco sobre relleno lleno, cuyo píxel real es `rgb(187,0,118)` — 5,43:1 con blanco —
comprobado uno a uno).

---

## 6. Estado de las compuertas al terminar

Todo desde `frontend/` en este worktree, con el backend `:6111` y la web `:3111` propias.

| Compuerta | Resultado |
| --- | --- |
| `pnpm run typecheck` | **10/10 tareas**, código 0 |
| `pnpm run lint` | **6/6 tareas**, código 0 |
| `pnpm run test` | **10/10 tareas** · schema 527 · sections 653 · icons 179 · ui 654 · tokens 55 · web 517 = **2 585 pruebas, 0 fallos** |
| `pnpm run build` | **5/5 tareas**, código 0 (el copiador de fuentes corre ahora en `ui:build` y en `web:build`) |
| `playwright test --project=chromium --workers=1` | **71/71 en verde** (los 70 de `3c-8` más la prueba nueva de las fuentes) |
| `playwright test --config=playwright.design.config.ts` | **279/279 en verde** (misma cifra que `3c-8`) |
| `scripts/smoke.sh` | **19/19 OK**, 0 fallidas |

Dos advertencias sobre la reproducibilidad de esa pasada de e2e, medidas aquí:

1. **`CDN_ORIGIN` hay que exportarlo en el proceso del SERVIDOR** cuando el backend no está en
   `:6003`. Sin él, `proxy.ts` mete `http://127.0.0.1:6003` en `img-src`/`font-src` de la CSP del
   lienzo, el lienzo no pinta y caen pruebas del editor: medido **5 rojas con `--workers=2`** y
   **2 con `--workers=1`** en este mismo árbol. Ponerlo en la línea de `playwright` no basta: el
   `webServer` ya estaba levantado.
2. **`e2e/a11y-publico.spec.ts` sigue flakeando bajo paralelismo.** Falló una vez con
   `--workers=2` (`color-contrast`, `serious`, los **mismos cuatro nodos** —`#s-couple`, el
   `kicker`, el `time[datetime="2027-04-18"]` y `#s-event`— que la cabecera del propio fichero
   documenta como carrera de temporización) y pasó **3 de 3** veces al ejecutarla sola. `axe` en la
   misma URL, con `document.fonts.ready` y las 3 imágenes en 200, da **0 violaciones y solo
   `incomplete: [color-contrast]`**. Es decir: `document.fonts.ready` no basta bajo contención;
   la compuerta puede dar un rojo falso — y, por el mismo mecanismo, podría dar un verde falso.

## 7. Rastro dejado en el entorno

Backend `:6111` parado, clúster efímero de `/tmp/pg-adv` parado, servidores web `:3111`, `:3141` y
`:3142` parados (todos por PID filtrando por `PORT=` en `/proc/<pid>/environ`, nunca `pkill -f`).

**Aviso para los otros worktrees**: había dos servidores ajenos sirviendo (`:3109` de `wt-3c/cv` y
`:3110` de `wt-3c/ux`) y al terminar ya NO estaban. No los maté yo —cada `kill` de esta sesión
filtró por `PORT=3111`— sino el gestor de memoria: la máquina tiene 16 GB, y con dos `next start`
ajenos, el mío, el `next start` que levanta `lhci` y los navegadores de Playwright, el sistema mató
por memoria **tres veces** mi propio servidor (código 137) y tumbó una corrida entera del LCP. Quien
retome esos worktrees tendrá que volver a levantar los suyos. `frontend/apps/web/public/fonts/` queda poblado (lo genera el `build`). Las 29 capturas de
evidencia de los bloques 3 y 3c-7 que el e2e regenera solas al correr se **revirtieron** con
`git checkout --` (mismo cuidado que documenta `bitacora/3c-8.md` § 3C-8b); `test-results/` y
`playwright-report/` quedan sin versionar, como siempre.
`frontend/apps/web/.lighthouseci/` queda con los LHR crudos de las corridas. Sin commit ni push.
