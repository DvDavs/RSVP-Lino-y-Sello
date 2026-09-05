# Bitácora 3B-ADV · revisión adversarial repetida del cierre de la fase 3

Veredicto y sólo las altas en `handoffs/3b-adv.md`. Aquí van las cifras, el método y las medias/bajas.
Árbol revisado `037d4fe` (rama `claude/fase-3b-cierre-orquestacion-z0pd4g`). **No implementé nada de
esta fase**, no hice commits y dejé el árbol limpio: `git status --short` vacío al terminar.

Entorno: backend compartido `127.0.0.1:6003` (arrancado desde el árbol integrado, no desde `wt/*`),
base `invitaciones_i10`, invitación 3 con enlace `/i/pub_91BJC9PMH4T7G77T7QRT7FXKX9`,
`apps/web` levantado por mí en `:3000`, `:3040` y `:3050`. Chromium preinstalado; **no** ejecuté
`playwright install` ni `dev-backend.sh stop/restart`.

---

## 0. Incidencia de entorno: `gradlew clean` contamina toda medida que dependa de imágenes

Anotada a petición del orquestador, y merece quedar escrita porque es una trampa reproducible.

`scripts/dev-backend.sh` exporta `TEMPLATES2_ASSETS_LOCAL_DIR=$RAIZ/build/templates2-assets`. Es decir:
**el almacén local de assets vive dentro de `build/`**, el mismo directorio que `./gradlew clean` borra.
La base de datos sigue apuntando a esos ficheros por `tpl_asset.s3_key`, así que tras un `clean`:

- todas las imágenes de la invitación publicada responden `404` sin que nada en la aplicación falle;
- el render sigue dando `200` y el `composed` sigue trayendo las URL, así que **no hay ninguna señal**;
- cualquier medida de contraste, WCAG, LCP o captura tomada en esa ventana es basura silenciosa.

Además, como el backend de desarrollo corre con `spring-boot-devtools` y su classpath es
`build/classes/**` del mismo árbol, un `clean` en paralelo **reinicia el backend con las clases a
medio compilar**: durante ~1 min `/auth/token` respondió `401` con `WWW-Authenticate: Basic realm="Realm"`
—la configuración de seguridad por defecto de Spring, no la de la aplicación— y `build/dev/backend.log`
desapareció. Se recupera solo cuando `compileKotlin` vuelve a escribir las clases.

**Para la fase 4**: sacar el almacén local de assets de `build/` (p. ej. `var/templates2-assets/`), o
que `dev-backend.sh` se niegue a arrancar si el directorio no existe pero la base tiene filas. Y no
correr `clean` contra el árbol del que cuelga un backend vivo.

Todas las medidas de contraste/píxeles/UX de esta bitácora se **repitieron** después de que el
orquestador restaurara el entorno. Las que no dependen de ficheros de assets (CSP, `/auth/token`,
unitarias, contrato, `smoke.sh`, análisis de código) se tomaron antes y siguen valiendo.

---

## 1. H-ADV-01 · negrita y cursiva — **CERRADA**

### 1.1 Por HTTP, contra el backend real

`POST /editor/invitations/3/document/operations`, `baseRevision:7`, un `setBlock` de
`couple.groomText` con seis `RichSpan`: `marks:["bold"]`, `marks:["italic"]`, `marks:["bold","italic"]`,
uno con `href`, uno con `marks:[]` y uno sin marcas.

```
HTTP=200   {"revision":8,"applied":true,…}
```

y el `composed` de la respuesta devuelve, sin pérdida:

```json
{"type":"text","text":"negrita","marks":["bold"]},{"type":"text","text":"cursiva","marks":["italic"]},
{"type":"text","text":" y ambas","marks":["bold","italic"]},{"type":"text","text":" enlace","href":"https://example.com"},
{"type":"text","text":" vacia","marks":[]}
```

`marks:[]` sobrevive como lista vacía, que es una rama distinta de `null`. **Restauré el valor
original** de `couple.groomText` acto seguido (`revision 9`, verificado en el `composed`).

Nota de método: el primer intento me devolvió `400 TPL_MALFORMED_JSON` porque metí `marks:["underline"]`;
el catálogo es cerrado (`blocks.ts:14`, `z.enum(["bold","italic"]).max(2)`). El esquema lo rechaza bien,
pero el mensaje que sale es `additionalProperties` sobre `$.operations[0]` (124 violaciones) porque falla
el brazo entero de la unión: **el error no nombra el campo culpable**. Está anotado abajo como baja.

