# Cómo agregar una plantilla nueva (30 minutos)

Esta guía es para alguien que **no programa**. No vas a tocar Kotlin, no vas a reiniciar nada y no
vas a leer el esquema del producto: todo el vocabulario (qué secciones existen, qué textos lleva
cada una, qué colores están permitidos) te lo da un programa, el kit de autor (`pnpm plantilla`).

Todos los comandos de esta guía están copiados literalmente de una sesión real en la que se
siguieron de principio a fin, sin saltarse ninguno. La salida que ves debajo de cada comando es la
salida real que dio esa sesión (con rutas de ejemplo `/tmp/taller/mi-boda`; tú usarás las tuyas).

## Qué vas a tener al terminar

Una plantilla nueva, con sus textos de ejemplo, visible en el catálogo del producto y elegible desde
el editor — sin que nadie haya tocado una línea de Kotlin ni reiniciado el servidor. Así se ve el
resultado de los primeros minutos, sin tocar ni un byte después de crearla (captura real, generada
con el mismo comando `pnpm plantilla capturas` que usarás tú en el minuto 20):
`docs/rediseno-plantillas/evidencia/fase-4/4-1b/boda-jardin@1.0.0-390.png`.

## Antes de empezar

Necesitas una terminal abierta en `frontend/` del repositorio y el backend de desarrollo levantado
(alguien de tu equipo lo hace una vez por sesión de trabajo; si ya está levantado, sáltate esto y ve
directo al minuto 0). Si te toca levantarlo tú:

```bash
cd <tu copia del repositorio>
export TPL_DEV_PORT=60NN                        # un número de puerto tuyo, distinto al de otros
export TPL_DEV_DB=invitaciones_f4_NN
export TPL_TEST_STATE_DIR=/tmp/templates2-pg-f4-NN
export TPL_DEV_PIDFILE=$PWD/build/dev/backend-NN.pid
export TPL_DEV_LOG=$PWD/build/dev/backend-NN.log
export TPL_DEV_BASE=http://127.0.0.1:$TPL_DEV_PORT

scripts/dev-backend.sh start      # la primera vez tarda ~90 s: está compilando
scripts/seed-demo.sh              # ~4 s
scripts/smoke.sh                  # tiene que terminar en 19/19 OK
```

Esto **no cuenta** en tus 30 minutos: es preparación del entorno, se hace una sola vez por sesión, y
si el backend ya está arriba (pregunta antes de arrancar otro) te lo saltas entero.

---

## Minuto 0-5 — comprobar el entorno y crear el andamio

Primero, `doctor`: te dice si falta algo y cómo arreglarlo, en vez de fallar a medias más adelante.

```bash
cd frontend
pnpm plantilla doctor
```

Salida real:

```
OK    Node: v22.22.2 (el monorepo exige >= 22.22)
OK    pnpm: pnpm 10.33.0
OK    Dependencias instaladas: frontend/packages/template-kit/node_modules existe
OK    Backend: http://127.0.0.1:6043 responde (HTTP 200 a /public/i/sonda/exists)
OK    TPL_DEV_PORT: TPL_DEV_PORT=6043
OK    TPL_DEV_DB: TPL_DEV_DB=invitaciones_f4_43
OK    TPL_TEST_STATE_DIR: TPL_TEST_STATE_DIR=/tmp/templates2-pg-f4-43
AVISO Cuenta MASTER: se usará demo.master@example.com
      El ayudante de registro crea y promueve `demo.master@example.com` si no existe (registrar-http.sh); si quieres otra cuenta, exporta TPL_MASTER_EMAIL y TPL_MASTER_PASS.
AVISO Base sembrada: no se puede comprobar desde aquí sin consultar la base
      `scripts/smoke.sh` da 4/19 sobre un clúster recién creado y 19/19 sólo DESPUÉS de `scripts/seed-demo.sh` (handoffs/4-0a.md §3.1). Si el smoke falla en la ruta 2, es esto.
OK    Chromium (Playwright): PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

10 comprobación(es) · 0 sin resolver · 2 aviso(s)
```

Los dos `AVISO` son normales si ya hiciste `seed-demo.sh` antes; no bloquean nada.

