# Evidencia — 3-CV, calidad visual de la invitación publicada

Capturas tomadas el 2026-09-05 sobre `apps/web` construido con `pnpm build && pnpm start` (nunca
`dev`) contra el backend real en `http://127.0.0.1:6003`. El juicio completo está en
`../../../memoria/bitacora/3-cv.md`.

## Las cuatro invitaciones publicadas

| prefijo | plantilla | paleta | set tipográfico | `publicToken` |
|---|---|---|---|---|
| `boda-blush` | `boda-clasica@1.0.0` | `blush` (por defecto) | `serif-elegante` (por defecto) | `pub_NABC24XNYWC15E17Q7TC9D34T5` |
| `boda-olive` | `boda-clasica@1.0.0` | `olive` | `moderna` | `pub_NXBDMMKFPRWPJXD79V2R0YGGZV` |
| `boda-navy` | `boda-clasica@1.0.0` | `navy` | `serif-elegante` | `pub_CZC0XAM2TDXRPTJ0SEF4KVJJZX` |
| `xv-garden` | `xv-jardin@1.0.0` | `garden` (por defecto) | `moderna` (único del `theme.json`) | `pub_4A2RZ1MM0CJ9F79GE8Y6WS2B94` |

## Qué hay aquí

- `<prefijo>-{movil,tablet,escritorio}.png` — página completa a 390×844, 820×1180 y 1440×900.
- `secciones/<prefijo>-<viewport>-<tipo>.png` — un recorte por sección de `boda-blush` y `xv-garden`.
- `objeciones/O-*.png` — la captura numerada que sostiene cada objeción de la tabla del §4:

| archivo | objeción | qué hay que mirar |
|---|---|---|
| `O-01a-portada-movil-390.png` | A1 | dos tercios de la portada vacíos; el velo se come la rama inferior de la lámina |
| `O-01b-portada-escritorio-1440.png` | A1 | a 1440×900 sólo se ve la franja central de la lámina, que es la que el ilustrador dejó en blanco |
| `O-02a-xv-portada-georgia.png` | A4, M14 | «Mis XV años» en Georgia (no Playfair); el nombre de la festejada relegado a antetítulo |
| `O-02b-boda-moderna-georgia.png` | A4 | el mismo titular con el set «Moderna» elegido en el editor: sale Georgia |
| `O-03a-titulo-en-inter-mesa-de-regalos.png` | A2, M2, M7 | «Mesa de regalos» en palo seco, a la izquierda, filete encima — y los títulos de tarjeta sí en Cormorant |
| `O-03b-titulo-en-cormorant-los-novios.png` | A2, M2, M10, B3 | «Los novios» en Cormorant, centrado, filete debajo; medallones con sombra de esfera |
| `O-04-rsvp-titulo-ilegible-y-boton-web.png` | A3, B1, B2 | título en tinta sobre el acento (2,66:1); insignia repetida; botón píldora |
| `O-05-pie-etiqueta-de-editor.png` | A5 | la palabra «PIE» impresa en la invitación |
| `O-06-anchos-de-columna-escritorio.png` | M1, M5, M6, M7 | la página entera reducida: los cuatro anchos de columna y el fondo único |
| `O-07-paleta-navy-con-arte-rosa.png` | A6 | paleta azul fría con las trece imágenes todavía en rosa |
| `O-08-ritmo-plano-y-fondo-unico-movil.png` | M5, M6 | 11 252 px de móvil reducidos: ritmo de metrónomo, un solo color |
| `O-09-tres-secciones-de-tarjetas-iguales.png` | M7, B6 | la tercera de tres secciones de tarjetas idénticas; fantasma del `.backdrop` |
| `O-10-galeria-seis-laminas-casi-iguales.png` | M8, M9 | a 460 px por lámina se ve que son el mismo papel seis veces, y el recorte cuadrado parte los tallos |
| `O-11-vestimenta-arte-sin-informacion.png` | M13 | 1 545 px de móvil para dos arcos que no dicen cómo vestir |