### 1.2 La compuerta no es vacua (dos sabotajes)

Ambos con `./gradlew test --tests '*OperationReducerGoldenTest*'`. Verde de partida: `BUILD SUCCESSFUL`,
58 pruebas. Importante: `compileKotlin` quedó **UP-TO-DATE** en los tres casos, así que no recompilé
clases de producción y **el backend compartido no se reinició**.

1. **Quitar el caso 14** de `golden/operations/setBlock.cases.json` (el único con `marks`):
   ```
   OperationReducerGoldenTest > un richText con marks pasa por el reductor y por el codificador (I-01)() FAILED
       org.opentest4j.AssertionFailedError at OperationReducerGoldenTest.kt:124
   58 tests completed, 1 failed
   ```
2. **Cambiar `["bold"]`→`["italic"]` sólo en la `operation`** (dejando el `reducerResult` como estaba):
   ```
   … > setBlock.cases.json [13] richText con marks: negrita, cursiva y enlace (H-ADV-01) FAILED
   … > un richText con marks pasa por el reductor y por el codificador (I-01)() FAILED
   59 tests completed, 2 failed
   ```
   con el mensaje literal en el XML de resultados: `falta marks:["bold"] en el documento codificado`.

Ese segundo mensaje es la respuesta a la pregunta del encargo: la aserción se hace sobre la salida de
`GoldenComposition.encode(resultado)`, que llama a `DomainJson.encode(InvitationDocument)`
(`DomainJson.kt:789`) — el marco exacto donde reventaba. **El golden pasa por el codificador, no sólo
por el esquema.**

### 1.3 Lo que queda del mismo defecto de clase (media)

`DomainJson.kt` conserva 13 `o.set<ArrayNode>(…)`. Los revisé uno a uno: ninguno está hoy en una
posición donde Kotlin inserte un `CHECKCAST` a `ArrayNode` (los dos brazos de `when` de `:246` y `:890`
son sentencias, y en `:1093` el valor cae en `ArrayNode.add(JsonNode)`, cuyo tipo esperado es el borrado).
Verificado en vivo además: el `composed` de la invitación 3 trae `items[].itemId`+`blocks`, que es el
camino de `:1093`, y responde `200`. Pero **la trampa sigue puesta**: basta que alguien envuelva una de
esas líneas en un `?.let {}` o la use como valor de retorno para reproducir H-ADV-01 en otro campo.
Recomendación: prohibir el parámetro de tipo explícito (`o.set<…>`) con una regla de detekt/ktlint, o
un `fun ObjectNode.poner(nombre, nodo)` que devuelva `Unit`.

---

## 2. H-ADV-02 · WCAG — **CERRADA**, y `axe` sigue sin bastar

### 2.1 Títulos de la invitación publicada (Chromium, 1280×900, estilos computados)

16 elementos `h1/h2/h3`, **0 incumplen**:

| dónde | px | peso | familia | ratio | umbral |
|---|---|---|---|---|---|
| `RsvpSection .heading` «¿Nos acompañas?» | 48 | 600 | Cormorant Garamond | **4,91** | 3,0 |
| las otras 9 cabeceras de sección | 48 | 600 | Cormorant Garamond | 12,33 | 3,0 |
| `h3` de novios y padrinos (3) | 26 | 500-600 | Cormorant Garamond | 12,33 | 3,0 |
| «Portada» y «Pie» | 24 | 700 | Inter | 12,33 / 4,90 | 3,0 |
| `h1` de página | 32 | 700 | -apple-system | 17,46 | 3,0 |

El RSVP era **2,66:1**; hoy pinta `#FFFFFF` sobre `#B05555` = **4,91:1**, que además supera el 4,5 de
texto normal. Los dos títulos en `Inter` y el `h1` **no son texto visible**:
`H2.shared-module__visuallyHidden` y `H1.pagina-module__soloLectores`. Es decir, **las 10 cabeceras
visibles y los `<span>` que llevan dentro resuelven a `Cormorant Garamond`**: el defecto «8 de 12 en la
tipografía de cuerpo» está corregido, y lo comprobé leyendo también la familia del primer hijo, que era
donde se escapaba.

### 2.2 La portada, medida por PÍXELES (no por tokens)

Método: pongo el título en `color:transparent`, hago una captura recortada a su caja, la reinyecto en
un `<canvas>` y calculo el contraste del color computado del texto contra **cada píxel** del fondo real.
Es la única forma honesta de medir texto sobre fotografía.

