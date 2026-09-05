# 3-CV — revisión de calidad visual de la invitación publicada

Fecha: 2026-09-05 · Worktree `worktree-agent-ac3cc8d03be3994a3`, partiendo de `1d7a6bd`
(punta de `claude/fase-3-frontend-orchestration-yuh8sx`, el merge de 3-6).
Backend real en `http://127.0.0.1:6003`, `apps/web` con `pnpm build && pnpm start` (nunca `dev`).
`[V]` = verificado ejecutándolo · `[I]` = inferido.

**Veredicto en una línea: NO, hoy no pasaría por una invitación digital de pago.** No por falta de
fotografía —el arte generado es correcto y en varios sitios es bueno—, sino por seis defectos
sistémicos que se ven en los primeros treinta segundos. Están todos localizados y todos se arreglan
dentro del contrato (tokens / `theme.json` / componente de sección / generador de arte).

---

## 1. Qué se miró exactamente, y cómo reproducirlo

Cuatro invitaciones **publicadas** (no vistas previas), para poder juzgar si el sistema aguanta o
sólo está afinada una combinación:

| id | plantilla | paleta | set tipográfico | enlace público |
|---|---|---|---|---|
| 8 | `boda-clasica@1.0.0` | `blush` (por defecto) | `serif-elegante` (por defecto) | `/i/pub_NABC24XNYWC15E17Q7TC9D34T5` |
| 37 | `boda-clasica@1.0.0` | `olive` | `moderna` | `/i/pub_NXBDMMKFPRWPJXD79V2R0YGGZV` |
| 38 | `boda-clasica@1.0.0` | `navy` | `serif-elegante` | `/i/pub_CZC0XAM2TDXRPTJ0SEF4KVJJZX` |
| 39 | `xv-jardin@1.0.0` | `garden` (por defecto) | `moderna` (**único** del `theme.json`) | `/i/pub_4A2RZ1MM0CJ9F79GE8Y6WS2B94` |

La invitación que siembra `scripts/seed-demo.sh` (id 3) se descartó como base de la revisión: es
compartida y otras sesiones la estaban editando durante la captura (`revision` 194, y dos corridas
seguidas dieron 10, 11 y 12 secciones visibles). Las cuatro de arriba se crearon para esta revisión
por las MISMAS rutas HTTP que usa el sembrador (`:choose-template` → `POST /assets` binario →
`POST /document/operations` → `setTheme` → `POST /release`); la fila de `invitation` con
`uses_templates2` va por SQL, igual que `seed-demo.sh`, porque no hay ruta HTTP (ADR-2-4-02).

Capturas de página completa en **390×844**, **820×1180** y **1440×900**, más un recorte por sección
de la variante `blush` y de `xv-jardin`, en
`docs/rediseno-plantillas/evidencia/fase-3/calidad-visual/`:

- `*-{movil,tablet,escritorio}.png` — 12 páginas completas.
- `secciones/*.png` — 63 recortes por sección.
- `objeciones/O-*.png` — las 14 capturas numeradas que sostienen las objeciones de §4.

Medidas del DOM (alturas, rellenos, anchos de columna, familia/tamaño/color computado de cada
título, `object-fit`/`object-position` de cada imagen, desbordamiento) tomadas en la misma corrida.
`axe-core@4.13.0` corrido aparte sobre la invitación publicada, **incluyendo el cubo `incomplete`**,
que es donde estaba lo interesante (§3.3).

---

## 2. El juicio, sección por sección (`boda-clasica`, `blush`, móvil 390 y escritorio 1440)

### 2.1 Portada — **el peor sitio donde podía fallar** [V]

`O-01a` (390×844) y `O-01b` (1440×900). Lo que se ve es **un degradado gris parduzco vacío** con
cuatro líneas de texto blanco abajo. No hay ornamento, no hay filete, no hay papel, no hay acento.

La causa no es el arte. `frontend/templates/boda-clasica/demo/cover.webp` es una lámina de papelería
**bien resuelta**: 1600×2240, lavado de acuarela, filete a un hilo con cuatro florones de esquina,
guirnalda superior, divisor central con rombo y una rama inferior detallada — y **el centro
deliberadamente vacío, porque ahí va el texto**. Es exactamente cómo se compone una lámina.

La sección la trata como si fuera una fotografía:

- `CoverSection.module.css:190-203` — `[data-variant="full"] .imageWrap > span { aspect-ratio: auto;
  height: 100% }` sobre un marco de `min-height: 100svh`, con el `object-fit: cover` que trae
  `ImageBlock`. En 1440×900 la banda visible de una lámina 5:7 es **el tercio central**: la franja
  que el ilustrador dejó en blanco a propósito. El filete, los cuatro florones y la guirnalda quedan
  fuera del recorte.
- `CoverSection.module.css:205-222` — `.scrim { height: 85%; background: linear-gradient(to top,
  color-mix(in srgb, var(--inv-color-ink) 92%, transparent) …) }`. Lo poco de rama que sí entra en
  el recorte queda debajo de un 92 % de tinta. Con `blush` la tinta es `#3A2E2B` (marrón) y el
  resultado es un lodo pardo; con `garden` la tinta es `#2E3B27` y el resultado es lodo verde militar
  (`O-02a`).

Es decir: **la mitad de arriba está vacía porque ahí no hay dibujo, y la mitad de abajo está tapada
porque ahí sí lo había.** El resultado es la única pantalla que el invitado ve entera, y es la que
menos parece una invitación de toda la pieza.

Lo que sí está bien decidido: `min-height: 100svh` + `align-self: end` da una primera pantalla de una
sola idea, y el nombre es lo único grande. La estructura es correcta; el tratamiento de la imagen no.

Detalle menor pero visible: **«SAVE THE DATE» en inglés, dentro de una caja rectangular con filete
que se lee como un botón** (`.badge`, `CoverSection.module.css:143-155`), en una invitación es-MX.
Sale de `boda-clasica/1.0.0/defaults.json` y es `source: "fixed"`, así que el cliente **no puede
quitarlo ni traducirlo** desde el editor.

### 2.2 Celebrantes («Los novios») — la mejor mitad y la peor mitad [V]

`objeciones/O-03b`. La cabecera es correcta y es de manual: «Los novios» en Cormorant Garamond 600
centrado, filete de acento de 36×2 px debajo, antetítulo en versalitas atenuadas con `tracking-wide`,
fecha en tono apagado. Tres niveles, ninguno compitiendo. Bien.

Debajo se cae:

- Los medallones de monograma (D / A) son un disco `border-radius: 50%` con `--inv-shadow-md`
  (`0 12px 32px -12px`, 28 % de tinta) y **sin filete**, sobre un fondo de casi el mismo valor
  (`CelebrantSection.module.css:106-114`). Sin borde que lo defina, la sombra difusa es lo único que
  separa el disco del papel: la lectura no es «sello», es **esfera de plástico brillante**. Es el
  detalle que más delata plantilla gratuita de toda la pieza.
- Los dos textos de los novios son párrafos de 3-4 líneas **centrados**. Centrar texto corrido de más
  de dos líneas es la marca de fábrica de la plantilla barata; la papelería fina centra líneas
  cortas y alinea a la izquierda todo lo que respire.
- La fecha vuelve a aparecer entera, dos pantallas después de la portada, sin cambiar de jerarquía.

En escritorio esta sección mide **544 px de ancho** (`--inv-measure`) dentro de 1440: una columna
estrecha con 448 px de margen izquierdo, mientras la sección de arriba va a sangre y la de abajo a
1088. Ver §2.13.

### 2.3 Evento («El día») — donde empieza a parecer un formulario [V]

Cuatro tarjetas en una línea de tiempo con filete y punto de acento. El eje vertical y el rombo están
bien hechos; es de los mejores detalles del documento. Pero:

- **El título «El día» sale en palo seco.** No es Cormorant. Ver §3.1: es un defecto de sistema, no
  de esta sección.
- **La fecha completa se repite cuatro veces**, una por tarjeta: «18 DE ABRIL DE 2027, 5:00 PM –
  6:15 PM». Y va en versalitas de acento, mientras el nombre del momento («Ceremonia religiosa») va
  en tinta normal. **El acento se gasta en lo menos importante de la tarjeta.** En una invitación de
  un solo día, la fecha se dice una vez arriba y cada tarjeta lleva sólo la hora.
- Los cortes de línea son malos: `5:00 PM – 6:15 / PM`, `10:30 PM – 19 / DE ABRIL DE 2027, 3:00 AM`.
- «Ver en el mapa» es un enlace subrayado suelto, la forma más web y menos editorial de decirlo.

### 2.4 Galería («Nuestros días») [V]

`O-10`. Seis láminas cuadradas. Tres problemas encadenados:

- Título en palo seco otra vez.
- **El recorte cuadrado destroza las láminas.** El arte es 1200×1500 (4:5); la retícula lo mete en
  1:1 con `object-fit: cover`, así que corta arriba y abajo y parte los tallos a media hoja.