Ahora crea el andamio. Elige un `slug` (identificador corto, en minúsculas, con guiones — es el
nombre técnico, no el nombre bonito que verá el cliente) y el tipo de evento:

```bash
pnpm plantilla nueva mi-boda --evento wedding --destino /tmp/taller/mi-boda
```

Salida real:

```
Creado /tmp/taller-43/mi-boda/1.0.0
  template.json, theme.json, defaults.json · 5 sección(es) · 10 bloque(s) · 219 líneas de manifiesto
  check: en verde a la primera (0 errores).

Siguiente paso: edita los textos de defaults.json y ejecuta
  pnpm plantilla check /tmp/taller-43/mi-boda/1.0.0
```

**Usa siempre `--destino` fuera de `frontend/templates/`** mientras trabajas (por ejemplo un
directorio bajo `/tmp`). Un manifiesto a medias dentro de `frontend/templates/` hace fallar las
pruebas de todo el monorepo, porque una suite entera de `sections` lee **todos** los
`frontend/templates/*/*/template.json` al arrancar. Sólo mueves tu plantilla terminada a
`frontend/templates/` al final, cuando ya pasa `check` sin errores (ver el checklist).

`--evento` acepta uno de: `wedding, quince, baptism, communion, confirmation, birthday, graduation,
generic`. Si no pones `--secciones`, el andamio trae las cinco típicas: `cover, celebrant, event,
rsvp, footer` (portada, celebrantes/festejados, itinerario, confirmación, pie). Para ver qué otras
secciones existen y qué llevan por dentro:

```bash
pnpm plantilla secciones
```

imprime las 12 secciones del catálogo (`cover, celebrant, event, gallery, giftTable, suggestions,
amenities, rsvp, family, story, dressCode, footer`), y `pnpm plantilla secciones cover` te da el
detalle de una sola: sus variantes, sus huecos de texto/imagen y cuáles trae ya el andamio.

Y el `check` ya salió **en verde a la primera** — no necesitas tocar nada para que el paquete sea
válido; sólo lleva textos de relleno.

---

## Minuto 5-15 — editar los textos, y una imagen si tienes una a mano

Abre `defaults.json` de tu plantilla en cualquier editor de texto. Ahí están todos los textos de
demostración, uno por cada hueco de contenido, con una clave que identifica el bloque
(`cover.title`, `celebrant.honoree`, etc.). Cambia el `"value"` (o el `"name"`, en el caso de una
persona) por textos reales de tu plantilla de ejemplo. No hace falta que sea la boda de nadie en
concreto — sirve un ejemplo creíble, es lo que se verá en el catálogo antes de que un cliente
personalice la suya.

No necesitas saber el esquema: si escribes algo que no encaja (una clave que no existe, un tipo de
valor equivocado), `check` te lo dice con el fichero y la línea exacta — ver la sección de errores
más abajo.

**Sobre las imágenes**: el kit **no** dibuja ni descarga nada — pon un archivo de imagen que ya
tengas (`.webp`, `.png`, `.jpg` o `.svg`) dentro de la carpeta `assets/` de tu plantilla (créala si
no existe) y decláralo en `template.json`. Ejemplo real, mínimo, para una foto de portada:

1. Copia el archivo a `assets/portada.webp`.
2. En `template.json`, añade una entrada a `"assets"` (o crea el array si no existe):
   ```json
   "assets": [
     { "id": "as_01HQZX8Y6K7M9N0P1Q2R3S4T5V", "path": "assets/portada.webp",
       "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
       "contentType": "image/webp", "bytes": 1 }
   ]
   ```
   El `sha256` y los `bytes` **no los calcules tú**: pon cualquier valor, `check` los mide del
   archivo real y los reescribe (P5, ver más abajo). Lo único que tienes que inventar es el `id`: un
   texto con la forma `as_` seguida de 26 caracteres en mayúsculas y dígitos (sin las letras I, L, O,
   U); no hace falta que sea un ULID de verdad, sólo que tenga esa forma — es un alias interno del
   paquete, no el identificador real que el servidor le pondrá a la imagen cuando alguien publique su
   invitación.