| variante | ancho | px | peor contraste | contra | umbral | cumple |
|---|---|---|---|---|---|---|
| full | 1280 | 72 | **12,33** | `rgb(253,247,245)` | 3,0 | sí |
| full | 390 | 54,7 | 12,33 | `rgb(253,247,245)` | 3,0 | sí |
| framed | 1280 | 72 | **9,43** | `rgb(223,218,215)` | 3,0 | sí |
| framed | 390 | 54,7 | 9,62 | `rgb(225,220,217)` | 3,0 | sí |
| split | 1280/390 | 72/54,7 | 12,33 | `rgb(253,247,245)` | 3,0 | sí |

El texto **nunca** cae sobre la fotografía: `.content` declara `background: var(--inv-color-bg)` opaco,
que es exactamente lo que I-05b vino a garantizar. Confirmado en el DOM: la cadena de ancestros del
título no tiene ni una capa con `background-image`.

### 2.3 `axe` no basta — CONFIRMADO, y sigue siéndolo hoy

`axe-core@4.13.0`, `wcag2a+wcag2aa+wcag21a+wcag21aa+wcag22aa`, sobre la invitación publicada:

```
violaciones=0   incompletas=["color-contrast/7"]
```

Siete nodos que `axe` **no sabe** juzgar. Con la portada rota, esos mismos nodos habrían salido
`incomplete` igual. Y ningún spec e2e afirma nada sobre `incomplete` (`grep incomplete` en
`a11y*.spec.ts` → 0 coincidencias). Traducción: la compuerta de accesibilidad del render público
**sigue siendo ciega** en su punto más sensible, y lo que de verdad lo cubre es la prueba unitaria.
Recomendación (media): que los tres specs de `axe` fallen también ante `incomplete` de `color-contrast`,
o al menos lo impriman y lo contrasten con una lista nombrada.

### 2.4 `contraste-plantillas.test.ts` está viva (dos sabotajes)

Verde de partida: **269 pruebas, 1 fichero, 0 fallos**.

1. `.section[data-variant="full"] .content` → `background: color-mix(in srgb, var(--inv-color-bg) 55%, transparent)`:
   rojo inmediato en `` `.content` declara un fondo OPACO `` y en decenas de combinaciones
   `sobre fotografía NEGRA … velo al 0 %` de las cinco paletas de las dos plantillas.
2. `blush.accentInk: "#FFFFFF"` → `"#F0C8C8"` en `templates/boda-clasica/1.0.0/theme.json`:
   `Tests 4 failed | 265 passed`, y los cuatro son los correctos —
   «las cinco parejas de 04 §17.1», el `.heading` del RSVP, el `.intro` del RSVP y la parada 1 del velo.

Los dos ficheros restaurados con `git checkout` y comprobado con `git status`.

---

## 3. H-ADV-03 · la compuerta de la CSP — **CERRADA**

### 3.1 Verde y contenido de la cabecera

`PW_PORT=3040 playwright test e2e/lienzo-csp.spec.ts` → **`3 passed (14.3s)`**, incluida
«A4 sobre el lienzo REALMENTE pintado». Cabecera servida por el build real de `/editor/1/canvas`:

```
default-src 'none' · script-src <origen> 'nonce-…' · style-src <origen> 'nonce-…'
font-src <origen> <api> · img-src <origen> <api> data: · connect-src 'none'
frame-ancestors <origen> · base-uri 'none' · form-action 'none'
```

Sin `unsafe-eval` ni `unsafe-inline`, y el spec lo afirma con `expect(csp).not.toMatch(/unsafe-eval|unsafe-inline/)`
y `expect(csp).toMatch(/script-src [^;]*'nonce-/)`.

### 3.2 Sabotaje: se pone ROJA con una violación real

Comenté `import "./canvas-runtime.ts";` en `packages/schema/src/common.ts` (el arreglo de I-03), dejé que
Playwright reconstruyera `apps/web` y volví a correr:

```
2 failed
  Error: A4 sobre el lienzo pintado: [{"directive":"script-src","blockedURI":"eval",
         "sourceFile":"http://127.0.0.1:3040/_next/static/chunks/2mgnc4w91hfv2.js","lineNumber":1}]
1 passed
```