- En escritorio la sección va **a sangre a 1392 px** y cada lámina se amplía a ~460 px. A ese tamaño
  se ve lo que a 160 px no se veía: **son el mismo papel seis veces**, con la misma línea vertical
  del marco recortada en el mismo sitio, y con una sola rama movida de posición. La número 5 son tres
  hojas flotando en un campo vacío. Ampliarlas es la peor decisión posible para este arte.

### 2.5 Historia («Cómo llegamos aquí») [V]

El eje de la línea de tiempo con rombo de acento y el antetítulo de fecha en versalitas
(«MARZO DE 2019») es **el detalle mejor resuelto del documento**. Las láminas 16:9 sí respetan su
proporción, así que no hay recorte destructivo.

Contra: título y títulos de hito en palo seco; en escritorio la sección deja **la mitad derecha
vacía** (columna de 34 rem alineada a la izquierda dentro de una banda de 1392 px) y el eje se
interrumpe antes del último hito.

### 2.6 Código de vestimenta [V]

`O-11`. Las dos láminas 5:7 no sufren recorte y las etiquetas ELLAS/ELLOS en versalitas están bien.
El problema es de contenido de la imagen: **son dos arcos pálidos con una ramita, y no dicen nada
sobre cómo vestir**. La sección ocupa 1 545 px en móvil (dos imágenes de 470 px) para transmitir dos
frases. Es la peor relación entre tinta y significado de toda la pieza.

### 2.7 Mesa de regalos [V]

`O-03a`. Aquí la costura entre las dos manos es imposible de no ver, aunque no se sepa que hubo dos:

- «Mesa de regalos» va **en palo seco, alineado a la izquierda, con un filete de 40×1 px ENCIMA**.
- «Los novios», dos secciones antes, va **en Cormorant, centrado, con un filete de 36×2 px DEBAJO**.
- Y dentro de la propia sección, los títulos de tarjeta («Liverpool», «Transferencia») **sí** van en
  Cormorant. O sea: **lo pequeño parece más invitación que lo grande.** La jerarquía está invertida.
- Las tarjetas son blancas, radio 24 px, sombra suave, con listas de viñeta redonda en acento. Es la
  tarjeta de una página de precios, no una papeleta. Y el blanco `#FFFFFF` sobre el fondo `#FDF7F5`
  se diferencian tan poco que la tarjeta sólo existe por la sombra.
- La insignia de tipo («LLUVIA DE SOBRES») repite literalmente el título de la tarjeta debajo.

### 2.8 Sugerencias y 2.9 Amenidades [V]

`O-09`. Idénticas a la anterior: mismo título en palo seco a la izquierda, mismo filete arriba,
mismas tarjetas blancas, mismas viñetas rojas. **Tres secciones seguidas con la misma maqueta,
2 600 px de móvil sin un solo cambio de ritmo.** Ambas soportan la variante `list`, que no se usa.
Además el `.backdrop` a `opacity: 0.12` deja un fantasma de texto detrás de las tarjetas.

### 2.10 RSVP — la sección más importante y la peor resuelta [V]

`O-04` (zoom ×3). Es el único punto de conversión de la invitación y tiene tres fallos a la vez:

1. **El título es ilegible.** El `<h2>` declara `color: rgb(255,255,255)`, pero el `<span>` de
   `TextBlock` pinta `rgb(58,46,43)` sobre `rgb(176,85,85)`: **2,66:1**, por debajo del 3:1 que
   exige AA incluso para texto grande. Y en palo seco, como los demás. Medido en el DOM.
2. **Dos insignias con borde** apiladas y centradas, y la primera repite palabra por palabra la nota
   que va justo debajo («Confirma antes del 20 de marzo…»). Son las únicas «chips» del documento.
3. **El botón** es blanco, radio 12 px, palo seco peso 600: un CTA de landing de SaaS. En una
   invitación esto se dice con un filete y versalitas, o con un marco fino, no con una píldora.

El bloque es además una franja de color plano sin un solo ornamento, en una pieza que por lo demás
es toda línea fina.

### 2.11 Familia — la única sección que ya parece una invitación [V]

Nombre en Cormorant, etiqueta en versalitas atenuadas debajo («MADRE DEL NOVIO»), dos parejas de
padres en columnas y un grupo de padrinos con su función. Es la convención exacta de la papelería
fina y está bien ejecutada. **Y no es casualidad que sea la que se ve bien: es una de las dos únicas
secciones cuyo título no es un bloque editable, así que es de las dos únicas que conservan la
tipografía de titular** (ver §3.1).

