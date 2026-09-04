# Dirección de arte de las plantillas (bloque 3-2d)

**Restricción de partida, medida:** no hay acceso a bancos de imágenes (Unsplash, Wikimedia y picsum
devuelven `000` tras el proxy). Toda la imaginería se **genera**: SVG autoral → `@resvg/resvg-js` →
`sharp` → **WebP** (`frontend/templates/scripts/build-art.mjs`). Eso descarta la fotografía y empuja
al lenguaje que de verdad usan las invitaciones premium: **botánica dibujada, lavados de acuarela,
texturas de papel, filigrana, monogramas, marcos y degradados**. No es un plan B.
**Regla dura:** nada de rectángulos planos ni de ruido de relleno — toda superficie lleva degradado
multiparada, todo motivo son curvas de Bézier reales y todo lienzo lleva grano de papel
(`feTurbulence` a ≤ 8 % de alfa).

## Las dos plantillas tienen que verse DISTINTAS

| | `boda-clasica` | `xv-jardin` |
|---|---|---|
| Idea | Papelería grabada, imprenta fina | Jardín pintado a la acuarela |
| Composición | **Simetría axial**, marco rectangular de doble filete | **Asimetría diagonal**, sin marco: guirnalda abajo-izquierda + acento arriba-derecha |
| Botánica | **Contorno**: hoja de almendra con nervadura, olivo con bayas, zarcillos en espiral | **Masa de color**: hoja rellena, eucalipto redondo, peonías de 3-4 coronas de pétalos |
| Peso de línea | 1.1–2.5 px a 1600 px de ancho; el trazo manda | 1.8–2.6 px sólo en el arco; el color manda |
| Arquitectura | Arco de **medio punto** | Arco **ojival** + celosía de jardín |
| Detalle | Alto en el trazo, bajo en la mancha | Bajo en el trazo, alto en la mancha (charcos de pigmento con `feDisplacementMap`) |
| Tipografía del arte | **Cormorant Garamond** (`theme.json:53`) | **Playfair Display** (`theme.json:39`) |

## Paletas — las reales, con su corrección de contraste

Tomadas de `theme.json` de cada plantilla, **no inventadas**. Las cinco parejas de `04 §17.1` se
miden en cada construcción; las que incumplían AA se corrigieron **bajando sólo la luminosidad HSL**
(mismo matiz, misma saturación), no mezclando hacia negro, que desaturaba (ADR-3-2d-04).

`frontend/templates/boda-clasica/1.0.0/theme.json:92` → `defaultPaletteId: "blush"`

| paleta | bg | surface | ink | accent | muted | línea |
|---|---|---|---|---|---|---|
| `blush` (por defecto) | `#FDF7F5` | `#FFFFFF` | `#3A2E2B` | `#B35B5B` (era `#C98B8B`) | `#9A8A86` | `:9`–`:14` |
| `olive` | `#F7F5EE` | `#FFFFFF` | `#2F3A2B` | `#6B7B4A` | `#888F76` (era `#8A9178`) | `:23`–`:28` |
| `navy` | `#F4F6FA` | `#FFFFFF` | `#1E2A44` | `#2E4A7D` | `#7C889E` | `:37`–`:42` |

`frontend/templates/xv-jardin/1.0.0/theme.json:56` → `defaultPaletteId: "garden"`

| paleta | bg | surface | ink | accent | muted | línea |
|---|---|---|---|---|---|---|
| `garden` (por defecto) | `#F6FAF3` | `#FFFFFF` | `#2E3B27` | `#607E47` (era `#7CA35C`) | `#7D956E` (era `#8FA482`) | `:9`–`:14` |
| `lilac` | `#F8F6FB` | `#FFFFFF` | `#372C43` | `#8765B3` (era `#9B7FC0`) | `#9886AC` (era `#A797B8`) | `:23`–`:28` |

Colores derivados, no tokens: `xv-jardin` pinta los pétalos con `#E7C7DE` y `boda-clasica` traza la
botánica con `mix(accent, ink, 0.30)` — el trazo de una plancha grabada siempre es más oscuro que el
lavado que lo rodea, y con el acento a secas la lámina no se leía a tamaño de miniatura.

## Qué imagen ocupa cada hueco

| archivo | px | dónde va | bloque del manifiesto |
|---|---|---|---|
| `1.0.0/assets/preview.webp` | 800×1120 | catálogo del editor | `previewImage` |
| `1.0.0/assets/rsvp-bg.webp` | 1920×1080 | fondo de la sección `rsvp` | `rsvp.background` (**`source:"fixed"`**, ver abajo) |
| `1.0.0/assets/divider.webp` | 1600×420 | separador entre secciones | ninguno: lo usa `packages/sections` |
| `demo/cover.webp` | 1600×2240 | portada | `cover.image` (`aspect: portrait`) |
| `demo/portrait-a|b.webp` | 1000×1000 | novio / novia · quinceañera | `couple.groomPhoto`, `couple.bridePhoto`, `honoree.photo` |
| `demo/gallery-1..6.webp` | 1200×1500 | galería | `gallery.photos[].image` (`aspect: free`) |
| `demo/story-1|2.webp` | 1600×900 | *sólo boda* — hitos de la historia | `story.milestones[].image` (`landscape`) |
| `demo/dress-a|b.webp` | 1000×1400 | *sólo boda* — código de vestimenta | `dressCode.rules[].image` (`portrait`) |

**Retratos de celebrante sin fotografía.** No se finge una foto ni se deja un hueco roto: es un
**medallón de papelería** — disco con doble filete, corona de hojas, filete con rombo y la inicial en
la tipografía de la plantilla. La inicial no transporta información nueva (el nombre completo va
siempre en texto en el bloque `person` de la misma sección), así que va con `alt=""` (`04 §17.4`).

## Contraste: qué se mide y cómo

`build-art.mjs` mide el ratio WCAG 2.x **píxel a píxel** sobre la imagen rasterizada, en la zona
donde la sección pintará texto, y toma el **mínimo**, no la media. Si una zona baja de 4.5:1 se
corrige el ARTE (se aleja el motivo), nunca el umbral — pasó dos veces y las dos se movió el motivo.
En la miniatura se mide sobre el fondo **sin** el texto: con el texto encima compararía la tinta
contra sí misma.

Zonas declaradas: portada `[0.12, 0.09]–[0.88, 0.55]` · fondo de RSVP `[0.20, 0.14]–[0.80, 0.86]` ·
miniatura `[0.14, 0.24]–[0.86, 0.72]`. Fuera de ellas el arte puede ser todo lo oscuro que quiera.

## Presupuesto de peso
≤ 250 KB por imagen en WebP; la portada puede pasar de ahí y se declara. Real: 28 imágenes, **1,2 MB
en total**, la más pesada la portada de boda con **144 KB**. Calidad WebP 82–86 con `effort: 6`,
fija, para que el resultado sea reproducible byte a byte.