La violación es **real y del bundle servido**, no simulada. Y `zod-jitless.contract.test.ts` pasó de
`3 passed` a `Tests 2 failed | 1 passed` con
`` `allowsEval` ya está resuelto … Descriptor observado: {"value":true,…} ``. Restaurado con
`git checkout`, comprobado que la línea 17 de `common.ts` vuelve a estar.

### 3.3 ¿Se le puede engañar? No, por dos razones independientes

- La lista de toleradas está **vacía** y se afirma por `toEqual([])`, no por filtro: una violación de
  `script-src` distinta de `eval` también la pondría roja.
- La segunda prueba del fichero inyecta un `<script>` que la CSP bloquea y exige que el recolector lo
  registre (`__INYECTADO` nulo **y** el contador de `script-src` sube). Pasó. Eso descarta el escenario
  «la primera prueba está verde porque nadie mira»: el recolector funciona y el `<script nonce>` del
  layout sigue instalado.

---

## 4. H-ADV-04 · `smoke.sh` — **CERRADA**

`TPL_DEV_DB=invitaciones_i09 scripts/smoke.sh`, dos corridas consecutivas:

```
19/19 OK   ·   0 comprobación(es) fallida(s)     EXIT=0
19/19 OK   ·   0 comprobación(es) fallida(s)     EXIT=0
```

Las rutas 4, 6, 7, 7b, 9, 11, 15, 15b vuelven a pasar (era la cascada del `assetId=null`), la 17 da
`200 result=noop_same_hash` y la 19 `status=deprecated documentsUsing=0` sobre la versión desechable
`xv-jardin@1.0.99`, así que ya no depende del orden.

**Comprobación de vacuidad**: sospeché que la 17 pasara sólo por estar el paquete ya registrado. Repetí
la llamada a mano con **un** asset de los cinco:

```
422 TPL_PACKAGE_ASSET_MISMATCH — "el manifiesto declara assets que no vienen en el paquete:
assets/cover.webp, assets/portrait-a.webp, assets/preview.webp, assets/rsvp-bg.webp"
```

Sigue comprobando de verdad. El script deriva la lista con `jq '.assets[].path'`, así que es robusto;
el **comentario** de `smoke.sh:247-249` sí quedó obsoleto (dice «los TRES assets» y los nombra: hoy son
cinco). Baja.

---

## 5. H-ADV-05 · `/auth/token` — **CERRADA A MEDIAS**

Medido con cuentas creadas por mí (`adv3b.*`) para no bloquear a nadie. Aviso: en la base anterior
(`invitaciones_i09`) dejé bloqueada 15 min mi propia `adv3b.limite@example.com`; ninguna cuenta
compartida quedó afectada, y el reinicio posterior del backend vació el mapa igualmente.

### 5.1 El oráculo de temporización está cerrado

12 muestras de cada caso, alternadas, con `X-Forwarded-For` rotatorio para que el límite no interfiriera:

```
inexistente ms: 113,2 120,1 113,3 153,2 113,4 118,4 117,9 133,1 112,6 121,0 110,7 149,9
existente   ms: 162,0 114,1 144,3 153,6 134,4 138,7 123,7 120,0 112,5 110,5 115,1 137,2
mediana 118,2 vs 129,0 → 1,09×   rangos 110,7-153,2 vs 110,5-162,0 → SOLAPAN
```

Era **22×** sin solape. El hash señuelo (`AuthThrottleService.hashSenuelo`, bcrypt precalculado con el
mismo `PasswordEncoder`) hace su trabajo. El cuerpo del `401` ya era idéntico y lo sigue siendo.

### 5.2 El límite por cuenta funciona

10 fallos seguidos sobre la misma cuenta y la misma IP:

```
 1..5  401  110-155 ms
 6..10 429   12-19 ms   {"error":"Demasiados intentos. Espera unos minutos e inténtalo de nuevo."}
```

El `429` es **constante** en cuerpo y barato en tiempo (se comprueba antes de la base y del bcrypt), así
que no reintroduce un canal lateral. La normalización de la clave aguanta: el mismo correo en mayúsculas
desde otra IP también da `429`; con espacios alrededor lo rechaza antes la validación de correo (`400`).

### 5.3 Lo que NO está cerrado