Único pero: el hueco entre padrinos (56 px) es mucho mayor que el que separa a los padres (pares
apretados), sin motivo. La lista se deshilacha hacia abajo.

### 2.12 Pie — un defecto que no admite defensa [V]

`O-05`. **La invitación imprime la palabra «PIE»**, en versalitas de acento, como si fuera un título
de sección, encima del aviso de derechos. «Pie» es la etiqueta INTERNA del editor
(`template.json`, `sections[].title.es-MX`), y sale en las dos plantillas.

`FooterSection.tsx:116` hace `{titleNode ?? section.title}` y el pie de ninguna de las dos plantillas
declara un bloque `sectionTitle`. `CoverSection.tsx:71` resuelve exactamente el mismo caso —
etiqueta de editor «Portada»— ocultándola con `shared.visuallyHidden`. El pie no.

### 2.13 Coherencia entre secciones: la costura, medida [V]

En escritorio (1440 px) el ancho de la columna de contenido salta entre **cuatro** valores:

| ancho | izquierda | secciones |
|---|---|---|
| 544 px (`--inv-measure`) | x=448 | celebrant |
| 1 088 px (`--inv-content-max`) | x=176 | family, giftTable, suggestions, amenities, footer |
| 1 392 px (sin tope) | x=24 | **event, gallery, story, dressCode** |
| 1 440 px (a sangre) | x=0 | cover, rsvp |

`--inv-content-max` sólo aparece en seis hojas —las seis de 3-2c—; las cuatro de 3-2b que quedan sin
tope se estiran hasta el borde. Bajando por la página, el ojo tiene que reencontrar el eje del texto
**cuatro veces**. Eso, y no otra cosa, es lo que hace que se note dónde acaba una mano y empieza
otra. En tablet (820) el salto se reduce a dos valores (544 vs 772) pero sigue ahí.

Y en el mismo eje: **alineación del título** `center` en nueve secciones, `start` en giftTable /
suggestions / amenities; **ornamento** de 36×2 px centrado DEBAJO en las de 3-2b, de 40×1 px a la
izquierda ENCIMA en las de 3-2c; **punto de quiebre** `640px` en las seis hojas de 3-2b y `48rem`
(768 px) en `RsvpSection:230` — hoy no se ve porque ese `@media` sólo gobierna la variante
`form-inline`, que ninguna plantilla usa, pero es la misma decisión tomada dos veces distinto.

### 2.14 Ritmo vertical y color: un metrónomo sobre un solo fondo [V]

Las nueve secciones interiores (celebrant, family, event, gallery, story, giftTable, suggestions,
amenities, dressCode) tienen **exactamente** `padding-block: 88px` (`--inv-space-8`) arriba y abajo
—y el RSVP el mismo valor en su `.inner`—, y **exactamente** el mismo fondo `--inv-color-bg`. `--inv-color-surface` está definido en las
cinco paletas y **no se usa nunca a nivel de sección**. Son 9 700 px de escritorio (11 252 en móvil)
de un solo color plano, con 176 px iguales entre cada par de secciones, y **los doce títulos al mismo
tamaño** (39,72 px, `--inv-text-3xl`; `--inv-text-4xl` no se usa fuera de la portada).

Es regularidad, no ritmo. Nada anuncia que se acerca el RSVP; nada agrupa itinerario con lugar;
nada distingue una sección troncal de una accesoria. `O-08` (la página de móvil reducida) lo enseña
de un vistazo: una tira lisa con dos manchas oscuras.

### 2.15 Móvil [V]

Bien: **cero desbordamiento horizontal** en las tres anchuras y en las cuatro combinaciones
(`scrollWidth == clientWidth` siempre); la portada ocupa exactamente `100svh`; ninguna imagen rota;
el punto focal se respeta de verdad (`object-position: 50% 32%`, `50% 45%`, `50% 47%` medidos en el
DOM, aplicados por CSSOM y no por `style=`, así que un encuadre malo se corrige desde el editor sin
tocar código).

Mal: todos los defectos de arriba se agravan. En un teléfono la portada vacía ocupa la pantalla
entera; las tres secciones de tarjetas seguidas son 2 600 px de scroll idéntico; el título ilegible
del RSVP es lo último que ve el invitado antes de decidir si confirma.

---

## 3. Las tres causas de fondo (una sola línea de CSS explica ocho síntomas)

