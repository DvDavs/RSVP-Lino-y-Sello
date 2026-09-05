# 3-ADV — revisión adversarial global de cierre de la fase 3

**Fecha:** 2026-09-05 · **Árbol revisado:** `claude/fase-3-frontend-orchestration-yuh8sx` @ `6cf9ec4`
(«merge(frontend): 3-7»). **Método:** atacar, no leer. Todo lo marcado `[V]` se ejecutó en esta
sesión contra el backend real (`scripts/dev-backend.sh`, `:6003`), el `build` de producción de
`apps/web` (`pnpm start`, `:3100`) y Chromium 1194 real vía Playwright. `[I]` = inferido.

---

## VEREDICTO: **NO CERRABLE**

Un defecto **vivo, reproducible y de camino feliz** rompe una de las dos funciones editoriales del
tipo de bloque `richText`: **escribir negrita o cursiva devuelve `500 TPL_INTERNAL`**. Lo ven cero
de las 2 390 pruebas del proyecto (1 195 Kotlin + 1 195 TS), todas verdes. Es exactamente el patrón
que la revisión equivalente de la fase 1 buscaba: un defecto de integración que las pruebas no
pueden ver porque **ninguna inyecta nunca el valor que lo dispara**.

A eso se suman: una cláusula de accesibilidad del contrato incumplida con `axe` en verde, una
compuerta de seguridad que **no puede ponerse en roja**, y la evidencia de cierre de la fase
(`19/19 rutas OK`) que hoy **mide 10/19**.

**5 altas · 6 medias · 4 bajas.**

---

## Cifras que medí yo (mandan sobre las declaradas)

| Magnitud | Declarado en el brief | **Medido por mí** | Comando |
|---|---|---|---|
| Pruebas TS | 1 195 (505·360·330) | **1 195** — 505 + 360 + 330, 0 fallos `[V]` | `pnpm -r test` → `EXIT=0` |
| Pruebas Kotlin | 1 195 | **1 195**, 0 fallos, 0 errores, 0 omitidas `[V]` | `./gradlew cleanTest check --rerun-tasks` → `BUILD SUCCESSFUL in 2m 31s`, `EXIT=0`; conteo sobre los 80 XML de `build/test-results/test/` |
| `typecheck` / `build` | limpios | **limpios** `[V]` | `pnpm -r build` → `EXIT=0` |
| `lint` | limpio | **0 errores, 1 aviso** `[V]` (`e2e/flujo-principal.spec.ts:94`, P-3-8-7) — pero `packages/schema` no se lintea (H-ADV-08) | `pnpm -r lint` |
| Presupuesto JS `/i/[publicToken]` | 143 / 150 KB | **144,0 / 150 KB** `[V]` (margen 6,0 KB, no 7) | `pnpm --filter web run budget` |
| `axe` AA en el render público | 0 violaciones | **0 violaciones, 0 críticas/serias** `[V]` … **y aun así incumple AA** (H-ADV-02): 10 nodos `incomplete` de `color-contrast` tapan un 2,66:1 real | `@axe-core/playwright`, tags `wcag2a…wcag22aa` |
| Cobertura `schema` (90/95/85) | — | Stmts 99,93 · Branch 87,77 · **Funcs 100** · Lines 99,93 `[V]` |
| Cobertura `sections` (70/75/60) | — | Stmts 93,65 · Branch 80,61 · **Funcs 96,62** · Lines 95,92 `[V]` |
| Cobertura `apps/web` (60/65/50) | — | Stmts 74,15 · Branch 65,44 · **Funcs 70,37** · Lines 78,40 `[V]` |
| `scripts/smoke.sh` | 19/19 OK | **10/19 OK, 14 comprobaciones fallidas** `[V]` (H-ADV-04) | `scripts/smoke.sh` |
| `securitypolicyviolation` en el lienzo (criterio A4) | 0 (8/8) | **1** en `apps/web` (`script-src` / `eval`) `[V]` | medido en el `<iframe>` real del editor |

`verifyJsonSchemaEmitted` corrió y pasó: «11 esquemas idénticos a los versionados» `[V]`.
`jacocoTestCoverageVerification` corrió y pasó `[V]`. Las 56 ADR de la fase 3 están **todas en
estado `propuesta`** `[V]` (2+3+3+8+4+5+4+1+5+5+2+4+4+6).