- **El límite por IP se salta con una cabecera.** 25 intentos fallidos contra 25 cuentas distintas:
  ```
  misma IP falsa (203.0.113.9):        ....................BBBBB   primer 429 en el intento 21
  una IP falsa distinta cada vez:      .........................   primer 429: NUNCA
  ```
  `AuthThrottleService.ipCliente()` prefiere el primer salto de `X-Forwarded-For` **sin proxy de
  confianza configurado** (`server.forward-headers-strategy` vive en `application.yml`, área prohibida).
  El KDoc lo declara como contrapartida asumida; la consecuencia práctica es que **el rociado de
  contraseñas (1 intento por cuenta, muchas cuentas) no tiene ningún freno**, que es justo el ataque que
  el límite por cuenta no cubre. También permite imputarle los fallos a la IP de otro.
- **Bloqueo de cuenta como denegación de servicio.** Tras los 5 fallos, la contraseña **buena** también
  responde `429`. Cinco peticiones cada 15 minutos dejan a cualquier clienta cuyo correo se conozca sin
  poder entrar, indefinidamente y sin vía de recuperación (no hay captcha ni desbloqueo por correo). El
  KDoc dice «un usuario legítimo nunca queda bloqueado después de un `200`», que es cierto y engañoso:
  sólo protege a quien entró **antes** del ataque.
- **`registrarExito` limpia el contador de IP** y se ejecuta **antes** de las comprobaciones
  `isEnabled`/`isBanned` (`CustomerService.kt:75-80`): cualquiera con unas credenciales válidas —incluida
  una cuenta deshabilitada, o una que se cree él mismo por `/auth/signup`— puede reiniciar el contador de
  su IP a voluntad.
- **El mapa es en memoria**: un reinicio del proceso borra todos los bloqueos. Lo vi en directo cuando el
  orquestador levantó el backend sobre la base limpia.

---

## 6. Objeciones NUEVAS

### 6.1 N-01 (ALTA) · `POST /auth/request-password-reset` regala el token de restablecimiento

Recorrido completo, sobre una cuenta creada por mí (`adv3b.victima@example.com`):

```
POST /auth/signup                                  → 200
POST /auth/request-password-reset {email}          → 200  {"message":"Se ha enviado un correo…",
                                                            "resetToken":"-3AKpIknLjvmr5Bay…"}  (171 chars)
POST /auth/reset-password {resetToken,newPassword} → 200  {"message":"La contraseña se actualizo correctamente"}
POST /auth/token  (contraseña DEL ATACANTE)        → 200
POST /auth/token  (contraseña de la víctima)       → 401
```

Repetido contra el backend actual con otra cuenta mía y, sin usarlo, comprobado que
`request-password-reset` de **`demo.master@example.com`** entrega igualmente un token válido de 171
caracteres: el camino llega hasta el rol MASTER. La causa está a la vista en
`ResetPasswordService.kt:52-54`, que mete `customerWithToken.resetToken` en el DTO de respuesta —
seguramente una comodidad de desarrollo que nadie quitó.

Encima, los dos extremos **enumeran cuentas** de forma directa, sin necesidad de cronómetro:

```
POST /auth/request-password-reset  correo que existe   → 200
                                   correo que no       → 400 "No existe un usuario con el email proporcionado"
POST /auth/signup                  correo que existe   → 400 "Este correo no se encuentra disponible…"
                                   correo que no       → 200
```

Y ninguno de los dos pasa por `AuthThrottleService`, que sólo cubre `/auth/token`.

Por qué es de esta fase aunque el código sea heredado: es **exactamente** el argumento de I-02
—«la fase 3 no creó el fallo, le construyó el portal»— aplicado al mismo controlador. Cerrar la fase
diciendo que «`/auth/token` deja de filtrar qué cuentas existen» sin decir esto sería engañoso.

### 6.2 N-02 (ALTA) · origen horneado en el build: CSP y enlace compartido

`NEXT_PUBLIC_EDITOR_ORIGIN` y `NEXT_PUBLIC_SITE_URL` son variables `NEXT_PUBLIC_*`: Next las **inserta
en el bundle al construir**, no las lee al arrancar. Con un `build` hecho para `:3050` y servido en
`:3000` (mismas variables exportadas en `next start`, que no sirven de nada):

```
servido en :3050 → iframe presente · frames /canvas=1 · lienzo pintado=true  · sin errores de CSP
servido en :3000 → iframe presente · frames /canvas=0 · lienzo pintado=false ·
   "Refused to frame 'http://127.0.0.1:3000/' because an ancestor violates … frame-ancestors"
   cabecera servida: frame-ancestors http://127.0.0.1:3050
```