3. En `defaults.json`, en el bloque de imagen correspondiente (por ejemplo `cover.image`):
   ```json
   "cover.image": {
     "kind": "image",
     "assetId": "as_01HQZX8Y6K7M9N0P1Q2R3S4T5V",
     "alt": "María y Andrés en el jardín",
     "focal": { "x": 0.5, "y": 0.4 }
   }
   ```
   `assetId` es el mismo `id` que pusiste en el paso 2; `alt` es el texto alternativo (accesibilidad,
   obligatorio); `focal` es el punto de la foto que se mantiene visible si la sección la recorta (0-1
   en cada eje; 0.5/0.5 es el centro).
4. Ejecuta `check` (sin `--no-escribir`, ver el minuto 15) y el kit mide el `sha256`/`bytes` reales y
   los escribe por ti. Salida real de este paso exacto:
   ```
   CORREGIDO TPL_ASSET_DIGEST_MEDIDO  template.json#/assets/0
     Los datos declarados de "assets/portada.webp" no coincidían con el archivo real y se han medido de nuevo.
     Sugerencia: Escrito sha256:ebaf89d6cc6943fa… bytes:46544 contentType:image/webp. Los digestos NUNCA se teclean (P5): los mide `plantilla check`.

   Reescrito: template.json (digestos medidos, P5).

   package_hash = sha256:df7ffc53f79621c94712f9bfdf0f9fde50aa3640fcdae03e1694e2f261ec04bd

   0 error(es) · 0 aviso(s) · 1 corregido(s)
   ```

Si no tienes ninguna foto a mano todavía, no pasa nada: deja el hueco de imagen sin rellenar. El
paquete sigue siendo válido y, cuando lo mires en el previsualizador (siguiente paso), ese hueco sale
con un marcador «imagen pendiente» — así lo verás tú, nunca un invitado real, porque esa plantilla no
se puede publicar en una invitación de verdad hasta que tenga sus imágenes obligatorias.

### Ver lo que llevas hecho: `preview`

Abre **otra terminal** (deja ésta libre para seguir editando) y levanta el previsualizador:

```bash
cd frontend
pnpm plantilla preview /tmp/taller/mi-boda/1.0.0
```

Salida real (el comando se queda escuchando; no vuelve a la línea de comandos):

```
Previsualizador de mi-boda@1.0.0 en http://127.0.0.1:5310 — Ctrl+C para salir.
  1 hueco(s) de imagen sin valor se pintan con el marcador del kit. Con `--sin-marcadores` los ves como los verá un invitado: vacíos (R5).
  Fecha y hora son de DEMOSTRACIÓN (2026-11-21 17:30): los bloques `source: "business"` no viven en el paquete, los pone Postgres al componer la invitación real (R4).
```

Abre esa URL en el navegador. Vas a ver tu plantilla en móvil y en escritorio **a la vez**, cada uno
en su propio marco. Ahora vuelve a la primera terminal, edita cualquiera de los tres `.json`
(`template.json`, `theme.json`, `defaults.json`) y guarda: el navegador se repinta solo, sin
recargar la página, en menos de un segundo. Deja esta terminal con `preview` abierta el resto del
taller — es tu ventana para ver cada cambio.

Dos cosas que ves en el previsualizador y **no** están en tu paquete, y el propio previsualizador te
lo dice: la fecha y hora son fijas de demostración (las pone el backend real, no tu plantilla), y los
huecos de imagen sin valor llevan el marcador «imagen pendiente». Si quieres ver exactamente lo que
verá un invitado con esos huecos vacíos, añade `--sin-marcadores`.

---

## Minuto 15-20 — `check`: validar de verdad

```bash
pnpm plantilla check /tmp/taller/mi-boda/1.0.0
```

Salida real, ya con los textos cambiados y sin errores:

```
plantilla check /tmp/taller-43/mi-boda/1.0.0

package_hash = sha256:526623213816aa6517378f182655d21261d3b19c1b05cde6fe723b6e494f4ca9
```

Al final siempre sale una línea con el resumen, aunque no la pegue aquí de nuevo: `N error(es) · N
aviso(s) · N corregido(s)`. Con `0 error(es)` tu plantilla está lista para el catálogo. Si sale algo
distinto de cero, ve a la sección de errores frecuentes: ahí está el texto exacto de los que más
cuestan, y cómo se arreglan.