### 3.1 `blocks/blocks.module.css:6` gobierna la tipografía de ocho de los doce títulos [V]

```
.text { font-family: var(--inv-font-body); font-weight: var(--inv-weight-body); color: var(--inv-color-ink); }
```

`TextBlock` siempre aplica `.text`. Una declaración en el propio elemento gana a la herencia, así que
**cualquier sección cuyo título sea un bloque `text` editable pinta su `<h2>` en la tipografía de
cuerpo, peso de cuerpo y color de tinta**, ignorando lo que diga su `.heading`. Volcado del DOM:

```
<h2 class="…__heading">   ff="Cormorant Garamond"  weight=600  color=rgb(255,255,255)
  <span class="blocks…__text">  ff=Inter  weight=400  color=rgb(58,46,43)   ← este es el que se ve
```

- **En palo seco (mal):** event, gallery, story, dressCode, giftTable, suggestions, amenities, rsvp.
- **En Cormorant (bien):** celebrant y family — las dos que renderizan la cadena fija del manifiesto.
- Consecuencia perversa: **cuanto más personaliza el cliente, peor se ve.** En cuanto escribe su
  propio título de sección, ese título pierde la tipografía de la plantilla.

Esto **ya estaba diagnosticado**: ADR-3-3b-01 lo describe con precisión y decide arreglarlo sólo en
`CoverSection.module.css`, descartando la alternativa (a) —`.text { font-family: inherit }`— porque
«cambia el aspecto de tres secciones a la vez». La ADR nombra dos huecos supervivientes
(`GallerySection .hashtag`, `FamilySection .blessing`) pero **no vio los ocho `.heading`**, que son
la jerarquía tipográfica entera de la invitación. El diagnóstico fue bueno; el alcance del arreglo,
no.

### 3.2 `publico.css` sólo autoaloja un set tipográfico de los dos que ofrece el editor [V]

`app/(public)/publico.css:44-47` importa únicamente `@fontsource/cormorant-garamond/{400,600}` y
`@fontsource/inter/{400,500}`, con este comentario: *«Las dos familias de `moderna` NO se cargan
todavía: ninguna invitación las usa hoy»*. **Es falso**: `xv-jardin/1.0.0/theme.json` declara
`"defaultFontSetId": "moderna"` y **no tiene ningún otro set**.

Medido en la invitación publicada de `xv-jardin` (`document.fonts`):

```
Cormorant Garamond 400/600 → unloaded    Inter 400/500 → unloaded
familia computada del titular: "Playfair Display", Georgia, …   → se pinta Georgia
familia computada del cuerpo:  "Source Sans 3", -apple-system,… → se pinta la del sistema
```

Es decir: **la segunda plantilla entera nunca se ve con su tipografía**, y cualquier cliente de
`boda-clasica` que elija «Moderna» en el editor —una de las dos opciones que le ofrecemos— se lleva
Georgia sin que nada se lo diga (verificado también sobre la invitación `olive/moderna`).

### 3.3 La compuerta de contraste está verde porque `axe` no puede medir, no porque pase [V]

`axe-core@4.13.0`, reglas wcag2a/2aa/21a/21aa/22aa, sobre la invitación publicada: **0 violaciones**
en 390×844 y en 1440×900 — el mismo resultado que reportó 3-3b. Pero el cubo `incomplete` trae
**10 nodos de `color-contrast`**, y entre ellos:

```
#s-rsvp > .blocks…__text  ::  "Element's background color could not be determined due to a background gradient"
```

Ese nodo es el título del RSVP, cuyo contraste real es **2,66:1** (`#3A2E2B` sobre `#B05555`).
`incomplete` no cuenta como violación, así que la afirmación «0 reglas critical/serious» de
`handoffs/3-3b.md` es cierta y a la vez **no cubre** el peor contraste de la invitación. Los otros
cuatro nodos que sí importan son los de la portada (texto blanco sobre el velo en degradado).

---

## 4. Las objeciones

Gravedad · evidencia · **dónde exactamente** se arregla. Ninguna propone CSS suelto, `style={{…}}`
ni literales: todas caen en tokens, `theme.json`, componente/CSS Module de sección con `var(--inv-*)`,
o generador de arte.