---

## Tabla de objeciones

| id | gravedad | objeción | evidencia | remedio | quién |
|---|---|---|---|---|---|
| **H-ADV-01** | **alta** | Escribir **negrita o cursiva** en cualquier campo `richText` devuelve `500 TPL_INTERNAL`: todo `RichSpan` con `marks` revienta el codificador. | `[V]` `POST /editor/invitations/55/document/operations` con `{"kind":"richText","doc":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"texto en negrita","marks":["bold"]}]}]}}` → `HTTP 500 {"code":"TPL_INTERNAL"}`. El **mismo cuerpo sin `marks` → `HTTP 200 applied=true`**. `build/dev/backend.log`: `java.lang.ClassCastException: ObjectNode cannot be cast to ArrayNode` en `DomainJson.kt:291` ← `:282` ← `:275` ← `:245` ← `:789` ← `EditorDocumentService.applyOperations:429`. Reproducido con el payload **que genera el propio editor**: `textoAMarcadoARichDoc("Te queremos **muchisimo** de verdad")` (`apps/web/lib/rich-text.ts:43`) → mismo 500. | `DomainJson.kt:291` es `o.set<ArrayNode>("marks", arr)`. `ObjectNode.set()` de Jackson devuelve **`this`**, y como esa expresión es el valor de retorno del lambda `s.marks?.let { … }`, Kotlin inserta un `CHECKCAST` a `ArrayNode` sobre un `ObjectNode`. Arreglo: `o.set<ObjectNode>("marks", arr)` o terminar el lambda con `Unit`. Añadir un golden de documento (no de caso de esquema) con `marks` a `golden/templates/` **y** un caso de reductor, o el agujero vuelve. | backend `templates2/schema` (fase 2 lo introdujo, la fase 3 lo hizo alcanzable: no puede cerrarse diciendo que el editor funciona) |
| **H-ADV-02** | **alta** | El contrato §8 exige **WCAG 2.2 AA** y la invitación publicada **no lo cumple**, aunque `axe` dé 0: el título del RSVP mide **2,66:1** sobre su banda (umbral 3,0 para 48 px). `axe` lo deja en `incomplete` por el degradado y nunca lo cuenta. Además 8 de los 12 `<h2>` se pintan en la tipografía de **cuerpo**. | `[V]` medición de estilos computados sobre `/i/pub_GR3Y93J5VDWXSW2YNKE0QYC8YJ` en Chromium: `s-rsvp "¿Nos acompañas?"` `px=48 ratio=2.66 umbral=3 cumple=false`; los otros 11 `<h2>` a 12,33. `axe` en la misma carga: `violacionesTotales: 0`, `incompletas: [{id:"color-contrast", nodos:10}]`. Tipografía: `s-event, s-gallery, s-story, s-giftTable, s-suggestions, s-amenities, s-dressCode, s-rsvp` → `h2="Cormorant Garamond"` pero `span=Inter`. Causa leída: `RsvpSection.module.css:79` `color: inherit` vs `blocks/blocks.module.css:6-10` `.text { font-family: var(--inv-font-body); color: var(--inv-color-ink) }`. | Es literalmente A2+A3 de `handoffs/3-cv.md`, aún sin aplicar: `> * { font: inherit; color: inherit; letter-spacing: inherit }` en `.heading` de las ocho hojas (verificado `[V]`: **0** de las 8 lo tienen hoy). Y añadir el caso `<h2>` sobre `accent` a `test/theme/contraste-plantillas.test.ts`, que hoy sólo comprueba parejas de tokens de paleta, no combinaciones renderizadas. | `packages/sections` |
| **H-ADV-03** | **alta** | La **única** aserción que protege `script-src` en la CSP del lienzo es un `console.warn`: la compuerta **no puede ponerse en roja**. Y con ella en verde, el criterio **A4 de la compuerta A1-A8 (0 `securitypolicyviolation`) — una de las cinco condiciones obligatorias de ADR-1R-F-02 / contrato §8 — NO se cumple en `apps/web`**. | `[V]` `pnpm exec playwright test e2e/lienzo-csp.spec.ts` → **`1 passed`** imprimiendo a la vez `lienzo-csp: script-src/eval sigue abierto … [{"directive":"script-src","blockedURI":"eval",…}]`. El código: `e2e/lienzo-csp.spec.ts` filtra `deEval` y hace `if (deEval.length > 0) console.warn(...)` — **sin `expect`**. `[V]` dentro del `<iframe>` real del editor: `window.__cspViolations` = `["script-src \| eval"]`. ADR-3-0b-01 declara «A4 **0** eventos» — medido sobre `frontend/spikes/canvas-gate`, **no** sobre el producto. | Dos cosas distintas: (a) afirmar `expect(violaciones.filter(v => v.directive !== "script-src")).toEqual([])` **y** un `expect` acotado que permita exactamente la violación conocida de Zod (`blockedURI === "eval"`) y falle ante cualquier otra — hoy una inyección realmente bloqueada pasaría inadvertida; (b) resolver o reclasificar A4: o `configureZodForCanvas()` funciona en `apps/web` (no lo hace) o ADR-3-0b-01 debe enmendarse para decir que A4 se cumple en el spike y no en el producto. **No aflojar la CSP.** | dueño del lienzo (linaje 3-0b/3-1) |
| **H-ADV-04** | **alta** | `scripts/smoke.sh` —la herramienta que produce la evidencia «19/19 rutas OK» de `handoffs/3-0a.md`— lleva rota desde el bloque 3-2d. Hoy mide **10/19**. Nadie la ha vuelto a correr desde entonces, así que **el inventario de rutas no está verificado**. | `[V]` `scripts/smoke.sh` → `10/19 OK · 14 comprobación(es) fallida(s)`. Causa raíz: `smoke.sh:144,151,246` cargan `assets/preview.png` y `assets/rsvp-bg.png`; ADR-3-2d-02 convirtió la imaginería a **WebP** y el paquete sólo tiene `divider.webp`, `preview.webp`, `rsvp-bg.webp`. `curl` falla («error encountered when reading a file»), el `assetId` sale `null` y cascadean las rutas 4, 6, 7, 7b, 9, 11, 15, 15b. `[V]` con sólo la extensión corregida: **17/19**. Las dos que quedan: ruta 17 → `422 TPL_PACKAGE_ASSET_MISMATCH` «el manifiesto declara assets que no vienen en el paquete: assets/divider.webp, assets/rsvp-bg.webp» (el script sube **uno**, el manifiesto declara **tres**), y ruta 19 → `409` porque la demostración sembrada usa esa versión. | Actualizar `smoke.sh` a `.webp`, subir los tres assets en la ruta 17, y hacer la ruta 19 independiente del orden (deprecar una versión que nadie use, o crearla al vuelo). Corregir además la tabla de `handoffs/3-0a.md §2`, que sigue diciendo `xv-jardin → preview.png`. Volver a generar `evidencia/fase-3/bloque-0/smoke.txt`. | 3-0a (script) con la deriva de 3-2d |
| **H-ADV-05** | **alta** | La pantalla `/acceso` que añadió la fase 3 pone puerta pública a un `/auth/token` **sin límite de intentos** y con un **oráculo de temporización** que enumera cuentas. | `[V]` 12 intentos seguidos con contraseña mala → `401` los 12, y la contraseña buena funciona **inmediatamente después** (`200`): no hay bloqueo, ni retardo, ni captcha. `[V]` temporización, 5 muestras cada una, sin solape: correo **inexistente** `0,0048 · 0,0041 · 0,0038 · 0,0038 · 0,0040` s; correo **existente** con contraseña mala `0,0877 · 0,0867 · 0,0909 · 0,0911 · 0,0912` s → **≈22×**. El mensaje es idéntico en ambos casos (bien), la latencia no. | La causa está en el módulo `auth` heredado (fuera de `templates2`), pero la fase 3 es la que le construyó el portal. Hace falta: limitar intentos por cuenta y por IP, y ejecutar el hash también cuando el usuario no existe (comparación contra un hash señuelo) para igualar el tiempo. Necesita **dueño asignado**: hoy no lo tiene nadie y no está en `preguntas-abiertas.md` `[V]`. | orquestador → dueño del módulo `auth` |
| **H-ADV-06** | media | Contrato §8 (ADR-1R-F-07): «**tipografías siempre autoalojadas**, `source:"google"` sólo con lista blanca compilada». No hay ninguna lista compilada: el juego `moderna` **no se sirve** y cae a la pila del sistema. | `[V]` `xv-jardin/1.0.0/theme.json`: `defaultFontSetId:"moderna"` y **un solo** `fontSet` (`Playfair Display` + `Source Sans 3`, `source:"google"`). `[V]` `apps/web/app/(public)/publico.css` sólo importa `@fontsource/cormorant-garamond` y `@fontsource/inter`. Alcanzable también desde `boda-clasica`, cuyo `theme.json` ofrece `moderna` como segundo juego en el `ThemePicker`. | Importar `@fontsource/playfair-display/{400,700}` y `@fontsource/source-sans-3/{400,600}` (A4 de 3-cv), o una prueba que falle si algún `fontSet` de `frontend/templates/**` no tiene cara autoalojada. Sin eso, cada plantilla nueva puede repetirlo en silencio. | `apps/web` + `frontend/templates` |
| **H-ADV-07** | media | El render público sirve **`HTTP 200`** para «no encontrada»/«no disponible» y las cachea con `stale-while-revalidate=31535700` (**≈365 días**), frente a los `3600` del backend y a la ventana de **300 s** que el contrato §4 acepta. | `[V]` token inexistente → `HTTP 200` + `Cache-Control: s-maxage=300, stale-while-revalidate=31535700`. `[V]` tras `DELETE …/release`, el backend responde `404` y el frontend sigue sirviendo la invitación publicada (`x-nextjs-cache: HIT`, nombres visibles). `[V]` a la inversa: un enlace visitado **antes** de publicar cachea el «no encontrada» y sobrevive a la publicación. `[V]` `POST /api/revalidate` **sí** limpia las dos (`MISS` y contenido correcto tras llamarlo). | Fijar `expireTime` en `next.config.ts` para que el SWR no exceda la ventana que el contrato acepta, y devolver el estado HTTP correcto (pregunta abierta 4 de 3-3, aún abierta). El editor ya invalida al despublicar y al rotar (`PublishDialog.tsx:142,158` `[V]`), pero el webhook del backend sigue apagado (P-3-8-5): cualquier publicación fuera del editor deja el caché mintiendo. | `apps/web` (3-3) + P-3-8-5 |
| **H-ADV-08** | media | `packages/schema` **no se lintea**: su `lint` es un `echo`. `pnpm -r lint` sale en verde sin haber mirado el paquete que sostiene el contrato compartido con Kotlin. | `[V]` `packages/schema/package.json:23`: `"lint": "echo 'lint: pendiente (fase 3, ADR-005 06 §7)' "`. `[V]` salida: `packages/schema lint: lint: pendiente (fase 3, ADR-005 06 §7)` → `Done`. La etiqueta dice «fase 3»; la fase 3 acaba sin hacerlo. | Enganchar `eslint src` como en `packages/sections`, o retirar la promesa del contrato §6 con una ADR que diga por qué. Una compuerta que no puede fallar es peor que no tenerla. | `packages/schema` |
| **H-ADV-09** | media | `next.config.ts` autoriza a `next/image` a buscar en **`https://**.amazonaws.com/**`** — todos los buckets S3 del mundo, no el del proyecto. `/_next/image` es un proxy de imágenes abierto a AWS. | `[V]` `next.config.ts` `images.remotePatterns` incluye `{ protocol:"https", hostname:"**.amazonaws.com", pathname:"/**" }`. `[V]` `/_next/image?url=https%3A%2F%2Fevil-bucket.s3.amazonaws.com%2Fx.png` → `403` (el remoto falló) frente a `400` de un host no permitido: el patrón **acepta** el host. Hoy es configuración muerta (`ImageBlock` usa `<img>` plano), lo que la hace más fácil de olvidar. | Acotar al bucket real (`hostname: "<bucket>.s3.<region>.amazonaws.com"`), o borrar el patrón mientras `next/image` no se use en el render público. | `apps/web` |
| **H-ADV-10** | media | P1 («nada en silencio») no se cumple en el puente del lienzo: un `READY` válido con nonce desconocido y todo mensaje que falla `event.source` se descartan con un `return` pelado, sin registro. | `[V]` desde la página del editor mandé un `READY` falso desde un `<iframe>` hermano y `KEY_COMMAND`/`BLOCK_CLICKED`/`READY v:99` desde la propia ventana: **todos rechazados** (bien) y **0 líneas de consola** en toda la corrida. `canvas-bridge.ts`, rama `m.t === "READY"`: `if (!noncesEnviados.has(m.nonce)) return;`, y `onWindowMessage`: `if (evento.source !== frame.contentWindow) return;`. `onInvalid`/`onIncompatible` sí avisan (`CanvasFrame.tsx:65-67`), la del nonce no. | Contar y registrar los rechazos por nonce (no los `foreign`, que son ruido legítimo de extensiones). Es la rama que taparía un fallo de saludo tras `restart()`, que limpia `noncesEnviados` mientras el lienzo puede seguir con el puerto viejo. | `apps/web` (3-4) |
| **H-ADV-11** | media | `apps/web/package.json` declara **`"zod": "4.5.4"` dos veces** en `dependencies`. | `[V]` líneas **41** y **51**; `jq '.dependencies\|keys\|length'` → 28 con 29 líneas de dependencia. Hoy inocuo (mismo valor, gana el último), pero indica que el manifiesto no se valida: un duplicado con versiones distintas se resolvería en silencio. | Quitar el duplicado y añadir una comprobación de claves repetidas al `package.json` (o `pnpm dedupe --check`). | `apps/web` |
| **H-ADV-12** | baja | `components/public/ComposedPreviewStub.tsx` y su prueba son **código muerto**: ninguna ruta los importa desde 3-3, que ya los declaró borrables. | `[V]` `grep -rn "ComposedPreviewStub" apps/web --include=*.tsx --include=*.ts` sólo devuelve el propio archivo y su `.test.tsx`. | Borrar los dos. Inflan el recuento de 330 pruebas de `apps/web` con cobertura de algo que no se sirve. | `apps/web` |
| **H-ADV-13** | baja | `/acceso?volver=/\evil.com` deja a la clienta **ya autenticada** en `chrome-error://chromewebdata/`. | `[V]` 9 cargas maliciosas contra `destinoSeguro`: **ninguna sale del origen** (bien), pero `"/\\evil.example.test/x"` y `"/\t/evil.example.test/x"` terminan en `chrome-error://chromewebdata/` en vez de caer a `/editor`. | En `app/(chrome)/acceso/page.tsx`, `destinoSeguro` debe rechazar también `\` tras la barra inicial y cualquier carácter de control, cayendo a `/editor`. | `apps/web` (3-8) |
| **H-ADV-14** | baja | El presupuesto declarado (143 KB) no es el que se mide hoy. | `[V]` `pnpm --filter web run budget` → `/i/[publicToken]: 144.0 KB gz de primera carga (límite 150.0 KB)`. Verde, pero el margen real es **6,0 KB**, no 7. | Actualizar la cifra en el cierre. La compuerta funciona (ver abajo). | orquestador |
| **H-ADV-15** | baja | `handoffs/3-0a.md §2` describe los paquetes con assets `preview.png` / `rsvp-bg.png`; hoy son tres `.webp` por plantilla. | `[V]` `ls frontend/templates/*/1.0.0/assets/` → `divider.webp preview.webp rsvp-bg.webp`. | Corregir la tabla junto con H-ADV-04. | 3-0a / 3-2d |

---

## Lo que ataqué y resistió

Con el mismo detalle que las objeciones: esto ya está comprobado y **no hace falta volver a mandarlo**.

### 1. XSS y escapado — resistió por completo `[V]`
Inyecté por el **camino real** (JWT propio obtenido con `POST /auth/token`, invitación 55 creada
para esto) en `text`, `richText`, `listText`, `person.name/note`, `image.alt`, `location.name/
address/mapHref` y `link.href`: `<script>`, `<img onerror>`, `"><svg/onload>`, `</textarea>`,
`</style>`, entidades dobles (`&amp;lt;`), rotura de contexto en `<title>`. Publiqué y abrí la
invitación en **Chromium real**:

```
dialogs: []          marcadores window.__*: {}      scriptsSospechosos: []
hrefsRaros: []       elementos con atributo on*: [] pageerror: []
img.alt = "\"><script>window.__A1=1</script><img src=y onerror=window.__A2=1>"   ← literal, inerte
```
En el HTML servido las 18 cargas aparecen escapadas (`&lt;`/`&gt;`/`>`), también dentro de
`<title>` y de los `<meta property="og:*">`. El esquema rechaza antes de tocar la base los `href`
con `javascript:`, `data:text/html`, `vbscript:`, `JaVaScRiPt:` y los que llevan espacios o comillas
(`400 TPL_MALFORMED_JSON`; `HttpUrl` = `/^https?:\/\/[^\s/$.?#].[^\s]*$/i`).

**`RichTextBlock` cumple su promesa de cero `innerHTML`, comprobado sobre el HTML servido y sobre el
DOM vivo**: construye el árbol React a mano (`<p>`/`<strong>`/`<em>`/`<a>`), y `LinkBlock`,
`LocationBlock` y `RichTextBlock` revalidan el esquema con `isSafeHttpUrl` aunque el contrato ya lo
garantice. En todo `packages/sections` hay **0** `dangerouslySetInnerHTML`; el único de `apps/web`
es el arranque con `nonce` del layout del lienzo (`app/(canvas)/layout.tsx:68`), una **constante sin
interpolación**.

### 2. CSP, `postMessage` y el lienzo — resistió, salvo A4 (H-ADV-03) `[V]`
- **Cabecera** en `/editor/[id]/canvas`: `default-src 'none'; script-src {APP} 'nonce-…'; style-src
  {APP} 'nonce-…'; font-src {APP} {CDN}; img-src {APP} {CDN} data:; connect-src 'none';
  frame-ancestors {APP}; base-uri 'none'; form-action 'none'`. **Ni un `'self'`.**
- **Sin evasión del `matcher`**: probé `/editor/3/canvas/`, `//editor/3/canvas`, `?x=1`, `/./`,
  `%2f`, `//` interno y mayúsculas — los que responden 200 llevan CSP; los demás son `308` a la ruta
  canónica (que la lleva) o `404`.
- **`connect-src 'none'` de verdad**: dentro del lienzo, `fetch` → `TypeError: Failed to fetch`;
  `XMLHttpRequest` → `NetworkError`; `WebSocket` y `sendBeacon` registran violación
  (`connect-src ws://…`, `connect-src http://…`). Ninguna petición sale.
- **Aislamiento real**, medido dentro del `<iframe>` del editor, no en una pestaña suelta:
  `window.origin === "null"`, `sandbox="allow-scripts"` (sin `allow-same-origin`),
  `referrerpolicy="no-referrer"`; `localStorage` y `sessionStorage` lanzan `SecurityError`;
  `document.cookie` lanza; `window.parent.location` y `window.parent.sessionStorage` lanzan
  `SecurityError`.
- **Cero secretos al lienzo**: busqué el JWT completo y su prefijo de 24 caracteres en los 54 620
  bytes del documento del lienzo y en todas las propiedades string de `window` → **0 coincidencias**.
  Ningún mensaje del protocolo lleva token; `targetOrigin:"*"` es seguro porque lo que viaja es el
  `ComposedDocument` ya resuelto, que el invitado ve igualmente en el render público.
- **Suplantación desde otro origen** (servidor propio en `127.0.0.1:3999`): `frame-ancestors`
  **impide enmarcar el lienzo** — *«Refused to frame … because an ancestor violates … frame-ancestors
  http://127.0.0.1:3100»*, `contentDocument` inaccesible. Abriéndolo como ventana y mandándole
  `HELLO` con **nonce inventado** y con **`v:99`**: el hijo no responde nada (valida
  `event.origin === NEXT_PUBLIC_EDITOR_ORIGIN`).
- **Suplantación al padre**: `READY` con nonce inventado desde un `<iframe>` hermano, y
  `KEY_COMMAND`/`BLOCK_CLICKED`/`READY v:99` desde la propia ventana → **todos rechazados**, el
  puente no pasa a `ready`. El padre valida por `event.source === iframe.contentWindow` **y** por
  nonce en el `READY`. (Que no deje rastro es H-ADV-10.)

### 3. Tokens y sesión — resistió `[V]`
El JWT vive **sólo** en `sessionStorage` bajo `invitaciones.auth.token`, escrito y leído únicamente
en `lib/api-client.ts` (P8). No es alcanzable desde el lienzo (origen opaco, ver arriba). No aparece
en ninguna URL, ni en atributos del DOM, ni en el HTML del lienzo. `sin token` → `401`; `Bearer
aaa.bbb.ccc` → `401`; documento de **otro cliente** → `403 TPL_FORBIDDEN`. El redirector de
`/acceso` **no es abierto**: 9 cargas (`//evil`, `https://evil`, `/\evil`, `/%09/`, `/%5C`, `\/`,
`/%2F%2F`…) y ninguna salió del origen.

### 4. Render público — resistió `[V]`
| caso | respuesta |
|---|---|
| `uses_templates2 = false` | `404 TPL_RELEASE_NOT_FOUND` |
| `invitation.is_enabled = false` | `403 TPL_INVITATION_UNAVAILABLE` |
| `customer.is_enabled = false` | `403 TPL_INVITATION_UNAVAILABLE` |
| `customer.is_banned = true` | `403 TPL_INVITATION_UNAVAILABLE` |
| token inexistente (backend) | `404 TPL_RELEASE_NOT_FOUND` |
| despublicada / token rotado | `404` (mismo código: sin oráculo añadido) |

`ETag: "sha256:ae1dba83…"` con prefijo de algoritmo; `If-None-Match` correcto → **`304` con 0 bytes**;
`If-None-Match` ajeno → `200`. `Cache-Control: public, max-age=300, stale-while-revalidate=3600` en
el backend. **`noindex` de verdad en la respuesta HTTP**: `X-Robots-Tag: noindex, nofollow` tanto en
`/i/*` como en la imagen de OpenGraph. Los metadatos y la tarjeta OG sólo llevan título, subtítulo y
fecha —lo que el invitado ve igualmente— y salen escapados. **Tokens imprevisibles**: siete
consecutivos (`pub_MGP2YM…`, `pub_HV6JDX…`, `pub_CZC0XA…`, `pub_4A2RZ1…`, `pub_NXBDMM…`,
`pub_NABC24…`, `pub_FCTH3D…`) sin orden ni prefijo común — `SecureRandom` por llamada
(ADR-2-ORQ-01) confirmado. El único oráculo `403`↔`404` es el que el contrato §4 acepta a propósito.

### 5. Límites y validación — resistió, con **una** excepción (H-ADV-01) `[V]`
| ataque | respuesta |
|---|---|
| `operations` con cuerpo ~800 KiB (> 768) | `413 TPL_BODY_TOO_LARGE` |
| `:choose-template` con ~9 KiB (> 8) | `413 TPL_BODY_TOO_LARGE` |
| clave desconocida en el lote | `400 TPL_MALFORMED_JSON` |
| `baseRevision: null` | `400 TPL_MALFORMED_JSON` |
| `clientBatchId` fuera de patrón (`"ab"`) | `400 TPL_MALFORMED_JSON` |
| `baseRevision` mentido (9999) | `409 TPL_REVISION_CONFLICT` |
| bloque inexistente | `422 TPL_BLOCK_UNKNOWN` |
| bloque `source:"business"` (`cover.date`) | `422 TPL_BLOCK_NOT_EDITABLE` |
| bloque `source:"fixed"` (`cover.buttonLabel`) | `422 TPL_BLOCK_NOT_EDITABLE` |
| `assetId` **de otra invitación** | `422 TPL_ASSET_NOT_OWNED` (ADR-030 se cumple) |
| asset con relación de aspecto errónea | `422 TPL_ASSET_SPEC_MISMATCH` |
| `richText` con `marks` | **`500 TPL_INTERNAL`** ← H-ADV-01 |

**Idempotencia**: mismo `clientBatchId` dos veces → `200 {applied:false, revision:5}` con la revisión
que produjo, exactamente como manda el contrato §4; y un tercer envío con el **mismo id y
operaciones distintas** también se ignora, dejando el valor de la primera (`"idem-primera"`): la
clave manda, como debe.

### 6. Undo por operaciones — **H-03 NO está reabierta** `[V]`
Es la comprobación que el brief marcaba como ALTA si fallaba. Verificada en los dos lados:
- **Servidor**, sobre un bloque `default` real (`gifts.title`): `setBlock` del usuario → `provenance
  = user`; **`clearBlock` → `provenance = default`** (devuelve el bloque a su escalón); y
  `setBlock(valorPorDefecto)` → `provenance = user`, que es justo la promoción que H-03 prohíbe.
- **Cliente**: `lib/undo.ts:113-119` elige `clearBlock` salvo que lo anterior fuera
  `provenance === "user" && value !== null`. La inversa de `clearBlock` sobre un bloque sin valor de
  usuario es `[]` (no-op), no un `setBlock`.
- El defecto que 3-6 §4 dejó abierto (el árbol crudo nunca se parcheaba, lo que corrompería la
  inversa del **segundo** `setBlock` de una sesión) **está corregido** por ADR-3-7-01:
  `store.ts` llama a `applyOperationToRawDocument(s.document, op)` antes de calcular nada, y la
  inversa se computa con el contexto tomado **antes** del parche.

### 7. Compuertas — dos funcionan, una no `[V]`
Saboteé tres a propósito:
- **Presupuesto**: `CHECK_BUDGET_OVERRIDE_KB=140` → `EXCEDIDO por 4.0 KB`, **exit 1**. Rompe de
  verdad.
- **Cobertura**: `vitest run --coverage --coverage.thresholds.functions=99` en `packages/sections` →
  `ERROR: Coverage for functions (96.62%) does not meet global threshold (99%)`, **exit 1**. Rompe de
  verdad, y el umbral de `functions` (el que existe porque `lines` engaña) está puesto en los tres
  paquetes con los valores del contrato §6.
- **CSP del lienzo**: **no rompe** — ver H-ADV-03. Es la única de las tres que no puede ponerse en
  roja, y es la de seguridad.

### 8. Afirmaciones «[V]» de bitácora que comprobé
| afirmación | bloque | ¿se sostiene hoy? |
|---|---|---|
| «1 195 pruebas Kotlin, 0 fallos» | cierre | **Sí** `[V]` — 1 195/0/0/0 con `--rerun-tasks` |
| «1 195 pruebas TS (505·360·330)» | cierre | **Sí** `[V]` |
| «`manifest` y `theme` en `GET …/document`» | 3-4b | **Sí** `[V]` — ambos campos presentes y completos |
| «`ETag` = `contentHash`, `304` con 0 bytes» | 3-0a | **Sí** `[V]` |
| «`notFound()`/`forbidden()` responden 200» | 3-3 | **Sí** `[V]` — sigue abierto (pregunta 4) |
| «`axe` 0 violaciones AA» | 3-8 | **Sí**, y **aun así incumple AA** `[V]` → H-ADV-02 |
| «A4: 0 `securitypolicyviolation`» | 3-0b | **No** en `apps/web`: 1 `[V]` → H-ADV-03 |
| «19/19 rutas OK» | 3-0a | **No**: 10/19 hoy `[V]` → H-ADV-04 |
| «presupuesto 143,1 KB» | 3-6 | **Casi**: 144,0 KB `[V]` → H-ADV-14 |
| «`pnpm -r lint` limpio» | 3-7 | **Sí** (0 errores) pero vacío para `packages/schema` `[V]` → H-ADV-08 |

---

## Nota de método
Trabajé sobre una invitación **propia** (id 55 y 56, creadas por SQL igual que hace `seed-demo.sh`)
para no perturbar la demostración compartida. Los interruptores que toqué en `invitation` y
`customer` para probar la matriz de disponibilidad quedaron **restaurados y verificados**
(`is_enabled=t`, `is_banned=f`, `uses_templates2=t`). No modifiqué ni una línea de producción: el
único cambio de esta rama son estos dos documentos de memoria.