Nota sobre `--no-escribir`: por omisión, `check` **mide y escribe** los digestos de tus imágenes en
`template.json` cada vez que lo ejecutas (así nunca los tecleas tú). Si en algún momento quieres
comprobar el paquete sin que toque nada — por ejemplo, para asegurarte de que no cambiaste una imagen
sin darte cuenta —, usa `pnpm plantilla check /tmp/taller/mi-boda/1.0.0 --no-escribir`: entonces un
digesto que no coincide con el archivo real es un `ERROR`, no una corrección automática.

---

## Minuto 20-25 — `capturas`: la foto de tu plantilla

Con `preview` todavía abierto en su terminal (o incluso si lo cerraste — `capturas` levanta su
propia instancia), en tu terminal de trabajo:

```bash
pnpm plantilla capturas /tmp/taller/mi-boda/1.0.0
```

Salida real:

```
3 captura(s) de mi-boda@1.0.0 a 390, 768, 1280 px (x2; Chromium: /opt/pw-browsers/chromium).
  /tmp/taller-43/mi-boda/capturas/mi-boda@1.0.0-390.png  289.6 KB
  /tmp/taller-43/mi-boda/capturas/mi-boda@1.0.0-768.png  561.3 KB
  /tmp/taller-43/mi-boda/capturas/mi-boda@1.0.0-1280.png  588.2 KB

Están FUERA de /tmp/taller-43/mi-boda/1.0.0: dentro serían un TPL_PACKAGE_UNEXPECTED_FILE al registrar.
  1 hueco(s) de imagen sin valor se pintan con el marcador del kit. Con `--sin-marcadores` los ves como los verá un invitado: vacíos (R5).
  Fecha y hora son de DEMOSTRACIÓN (2026-11-21 17:30): los bloques `source: "business"` no viven en el paquete, los pone Postgres al componer la invitación real (R4).
```

Fíjate dónde caen los tres PNG: en `mi-boda/capturas/`, **al lado** de `1.0.0/`, nunca dentro. Si
alguna vez pasas `--destino` apuntando dentro del directorio de la versión, el kit lo rechaza antes
de abrir el navegador — no hace falta que lo pruebes, está en la sección de errores.

Estas capturas son las que enseñas al resto del equipo para aprobar la plantilla — no hace falta que
entren en el paquete que registras.

---

## Minuto 25-30 — `registrar`: publicarla, sin tocar Kotlin ni reiniciar nada

```bash
pnpm plantilla registrar /tmp/taller/mi-boda/1.0.0
```

Salida real (primera vez):

```
POST /master/templates2/versions  (/tmp/taller-43/mi-boda/1.0.0)  →  HTTP 201
{
  "result": "created",
  "alreadyRegistered": false,
  "templateVersionId": 4,
  "slug": "mi-boda",
  "version": "1.0.0",
  "packageHash": "sha256:526623213816aa6517378f182655d21261d3b19c1b05cde6fe723b6e494f4ca9",
  "assetsRegistered": 0
}
201 created — la versión se ha publicado. Es nueva en la base: ya se puede elegir desde el catálogo.
```

`registrar` ejecuta `check` por ti antes de mandar nada (si tu paquete tiene errores, ni siquiera
llega a intentar el registro) y luego hace la petición HTTP con el token del usuario MASTER de
desarrollo. Nada de esto reinicia el backend ni toca una línea de Kotlin.

Si lo ejecutas otra vez sin cambiar nada, el resultado es distinto **a propósito** — no es un fallo:

```
POST /master/templates2/versions  (/tmp/taller-43/mi-boda/1.0.0)  →  HTTP 200
{
  "result": "noop_same_hash",
  "alreadyRegistered": true,
  "templateVersionId": 4,
  ...
}
200 noop_same_hash — ya estaba registrada con EXACTAMENTE el mismo `package_hash`, así que no se ha hecho nada. Es el resultado correcto de volver a registrar el mismo paquete (ADR-008), no un fallo.
```