| # | Grav. | Objeción | Evidencia | Arreglo, y en qué archivo |
|---|---|---|---|---|
| **A1** | **alta** | La portada es un degradado vacío: la lámina se recorta como foto (`cover` sobre 100svh) y el velo al 92 % de tinta borra la única parte dibujada | `O-01a`, `O-01b`, `O-02a` | `packages/sections/src/styles/CoverSection.module.css` (`:166-234`): en `[data-variant="full"]`, contener la lámina en vez de recortarla (respetar su relación con `--inv-image-aspect-*` y rellenar con `--inv-color-bg`), llevar `.content` al panel central vacío (`align-self: center`) y bajar `.scrim` a un valor ligero o quitarlo pintando el texto en `--inv-color-ink` |
| **A2** | **alta** | 8 de 12 títulos de sección salen en la tipografía de CUERPO; sólo los 2 que no son editables conservan la de titular | `O-03a` vs `O-03b`, volcado §3.1 | Añadir `> * { font: inherit; color: inherit; letter-spacing: inherit }` a `.heading` en `EventSection:45`, `GallerySection:44`, `StorySection:38`, `DressCodeSection:36`, `GiftTableSection:52`, `SuggestionsSection:50`, `AmenitiesSection:50`, `RsvpSection:72` — o adoptar de una vez la alternativa (a) de ADR-3-3b-01 en `blocks/blocks.module.css:6` |
| **A3** | **alta** | El título del RSVP se pinta en tinta sobre el acento: **2,66:1**, por debajo de AA; `axe` lo deja en `incomplete` y la compuerta no lo ve | `O-04`, §3.3 | Lo resuelve el mismo `> *` de A2 en `RsvpSection.module.css:72` (heredar arregla familia y color a la vez). Añadir el caso a `test/theme/contraste-plantillas.test.ts` |
| **A4** | **alta** | El set «Moderna» no está autoalojado: `xv-jardin` **entero** y cualquier boda con «Moderna» se ven en Georgia | §3.2, `O-02a`, `O-02b` | `apps/web/app/(public)/publico.css:44-47` + `apps/web/package.json`: importar `@fontsource/playfair-display/{400,700}.css` y `@fontsource/source-sans-3/{400,600}.css` |
| **A5** | **alta** | La invitación imprime «PIE», la etiqueta interna del editor, en las dos plantillas | `O-05` | `packages/sections/src/sections/FooterSection.tsx:116`: cuando `titleNode` es `null`, marcar el `<h2>` con `shared.visuallyHidden`, igual que `CoverSection.tsx:71` con «Portada» |
| **A6** | **alta** | El sistema de paletas sólo está afinado en una: el arte se tinta con la paleta POR DEFECTO, así que `navy` deja trece imágenes rosas sobre un fondo azul frío | `O-07` | `frontend/templates/scripts/build-art.mjs:37-44` (`paletaDe()` lee sólo `defaultPaletteId`): generar un paquete por `paletteId` en `demo/<paletteId>/` y que la siembra escoja el que casa; o, como paso intermedio, tintar la línea en grafito neutro para que sobreviva a cualquier paleta |
| M1 | media | Cuatro anchos de columna en escritorio (544/1088/1392/1440): el eje del texto salta cuatro veces | `O-06`, tabla §2.13 | Acotar `.inner`/`.groupWrap` a `--inv-content-max` en `EventSection`, `GallerySection`, `StorySection`, `DressCodeSection`; dar a `CelebrantSection:8` la misma envoltura (dejar `--inv-measure` sólo para texto corrido) |
| M2 | media | Dos sistemas de cabecera: centrada con filete 36×2 debajo (3-2b) vs a la izquierda con filete 40×1 encima (3-2c) | `O-03a` vs `O-03b` | Unificar en las 11 hojas: una sola alineación y un solo ornamento, con su medida en tokens (ver M3) |
| M3 | media | Literales de tamaño en seis hojas — viola P3 / `04 §19.2` | `grep` | `tokens.css`: `--inv-rule-length`, `--inv-rule-thickness`, `--inv-medallion-size`; sustituir `2.5rem`/`0.0625rem`/`4.5rem`/`7rem`/`3rem`/`3.5rem`/`1.5rem`/`22rem` en `{GiftTable,Suggestions,Amenities,Family,Rsvp,Footer}Section.module.css` |
| M4 | media | Dos puntos de quiebre en el mismo paquete: `640px` en las seis hojas de 3-2b y `48rem` (768 px) en `RsvpSection:230`. Latente hoy —ese `@media` sólo gobierna la variante `form-inline`, que no se usa— pero se activará en cuanto alguien la elija | CSS | Un solo valor documentado: fijarlo en una constante única de las hojas y dejarlo dicho en `tokens.css` |
| M5 | media | Ritmo de metrónomo (88 px arriba y abajo en las nueve secciones interiores) y un único fondo en 9 700 px; `--inv-color-surface` no se usa nunca a nivel de sección | `O-08`, medidas §2.14 | `tokens.css`: un `--inv-space-9` de respiro; alternar `--inv-color-surface` en las secciones pares desde cada `.section` de sección |
| M6 | media | Los doce títulos al mismo tamaño: ninguna sección manda sobre otra; `--inv-text-4xl` no se usa fuera de la portada | medidas §2.14 | Escalonar en las hojas de sección: troncales (celebrant/event/rsvp) a `--inv-text-3xl`, accesorias (suggestions/amenities/giftTable) a `--inv-text-2xl` |
| M7 | media | Tres secciones de tarjetas idénticas seguidas: 2 600 px de móvil sin cambio de ritmo | `O-09` | Usar la variante `list` que ya soportan `SuggestionsSection`/`AmenitiesSection` para al menos una, desde `defaults.json` de la plantilla |
| M8 | media | La galería a sangre (1 392 px) amplía seis láminas casi idénticas a 460 px y deja ver que son el mismo papel seis veces | `O-10` | `GallerySection.module.css`: acotar a `--inv-content-max` y bajar a tres por fila; y en `templates/scripts/art/scenes.mjs`, variar de verdad la composición de las seis láminas |
| M9 | media | El recorte cuadrado de la galería parte los tallos de láminas 4:5 | `O-10` | `GallerySection.module.css`: redefinir `--inv-image-aspect-default: 4 / 5` en el contenedor de la retícula (misma técnica que ya usa `CoverSection:267`) |
| M10 | media | Medallones y retratos: disco sin filete sobre un fondo de casi el mismo valor, con `--inv-shadow-md` difusa como único contorno → lectura de esfera de plástico | `O-03b` | `CelebrantSection.module.css:111-114`: filete a un hilo en `--inv-color-accent` + `--inv-shadow-sm` |
| M11 | media | La fecha completa repetida en las cuatro tarjetas del itinerario, y en acento, mientras el nombre del momento va en tinta; cortes de línea rotos | recorte `boda-blush-movil-event.png` | `EventSection.tsx` + `.module.css`: la fecha una vez en la cabecera de la sección, sólo la hora por tarjeta; `text-wrap: balance` en el rango |
| M12 | media | «Save the date» en inglés, con forma de botón, y `source: "fixed"` (el cliente no puede cambiarlo) | `O-01a` | `frontend/templates/boda-clasica/1.0.0/defaults.json` (texto en es-MX) y `CoverSection.module.css:143` (`.badge` como versalitas con filete, no como caja de botón) |
| M13 | media | El código de vestimenta gasta 1 545 px de móvil en dos láminas que no dicen cómo vestir | `O-11` | `frontend/templates/scripts/art/scenes.mjs`: dos siluetas distinguibles (vestido largo / esmoquin) en la misma línea fina |
| M14 | media | `xv-jardin`: el héroe de la portada es la frase genérica «Mis XV años» y el nombre de la festejada va de antetítulo | `O-02a` | `frontend/templates/xv-jardin/1.0.0/defaults.json`: intercambiar `cover.title` y `cover.subtitle` (los roles ya existen) |
| B1 | baja | La insignia del RSVP repite palabra por palabra la nota que va debajo | `O-04` | `RsvpSection.tsx`: no pintar la insignia de fecha límite si el texto de la nota ya la contiene, o quitarla del `defaults.json` |
| B2 | baja | El botón «Confirmar asistencia» es un CTA de landing (píldora blanca, palo seco 600) | `O-04` | `RsvpSection.module.css` `.cta`: marco fino en `--inv-color-accent-ink`, versalitas, `--inv-radius-sm` |
| B3 | baja | Texto corrido de 3-4 líneas centrado en celebrant, intro de family y nota del RSVP | `O-03b` | `CelebrantSection.module.css:94`, `FamilySection`, `RsvpSection`: `text-align: start` cuando el párrafo pasa de dos líneas |
| B4 | baja | En family, el hueco entre padrinos (56 px) es mucho mayor que entre padres, sin motivo | recorte `boda-blush-movil-family.png` | `FamilySection.module.css:35`: `--inv-space-5` para los ítems del grupo |
| B5 | baja | `xv-jardin/demo/portrait-{a,b}.webp` son 1000×1000 y `honoree.photo` exige `aspect: portrait`: el backend rechaza el propio arte del paquete con `422 TPL_ASSET_SPEC_MISMATCH` | reproducido al sembrar la invitación 39 | `frontend/templates/scripts/build-art.mjs`: generar el retrato de `xv-jardin` en 4:5 (o relajar `constraints.aspect` en `xv-jardin/1.0.0/template.json`) |
| B6 | baja | El `.backdrop` a `opacity: 0.12` deja un fantasma de texto detrás de las tarjetas | `O-09` | `{GiftTable,Suggestions,Amenities}Section.module.css` `.backdrop`: bajar la opacidad o desenfocar con `filter` tokenizado |