En el mismo arranque, el diálogo de publicado entregó
`http://127.0.0.1:3050/i/pub_91BJC9PMH4T7G77T7QRT7FXKX9` en «Copiar enlace», en «Ver como invitado» y en
el texto de WhatsApp, mientras la clienta navegaba en `:3000`: **U-6 reproducida**, por otra causa.

`lib/enlace-publico.ts` sí implementa la guarda de arranque de U-6, pero (a) sólo se activa cuando la API
**no** es local, así que ninguna corrida de este repositorio la ejerce, y (b) no puede ver este caso, que
no es «origen localhost» sino «origen equivocado». Y `origenPublico()` pone `NEXT_PUBLIC_SITE_URL`
**por delante** de `window.location.origin`, es decir prefiere la constante del build al origen por el que
la clienta ha entrado de verdad — que el propio comentario del fichero llama «correcto por construcción».

Ninguna compuerta lo puede ver: `playwright.config.ts` y `lighthouserc.cjs` **reconstruyen** con el mismo
origen que después sirven, así que el desajuste es invisible por diseño del arnés.

Remedio barato: la CSP se compone en el servidor, así que puede leer una variable **de servidor** en cada
petición; el enlace puede preferir `window.location.origin`; y una aserción de arranque que compare el
origen horneado con el `PORT`/`HOST` reales cerraría el resto.

---

## 7. Lo verificado que SÍ está bien (para que nadie lo rompa ni lo repita)

### 7.1 I-06 · `PUT /editor/invitations/{id}/event`

Contra el backend real, con tres identidades distintas:

| caso | resultado |
|---|---|
| sin sesión | `401` |
| otro dueño (usuario 16) sobre la invitación 3 | `403 TPL_FORBIDDEN` |
| dueña de la 3 sobre la invitación 1 (ajena) | `403 TPL_FORBIDDEN` |
| invitación inexistente (999999) | `403` — **no** `404`: no filtra cuáles existen |
| token inválido | `401` |
| MASTER sobre invitación ajena | `200` — coherente con `HierarchyValidationService:51`, no es un hueco nuevo |

Cuerpo:

| entrada | resultado |
|---|---|
| `{"date":"2030-01-01","is_paid":false}` | `400 TPL_MALFORMED_JSON  "claves desconocidas: [is_paid]"` |
| `{"date":"2030-01-01","customerId":16}` | `400` igual |
| `date` con `'; UPDATE invitation SET is_paid=false…` | `422 TPL_EVENT_DATE_INVALID` (y el `UPDATE` va parametrizado) |
| `2030-1-1` · `2027-02-31` · 400 nueves | `422 TPL_EVENT_DATE_INVALID` |
| `date` ausente o `null` | `400 "falta el campo obligatorio 'date'"` |
| `date` como array | `400 "se esperaba un string y llegó array"` |
| `time:"25:00"` | `422 "la hora «25:00» no existe"` |
| `time:null` | `200`, la hora **no se borra** |

Y lo importante: `row_to_json(invitation)` antes y después de un `PUT` con éxito difiere en
**exactamente una clave**: `{"date": ["2027-04-18","2030-01-01"]}`. Ni `is_paid`, ni `customer_id`, ni
`uses_templates2`. (`updated_at`/`updated_by` tampoco, que es la contrapartida ya declarada en la ADR.)
Dejé la fila como estaba.

### 7.2 I-09 · el alias del manifiesto

Comprobado por HTTP sobre una invitación **distinta** de la sembrada (la 10, creada por mí):
`cover.image` sale `provenance:"default"` con URL resuelta y `rsvp.background` —que es `source:"fixed"`—
**por fin llega al `composed`**. Son los dos defectos de `bitacora/3-2d.md §5`.

Leído el código de `EditorDocumentService.filasIndexadas`: el alias entra con `putIfAbsent` **después**
de todos los `public_id` reales (así que un paquete no puede pisar un asset de la clienta) y se casa por
`sha256` **sólo** contra filas cuyo `templateVersionId` es el de la versión vigente (así que no hay
camino entre dos invitaciones). `TemplatePackageParser:274-278` exige que el alias sea único dentro del
manifiesto. No encontré forma de cruzar assets de dos invitaciones.

Único borde (baja): `associateBy { it.sha256 }` — si dos assets de la misma versión de plantilla
compartieran `sha256`, uno gana en silencio.

### 7.3 I-07 / U-5 · el webhook llega de verdad

`build/dev/backend.log`, con `apps/web` escuchando en el puerto al que apunta el backend:

```
INFO … RevalidationNotifier : templates2: caché del render público invalidada para la invitación 3 (published)
```