Con eso, tu plantilla ya está en el catálogo del backend de desarrollo, elegible desde el editor. El
paso final — mover el directorio a `frontend/templates/<slug>/<version>/` para que quede en el
repositorio — lo cubre el checklist (`guias/checklist-plantilla.md`).

**Tiempo total del recorrido, tal como se cronometró**: entorno ya levantado, `doctor` + `nueva`
menos de dos minutos; el resto — escribir textos reales, mirar el previsualizador, ajustar algo si
`check` protesta — se lleva el resto de los 30 minutos. El propio kit (crear, validar, capturar,
registrar) tarda segundos: lo que ocupa el tiempo es decidir qué escribir, no pelearse con el
formato.

---

## Errores frecuentes

Cada uno de estos es el mensaje **literal** que da el kit — provocado a propósito, en un paquete de
ejemplo, y copiado tal cual salió por pantalla. El formato es siempre el mismo: severidad y código en
la primera línea, el problema en la segunda, la sugerencia (qué escribir) en la tercera.

### 1. Un `role` que no existe en el catálogo

Se produce al escribir un rol a mano (o copiarlo mal) en `template.json`. El catálogo de roles es
cerrado: no puedes inventar uno.

```
ERROR TPL_ROLE_UNKNOWN  template.json#/sections/0/blocks/0/role
  El rol "tituloDePortada" del bloque "cover.title" no está en el catálogo cerrado de 90 roles.
  Sugerencia: Roles admitidos en una sección "cover" con bloques "text": coverTitle, coverSubtitle, coverButtonLabel, sectionTitle, sectionIntro.
```

**Arreglo**: usa uno de los roles que te sugiere la última línea — normalmente uno de ellos es
exactamente el que querías escribir.

### 2. Un bloque `group` mal formado

Los bloques de tipo `group` (una lista repetible, como las tarjetas de un itinerario) llevan dos
campos obligatorios propios, `itemLabel` e `itemBlocks`, además de los comunes a todo bloque. Si
faltan:

```
ERROR TPL_BLOCK_SPEC_INVALID  template.json#/sections/2/blocks/1
  El bloque "event.cards" no encaja en la rama `type: "group"` del esquema.
  Sugerencia: bloque `type: "group"`. Faltan: itemLabel, itemBlocks. Ejemplo mínimo: {"id":"evento.momentos","type":"group","role":"eventCards","label":{"es-MX":"Momentos"},"itemLabel":{"es-MX":"Momento"},"itemBlocks":[{"id":"titulo","type":"text","role":"eventTitle","label":{"es-MX":"Título"}}]}
```

**Arreglo**: copia el «ejemplo mínimo» de la sugerencia y adáptalo — trae exactamente los campos que
faltan. Si en vez de faltar campos sobran (escribiste uno que esa rama del esquema no admite), el
mismo código de error lo dice con «No admite: …» en vez de «Faltan: …».

### 3. Un digesto de asset que no cuadra

Pasa si escribes a mano (o copias de otra plantilla) el `sha256`/`bytes` de una imagen en
`template.json`, y no coinciden con el archivo real de `assets/`. Con `--no-escribir`:

```
ERROR TPL_ASSET_DIGEST_MISMATCH  template.json#/assets/0
  El manifiesto declara "assets/preview.webp" con sha256 0000000000000000… y 999 bytes, pero el archivo real es d3d61fc28c4674fd… y 38 bytes.
  Sugerencia: Ejecuta `pnpm plantilla check /tmp/taller-43/sabotaje/1.0.0` sin `--no-escribir` y el kit mide y escribe el digesto correcto; no lo teclees (P5). El registro rechaza el paquete con 422 TPL_PACKAGE_ASSET_MISMATCH.
```

**Arreglo**: exactamente lo que dice la sugerencia — ejecuta `check` sin `--no-escribir` y el kit
mide el archivo real y reescribe el manifiesto solo. Nunca teclees un `sha256` o unos `bytes` a mano
(P5): es indicación general del kit, no sólo de este error.

### 4. Tipografía no autoalojada

La superficie pública nunca pide una fuente a un servidor externo (Google Fonts está bloqueado en
este entorno, y en producción es una decisión de seguridad y de rendimiento). Si pones en
`theme.json` una familia que el producto no sirve desde su propio dominio:

```
ERROR TPL_FONT_NOT_SELF_HOSTED  theme.json#/fontSets/0/heading/family
  El fontSet "clasica" declara la familia "Great Vibes" en heading y la superficie pública NO la autoaloja: esa invitación se pintaría con la pila de reserva (Georgia / la sans del sistema).
  Sugerencia: Familias autoalojadas hoy, con sus pesos, en apps/web/app/(public)/publico.css: Cormorant Garamond (400, 600), Inter (400, 500), Playfair Display (400, 700), Source Sans 3 (400, 600). La más cercana a "Great Vibes" es "Cormorant Garamond" con pesos [400, 600] — «Great Vibes» es una tipografía MANUSCRITA (script) y NINGUNA de las familias que el producto autoaloja lo es: no hay equivalente. Se sustituye por «Cormorant Garamond», la serif de titular de trazo más caligráfico y mayor contraste de las autoalojadas; el titular pierde la letra manuscrita y hay que restaurarlo en la fase de arte. Escríbela en theme.json, o autoaloja la original (`pnpm add @fontsource/great-vibes` en apps/web y su `@import` en publico.css): la superficie pública nunca pide una fuente a un tercero en tiempo de ejecución (ADR-1R-F-07).
```

**Arreglo (el que está a tu alcance sin tocar código)**: usa una de las familias ya autoalojadas que
lista el propio mensaje (`Cormorant Garamond`, `Inter`, `Playfair Display`, `Source Sans 3`, con sus
pesos). Autoalojar una familia nueva requiere tocar `apps/web/` y está fuera de lo que hace esta guía
— pídeselo a quien lleve el frontend.

### 5. Una paleta que no cumple contraste

`theme.json` exige que 9 parejas de color (texto sobre fondo, texto sobre acento, etc.) cumplan
WCAG 2.2 AA. Si aclaras demasiado un color de acento:

```
ERROR TPL_PALETTE_CONTRAST_BELOW_AA  theme.json#/palettes/0/tokens
  La paleta "arena" incumple 4 de las 9 parejas de contraste WCAG 2.2 AA: accentInk/accent #FFFFFF/#D8C4A8 = 1.70:1 < 4.5:1 (texto sobre botones/insignias de acento); accent/bg #D8C4A8/#FAF7F2 = 1.59:1 < 3.0:1 (componentes de interfaz (1.4.11)); accent/bg (1.4.3) #D8C4A8/#FAF7F2 = 1.59:1 < 4.5:1 (enlaces y horas en texto normal); accent/surface (1.4.3) #D8C4A8/#FFFFFF = 1.70:1 < 4.5:1 (los mismos, sobre tarjetas).
  Sugerencia: Oscurece la tinta, nunca bajes el umbral (contratos.md §12.4). Valores que sí cumplen, calculados con la misma fórmula: accent: #D8C4A8 → #7A6E5F.
```

**Arreglo**: copia el hexadecimal que te propone la sugerencia (`#7A6E5F` en este ejemplo, para
`accent`) — ya está calculado con la misma fórmula que usa la validación, así que al pegarlo el error
desaparece. Nunca se soluciona bajando el umbral de contraste.

---

## Qué NO hace el kit

- **No dibuja el arte.** El andamio sale sin `assets/` y sin `previewImage`: tú pones los archivos de
  imagen (una foto que ya tengas, un diseño ya hecho) y el kit sólo mide sus digestos.
- **No descarga imágenes de internet.** No hay ninguna opción que traiga una foto de un banco de
  imágenes o de una URL — el proxy de este entorno además las bloquea.
- **No inventa `assetId`.** El alias que usa `defaults.json` para referenciar una imagen del propio
  paquete (el campo `id` de cada entrada de `assets`) lo escribes tú; el kit sólo valida que tenga la
  forma correcta y que no se repita.
- **No escribe textos de verdad.** El andamio trae textos de relleno («Nombre o título principal de
  la portada») que describen qué va ahí, no una redacción terminada — eso lo escribes tú en el
  minuto 5-15.
- **No levanta el backend por ti.** `doctor` te dice qué falta y qué comando ejecutar, pero no lo
  ejecuta él mismo.