---

## 5. La comparación con el mercado

**¿Pasaría hoy por una invitación digital de pago? No.** Un cliente que ha visto Zola, Withjoy,
Greenvelope o cualquiera de las mexicanas de gama alta espera tres cosas que aquí no están: una
primera pantalla que sea una imagen resuelta, **una** tipografía de titular sostenida de arriba
abajo, y superficies que cambien para marcar los capítulos. Ninguna de las tres se cumple.

**Las tres cosas que la delatan** (en orden de daño):

1. **La portada.** Es lo primero y es un rectángulo gris parduzco. No importa lo bien que esté el
   resto: el juicio se forma ahí. Y no es culpa del arte —la lámina es buena—, es que se recorta y se
   vela como si fuera una fotografía.
2. **La tipografía cambia a mitad de página, y una sección se titula «PIE».** Ver «Los novios» en
   Cormorant y tres pantallas después «Mesa de regalos» en Inter es exactamente la señal de plantilla
   ensamblada por piezas. Que además aparezca impresa una etiqueta interna del editor es el tipo de
   detalle que un cliente fotografía y manda por WhatsApp para pedir el reembolso.
3. **Tres secciones de tarjetas blancas idénticas seguidas, con viñetas rojas y un botón píldora al
   final.** Eso es una página de ajustes. Es literalmente el «parece un formulario» que el dueño puso
   como listón, y ocupa el tercio final de la invitación.