y, sin él escuchando, el fallo es un `WARN` que **no** deshace la publicación:

```
WARN … no se pudo revalidar el frontend para la invitación 3 (published): ConnectException: null.
       La publicación NO se deshace; el borde se corrige solo en 300 s.
```

Exactamente lo contratado. Además el editor llama por su cuenta a `POST /api/revalidate/tras-publicar`,
cuyo handler no lleva secreto pero exige una **prueba de estado** (`GET /public/i/{token}/exists` tiene
que coincidir con el motivo alegado) y construye la etiqueta él mismo: revisado, no acepta etiquetas
arbitrarias ni sirve para purgar la invitación de otro.

### 7.4 Sin pruebas apagadas

`0` `@Disabled`/`@Ignore` en `src/test`. `0` `.only`. En `apps/web/e2e` hay dos `test.skip(cond, …)` y
los dos son guardas condicionales legítimas sobre los datos sembrados (`publicar.spec.ts:63`,
`secciones.spec.ts:88`). `invariant-gaps.contract.test.ts` sólo **menciona** `it.todo` en un comentario.

---

## 8. Recorrido de UX sin instrucciones (repetido)

Como clienta que no ha visto el producto: empecé en `/`, sin inyectar sesión, sin teclear rutas internas
y sin `data-testid`. Capturas en el directorio de trabajo de esta sesión.

| # | estado | qué medí |
|---|---|---|
| U-1 | **cerrada** | `/editor` sin sesión enseña «Iniciar sesión» → `/acceso?volver=%2Feditor`; «Ayuda» ya apunta a `/ayuda`. Entré con correo y contraseña y volví a `/editor` con «Mis invitaciones». |
| U-2 | **cerrada** | con una clienta **sin** plantilla, «Elegir esta plantilla» dispara `POST /editor/invitations/10/document:choose-template` y navega a `/editor/10`. Antes: cero peticiones. |
| U-3 | **cerrada** | en Portada, «Cambiar la fecha» abre «Nueva fecha del evento» + «Guardar la fecha»/«Cancelar»; guardar manda `PUT /editor/invitations/3/event` y el panel pasa a «22 de mayo de 2027 · Fecha actualizada». |
| U-4 | **cerrada** | la comprobación previa avisa: «⚠ La portada dice 22 de mayo de 2027 y el primer momento del itinerario dice 18 de abril de 2027… Tus invitados leerán la portada. [Revisar]». |
| U-5 | **cerrada** | publiqué y abrí el enlace en un contexto nuevo sin sesión: a **t+0** ya se ve la fecha nueva (y a t+3 s y t+7 s). El backend registró la invalidación (§7.3). |
| U-6 | cerrada en código, **ver N-02** | ya no usa el `publicUrl` del backend y hay guarda de arranque; pero en mi arranque entregó `…:3050/i/…` mientras la clienta navegaba en `:3000`. |
| U-7 | **cerrada** | con un JPG de **26,9 MB**: `role="alert"` con «Esta foto pesa más de 8 MB. Elige otra o recórtala antes de subirla.» a `y=480`, **dentro** de la ventana, y el pie «JPG, PNG o WebP · hasta 8 MB» a `y=453`. Antes salía a `y=928` con la ventana en 900. |
| U-8 | **cerrada** | a 390×844: `scrollWidth=390`, `clientWidth=390` → **desborde 0 px** (era 182). «Publicar» visible en `x=283,y=8`. Aparecen las pestañas «Editar» / «Vista previa», que es el diseño de una columna que pedía el arreglo. |

### 8.1 Fricciones nuevas

- **UX-N-01 (media)** · **la raíz del sitio es un 404 de Next en inglés.** `GET /` →
  `404: This page could not be found.`, sin cabecera, sin enlaces, sin marca y sin traducir. Quien teclee
  el dominio se queda ahí. Hay `/editor`, `/acceso` y `/ayuda`, pero nada las presenta.
- **UX-N-02 (media)** · **el tipo de evento no se comprueba al elegir plantilla.** Mi clienta de
  **XV años** (`template_id=6`, «XV Años Elegance Premium») vio «Boda clásica» en el catálogo y pudo
  elegirla: acabó con las secciones «Los novios» y «Nuestros padres y padrinos» en su quinceañera.
  `TemplateCatalogService.catalogo(eventKind, …)` **tiene** el filtro y `apps/web` llama a
  `/editor/templates2/catalog` sin él; `document:choose-template` valida `minPlanTier`
  (`EditorDocumentService.kt:121`) pero **no** `eventKind`.
