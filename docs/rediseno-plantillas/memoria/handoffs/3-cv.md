# 3-CV → orquestador — las seis objeciones ALTAS de calidad visual

**Hoy la invitación NO pasaría por una de pago.** Seis defectos sistémicos, ninguno pide rediseñar. Juicio sección por sección y 20 objeciones medias/bajas en `bitacora/3-cv.md`; capturas (4 invitaciones publicadas × 3 viewports, 2 plantillas, 4 paletas) en `evidencia/fase-3/calidad-visual/`, con índice en su `README.md`.

**A1 · La portada es un degradado gris vacío** (`O-01a`, `O-01b`). La lámina —centro en blanco a propósito, rama detallada
abajo— se recorta con `object-fit: cover` sobre `min-height:100svh`, así que sólo se ve su franja central vacía, y el
`.scrim` al 92 % de tinta tapa lo poco dibujado que entra. → `packages/sections/src/styles/CoverSection.module.css:166-234`:
en `[data-variant="full"]`, contener la lámina (`--inv-image-aspect-*`, relleno `--inv-color-bg`), `.content` al panel
central (`align-self:center`), `.scrim` ligero o fuera con el texto en `--inv-color-ink`.

**A2 · 8 de los 12 títulos de sección salen en la tipografía de CUERPO** (`O-03a` vs `O-03b`). `blocks/blocks.module.css:6`
fija familia/peso/color en el `<span>` de `TextBlock` y gana a la herencia: toda sección con título editable pinta su
`<h2>` en Inter 400 tinta; sólo `celebrant` y `family` conservan Cormorant 600. ADR-3-3b-01 lo diagnosticó y lo arregló
**sólo en la portada**. → `> * { font: inherit; color: inherit; letter-spacing: inherit }` en `.heading` de `EventSection.module.css:45`, `GallerySection:44`, `StorySection:38`, `DressCodeSection:36`, `GiftTableSection:52`, `SuggestionsSection:50`, `AmenitiesSection:50`, `RsvpSection:72` — o la alternativa (a) de esa ADR en `blocks/`, de una vez.

**A3 · El título del RSVP es ilegible y la compuerta no lo ve** (`O-04`). El `<h2>` declara blanco, el `<span>` pinta
`#3A2E2B` sobre `#B05555` = **2,66:1** (AA exige 3:1 en texto grande); `axe` lo deja en `incomplete` ("background gradient"),
así que «0 reglas serious» de 3-3b es cierto y a la vez no lo cubre. → lo resuelve el mismo `> *` de A2 en
`RsvpSection.module.css:72`; añadir el caso a `test/theme/contraste-plantillas.test.ts`.

**A4 · El set «Moderna» no está autoalojado: `xv-jardin` entero se ve en Georgia** (`O-02a`, `O-02b`).
`apps/web/app/(public)/publico.css:44-47` importa sólo Cormorant e Inter afirmando que ninguna invitación usa Moderna:
**falso**, `xv-jardin/1.0.0/theme.json` tiene `defaultFontSetId:"moderna"` y ningún otro set (verificado con
`document.fonts`: Playfair Display y Source Sans 3 no se declaran, se pinta Georgia + sans del sistema). → importar `@fontsource/playfair-display/{400,700}.css` y `@fontsource/source-sans-3/{400,600}.css` en `publico.css`, más las dos dependencias en `apps/web/package.json`.

**A5 · La invitación imprime la palabra «PIE»** (`O-05`). `FooterSection.tsx:116` hace `{titleNode ?? section.title}` y el
pie de las **dos** plantillas no declara `sectionTitle`: sale la etiqueta interna del editor, en versalitas de acento,
sobre el aviso legal. → con `titleNode === null`, marcar el `<h2>` con `shared.visuallyHidden`, igual que `CoverSection.tsx:71`.

**A6 · El sistema de paletas sólo está afinado en una** (`O-07`). `templates/scripts/build-art.mjs:37-44` (`paletaDe()`) lee
sólo `defaultPaletteId`: un único paquete de arte por plantilla, así que con `navy` las trece imágenes siguen rosas sobre un
fondo azul frío. → un paquete por `paletteId` en `demo/<paletteId>/` y que la siembra escoja el que casa; paso intermedio
aceptable, tintar la línea en grafito neutro para que sobreviva a cualquier paleta.

**Orden por coste/beneficio:** A5 (una línea) → A2+A3 (una regla en ocho hojas: arregla la jerarquía tipográfica entera y el
contraste del RSVP) → A4 (dos imports) → A1 (la que más cambia el juicio del dueño) → A6 (la más cara, y la que decide si
esto es un sistema o una plantilla con selector de color).