**Las tres cosas que están bien resueltas, y por qué:**

1. **La sección de familia.** Nombre en la serif de titular, función en versalitas atenuadas debajo,
   padres en pares y padrinos en grupo. Es la convención literal de la papelería fina, y la decisión
   concreta que lo consigue es `blocks.module.css .personName { font-family: var(--inv-font-heading) }`
   más el par nombre/etiqueta de `PersonBlock`. Es la prueba de que el sistema **puede** dar el nivel.
2. **La línea de tiempo de historia y de evento.** Filete a un hilo con rombo/punto de acento y
   antetítulo de fecha en versalitas. La decisión que lo consigue es haber tokenizado el trazo
   (`--inv-border-width-axis`, `--inv-border-width-hairline`) en vez de escribir `2px`: el eje se
   tiñe solo con la paleta activa y no se rompe en ninguna.
3. **El punto focal y la solidez en móvil.** `ImageValue.focal` llega de verdad al `object-position`
   por CSSOM (medido: `50% 32%`, `50% 45%`, `50% 47%`) sin `style=` y sin romper la CSP del lienzo, y
   no hay un solo píxel de desbordamiento horizontal en 390, 820 ni 1440. Significa que **todo
   encuadre malo es corregible desde el editor**, sin tocar código — que es exactamente lo que un
   producto de plantillas necesita.

Dicho de otro modo: **la infraestructura está bien y la dirección de arte es defendible; lo que falta
es el último 15 % de oficio tipográfico y de composición.** Las seis objeciones altas son todas de
una tarde de trabajo, y ninguna exige rediseñar nada.

---

## 6. Notas de entorno (no son defectos del producto)

- La invitación 8, que se usó como base `blush`, tiene `hashtag = '#Diag'` en la columna de
  `invitation` (la dejó así otra sesión). Por eso la galería muestra «#Diag» y no «#AnaYDiego2027».
  No es un defecto de composición: las invitaciones 37/38/39 muestran el hashtag correcto.
- La invitación sembrada por `scripts/seed-demo.sh` (id 3) es compartida entre sesiones y su
  visibilidad de secciones cambia durante una corrida; para una revisión visual hay que publicar una
  propia.
- `page.goto(..., { waitUntil: 'networkidle' })` **no termina nunca** contra esta build; hay que usar
  `domcontentloaded` más un recorrido de la página para disparar el `loading="lazy"`.
- El Chromium de `/opt/pw-browsers` es la revisión 1194 y `@playwright/test@1.62.1` pide la 1234:
  hay que pasar `executablePath` a mano, igual que hace `playwright.config.ts:11`.