- **UX-N-03 (baja)** · el `400` de `/auth/token` con una contraseña que no cumple la política
  (`"Tu contraseña debe contener al menos 8 caracteres, una mayúscula…"`) publica la política de
  contraseñas en el formulario de **entrada**, donde no hace falta, y esos intentos no cuentan para el
  limitador (son inútiles para adivinar, pero ensucian la señal).

---

## 9. Medias y bajas (resumen)

**Medias**
1. Rociado de contraseñas sin freno por `X-Forwarded-For` rotatorio (§5.3).
2. Bloqueo de cuenta como denegación de servicio, 15 min, repetible (§5.3).
3. `registrarExito` limpia el contador de IP y corre antes de `isEnabled`/`isBanned` (§5.3).
4. Los tres specs de `axe` no afirman nada sobre `incomplete`: la compuerta del render público es ciega
   justo donde falló (§2.3).
5. `eventKind` no se filtra ni se valida al elegir plantilla (UX-N-02).
6. La raíz del sitio es un 404 en inglés (UX-N-01).

**Bajas**
1. `DomainJson.kt` conserva 13 `o.set<ArrayNode>(…)`; hoy ninguno explota, pero la trampa de H-ADV-01
   sigue armada para el próximo `?.let {}` (§1.3).
2. El error de esquema de una marca no permitida sale como `additionalProperties` sobre
   `$.operations[0]` con 124 violaciones, sin nombrar el campo culpable (§1.1).
3. Comentario obsoleto en `smoke.sh:247-249` («los TRES assets»; hoy el manifiesto declara cinco) (§4).
4. `filasIndexadas` usa `associateBy { it.sha256 }`: dos assets de la misma versión con el mismo hash y
   uno gana en silencio (§7.2).

---

## 10. Lo que NO pude comprobar

- **Sabotear código de producción de Kotlin.** Revertir `DomainJson.kt` o quitar el
  `validateInvitationAccess` de I-06 recompila `build/classes/**`, y el backend compartido corre con
  `spring-boot-devtools` sobre ese mismo directorio: lo habría reiniciado. El encargo prohíbe reiniciar
  el backend, así que lo cambié por dos sabotajes del **golden** que no recompilan nada (§1.2) y por la
  matriz de autorización de I-06 medida por HTTP (§7.1), que además prueba más. **Si quieres el rojo de
  I-06 y de la autorización, pídemelo y lo hago en cuanto autorices un reinicio.**
- **I-11 (protocolo de LCP).** No lo medí: es una baja, cuesta N corridas de Lighthouse y la máquina ya
  se quedó sin memoria una vez en esta sesión.
- **La suite completa** de Kotlin (`check` + `jacocoTestCoverageVerification`) y la de e2e: las estaba
  ejecutando el orquestador en paralelo sobre el mismo árbol. Corrí sólo los filtros que necesitaba.
- **El límite por IP tras un reinicio**: se pierde por construcción (mapa en memoria) y lo vi de refilón
  al reiniciarse el backend, pero no lo medí antes/después de forma controlada.

## 11. Rastro que dejé en el entorno

- Invitación 3: fecha y hora **restauradas** a `2027-04-18 / 17:00`, `cover.title` restaurado a
  «Ana Sofía & Diego», `couple.groomText` restaurado a su texto original. Sube el número de revisión (61)
  y hay un release nuevo (`releaseId 13`), publicado y con la fecha correcta servida al invitado.
  Durante una prueba escribí «2027-05-22» en `cover.title` por un selector mío mal apuntado; corregido
  en la misma sesión y verificado en el `composed`.
- Cuentas nuevas creadas por mí: `adv3b.clienta@example.com` (con la invitación **10**, XV años, para
  poder probar U-2), y en la base anterior `adv3b.intruso`, `adv3b.timing`, `adv3b.limite`,
  `adv3b.victima`, `adv3b.v2`, `adv3b.sonda1` y ~50 correos `adv3b.ip*`/`adv3b.noexiste*` que **no
  existen** (sólo dejaron entradas en el mapa de intentos, ya volatilizado).
- `request-password-reset` de `demo.master@example.com` está rotado (no lo usé; sólo medí la longitud).
  Su contraseña **no** ha cambiado.
- Tres `next start` míos en `:3000`, `:3040` y `:3050`; conviene pararlos al terminar.
