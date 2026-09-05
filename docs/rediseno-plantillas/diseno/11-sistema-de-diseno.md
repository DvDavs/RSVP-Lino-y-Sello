# 11 — Sistema de diseño del producto (dirección a grado de implementación)

Fase 3-C, bloque 0. Fecha: 2026-09-05. Autor: 3c-0 (director de arte). Estado: **propuesta** (ADR-3C-0-01 a 06 en `memoria/decisiones.md`; el dueño puede cambiar la elección de paleta y de tipografía sin invalidar el resto).

**Ámbito.** El *producto*: web pública, acceso y registro, asistente de creación, catálogo, chrome del editor, publicación, estados y ayuda, y cualquier módulo futuro (invitados, RSVP, panel). **Fuera:** las plantillas de invitación (`packages/sections`, tokens `--inv-*`), que el chrome nunca toca (`04 §19`, `contratos.md §8`).

**Evidencia.** Moodboard autocontenido en `evidencia/fase-3c/moodboard/index.html` (sin CDN ni Google Fonts; fuentes OFL copiadas de npm a `moodboard/fonts/`), capturas Playwright a 390 y 1440 px en `moodboard/capturas/`, generador de escalas `generar-escalas.mjs`, verificador de contraste `verificar-paletas.mjs` (salida literal en `verificar-paletas.salida.txt` y en §1.6), salida literal de `npm view` en `npm-view.salida.txt` (y en §2.3). Todo lo que se afirma aquí sobre colores, licencias y pesos sale de esos ficheros.

**Cómo leer este documento.** Los bloques 1 y 2 de la fase implementan a partir de él sin preguntar: cada sección termina en algo ejecutable (un valor, una API, una regla con su prueba). Notación: `[V]` verificado ejecutándolo, `[I]` inferido, `[P]` propuesta que el dueño puede cambiar.

---

## 0. La idea en tres frases

1. **Papel picado, no clipart.** La actitud de la referencia (color vivo, formas como composición, iconos propios, controles a medida) se traduce a una identidad mexicana contemporánea: formas recortadas (rayos, rayas, ondas, sello festoneado) sobre papel de hueso, con un rosa bugambilia que nadie usa en este mercado. No hay púrpura.
2. **El brillo lo dan las superficies, no la tipografía.** Escalas OKLCH de 50 a 900 con luminosidad idéntica por paso en todos los matices: el 50-200 pinta bandas y fondos, el 600-900 pinta texto y botones, el 500 solo vive en formas grandes. Ninguna pareja de color existe sin su ratio medido por script.
3. **Tres voces que se distinguen a un metro.** Una serifa suave con carácter para los títulos, una sans de ojo alto para leer en el teléfono y una mono con tracking para etiquetas. Todo OFL, todo por npm, todo autoalojado.

---

## 1. Color: tres propuestas de paleta

### 1.1 Método (común a las tres) `[V]`

- **Generación en OKLCH** (`moodboard/generar-escalas.mjs`): cada matiz se define por su ángulo `h` y un croma máximo `c`; los diez pasos comparten la misma tabla de luminosidad `L` y la misma curva de croma. Así el paso 600 de cualquier matiz tiene el mismo peso visual y **las mismas garantías de contraste con blanco** (5,1 a 6,2:1 en las tres paletas), y el 300 las mismas con la tinta oscura. Recorte al gamut sRGB reduciendo solo el croma, nunca `L` ni `h`.

| paso | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `L` OKLCH | 0,975 | 0,945 | 0,895 | 0,82 | 0,72 | 0,62 | 0,52 | 0,44 | 0,36 | 0,29 |
| croma (× máx.) | 0,14 | 0,28 | 0,50 | 0,72 | 0,90 | 1,00 | 1,00 | 0,90 | 0,75 | 0,60 |

- **Neutros cálidos**, nunca gris puro: 11 pasos (50-950) con croma 0,006-0,020 sobre un matiz de hueso/cacao (58-70° según paleta). El 50 es el papel de la página, el 950 la tinta más oscura y el fondo del tema oscuro.
- **Cada paleta tiene 8 matices**: principal, dos de apoyo, acento cálido, éxito, peligro, aviso e info. Los apoyos rotan por tipo de evento en bandas e iconos (boda: principal; XV: acento; bautizo: apoyo 1; cumpleaños: apoyo 2…): así la identidad no se lee como «solo bodas».

### 1.2 Las escalas (hex sRGB generados) `[V]`

#### Paleta A — Bugambilia

Rosa mexicano, tinta de cacao, jade y mango. Fiesta y elegancia a la manera de Barragán.

| Rol (matiz OKLCH) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `primary` · bugambilia (352°) | `#fff3f8` | `#ffe5ef` | `#ffcce1` | `#ffa4cc` | `#ff62b2` | `#e52995` | `#bb0076` | `#95005d` | `#710045` | `#530031` |
| `support1` · anil (264°) | `#f3f7ff` | `#e4edff` | `#ccddff` | `#a7c4ff` | `#76a2ff` | `#457cfd` | `#2a5cda` | `#1b46b4` | `#11338a` | `#0a2466` |
| `support2` · jade (168°) | `#eafcf4` | `#d3f6e7` | `#acedd3` | `#77dbb7` | `#2dbf94` | `#009e77` | `#007c5d` | `#006249` | `#004936` | `#003426` |
| `accent` · mango (78°) | `#fff5e7` | `#ffeaca` | `#fed698` | `#f2b95a` | `#d79700` | `#b07b00` | `#8b6000` | `#6e4b00` | `#523700` | `#3c2700` |
| `success` · hierba (148°) | `#edfcee` | `#d8f6db` | `#b7edbd` | `#8bda97` | `#57be6b` | `#1ca045` | `#007f30` | `#006425` | `#004b19` | `#003610` |
| `danger` · chile (27°) | `#fff4f2` | `#ffe6e3` | `#ffcfc9` | `#ffaba1` | `#ff7266` | `#ea3d38` | `#c50516` | `#9e000e` | `#780008` | `#580004` |
| `warning` · ambar (58°) | `#fff5ed` | `#ffe8d7` | `#ffd2b2` | `#ffb072` | `#ee8722` | `#c66b00` | `#9c5300` | `#7c4100` | `#5e2f00` | `#442100` |
| `info` · cielo (236°) | `#eef8ff` | `#daf1ff` | `#b7e3ff` | `#7ecfff` | `#2ab1f2` | `#0091cb` | `#0071a0` | `#00597f` | `#004260` | `#002f46` |

| Neutros cálidos (62°) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `neutral` · hueso | `#fdf9f6` | `#f7f1ec` | `#ece5de` | `#d8cfc8` | `#b3a9a1` | `#988d84` | `#6c6158` | `#554b42` | `#3d332b` | `#292018` | `#150e07` |

#### Paleta B — Talavera

Cobalto de Puebla, terracota, olivo y sol. Artesanal, confiable, sin ser otro azul corporativo.

| Rol (matiz OKLCH) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `primary` · cobalto (262°) | `#f2f7ff` | `#e3edff` | `#caddff` | `#a4c5ff` | `#71a3ff` | `#3b7dff` | `#1a5cdf` | `#0b46b8` | `#04338e` | `#032468` |
| `support1` · terracota (42°) | `#fff4f0` | `#ffe7de` | `#ffd1bf` | `#ffad8d` | `#f28052` | `#d75a21` | `#af4000` | `#8b3100` | `#692300` | `#4d1800` |
| `support2` · olivo (126°) | `#f4f9ec` | `#e7f2d8` | `#d2e5b6` | `#b5d08d` | `#92b25e` | `#739432` | `#567506` | `#435d00` | `#314500` | `#223100` |
| `accent` · sol (90°) | `#fdf6e4` | `#faecc7` | `#f3da97` | `#e5c057` | `#c89f00` | `#a48200` | `#816500` | `#664f00` | `#4c3b00` | `#372900` |
| `success` · hierba (150°) | `#ecfcef` | `#d7f6dc` | `#b5edbf` | `#87db9a` | `#50bf6f` | `#03a14a` | `#007f38` | `#00642b` | `#004b1e` | `#003614` |
| `danger` · chile (25°) | `#fff4f3` | `#ffe6e4` | `#ffcfca` | `#ffaba3` | `#ff716b` | `#ea3c3f` | `#c50220` | `#9e0017` | `#78000e` | `#580008` |
| `warning` · ambar (62°) | `#fff5ec` | `#ffe8d5` | `#ffd3ad` | `#ffb169` | `#eb8911` | `#c16f00` | `#985600` | `#794300` | `#5b3100` | `#422200` |
| `info` · agua (205°) | `#e8fbfd` | `#d0f5f9` | `#a5eaf2` | `#6bd7e3` | `#00bac9` | `#0098a4` | `#007781` | `#005e66` | `#00464c` | `#003237` |

| Neutros cálidos (70°) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `neutral` · hueso | `#fdf9f6` | `#f6f1ec` | `#ece5de` | `#d7d0c7` | `#b2a9a0` | `#978d84` | `#6b6157` | `#544b41` | `#3c342a` | `#282017` | `#140e07` |

#### Paleta C — Jade

Verde jade profundo, coral, ocre y cempasúchil. Fresco, natural, con el calor de la fiesta en los acentos.

| Rol (matiz OKLCH) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| `primary` · jade (178°) | `#eafbf7` | `#d2f6ed` | `#aaecdc` | `#74dac4` | `#24bea5` | `#009c86` | `#007a69` | `#006152` | `#00483d` | `#00342b` |
| `support1` · coral (24°) | `#fff4f3` | `#ffe6e4` | `#ffcfcb` | `#ffaaa4` | `#fe726e` | `#e2484a` | `#be222d` | `#9b0d1d` | `#760413` | `#57030b` |
| `support2` · ocre (86°) | `#fdf6e8` | `#f9ecd0` | `#f1daa8` | `#e1c075` | `#c89e39` | `#a87f00` | `#846300` | `#694e00` | `#4e3a00` | `#382900` |
| `accent` · cempasuchil (52°) | `#fff4ee` | `#ffe8da` | `#ffd2b7` | `#ffaf7e` | `#f97d14` | `#ce6400` | `#a34e00` | `#813c00` | `#612c00` | `#471e00` |
| `success` · hierba (145°) | `#edfbed` | `#daf6da` | `#baecba` | `#90d992` | `#5fbd65` | `#2f9f3d` | `#008020` | `#006517` | `#004b0f` | `#003608` |
| `danger` · chile (16°) | `#fff4f4` | `#ffe6e6` | `#ffced0` | `#ffa9ae` | `#ff6e7e` | `#ec3157` | `#c4003e` | `#9c002f` | `#760022` | `#570016` |
| `warning` · ambar (70°) | `#fff5ea` | `#ffe9d0` | `#ffd4a3` | `#fab45f` | `#e19000` | `#b97500` | `#915b00` | `#734700` | `#573400` | `#3f2500` |
| `info` · anil (258°) | `#f2f7ff` | `#e2eeff` | `#c8deff` | `#a0c6ff` | `#68a5ff` | `#3d84ea` | `#1c65c8` | `#0c4ea5` | `#05397e` | `#03295d` |

| Neutros cálidos (58°) | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `neutral` · hueso | `#fdf9f6` | `#f7f1ed` | `#ede4df` | `#d8cfc8` | `#b3a9a1` | `#988d85` | `#6c6158` | `#564b43` | `#3d332b` | `#291f18` | `#150d08` |

### 1.3 Roles semánticos → paso de escala (claro y oscuro) `[V]`

Es la función `semantica()` de `verificar-paletas.mjs`, es decir, lo que `packages/tokens` emitirá como `--ui-*`. `n` = neutros; `p` = principal; `a1/a2` = apoyos; `ac` = acento; `ok/err/warn/info` = estados; `foco` = el matiz de foco (**nunca el principal**: A → apoyo 1 añil, B → apoyo 1 terracota, C → info añil, para que el anillo se vea sobre el botón primario).

| token `--ui-` | claro | oscuro (`data-theme="dark"`) | uso |
|---|---|---|---|
| `surface` | n-50 | n-950 | papel de la página |
| `surface-raised` | `#ffffff` | n-900 | tarjetas, campos, menús |
| `surface-alt` | p-50 | n-800 | bandas alternas, hoja de asistente |
| `ink` | n-900 | n-50 | texto y títulos |
| `ink-muted` | n-700 | n-300 | texto secundario |
| `ink-placeholder` | n-600 | n-400 | placeholder de campo (solo sobre `surface-raised`) |
| `border` | n-500 | n-500 | borde de control (≥ 3,0 gráfico) |
| `divider` | n-200 | n-800 | separadores decorativos (sin umbral) |
| `primary` / `on-primary` | p-600 / blanco | p-300 / n-950 | botón primario, icono de acción |
| `primary-hover` | p-700 | p-200 | hover del primario |
| `primary-soft` / `on-primary-soft` | p-100 / p-800 | p-900 / p-100 | chip seleccionado, fila activa, cuadro de icono |
| `primary-bright` | p-500 | p-500 | **solo formas**; nunca texto ni fondo de texto |
| `link` | p-700 | p-300 | enlaces y texto de acción |
| `accent` / `on-accent` | ac-400 / n-950 | ac-300 / n-950 | acento cálido (plan, insignia, CTA de conversión) |
| `accent-soft` / `on-accent-soft` | ac-100 / ac-800 | ac-900 / ac-100 | banda de acento |
| `success` / `on-success` · `success-text` · `success-soft` / `on-success-soft` | ok-600 / blanco · ok-700 · ok-100 / ok-800 | ok-300 / n-950 · ok-300 · ok-900 / ok-100 | estado |
| `danger` …, `warning` …, `info` … | mismo patrón: 600/blanco · 700 · 100/800 (aviso: 400 con n-950 encima, 700 como texto) | 300/n-950 · 300 · 900/100 | estados |
| `focus` | foco-500 | foco-300 | anillo de foco (≥ 3,0 sobre toda superficie) |
| `support-1`, `support-1-soft`, `support-1-deep` | a1-500, a1-100, a1-800 | a1-400, a1-900, a1-200 | formas, bandas e iconos por categoría |
| `support-2`, `support-2-soft`, `support-2-deep` | a2-500, a2-100, a2-800 | a2-400, a2-900, a2-200 | ídem |

### 1.4 Parejas garantizadas y umbrales `[V]`

Las 42 parejas están en `PAREJAS` de `verificar-paletas.mjs`; 40 llevan umbral (4,5 texto normal; 3,0 solo donde se declara gráfico: borde de control, anillo de foco, icono de acción) y 2 son informativas (separador y forma decorativa). Se evalúan en claro y en oscuro para las tres paletas: **240 comprobaciones, 0 fallos**. Las parejas exigidas por el brief y su peor ratio en las tres paletas (claro / oscuro):

| pareja | peor ratio claro | peor ratio oscuro | umbral |
|---|---|---|---|
| `ink` / `surface`, `surface-raised`, `surface-alt` | 14,78 | 11,68 | 4,5 |
| `ink-muted` / las tres superficies | 7,86 | 8,00 | 4,5 |
| `ink-placeholder` / `surface-raised` | 6,02 | 6,93 | 4,5 |
| `border` / `surface`, `surface-raised` | 3,09 | 4,93 | 3,0 |
| `on-primary` / `primary` (y `primary-hover`) | 5,27 | 10,42 | 4,5 |
| `on-primary-soft` / `primary-soft` | 9,10 | 11,89 | 4,5 |
| `link` / las tres superficies | 6,94 | 6,70 | 4,5 |
| `on-accent` / `accent` | 7,29 | 10,69 | 4,5 |
| `on-success` / `success` · `success-text` / superficie | 5,11 · 6,98 | 11,45 · 9,57 | 4,5 |
| `on-danger` / `danger` · `danger-text` / superficie | 6,15 · 5,87 | 10,56 · 8,82 | 4,5 |
| `on-warning` / `warning` · `warning-text` / superficie | 7,40 · 7,63 | 10,66 · 8,91 | 4,5 |
| `on-info` / `info` · `info-text` / superficie | 5,31 · 7,18 | 10,99 · 9,22 | 4,5 |
| `focus` / las tres superficies | 3,45 | 7,02 | 3,0 |

**Regla del anillo de foco (y por qué no existe la pareja `focus/primary`).** El anillo nunca toca el control: entre control y anillo hay un halo de 2 px de `surface` (`box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 5px var(--ui-focus)` o `outline: 3px solid var(--ui-focus); outline-offset: 2px`). Su color adyacente es siempre `surface`, ya verificado. Medir `focus` contra `primary` sería medir algo que el sistema prohíbe dibujar (lo hice, fallaba en las seis combinaciones, y la corrección correcta fue la regla, no el color).

### 1.5 Reglas de uso del color

1. **El brillo lo dan las superficies grandes en 50-200 y la tipografía en 600-900.** Nunca saturación sobre saturación: un botón 600 va sobre papel 50/blanco o sobre una banda 100 de *otro* matiz, jamás sobre un 500.
2. **El 500 es decorativo.** Solo en formas grandes (`primary-bright`, `support-*`). Ni texto, ni fondo de texto, ni icono pequeño.
3. **Una forma protagonista por bloque** y **contraste de matiz forma/fondo**: forma de apoyo o acento sobre banda del principal; forma del principal sobre papel neutro. Detalle en §3.4.
4. **Estados con texto siempre**: el color de éxito/peligro/aviso/info nunca es el único portador de significado (icono + texto + color).
5. **Tema oscuro es un mapa, no una excepción**: `data-theme="dark"` en `<html>` cambia el mapa de §1.3 y nada más. Ningún componente sabe en qué tema está.
6. **Cero hex en componentes.** Todo color entra por `var(--ui-*)`; `grep -rn "#[0-9a-f]\{6\}" packages/ui/src` debe salir vacío salvo en `tokens`. Un hex suelto es rechazo en revisión.
7. **Nunca texto sobre fotografía** (regla demostrada en 3-B, `10 §4`): separación por papel opaco, banda o tarjeta.

### 1.6 Salida literal de `verificar-paletas.mjs` `[V]`

```
$ node evidencia/fase-3c/moodboard/verificar-paletas.mjs
paleta       tema  figura           fondo          hex              ratio  umbral estado nota
----------------------------------------------------------------------------------------------------------------------
a:Bugambilia light ink              surface        #292018/#fdf9f6  15.26  4.5    OK     texto normal
a:Bugambilia light ink              surface-raised #292018/#ffffff  15.98  4.5    OK     texto normal
a:Bugambilia light ink              surface-alt    #292018/#fff3f8  14.78  4.5    OK     texto normal
a:Bugambilia light ink-muted        surface        #554b42/#fdf9f6  8.12   4.5    OK     texto normal
a:Bugambilia light ink-muted        surface-raised #554b42/#ffffff  8.50   4.5    OK     texto normal
a:Bugambilia light ink-muted        surface-alt    #554b42/#fff3f8  7.86   4.5    OK     texto normal
a:Bugambilia light ink-placeholder  surface-raised #6c6158/#ffffff  6.02   4.5    OK     texto normal (campo)
a:Bugambilia light border           surface-raised #988d84/#ffffff  3.24   3.0    OK     grafico: borde de control
a:Bugambilia light border           surface        #988d84/#fdf9f6  3.10   3.0    OK     grafico: borde de control
a:Bugambilia light divider          surface        #ece5de/#fdf9f6  1.19   -      info   decorativo: separador
a:Bugambilia light on-primary       primary        #ffffff/#bb0076  6.22   4.5    OK     texto normal (boton)
a:Bugambilia light on-primary       primary-hover  #ffffff/#95005d  8.62   4.5    OK     texto normal (boton hover)
a:Bugambilia light on-primary-soft  primary-soft   #710045/#ffe5ef  9.90   4.5    OK     texto normal (chip)
a:Bugambilia light primary          surface        #bb0076/#fdf9f6  5.94   3.0    OK     grafico: icono de accion, aro secundario
a:Bugambilia light primary          surface-raised #bb0076/#ffffff  6.22   3.0    OK     grafico: icono de accion, aro secundario
a:Bugambilia light link             surface        #95005d/#fdf9f6  8.23   4.5    OK     texto normal (enlace)
a:Bugambilia light link             surface-raised #95005d/#ffffff  8.62   4.5    OK     texto normal (enlace)
a:Bugambilia light link             surface-alt    #95005d/#fff3f8  7.98   4.5    OK     texto normal (enlace)
a:Bugambilia light primary-bright   surface        #e52995/#fdf9f6  3.95   -      info   decorativo: formas
a:Bugambilia light on-accent        accent         #150e07/#d79700  7.58   4.5    OK     texto normal (acento calido)
a:Bugambilia light on-accent-soft   accent-soft    #523700/#ffeaca  9.38   4.5    OK     texto normal
a:Bugambilia light on-success       success        #ffffff/#007f30  5.15   4.5    OK     texto normal
a:Bugambilia light success-text     surface        #006425/#fdf9f6  7.04   4.5    OK     texto normal (estado)
a:Bugambilia light success-text     surface-raised #006425/#ffffff  7.37   4.5    OK     texto normal (estado)
a:Bugambilia light on-success-soft  success-soft   #004b19/#d8f6db  8.97   4.5    OK     texto normal
a:Bugambilia light on-danger        danger         #ffffff/#c50516  6.16   4.5    OK     texto normal
a:Bugambilia light danger-text      surface        #c50516/#fdf9f6  5.89   4.5    OK     texto normal (error)
a:Bugambilia light danger-text      surface-raised #c50516/#ffffff  6.16   4.5    OK     texto normal (error)
a:Bugambilia light on-danger-soft   danger-soft    #780008/#ffe6e3  9.81   4.5    OK     texto normal
a:Bugambilia light on-warning       warning        #150e07/#ee8722  7.40   4.5    OK     texto normal
a:Bugambilia light warning-text     surface        #7c4100/#fdf9f6  7.68   4.5    OK     texto normal (aviso)
a:Bugambilia light warning-text     surface-raised #7c4100/#ffffff  8.04   4.5    OK     texto normal (aviso)
a:Bugambilia light on-warning-soft  warning-soft   #5e2f00/#ffe8d7  9.44   4.5    OK     texto normal
a:Bugambilia light on-info          info           #ffffff/#0071a0  5.43   4.5    OK     texto normal
a:Bugambilia light info-text        surface        #00597f/#fdf9f6  7.33   4.5    OK     texto normal
a:Bugambilia light info-text        surface-raised #00597f/#ffffff  7.68   4.5    OK     texto normal
a:Bugambilia light on-info-soft     info-soft      #004260/#daf1ff  9.24   4.5    OK     texto normal
a:Bugambilia light focus            surface        #457cfd/#fdf9f6  3.61   3.0    OK     grafico: anillo de foco
a:Bugambilia light focus            surface-raised #457cfd/#ffffff  3.78   3.0    OK     grafico: anillo de foco
a:Bugambilia light focus            surface-alt    #457cfd/#fff3f8  3.50   3.0    OK     grafico: anillo de foco
a:Bugambilia light support-1-deep   support-1-soft #11338a/#e4edff  9.58   4.5    OK     texto normal (banda de apoyo 1)
a:Bugambilia light support-2-deep   support-2-soft #004936/#d3f6e7  9.02   4.5    OK     texto normal (banda de apoyo 2)
a:Bugambilia dark  ink              surface        #fdf9f6/#150e07  18.27  4.5    OK     texto normal
a:Bugambilia dark  ink              surface-raised #fdf9f6/#292018  15.26  4.5    OK     texto normal
a:Bugambilia dark  ink              surface-alt    #fdf9f6/#3d332b  11.75  4.5    OK     texto normal
a:Bugambilia dark  ink-muted        surface        #d8cfc8/#150e07  12.46  4.5    OK     texto normal
a:Bugambilia dark  ink-muted        surface-raised #d8cfc8/#292018  10.41  4.5    OK     texto normal
a:Bugambilia dark  ink-muted        surface-alt    #d8cfc8/#3d332b  8.01   4.5    OK     texto normal
a:Bugambilia dark  ink-placeholder  surface-raised #b3a9a1/#292018  6.93   4.5    OK     texto normal (campo)
a:Bugambilia dark  border           surface-raised #988d84/#292018  4.93   3.0    OK     grafico: borde de control
a:Bugambilia dark  border           surface        #988d84/#150e07  5.90   3.0    OK     grafico: borde de control
a:Bugambilia dark  divider          surface        #3d332b/#150e07  1.55   -      info   decorativo: separador
a:Bugambilia dark  on-primary       primary        #150e07/#ffa4cc  10.42  4.5    OK     texto normal (boton)
a:Bugambilia dark  on-primary       primary-hover  #150e07/#ffcce1  13.64  4.5    OK     texto normal (boton hover)
a:Bugambilia dark  on-primary-soft  primary-soft   #ffe5ef/#530031  12.54  4.5    OK     texto normal (chip)
a:Bugambilia dark  primary          surface        #ffa4cc/#150e07  10.42  3.0    OK     grafico: icono de accion, aro secundario
a:Bugambilia dark  primary          surface-raised #ffa4cc/#292018  8.70   3.0    OK     grafico: icono de accion, aro secundario
a:Bugambilia dark  link             surface        #ffa4cc/#150e07  10.42  4.5    OK     texto normal (enlace)
a:Bugambilia dark  link             surface-raised #ffa4cc/#292018  8.70   4.5    OK     texto normal (enlace)
a:Bugambilia dark  link             surface-alt    #ffa4cc/#3d332b  6.70   4.5    OK     texto normal (enlace)
a:Bugambilia dark  primary-bright   surface        #e52995/#150e07  4.63   -      info   decorativo: formas
a:Bugambilia dark  on-accent        accent         #150e07/#f2b95a  10.81  4.5    OK     texto normal (acento calido)
a:Bugambilia dark  on-accent-soft   accent-soft    #ffeaca/#3c2700  12.06  4.5    OK     texto normal
a:Bugambilia dark  on-success       success        #150e07/#8bda97  11.45  4.5    OK     texto normal
a:Bugambilia dark  success-text     surface        #8bda97/#150e07  11.45  4.5    OK     texto normal (estado)
a:Bugambilia dark  success-text     surface-raised #8bda97/#292018  9.57   4.5    OK     texto normal (estado)
a:Bugambilia dark  on-success-soft  success-soft   #d8f6db/#003610  11.81  4.5    OK     texto normal
a:Bugambilia dark  on-danger        danger         #150e07/#ffaba1  10.56  4.5    OK     texto normal
a:Bugambilia dark  danger-text      surface        #ffaba1/#150e07  10.56  4.5    OK     texto normal (error)
a:Bugambilia dark  danger-text      surface-raised #ffaba1/#292018  8.82   4.5    OK     texto normal (error)
a:Bugambilia dark  on-danger-soft   danger-soft    #ffe6e3/#580004  12.48  4.5    OK     texto normal
a:Bugambilia dark  on-warning       warning        #150e07/#ffb072  10.66  4.5    OK     texto normal
a:Bugambilia dark  warning-text     surface        #ffb072/#150e07  10.66  4.5    OK     texto normal (aviso)
a:Bugambilia dark  warning-text     surface-raised #ffb072/#292018  8.91   4.5    OK     texto normal (aviso)
a:Bugambilia dark  on-warning-soft  warning-soft   #ffe8d7/#442100  12.15  4.5    OK     texto normal
a:Bugambilia dark  on-info          info           #150e07/#7ecfff  11.16  4.5    OK     texto normal
a:Bugambilia dark  info-text        surface        #7ecfff/#150e07  11.16  4.5    OK     texto normal
a:Bugambilia dark  info-text        surface-raised #7ecfff/#292018  9.33   4.5    OK     texto normal
a:Bugambilia dark  on-info-soft     info-soft      #daf1ff/#002f46  12.04  4.5    OK     texto normal
a:Bugambilia dark  focus            surface        #a7c4ff/#150e07  10.92  3.0    OK     grafico: anillo de foco
a:Bugambilia dark  focus            surface-raised #a7c4ff/#292018  9.12   3.0    OK     grafico: anillo de foco
a:Bugambilia dark  focus            surface-alt    #a7c4ff/#3d332b  7.02   3.0    OK     grafico: anillo de foco
a:Bugambilia dark  support-1-deep   support-1-soft #ccddff/#0a2466  10.54  4.5    OK     texto normal (banda de apoyo 1)
a:Bugambilia dark  support-2-deep   support-2-soft #acedd3/#003426  10.41  4.5    OK     texto normal (banda de apoyo 2)
b:Talavera   light ink              surface        #282017/#fdf9f6  15.32  4.5    OK     texto normal
b:Talavera   light ink              surface-raised #282017/#ffffff  16.04  4.5    OK     texto normal
b:Talavera   light ink              surface-alt    #282017/#f2f7ff  14.91  4.5    OK     texto normal
b:Talavera   light ink-muted        surface        #544b41/#fdf9f6  8.15   4.5    OK     texto normal
b:Talavera   light ink-muted        surface-raised #544b41/#ffffff  8.54   4.5    OK     texto normal
b:Talavera   light ink-muted        surface-alt    #544b41/#f2f7ff  7.94   4.5    OK     texto normal
b:Talavera   light ink-placeholder  surface-raised #6b6157/#ffffff  6.05   4.5    OK     texto normal (campo)
b:Talavera   light border           surface-raised #978d84/#ffffff  3.25   3.0    OK     grafico: borde de control
b:Talavera   light border           surface        #978d84/#fdf9f6  3.11   3.0    OK     grafico: borde de control
b:Talavera   light divider          surface        #ece5de/#fdf9f6  1.19   -      info   decorativo: separador
b:Talavera   light on-primary       primary        #ffffff/#1a5cdf  5.77   4.5    OK     texto normal (boton)
b:Talavera   light on-primary       primary-hover  #ffffff/#0b46b8  8.13   4.5    OK     texto normal (boton hover)
b:Talavera   light on-primary-soft  primary-soft   #04338e/#e3edff  9.54   4.5    OK     texto normal (chip)
b:Talavera   light primary          surface        #1a5cdf/#fdf9f6  5.51   3.0    OK     grafico: icono de accion, aro secundario
b:Talavera   light primary          surface-raised #1a5cdf/#ffffff  5.77   3.0    OK     grafico: icono de accion, aro secundario
b:Talavera   light link             surface        #0b46b8/#fdf9f6  7.77   4.5    OK     texto normal (enlace)
b:Talavera   light link             surface-raised #0b46b8/#ffffff  8.13   4.5    OK     texto normal (enlace)
b:Talavera   light link             surface-alt    #0b46b8/#f2f7ff  7.56   4.5    OK     texto normal (enlace)
b:Talavera   light primary-bright   surface        #3b7dff/#fdf9f6  3.61   -      info   decorativo: formas
b:Talavera   light on-accent        accent         #140e07/#c89f00  7.68   4.5    OK     texto normal (acento calido)
b:Talavera   light on-accent-soft   accent-soft    #4c3b00/#faecc7  9.25   4.5    OK     texto normal
b:Talavera   light on-success       success        #ffffff/#007f38  5.13   4.5    OK     texto normal
b:Talavera   light success-text     surface        #00642b/#fdf9f6  7.02   4.5    OK     texto normal (estado)
b:Talavera   light success-text     surface-raised #00642b/#ffffff  7.35   4.5    OK     texto normal (estado)
b:Talavera   light on-success-soft  success-soft   #004b1e/#d7f6dc  8.94   4.5    OK     texto normal
b:Talavera   light on-danger        danger         #ffffff/#c50220  6.17   4.5    OK     texto normal
b:Talavera   light danger-text      surface        #c50220/#fdf9f6  5.89   4.5    OK     texto normal (error)
b:Talavera   light danger-text      surface-raised #c50220/#ffffff  6.17   4.5    OK     texto normal (error)
b:Talavera   light on-danger-soft   danger-soft    #78000e/#ffe6e4  9.80   4.5    OK     texto normal
b:Talavera   light on-warning       warning        #140e07/#eb8911  7.41   4.5    OK     texto normal
b:Talavera   light warning-text     surface        #794300/#fdf9f6  7.67   4.5    OK     texto normal (aviso)
b:Talavera   light warning-text     surface-raised #794300/#ffffff  8.03   4.5    OK     texto normal (aviso)
b:Talavera   light on-warning-soft  warning-soft   #5b3100/#ffe8d5  9.42   4.5    OK     texto normal
b:Talavera   light on-info          info           #ffffff/#007781  5.31   4.5    OK     texto normal
b:Talavera   light info-text        surface        #005e66/#fdf9f6  7.18   4.5    OK     texto normal
b:Talavera   light info-text        surface-raised #005e66/#ffffff  7.52   4.5    OK     texto normal
b:Talavera   light on-info-soft     info-soft      #00464c/#d0f5f9  9.14   4.5    OK     texto normal
b:Talavera   light focus            surface        #d75a21/#fdf9f6  3.73   3.0    OK     grafico: anillo de foco
b:Talavera   light focus            surface-raised #d75a21/#ffffff  3.91   3.0    OK     grafico: anillo de foco
b:Talavera   light focus            surface-alt    #d75a21/#f2f7ff  3.63   3.0    OK     grafico: anillo de foco
b:Talavera   light support-1-deep   support-1-soft #692300/#ffe7de  9.63   4.5    OK     texto normal (banda de apoyo 1)
b:Talavera   light support-2-deep   support-2-soft #314500/#e7f2d8  9.13   4.5    OK     texto normal (banda de apoyo 2)
b:Talavera   dark  ink              surface        #fdf9f6/#140e07  18.31  4.5    OK     texto normal
b:Talavera   dark  ink              surface-raised #fdf9f6/#282017  15.32  4.5    OK     texto normal
b:Talavera   dark  ink              surface-alt    #fdf9f6/#3c342a  11.68  4.5    OK     texto normal
b:Talavera   dark  ink-muted        surface        #d7d0c7/#140e07  12.54  4.5    OK     texto normal
b:Talavera   dark  ink-muted        surface-raised #d7d0c7/#282017  10.49  4.5    OK     texto normal
b:Talavera   dark  ink-muted        surface-alt    #d7d0c7/#3c342a  8.00   4.5    OK     texto normal
b:Talavera   dark  ink-placeholder  surface-raised #b2a9a0/#282017  6.93   4.5    OK     texto normal (campo)
b:Talavera   dark  border           surface-raised #978d84/#282017  4.93   3.0    OK     grafico: borde de control
b:Talavera   dark  border           surface        #978d84/#140e07  5.90   3.0    OK     grafico: borde de control
b:Talavera   dark  divider          surface        #3c342a/#140e07  1.57   -      info   decorativo: separador
b:Talavera   dark  on-primary       primary        #140e07/#a4c5ff  10.96  4.5    OK     texto normal (boton)
b:Talavera   dark  on-primary       primary-hover  #140e07/#caddff  13.96  4.5    OK     texto normal (boton hover)
b:Talavera   dark  on-primary-soft  primary-soft   #e3edff/#032468  12.24  4.5    OK     texto normal (chip)
b:Talavera   dark  primary          surface        #a4c5ff/#140e07  10.96  3.0    OK     grafico: icono de accion, aro secundario
b:Talavera   dark  primary          surface-raised #a4c5ff/#282017  9.17   3.0    OK     grafico: icono de accion, aro secundario
b:Talavera   dark  link             surface        #a4c5ff/#140e07  10.96  4.5    OK     texto normal (enlace)
b:Talavera   dark  link             surface-raised #a4c5ff/#282017  9.17   4.5    OK     texto normal (enlace)
b:Talavera   dark  link             surface-alt    #a4c5ff/#3c342a  7.00   4.5    OK     texto normal (enlace)
b:Talavera   dark  primary-bright   surface        #3b7dff/#140e07  5.08   -      info   decorativo: formas
b:Talavera   dark  on-accent        accent         #140e07/#e5c057  10.96  4.5    OK     texto normal (acento calido)
b:Talavera   dark  on-accent-soft   accent-soft    #faecc7/#372900  12.09  4.5    OK     texto normal
b:Talavera   dark  on-success       success        #140e07/#87db9a  11.53  4.5    OK     texto normal
b:Talavera   dark  success-text     surface        #87db9a/#140e07  11.53  4.5    OK     texto normal (estado)
b:Talavera   dark  success-text     surface-raised #87db9a/#282017  9.65   4.5    OK     texto normal (estado)
b:Talavera   dark  on-success-soft  success-soft   #d7f6dc/#003614  11.77  4.5    OK     texto normal
b:Talavera   dark  on-danger        danger         #140e07/#ffaba3  10.59  4.5    OK     texto normal
b:Talavera   dark  danger-text      surface        #ffaba3/#140e07  10.59  4.5    OK     texto normal (error)
b:Talavera   dark  danger-text      surface-raised #ffaba3/#282017  8.86   4.5    OK     texto normal (error)
b:Talavera   dark  on-danger-soft   danger-soft    #ffe6e4/#580008  12.47  4.5    OK     texto normal
b:Talavera   dark  on-warning       warning        #140e07/#ffb169  10.72  4.5    OK     texto normal
b:Talavera   dark  warning-text     surface        #ffb169/#140e07  10.72  4.5    OK     texto normal (aviso)
b:Talavera   dark  warning-text     surface-raised #ffb169/#282017  8.97   4.5    OK     texto normal (aviso)
b:Talavera   dark  on-warning-soft  warning-soft   #ffe8d5/#422200  12.16  4.5    OK     texto normal
b:Talavera   dark  on-info          info           #140e07/#6bd7e3  11.37  4.5    OK     texto normal
b:Talavera   dark  info-text        surface        #6bd7e3/#140e07  11.37  4.5    OK     texto normal
b:Talavera   dark  info-text        surface-raised #6bd7e3/#282017  9.51   4.5    OK     texto normal
b:Talavera   dark  on-info-soft     info-soft      #d0f5f9/#003237  11.98  4.5    OK     texto normal
b:Talavera   dark  focus            surface        #ffad8d/#140e07  10.60  3.0    OK     grafico: anillo de foco
b:Talavera   dark  focus            surface-raised #ffad8d/#282017  8.87   3.0    OK     grafico: anillo de foco
b:Talavera   dark  focus            surface-alt    #ffad8d/#3c342a  6.77   3.0    OK     grafico: anillo de foco
b:Talavera   dark  support-1-deep   support-1-soft #ffd1bf/#4d1800  10.46  4.5    OK     texto normal (banda de apoyo 1)
b:Talavera   dark  support-2-deep   support-2-soft #d2e5b6/#223100  10.36  4.5    OK     texto normal (banda de apoyo 2)
c:Jade       light ink              surface        #291f18/#fdf9f6  15.39  4.5    OK     texto normal
c:Jade       light ink              surface-raised #291f18/#ffffff  16.11  4.5    OK     texto normal
c:Jade       light ink              surface-alt    #291f18/#eafbf7  15.07  4.5    OK     texto normal
c:Jade       light ink-muted        surface        #564b43/#fdf9f6  8.08   4.5    OK     texto normal
c:Jade       light ink-muted        surface-raised #564b43/#ffffff  8.46   4.5    OK     texto normal
c:Jade       light ink-muted        surface-alt    #564b43/#eafbf7  7.91   4.5    OK     texto normal
c:Jade       light ink-placeholder  surface-raised #6c6158/#ffffff  6.02   4.5    OK     texto normal (campo)
c:Jade       light border           surface-raised #988d85/#ffffff  3.24   3.0    OK     grafico: borde de control
c:Jade       light border           surface        #988d85/#fdf9f6  3.09   3.0    OK     grafico: borde de control
c:Jade       light divider          surface        #ede4df/#fdf9f6  1.20   -      info   decorativo: separador
c:Jade       light on-primary       primary        #ffffff/#007a69  5.27   4.5    OK     texto normal (boton)
c:Jade       light on-primary       primary-hover  #ffffff/#006152  7.42   4.5    OK     texto normal (boton hover)
c:Jade       light on-primary-soft  primary-soft   #00483d/#d2f6ed  9.10   4.5    OK     texto normal (chip)
c:Jade       light primary          surface        #007a69/#fdf9f6  5.03   3.0    OK     grafico: icono de accion, aro secundario
c:Jade       light primary          surface-raised #007a69/#ffffff  5.27   3.0    OK     grafico: icono de accion, aro secundario
c:Jade       light link             surface        #006152/#fdf9f6  7.08   4.5    OK     texto normal (enlace)
c:Jade       light link             surface-raised #006152/#ffffff  7.42   4.5    OK     texto normal (enlace)
c:Jade       light link             surface-alt    #006152/#eafbf7  6.94   4.5    OK     texto normal (enlace)
c:Jade       light primary-bright   surface        #009c86/#fdf9f6  3.29   -      info   decorativo: formas
c:Jade       light on-accent        accent         #150d08/#f97d14  7.29   4.5    OK     texto normal (acento calido)
c:Jade       light on-accent-soft   accent-soft    #612c00/#ffe8da  9.53   4.5    OK     texto normal
c:Jade       light on-success       success        #ffffff/#008020  5.11   4.5    OK     texto normal
c:Jade       light success-text     surface        #006517/#fdf9f6  6.98   4.5    OK     texto normal (estado)
c:Jade       light success-text     surface-raised #006517/#ffffff  7.31   4.5    OK     texto normal (estado)
c:Jade       light on-success-soft  success-soft   #004b0f/#daf6da  9.03   4.5    OK     texto normal
c:Jade       light on-danger        danger         #ffffff/#c4003e  6.15   4.5    OK     texto normal
c:Jade       light danger-text      surface        #c4003e/#fdf9f6  5.87   4.5    OK     texto normal (error)
c:Jade       light danger-text      surface-raised #c4003e/#ffffff  6.15   4.5    OK     texto normal (error)
c:Jade       light on-danger-soft   danger-soft    #760022/#ffe6e6  9.88   4.5    OK     texto normal
c:Jade       light on-warning       warning        #150d08/#e19000  7.49   4.5    OK     texto normal
c:Jade       light warning-text     surface        #734700/#fdf9f6  7.63   4.5    OK     texto normal (aviso)
c:Jade       light warning-text     surface-raised #734700/#ffffff  7.98   4.5    OK     texto normal (aviso)
c:Jade       light on-warning-soft  warning-soft   #573400/#ffe9d0  9.40   4.5    OK     texto normal
c:Jade       light on-info          info           #ffffff/#1c65c8  5.61   4.5    OK     texto normal
c:Jade       light info-text        surface        #0c4ea5/#fdf9f6  7.57   4.5    OK     texto normal
c:Jade       light info-text        surface-raised #0c4ea5/#ffffff  7.93   4.5    OK     texto normal
c:Jade       light on-info-soft     info-soft      #05397e/#e2eeff  9.46   4.5    OK     texto normal
c:Jade       light focus            surface        #3d84ea/#fdf9f6  3.53   3.0    OK     grafico: anillo de foco
c:Jade       light focus            surface-raised #3d84ea/#ffffff  3.69   3.0    OK     grafico: anillo de foco
c:Jade       light focus            surface-alt    #3d84ea/#eafbf7  3.45   3.0    OK     grafico: anillo de foco
c:Jade       light support-1-deep   support-1-soft #760413/#ffe6e4  9.84   4.5    OK     texto normal (banda de apoyo 1)
c:Jade       light support-2-deep   support-2-soft #4e3a00/#f9ecd0  9.30   4.5    OK     texto normal (banda de apoyo 2)
c:Jade       dark  ink              surface        #fdf9f6/#150d08  18.35  4.5    OK     texto normal
c:Jade       dark  ink              surface-raised #fdf9f6/#291f18  15.39  4.5    OK     texto normal
c:Jade       dark  ink              surface-alt    #fdf9f6/#3d332b  11.75  4.5    OK     texto normal
c:Jade       dark  ink-muted        surface        #d8cfc8/#150d08  12.52  4.5    OK     texto normal
c:Jade       dark  ink-muted        surface-raised #d8cfc8/#291f18  10.49  4.5    OK     texto normal
c:Jade       dark  ink-muted        surface-alt    #d8cfc8/#3d332b  8.01   4.5    OK     texto normal
c:Jade       dark  ink-placeholder  surface-raised #b3a9a1/#291f18  6.99   4.5    OK     texto normal (campo)
c:Jade       dark  border           surface-raised #988d85/#291f18  4.97   3.0    OK     grafico: borde de control
c:Jade       dark  border           surface        #988d85/#150d08  5.93   3.0    OK     grafico: borde de control
c:Jade       dark  divider          surface        #3d332b/#150d08  1.56   -      info   decorativo: separador
c:Jade       dark  on-primary       primary        #150d08/#74dac4  11.50  4.5    OK     texto normal (boton)
c:Jade       dark  on-primary       primary-hover  #150d08/#aaecdc  14.40  4.5    OK     texto normal (boton hover)
c:Jade       dark  on-primary-soft  primary-soft   #d2f6ed/#00342b  11.89  4.5    OK     texto normal (chip)
c:Jade       dark  primary          surface        #74dac4/#150d08  11.50  3.0    OK     grafico: icono de accion, aro secundario
c:Jade       dark  primary          surface-raised #74dac4/#291f18  9.64   3.0    OK     grafico: icono de accion, aro secundario
c:Jade       dark  link             surface        #74dac4/#150d08  11.50  4.5    OK     texto normal (enlace)
c:Jade       dark  link             surface-raised #74dac4/#291f18  9.64   4.5    OK     texto normal (enlace)
c:Jade       dark  link             surface-alt    #74dac4/#3d332b  7.36   4.5    OK     texto normal (enlace)
c:Jade       dark  primary-bright   surface        #009c86/#150d08  5.58   -      info   decorativo: formas
c:Jade       dark  on-accent        accent         #150d08/#ffaf7e  10.69  4.5    OK     texto normal (acento calido)
c:Jade       dark  on-accent-soft   accent-soft    #ffe8da/#471e00  12.25  4.5    OK     texto normal
c:Jade       dark  on-success       success        #150d08/#90d992  11.46  4.5    OK     texto normal
c:Jade       dark  success-text     surface        #90d992/#150d08  11.46  4.5    OK     texto normal (estado)
c:Jade       dark  success-text     surface-raised #90d992/#291f18  9.61   4.5    OK     texto normal (estado)
c:Jade       dark  on-success-soft  success-soft   #daf6da/#003608  11.87  4.5    OK     texto normal
c:Jade       dark  on-danger        danger         #150d08/#ffa9ae  10.56  4.5    OK     texto normal
c:Jade       dark  danger-text      surface        #ffa9ae/#150d08  10.56  4.5    OK     texto normal (error)
c:Jade       dark  danger-text      surface-raised #ffa9ae/#291f18  8.85   4.5    OK     texto normal (error)
c:Jade       dark  on-danger-soft   danger-soft    #ffe6e6/#570016  12.50  4.5    OK     texto normal
c:Jade       dark  on-warning       warning        #150d08/#fab45f  10.76  4.5    OK     texto normal
c:Jade       dark  warning-text     surface        #fab45f/#150d08  10.76  4.5    OK     texto normal (aviso)
c:Jade       dark  warning-text     surface-raised #fab45f/#291f18  9.02   4.5    OK     texto normal (aviso)
c:Jade       dark  on-warning-soft  warning-soft   #ffe9d0/#3f2500  12.07  4.5    OK     texto normal
c:Jade       dark  on-info          info           #150d08/#a0c6ff  10.99  4.5    OK     texto normal
c:Jade       dark  info-text        surface        #a0c6ff/#150d08  10.99  4.5    OK     texto normal
c:Jade       dark  info-text        surface-raised #a0c6ff/#291f18  9.22   4.5    OK     texto normal
c:Jade       dark  on-info-soft     info-soft      #e2eeff/#03295d  12.11  4.5    OK     texto normal
c:Jade       dark  focus            surface        #a0c6ff/#150d08  10.99  3.0    OK     grafico: anillo de foco
c:Jade       dark  focus            surface-raised #a0c6ff/#291f18  9.22   3.0    OK     grafico: anillo de foco
c:Jade       dark  focus            surface-alt    #a0c6ff/#3d332b  7.04   3.0    OK     grafico: anillo de foco
c:Jade       dark  support-1-deep   support-1-soft #ffcfcb/#57030b  10.57  4.5    OK     texto normal (banda de apoyo 1)
c:Jade       dark  support-2-deep   support-2-soft #f1daa8/#382900  10.32  4.5    OK     texto normal (banda de apoyo 2)
----------------------------------------------------------------------------------------------------------------------
3 paletas x 2 temas x 42 parejas = 252 filas; 240 con umbral; 0 fallos.
$ echo $?
0
```

### 1.7 Recomendación razonada y elección `[P]`

**Elección: Paleta A, Bugambilia.** Razones, en orden de peso:

1. **Identidad propia y reconocible.** El rosa mexicano es el color de la fiesta en México (Barragán, la señalética del 68, el papel picado) y **nadie lo usa en invitaciones digitales**: el mercado va al dorado, al negro y al pastel. Frente a la referencia (púrpura casi negro) es otra familia y otra temperatura: cálida, alegre, con tinta de cacao en vez de zinc.
2. **Se comporta bien en la matemática.** `on-primary/primary` 6,22, `link/surface` 8,23, `focus/surface` 3,61, y el oscuro con `primary` 300 sobre cacao 950 llega a 10,4. El añil de apoyo da un foco que se ve sobre el botón; el jade y el mango cubren éxito y acento sin robarle el protagonismo.
3. **Rota bien por tipo de evento.** Boda (bugambilia), XV (mango), bautizo (añil suave), cumpleaños (jade), graduación (añil profundo), corporativo (cacao + añil): la estructura se mantiene y el color cambia, que es el patrón de la referencia (capturas 06-07) hecho propio.

**Riesgo declarado y su mitigación:** un rosa saturado puede leerse como «solo femenino / solo bodas». Mitigación: (a) el principal solo ocupa botones, enlaces y una forma por bloque; el papel es hueso, no rosa; (b) las bandas de los eventos usan los apoyos; (c) el chrome del editor no lleva formas decorativas y el rosa aparece únicamente en acción y selección. Si el dueño lo rechaza, **Talavera (B)** es la alternativa inmediata: mismo sistema, mismo script, cambia un fichero de datos. **Jade (C)** se descarta como recomendación porque el éxito y el principal son los dos verdes; separados 33° y por luminosidad pasan el script, pero un chip «confirmado» junto a un botón primario pide atención en cada composición, y eso es una carga permanente para los módulos futuros.

---

## 2. Tipografía: tres parejas OFL por npm

### 2.1 Las tres parejas `[V]`

Las nueve familias se instalaron con `npm pack` desde el registro (proxy del entorno), se copiaron sus woff2 **latinos** y su `OFL.txt` a `moodboard/fonts/` (484 KB en total, incluidas licencias) y `document.fonts.check()` confirmó la carga de las nueve antes de cada captura (`capturar.mjs`, salida en la bitácora).

| pareja | display | texto | etiqueta | woff2 latinos (bytes) | carácter |
|---|---|---|---|---|---|
| **1 · recomendada** | **Fraunces** (variable: wght 100-900, opsz 9-144, SOFT 0-100, WONK 0-1) | **Onest** (variable 100-900) | **Red Hat Mono** (variable 300-700) | 121 016 + 33 760 + 22 412 = **177 188** | serifa suave con carácter + humanista de ojo alto + mono suave |
| 2 | Bricolage Grotesque (variable: wght 200-800, opsz 12-96, wdth 75-100) | Figtree (variable 300-900) | Azeret Mono (variable 100-900) | 76 888 + 20 156 + 26 164 = 123 208 | grotesca con trampas de tinta + geométrica amable + mono con personalidad |
| 3 | Gabarito (variable 400-900) | Instrument Sans (variable 400-700, wdth 75-100) | Spline Sans Mono (variable 300-700) | 34 236 + 30 092 + 36 476 = 100 804 | geométrica redondeada + sans neutra + mono suave |

Paquetes: `@fontsource-variable/{fraunces,onest,red-hat-mono,bricolage-grotesque,figtree,azeret-mono,gabarito,instrument-sans,spline-sans-mono}`, todos `license = 'OFL-1.1'` (§2.3). Fontsource sirve el subconjunto latino como fichero aparte con `unicode-range`, así que el navegador solo descarga el latino para es-MX (acentos, «ñ», «¿¡» están en `U+0000-00FF`).

### 2.2 Escala modular con nombres semánticos `[P]`

Fuente por rol: `display-*` y `heading-*` en la display (nunca la de cuerpo en títulos, `10 §1.5`); `text-*` en la de texto; `label-*` en la mono, mayúsculas con tracking positivo. Tamaños a 390 px → 1024 px+ (entre medias, `clamp()`).

| rol | tamaño 390 / 1024+ | line-height | tracking | peso | ejes (Fraunces) |
|---|---|---|---|---|---|
| `display-2xl` | 40 / 64 | 1,05 / 1,02 | -0,035em / -0,04em | 800 | opsz 96, SOFT 70, WONK 1 |
| `display-xl` | 32 / 48 | 1,05 | -0,03em / -0,035em | 800 | opsz 72, SOFT 60, WONK 1 |
| `display-lg` | 28 / 36 | 1,1 / 1,08 | -0,025em | 700 | opsz 48, SOFT 50 |
| `display-md` | 24 / 28 | 1,15 / 1,12 | -0,02em | 700 | opsz 32, SOFT 40 |
| `display-sm` | 20 / 22 | 1,2 | -0,02em | 700 | opsz 20, SOFT 30 |
| `heading-lg` | 24 / 28 | 1,15 | -0,02em | 700 | opsz 32, SOFT 40 |
| `heading-md` | 20 / 22 | 1,2 | -0,02em | 700 | opsz 20, SOFT 30 |
| `heading-sm` | 17 / 18 | 1,3 | -0,01em | 700 | opsz 14, SOFT 20 |
| `text-lg` | 18 / 18 | 1,5 | 0 | 450 | — |
| `text-md` | 16 / 16 | 1,5 | 0 | 450 (negrita 650) | — |
| `text-sm` | 14 / 14 | 1,5 | 0 | 450 | — |
| `text-xs` | 13 / 13 | 1,45 | 0 | 450 | mínimo para texto de interfaz |
| `label-lg` | 14 / 14 | 1,3 | +0,06em | 500 | sin mayúsculas: metadatos, contadores |
| `label-md` | 12 / 12 | 1,3 | +0,12em | 500 | mayúsculas: eyebrow, paso, badge |
| `label-sm` | 11 / 11 | 1,3 | +0,14em | 500 | mayúsculas: badge pequeño, pie |

Diferencia entre `display` y `heading`: mismo dibujo, distinta función. `display` abre una pantalla o una sección (una por vista, puede llevar SOFT alto y WONK); `heading` titula bloques y tarjetas (jerarquía HTML por nivel, nunca por tamaño, `04 §17.3`). El peso del cuerpo es 450 (no 400) por el mismo motivo por el que la referencia usa Inter 500: una Onest de 400 sobre hueso queda fina en pantallas de baja densidad.

### 2.3 Salida literal de `npm view` `[V]`

```
$ for p in <paquetes>; do npm view "$p" version license dist.unpackedSize; done   # 2026-09-05, registro npm por el proxy del entorno
== @fontsource-variable/fraunces
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 1924482
== @fontsource-variable/onest
version = '5.3.1'
license = 'OFL-1.1'
dist.unpackedSize = 175277
== @fontsource-variable/red-hat-mono
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 90781
== @fontsource-variable/bricolage-grotesque
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 544183
== @fontsource-variable/figtree
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 81105
== @fontsource-variable/azeret-mono
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 104782
== @fontsource-variable/gabarito
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 64549
== @fontsource-variable/instrument-sans
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 424093
== @fontsource-variable/spline-sans-mono
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 136699
== @fontsource-variable/inter
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 1909049
== @fontsource-variable/outfit
version = '5.3.0'
license = 'OFL-1.1'
dist.unpackedSize = 65131

$ npm pack @fontsource-variable/{fraunces,onest,red-hat-mono,bricolage-grotesque,figtree,azeret-mono,gabarito,instrument-sans,spline-sans-mono}@5.3.x && tar -tzvf <cada .tgz> | grep latin.*normal   # ficheros woff2 latinos y su tamaño en bytes
== fontsource-variable-fraunces-5.3.0.tgz
  121016 package/files/fraunces-latin-full-normal.woff2
  67304 package/files/fraunces-latin-opsz-normal.woff2
  36620 package/files/fraunces-latin-wght-normal.woff2
== fontsource-variable-onest-5.3.1.tgz
  33760 package/files/onest-latin-wght-normal.woff2
== fontsource-variable-red-hat-mono-5.3.0.tgz
  22412 package/files/red-hat-mono-latin-wght-normal.woff2
== fontsource-variable-bricolage-grotesque-5.3.0.tgz
  76888 package/files/bricolage-grotesque-latin-opsz-normal.woff2
  78156 package/files/bricolage-grotesque-latin-wdth-normal.woff2
  41344 package/files/bricolage-grotesque-latin-wght-normal.woff2
== fontsource-variable-figtree-5.3.0.tgz
  20156 package/files/figtree-latin-wght-normal.woff2
== fontsource-variable-azeret-mono-5.3.0.tgz
  26164 package/files/azeret-mono-latin-wght-normal.woff2
== fontsource-variable-gabarito-5.3.0.tgz
  34236 package/files/gabarito-latin-wght-normal.woff2
== fontsource-variable-instrument-sans-5.3.0.tgz
  57332 package/files/instrument-sans-latin-wdth-normal.woff2
  30092 package/files/instrument-sans-latin-wght-normal.woff2
== fontsource-variable-spline-sans-mono-5.3.0.tgz
  36476 package/files/spline-sans-mono-latin-wght-normal.woff2

$ ls -la fonts/*.woff2   # copiados desde npm pack al moodboard
26164 fonts/azeret-mono-latin-wght-normal.woff2
76888 fonts/bricolage-grotesque-latin-opsz-normal.woff2
20156 fonts/figtree-latin-wght-normal.woff2
121016 fonts/fraunces-latin-full-normal.woff2
34236 fonts/gabarito-latin-wght-normal.woff2
30092 fonts/instrument-sans-latin-wght-normal.woff2
33760 fonts/onest-latin-wght-normal.woff2
22412 fonts/red-hat-mono-latin-wght-normal.woff2
36476 fonts/spline-sans-mono-latin-wght-normal.woff2

$ du -sh fonts/
484K	fonts/
```

### 2.4 Presupuesto de peso y carga `[V]`

- Pareja recomendada: **177 KB** de woff2 latinos (Fraunces `full` 121 KB con los cuatro ejes; si el bloque 1 decide prescindir de SOFT/WONK, `fraunces-latin-opsz-normal.woff2` pesa 67 KB y el total baja a 123 KB). Solo se sirve el peso normal; no hay itálica en el sistema (Fraunces la tiene si algún día hace falta: 150 KB más).
- La display se `preload`a (`<link rel="preload" as="font" type="font/woff2" crossorigin>`) porque pinta el `display-2xl` del LCP de la landing; texto y etiqueta con `font-display: swap` y **metric override** (`ascent-override`, `size-adjust`) contra la fuente de respaldo para que el swap no reacomode el texto (CLS).
- **No afecta al presupuesto de `/i/[token]`** (JS < 150 KB gz, LCP < 2,5 s, `contratos.md §8`): esas fuentes solo se importan en el layout raíz `(chrome)`; `(public)` y `(canvas)` son árboles de layout distintos y no las cargan (`04 §19`). Aun así, en el chrome se mide: la landing debe seguir en LCP < 2,5 s con la display precargada.
- Mecanismo: `@fontsource-variable/*` importados en `globals.css` del chrome (ya es así hoy con Inter/Bricolage/Outfit); las tres importaciones actuales se sustituyen, no se suman.

### 2.5 Recomendación, elección y descartes `[P]`

**Elección: pareja 1, Fraunces + Onest + Red Hat Mono.** Fraunces es la única de las tres display que cambia de personalidad con el tamaño (opsz + SOFT): juguetona y redonda en un titular de 64 px, sobria en un título de tarjeta de 20 px; eso resuelve «distinción clara entre títulos, encabezados y contenido» con una sola familia. Con Onest (ojo alto, aperturas abiertas, «ñ» y acentos bien resueltos) la lectura a 16 px en móvil es cómoda, y Red Hat Mono da a los eyebrows y pasos una voz técnica pero amable. Las tres son inconfundibles entre sí (capturas `tipografia-1*.png`).

Descartes y por qué:
- **Inter** (instalada): es la tipografía de la referencia y del 70 % del software; usarla es exactamente «una variante de aquel». Además obliga al peso 500 para no verse fina, cosa que Onest resuelve en 450.
- **Bricolage Grotesque** (instalada): sí tiene carácter y se queda como pareja 2 (segunda opción real, ya instalada, 77 KB). Se descarta como primera porque su carácter es urbano y áspero; para bodas, bautizos y XV años la serifa suave comunica celebración sin perder modernidad.
- **Outfit** (instalada): geométrica correcta pero sobreexpuesta (miles de sitios de plantillas) y sin ejes ópticos; a 16 px pierde personalidad y a 64 px no gana ninguna. Se retira del chrome.
- **Playfair Display, Cormorant Garamond, Source Sans 3** (instaladas, `@fontsource/*` estáticas): son de las **plantillas de invitación**; usarlas en el chrome rompería la separación chrome/invitación y haría que el editor «se pareciera» a una plantilla concreta.
- Consideradas y no elegidas: Instrument Serif (sin pesos altos), Unbounded y Syne (demasiado anchas para títulos largos en es-MX a 390 px), Epilogue (grotesca, solapa con Bricolage), Atkinson Hyperlegible Next (excelente legibilidad, aspecto utilitario).

---

## 3. Biblioteca de formas (`@invitaciones/ui/shapes`)

Todas en SVG inline, sin hex propio (color por token), parametrizadas y **deterministas** (mismo `seed`, mismo dibujo en servidor y cliente: sin discrepancias de hidratación). Dibujadas con la paleta recomendada en `#formas` del moodboard (`capturas/formas.png`). La matemática de blob, sello y rayos vive hoy en `moodboard/construir.mjs` (`blob()`, `sello()`, `rayos()`) y se traslada tal cual a `packages/ui/src/shapes/geometria.ts`.

### 3.1 Catálogo y API `[P]`

Props comunes: `tone` (token de color: `primary`, `primary-soft`, `primary-bright`, `support-1`, `support-1-soft`, `support-2`, `accent`, `accent-soft`…), `rotate` (grados), `scale`, `className`, `aria-hidden` (siempre `true`: son decorativas), `breathe` (animación de 12 s que `prefers-reduced-motion` apaga; por defecto `false`).

| forma | componente y parámetros | dónde | qué emite |
|---|---|---|---|
| Rayos radiales | `<Rays tone="primary-soft" density={12} radius={160} breathe />` | fondo de héroe, testimonio, banda de publicación | `<path>` con `density` cuñas de 180/density grados sobre el fondo del contenedor (el fondo pone la otra mitad) |
| Rayas | `<Stripes tone="support-2-soft" angle={-24} gap={18} width={9} />` | fondo de banda | `<pattern>` de franjas |
| Onda, una o dos capas | `<WaveDivider from="primary-soft" to="surface" profile="suave\|marcada\|doble" layers={1\|2} tones={[…]} flip />` | divisor entre secciones; borde inferior de foto de tarjeta (con `asClip`) | `<path>` de altura fija 60-90 px, `preserveAspectRatio="none"` |
| Blob orgánico | `<Blob seed={7} points={7} amplitude={0.22} tone="support-2-soft" />` | detrás de una tarjeta o lista; máscara | `<path>` Catmull-Rom cerrado; `seed` → mulberry32 |
| Triángulo | `<Triangle tone="accent" rotate={-8} scale={1.2} radius={12} />` | detrás de foto o tarjeta | `<path>` con esquinas redondeadas |
| Cuadrado rotado | `<RotatedSquare tone="primary-bright" rotate={12} radius="md" />` | detrás de foto grande | `<rect rx>` |
| Píldora | `<Pill tone="support-1" dot>128 confirmados</Pill>` | prueba social, insignia colgada, eyebrow con fondo | `<span>` con `-soft`/`-deep` (pareja verificada) |
| Sombra de color desplazada | `<Card shadow="color" tone="support-2" />` | la tarjeta destacada de una vista | `box-shadow: 8px 8px 0 0 var(--ui-support-2)` + borde de tinta 2 px |
| Máscaras de foto | `<Image mask="radius-lg\|blob\|arch\|seal\|rotated" seed points rotate />` | toda fotografía | `clip-path: path()`/`url(#…)` + placeholder del sistema si no hay `src` |
| Sello festoneado | `<Seal points={12} amplitude={4} tone="primary-soft" />` | fondo de insignia, de estado vacío y de icono grande; máscara `seal` | `r(θ) = R + a·cos(nθ)` muestreado a 240 pasos |

### 3.2 Parámetros de detalle

- `density` de rayos: 8-16 (12 por defecto); `radius` en px o `%` del contenedor; los rayos se centran en un punto que se puede desplazar (`origin="80% 30%"`) para que salgan desde detrás de la foto.
- `profile` de onda: tres curvas fijas (`suave`, `marcada`, `doble`) para que todas las ondas del producto sean la misma familia; no se admite un `path` libre.
- `seed` de blob y de máscara blob: entero; el mismo número siempre da el mismo blob. En listas se usa el índice o un hash estable del id.
- `reduced-motion`: `breathe` se implementa con `@media (prefers-reduced-motion: no-preference)`; sin ella no hay `animation` en el CSS emitido.
- Todas aceptan `style` solo para `--tone` (nunca colores literales).

### 3.3 Placeholder del sistema (mientras no hay foto)

`<Image>` sin `src` (o con `pending`) pinta la máscara con un degradado de dos tonos `-soft` de la paleta (principal → apoyo 2), el icono `galeria` de dos tonos en `primary` centrado y, en desarrollo, un `data-imagen-pendiente="<id>"` que el bloque 3 vuelca a `imagenes-pendientes.md` (§9).

### 3.4 Reglas de composición (obligatorias; el moodboard las muestra con un «así sí / así nunca»)

1. **Una protagonista por bloque.** Como máximo una forma protagonista por sección o tarjeta; una segunda solo en `-soft`, con menos del 30 % del área y sin tocar a la primera.
2. **Contraste de matiz forma/fondo.** La forma nunca es del mismo matiz que su fondo, salvo los rayos (dos pasos del mismo matiz por definición). Con `surface-alt` (principal 50), la forma va en apoyo o acento; sobre papel neutro puede ir el principal.
3. **La forma nunca compite con el texto.** Solo puede quedar detrás de un `display-*` o de una foto; nunca debajo de un párrafo, un campo o un botón. Se recorta al contenedor (`overflow: hidden`) y nunca sale del bloque.
4. **Fotos siempre con máscara** o radio ≥ 24 px. Nunca rectángulo duro sobre color plano.
5. **Texto nunca sobre foto.** Separación por papel opaco, banda o tarjeta (con sombra 2 si va encima del borde de la foto). Nunca velo, degradado ni `text-shadow`.
6. **El 500 es decorativo.** Solo en formas grandes.
7. **Movimiento:** solo `breathe` y solo en formas de fondo.
8. **Sombra de color: una por vista** y nunca mezclada con sombra difusa en el mismo elemento.
9. **El editor no lleva formas decorativas.** En `/editor/[id]` la protagonista es la invitación de la clienta.

---

## 4. Sistema de iconos (`@invitaciones/icons`)

### 4.1 Retícula y estilo `[P]`

- Retícula **24 × 24**, margen de 1,5 px; el dibujo vive en 21 × 21. Trazo **1,75 px** (2 px cuando el icono se usa a 16 px), `stroke-linecap="round"`, `stroke-linejoin="round"`, sin `fill` en el trazo.
- **Dos tonos**: contorno en `currentColor` y relleno suave en `var(--tono, var(--ui-primary-soft))` para la pieza principal (solapa del sobre, cuerpo del pastel, birrete…). El «dos tonos» sale de un segundo token, nunca de `opacity` sobre `currentColor` (así el relleno se verifica como color propio y en oscuro cambia a `primary-soft` oscuro sin trabajo).
- A 48 px el trazo **escala** con el icono (sigue siendo 1,75 unidades de la retícula); por eso los iconos grandes de estados vacíos y tipos de evento conservan el peso de los de 24 (`capturas/iconos.png`, cada icono a 24 y 48).
- Un color por categoría en listas: cuadro de fondo `-soft` + trazo `-deep`/600 del mismo matiz; el dibujo y el trazo no cambian.
- Nombres en `kebab-case` español sin acentos (`xv-anos`, `cumpleanos`); exportación como `<IconoNombre />` en PascalCase.
- Cada icono lleva `aria-hidden="true"` salvo que sea el único contenido de un control, y entonces el control lleva `aria-label`.

### 4.2 Inventario (82 nombres; 15 dibujados en el moodboard)

- **Navegación (11):** `inicio`, `atras`, `adelante`, `menu`, `cerrar`, `buscar`, `ayuda`, `ajustes`, `externo`, `chevron-abajo`, `chevron-derecha`.
- **Edición (20):** `editar`, `deshacer` (dibujado), `rehacer`, `guardar`, `arrastrar`, `subir`, `bajar`, `ver`, `ocultar`, `duplicar`, `borrar`, `agregar`, `quitar`, `recortar`, `punto-focal`, `paleta`, `tipografia`, `movil`, `escritorio`, `vista-previa`.
- **Secciones de invitación (15):** `portada`, `celebrantes`, `evento-fecha` (dibujado), `itinerario`, `galeria` (dibujado), `mesa-de-regalos` (dibujado), `sugerencias`, `comodidades`, `rsvp-confirmado` (dibujado), `familia`, `historia`, `vestimenta` (dibujado), `pie`, `lugar` (dibujado), `reloj`.
- **Estados (8):** `exito`, `aviso`, `error`, `info`, `cargando`, `candado`, `chispa` (dibujado), `imagen-pendiente`.
- **RSVP e invitados (7):** `confirmar`, `rechazar`, `invitados`, `mesa`, `nota`, `alergia`, `ninos`.
- **Compartir (8):** `compartir` (dibujado), `enlace` (dibujado), `copiar`, `chat`, `descargar`, `qr`, `correo`, `telefono`.
- **Cuenta (5):** `cuenta`, `plan`, `pago`, `salir`, `entrar`.
- **Tipos de evento (8):** `boda` (dibujado), `xv-anos` (dibujado), `bautizo`, `comunion`, `cumpleanos` (dibujado), `graduacion` (dibujado), `corporativo`, `invitacion` (dibujado).

Los SVG fuente de los 15 dibujados están en `moodboard/partes/05-iconos.html`; el bloque 2 los copia a `packages/icons/svg/*.svg` sin retocar.

### 4.3 Ilustraciones de estados vacíos

Misma gramática que los iconos, a otra escala (`capturas/iconos.png`, «Todavía no tienes invitaciones»): trazo de tinta grueso (4-4,5 px en un lienzo de 160), un solo tono de relleno por pieza, **sombra de color desplazada** 7/7 px en un tono de apoyo, todo sobre una forma de fondo (sello, blob o rayos) en `primary-soft`, con un solo detalle de acento (la chispa). Nada de clipart plano ni personajes. Estados que la necesitan: sin invitaciones, sin plantillas, sin fotos, sin confirmaciones, sin conexión, 404, enlace caducado. Cada ilustración es un componente `<Ilustracion nombre="sin-invitaciones" />` de `packages/ui/src/ilustraciones/`.

---

## 5. Inventario de componentes (`@invitaciones/ui`)

Base accesible: **Radix** (Dialog, DropdownMenu, RadioGroup, Switch, Progress ya están en el proyecto; se añaden Tabs, Tooltip, Toast, Select/Combobox sobre `@radix-ui/react-*` o cmdk-like propio). Aspecto 100 % propio con `class-variance-authority` + tokens; **ningún control nativo sin estilo**. Convenciones comunes: altura de control 44-46 px (objetivo ≥ 24 px, 2.5.8), radio de control 8 px, píldora para acciones, foco con anillo de 3 px `focus` y halo de 2 px `surface`, estado ocupado con `aria-busy` y texto («Publicando…»), deshabilitado con `opacity: .45` + `cursor: not-allowed` y **siempre una explicación cerca** (nunca un control mudo). Bocetos con estados en `capturas/componentes.png`.

| componente | anatomía | tokens | estados | teclado y ARIA | móvil |
|---|---|---|---|---|---|
| **Button** primario / secundario / terciario / icono / peligro / acento; tamaños sm 36, md 44, lg 52 | `<button>` píldora, texto 15/600, icono opcional 18 px a la izquierda, spinner en `cargando` | `primary`/`on-primary`, `primary-hover`, `primary-soft`, `link`, `danger`, `accent`, `focus` | reposo, hover (fondo 700 + `translateY(-1px)`), foco, activo (`scale(.98)`), deshabilitado, cargando (`aria-busy`, texto cambia, ancho fijo) | Enter/Espacio; icono solo → `aria-label` | ancho completo dentro de formularios; nunca dos primarios en una vista |
| **Input** | etiqueta 14/600 arriba, control 46 px radio 8, borde 1,5 px `border`, ayuda 12,5 debajo, error con icono | `surface-raised`, `border`, `ink`, `ink-placeholder`, `primary` (foco), `danger`, `focus` | reposo, hover (borde `ink-muted`), foco (borde 2 px `primary` + anillo), error (`aria-invalid` + borde `danger` + mensaje `role="alert"`), deshabilitado (fondo `surface-alt` + texto de dónde se cambia), solo lectura | etiqueta asociada; `aria-describedby` a ayuda y error | 16 px de fuente mínimo (evita zoom en iOS); `inputmode` correcto |
| **Textarea** | como Input, alto mínimo 96, contador «0/280» al 80 % | ídem | ídem | ídem | crece con el contenido hasta 6 líneas |
| **Select** (≤ 5 opciones fijas) | control con valor + chevron; lista flotante en `surface-raised` con `shadow-2`, opciones de 44 px | `primary-soft`/`on-primary-soft` (resaltada), `primary` (check) | cerrado, abierto, resaltada, elegida, deshabilitada (con motivo: «Corporativo · plan 2») | Radix Select: flechas, Inicio/Fin, escribir para saltar, Esc; `role="listbox"` | hoja inferior con asa; el control no hace zoom |
| **Combobox** (> 5 opciones o búsqueda) | igual que Select con campo de búsqueda arriba de la lista y «Sin resultados para …» | ídem | ídem + «buscando» | `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-autocomplete="list"` | hoja inferior, búsqueda con foco automático, teclado no tapa la lista |
| **Radio** / **Checkbox** grandes | 26 px, borde 2 px, marca 12 px; **opción grande** (tarjeta 52 px con texto y meta) para ≤ 5 opciones | `border`, `primary`, `on-primary`, `primary-soft`, `focus` | reposo, hover, marcado, foco, deshabilitado, error de grupo | Radix RadioGroup / Checkbox; flechas entre radios; Espacio | objetivo de toda la fila (≥ 44 px) |
| **Switch** | 48 × 28, bolita 22 con `shadow-1`, transición `spring` | `border` (off), `primary` (on), `focus` | off, on, foco, deshabilitado | `role="switch"`, `aria-checked`, etiqueta que nombra («Mostrar Nuestra historia») | ídem |
| **Chip** | píldora 34 px, 13/600; seleccionable, de estado (éxito/aviso/peligro/info/acento), con punto o check | `primary-soft`/`on-primary-soft`, `*-soft`/`on-*-soft`, `border` | reposo (borde), hover (fondo `surface-alt` + borde `primary`), seleccionado, foco, deshabilitado | `role="checkbox"`/`radio` según grupo, o `button` con `aria-pressed` | se envuelven en filas; en filtros, carrusel horizontal con scroll-snap |
| **Stepper** | pasos con círculo 30 (número / check), etiqueta mono 10,5 en mayúsculas, líneas de 3 px | `primary`, `on-primary`, `border`, `divider`, `ink-muted` | pendiente, actual, hecho, error | `<ol>` con `aria-current="step"`; pasos hechos son enlaces | solo números + línea; la etiqueta del actual bajo el título |
| **Progreso anular** | anillo 72, trazo 7, **número siempre como texto** | `divider`, `primary`, `success` | en curso, completo, indeterminado | `role="progressbar"`, `aria-valuenow`, `aria-valuetext` | ídem |
| **Card** plana / elevada / sombra de color / tinta | radio 14-24, padding 16-24 | `surface-raised`, `divider`, `shadow-1/2`, `shadow-color`, `support-*-soft/deep` | reposo; **sin hover de elevación en rejillas** (decisión de la referencia que se conserva: la rejilla no salta); la tarjeta enlazable solo cambia el color del título | `<article>` con `<h3>` y un solo control primario | una columna; imagen arriba con máscara |
| **Tabs** | píldora contenedora en `surface-alt`, pestaña activa en `surface-raised` con `shadow-1` | ídem | activa, inactiva, hover, foco, deshabilitada | Radix Tabs, activación manual, ←/→ Inicio/Fin | scroll horizontal si no caben |
| **Dialog** / **Sheet** | `surface-raised`, radio 24, `shadow-2`, título display-md, cuerpo, acciones a la derecha | ídem + `ink` al 40 % como fondo (sin blur) | abierto, ocupado (bloquea Esc), con error | Radix Dialog: foco atrapado y devuelto, `aria-labelledby/describedby`, Esc | hoja inferior con asa, botón primario pegado abajo, `safe-area-inset` |
| **Toast** | `ink` sobre `surface`, icono 22, negrita + frase, 4 s, máximo 2 apilados | `ink`, `surface`, `success`/`danger` (icono) | informativo, éxito, error | región `role="status"` `aria-live="polite"`; los errores que exigen decisión son diálogo o banner, no toast | arriba centrado, bajo la barra |
| **Tooltip** | `ink`/`surface`, 13/500, flecha opcional | ídem | visible con foco y con ratón | Radix Tooltip; nunca único portador de información | no aparece en táctil: el contenido debe existir en otro sitio |
| **EmptyState** | ilustración (§4.3) + display-sm + frase + una acción | `surface-alt`, `primary-soft` | — | `<section aria-labelledby>` | ilustración a 120 px |
| **Skeleton** | barras con brillo lento (`prefers-reduced-motion` lo apaga) | `surface-alt`, `divider` | — | `aria-busy` en el contenedor; `aria-hidden` en las barras | ídem |
| **Avatar** | 44, iniciales 15/700 o foto con máscara circular | `support-1-soft`/`support-1-deep` | con foto, con iniciales, con estado | `<img alt>` o `aria-label` | 36 en listas |
| **Badge** | 22 px, mono 11 en mayúsculas | `*-soft`/`on-*-soft` | por estado | texto siempre | ídem |
| **Breadcrumb** / progreso de asistente | enlaces 13,5 con «/» en `ink-muted`; en asistentes lo sustituye el Stepper | `link`, `ink-muted` | — | `<nav aria-label="Ruta">`, `aria-current="page"` | solo el Stepper o «Atrás» con nombre del paso |
| **Image** | máscara (§3.1), placeholder del sistema, `alt` obligatorio salvo `role="decorative"` | `primary-soft`, `support-2-soft` | cargando (skeleton dentro de la máscara), cargada, rota (placeholder + texto), pendiente | `<img>` con `alt`; decorativa `alt=""` | `sizes` correcto; nunca `object-fit` sin máscara |

Cada componente entra en la galería `/design` con **todas** sus variantes y estados y con una captura de regresión (§8).

---

## 6. Movimiento

### 6.1 Duraciones y curvas con nombre `[P]`

| token | valor | uso |
|---|---|---|
| `--ui-dur-1` | 120 ms | color de hover, foco, cambio de icono |
| `--ui-dur-2` | 200 ms | botón, chip, switch, tab |
| `--ui-dur-3` | 320 ms | entrada de tarjetas, hoja, diálogo, toast |
| `--ui-dur-4` | 600 ms | cambio de pantalla en el asistente, progreso anular |
| `--ui-dur-respira` | 12 000 ms | respiración de formas |
| `--ui-ease-out` «salida» | `cubic-bezier(0.2, 0.7, 0.2, 1)` | entradas y hover |
| `--ui-ease-in-out` «traslado» | `cubic-bezier(0.6, 0, 0.2, 1)` | cambios de estado, respiración |
| `--ui-ease-spring` «rebote suave» | `cubic-bezier(0.34, 1.4, 0.64, 1)` | switch, check, chip seleccionado |
| `--ui-ease-linear` | `linear` | spinner, skeleton |

### 6.2 Reglas

1. **Entradas escalonadas**: listas y rejillas entran con `dur-3` y un retardo de 40 ms por elemento, máximo 8 elementos (el resto sin animación). Solo al montar, nunca al reordenar datos.
2. **Formas que respiran lentísimo**: `breathe` = `scale(1) rotate(0)` → `scale(1.04) rotate(2deg)` en 12 s, alternado, solo en formas de fondo, como máximo una por vista.
3. **Hover con elevación mínima**: botones `translateY(-1px)`; las tarjetas en rejilla **no** se elevan (la rejilla no salta); los enlaces cambian de color en `dur-1`.
4. **Nada bloquea la interacción**: ninguna animación de entrada retrasa el foco ni el clic; los diálogos aceptan Esc desde el primer frame; el autoguardado no anima.
5. **Todo con `prefers-reduced-motion`**: con `reduce` no hay `animation` ni `transition` de `transform`; quedan solo transiciones de color de 120 ms y el spinner se vuelve estático con texto («Publicando…»). Implementación central: las utilidades de movimiento se emiten dentro de `@media (prefers-reduced-motion: no-preference)`.
6. **Progreso, no espera**: cualquier espera superior a 400 ms muestra skeleton o progreso con texto; nunca una pantalla vacía.

---

## 7. Mapa de pantallas (wireframes en `#pantallas`, `capturas/pantallas*.png`)

Principio: **un objetivo por pantalla, progreso visible, textos es-MX cálidos y concretos**. Las plantillas de invitación quedan fuera. Las fricciones medidas que esto corrige: la raíz `/` es un 404 en inglés y el tipo de evento no se comprueba al elegir plantilla (`handoffs/3b-adv.md §8.1`, `bitacora/3-ux.md`).

| pantalla | ruta | objetivo | forma protagonista | textos clave (es-MX) |
|---|---|---|---|---|
| Web pública | `/` | entender en cinco segundos y empezar | rayos detrás de la foto con máscara de sello | eyebrow «Invitaciones digitales con RSVP» · «Tu invitación, lista en una tarde.» · «Empezar mi invitación» / «Ver ejemplos» · «Cómo funciona» → «Tres pasos y a repartir.» · «Para cada celebración» · testimonio · «Elige tu plan» |
| Acceso y registro | `/acceso` | entrar o crear cuenta sin fricción; registro en 3 pasos con progreso | ondas de dos capas | pestañas «Entrar» / «Crear cuenta» · «Entra a tu cuenta» · «Crea tu cuenta» · error «El correo o la contraseña no coinciden. Revísalos e inténtalo otra vez.» · recuperación «Si el correo corresponde a una cuenta, te enviamos un enlace para cambiar la contraseña.» · paso 2 «Elige una contraseña» · paso 3 «¿Cómo te llamamos?» → «Listo. Elige el tipo de evento.» |
| Asistente de creación | `/editor` (pasos `?paso=evento\|plantilla\|datos`) | llegar al editor con plantilla coherente con el evento | cuadros de tipo de evento con icono; tarjeta con onda | paso 1 «¿Qué vamos a celebrar?» · «Elige uno; te mostramos solo las plantillas que le van.» · «Continuar con Boda» · paso 2 «Elige el punto de partida» · filtros «Todas · 12», «Incluidas en mi plan» · bloqueada «Requiere el plan 2» → «Ver qué incluye el plan 2» · paso 3 «Los datos básicos»: «¿Quiénes celebran?», «¿Cuándo?», «¿Dónde?» · «Puedes cambiarlos después» · «Abrir mi invitación» · vacío «Todavía no tienes invitaciones» → «Ver planes» |
| Chrome del editor | `/editor/[id]` | editar sin miedo | ninguna (la protagonista es la invitación) | barra: nombre humano de la invitación, «Guardando…» → «Guardado 12:41», «Ver», «Publicar» · fila de sección: asa, icono, nombre, badge «ejemplo», interruptor «Mostrar Nuestra historia», menú (Subir, Bajar, Cambiar diseño) · panel de bloque: «Volver a secciones», contador «17/40», «Cambiar la fecha» · móvil: pestañas «Editar» / «Vista previa» (ADR-3-8-01) · **selector de paleta y tipografía de la plantilla** con muestras reales (`ThemePicker`), reordenar con asa y alternativa sin arrastre, gestor de fotos en el panel |
| Publicar y compartir | diálogo / hoja + tarjeta de éxito | salida clara | chispa sobre sello, una vez | «Antes de publicar, revisamos» · «Falta el nombre del lugar → Completar» · «usa el texto de ejemplo → Editar» · «Publicar» deshabilitado con motivo · «Tu invitación ya está en vivo» (texto, **sin emoji**: sustituye la palomita verde (U+2705) que hoy vive en `lib/i18n.ts` `publicar.yaSeVe`) · «Copiar enlace» → toast «Enlace copiado. Ya puedes pegarlo en WhatsApp.» · «Compartir por WhatsApp» · «Ver como invitado» · «Código QR para imprimir» · «Estamos actualizando el enlace de tus invitados…» |
| Estados | 404, vacío, error, sin conexión | ningún callejón sin salida | sello + ilustración | «Esta página no existe» · «Ir a la portada» / «Ir a mis invitaciones» · «Todavía no hay fotos» → «Agregar fotos» · «Nadie ha confirmado todavía» → «Compartir el enlace» · «Algo salió mal. Inténtalo de nuevo.» + «Código: TPL_…» · «No hay internet. Tus cambios se guardan aquí y se envían al volver.» |
| Ayuda | `/ayuda` | resolver la duda sin salir | rayos pequeños en la cabecera | «¿En qué te ayudamos?» · buscador · acordeón de dudas reales · «Escríbenos por WhatsApp» |

Wireframes a 390 y a escritorio: `#pantallas` (landing 390/1440, acceso 390 ×2, asistente 390 paso 1 / 1440 paso 2, editor 390/1440, publicación 390/1440, 404 y ayuda 390). Tono de los textos: segunda persona, verbos concretos, sin jerga; los códigos de error van aparte y en mono.

---

## 8. Arquitectura del sistema de diseño

### 8.1 Paquetes `[P]`

```
frontend/packages/
  tokens/            @invitaciones/tokens
    src/
      paletas.ts     escalas (datos; generadas desde OKLCH, misma tabla que verificar-paletas.mjs)
      semantica.ts   roles → paso, por tema (la función semantica() de este bloque)
      tipografia.ts  familias, escala modular (§2.2), pesos
      espacio.ts     4-8-12-16-24-32-48-64-96, radios 8/14/24/36/pill, sombras, contenedor 1200 y canaletas
      movimiento.ts  duraciones y curvas (§6.1)
      index.ts       export tipado (as const) para TS
    scripts/
      build-css.mjs      → dist/tokens.css   (:root {--ui-*} y [data-theme="dark"] {--ui-*})
      build-tailwind.mjs → dist/preset.js    (preset con SOLO tokens semánticos: colors.ui.primary = var(--ui-primary)…)
      verify-contrast.mjs → rompe el build si una pareja baja del umbral (semilla: moodboard/verificar-paletas.mjs)
    package.json  "build": "node scripts/build-css.mjs && node scripts/build-tailwind.mjs", "verify": "node scripts/verify-contrast.mjs", "prepack": "npm run verify && npm run build"
  ui/                @invitaciones/ui
    src/
      componentes/   Button, Input, …, cada uno con .tsx + .test.tsx + historia para la galería
      shapes/        Rays, Stripes, WaveDivider, Blob, Triangle, RotatedSquare, Pill, Seal, Image + geometria.ts
      ilustraciones/ SinInvitaciones, SinFotos, …
      utilidades/    cn(), useReducedMotion(), tema (data-theme)
      estilos.css    @import "@invitaciones/tokens/dist/tokens.css"; @font-face de las tres familias
    package.json  deps: react, @radix-ui/*, class-variance-authority, tailwind-merge; peer: @invitaciones/tokens
  icons/             @invitaciones/icons
    svg/*.svg        fuente (24×24, dos tonos con var(--tono))
    scripts/generar.mjs   svgr → src/*.tsx (PascalCase), index.ts, y un JSON con el inventario para la galería
```

- **`apps/web/app/design/**`** (galería viva, ruta interna): `/design` (índice), `/design/tokens` (paletas, semántica, tipografía, espacio, movimiento; conmutador claro/oscuro), `/design/formas`, `/design/iconos` (inventario con búsqueda), `/design/componentes/[nombre]` (todas las variantes y estados, con controles). Fuera de producción (bandera `DESIGN_GALLERY=1`) y con capturas de regresión visual en CI (`e2e/design.spec.ts`, `toHaveScreenshot`).
- **Consumo:** `apps/web/app/(chrome)/globals.css` pasa a `@import "@invitaciones/ui/estilos.css"` y el `tailwind.config`/`@theme` importa el preset; los componentes de `components/ui/*` se sustituyen por los de `@invitaciones/ui` (los de `components/editor/*` los consumen). `(public)` y `(canvas)` no importan nada de esto.

### 8.2 Convenciones de nombres

- Prefijo **`--ui-`** para todo token del sistema; **nunca `--inv-`** (reservado a las plantillas). Compuerta: `test/tokens-no-leak.test.ts` ya existe para el sentido contrario; se añade el `grep` de `--inv-` en `packages/{tokens,ui,icons}` y de `--ui-` en `packages/sections`.
- Tokens semánticos únicamente en el preset de Tailwind: `bg-ui-primary`, `text-ui-on-primary`, `ring-ui-focus`, `font-ui-display`, `text-ui-display-xl`… **Sin** `bg-bugambilia-600`: los pasos de escala existen en TS y en `tokens.css` para las formas y la galería, pero no como utilidades, para que ningún componente elija un paso a mano.
- Componentes en PascalCase y en español donde el nombre es de producto (`EstadoVacio`, `SelectorDeTema`) y en inglés donde es un primitivo universal (`Button`, `Input`, `Dialog`), como ya hace el repo.
- Cada componente exporta sus variantes con `cva` y su tipo `…Props`; los tests de estados usan `getComputedStyle` sobre lo renderizado (no `toHaveClass`), en línea con `10 §4.2`.

### 8.3 `verify-contrast` (rompe el build)

Lee `paletas.ts` + `semantica.ts`, evalúa las 42 parejas por paleta activa y tema, imprime la tabla y sale con 1 si alguna baja de su umbral. Se ejecuta en `prepack` de `tokens` y en CI antes del build de `apps/web`. Además, la prueba de **pila renderizada** (`10 §4.2`): en la galería, un test Playwright toma cada pareja en su componente real (`getComputedStyle` del texto y del fondo compuesto, degradados incluidos) y compara con el umbral derivado del tamaño computado; debe caer si se sabotea un token (documentado).

### 8.4 Cómo lo consume un módulo futuro (15 minutos)

1. `pnpm add @invitaciones/tokens @invitaciones/ui @invitaciones/icons` (workspace).
2. Importar `@invitaciones/ui/estilos.css` en el layout raíz del módulo y el preset en su Tailwind.
3. Poner `data-theme` en `<html>` (o dejar que `useTema()` lo lea del sistema).
4. Componer con `Button`, `Input`, `Card`, formas e iconos; textos en es-MX; una forma protagonista por bloque; fotos con `Image mask`.
5. Añadir sus pantallas a `/design` si crea un componente nuevo (obligatorio, `10 §1.9`).

---

## 9. Imágenes pendientes (lista inicial; el bloque 3 la vuelca a `imagenes-pendientes.md`)

Estilo común: fotografía ultrarrealista, luz natural cálida, personas reales en celebraciones mexicanas contemporáneas (sin folclor de cartón), saturación alta pero piel natural, fondo con profundidad; nunca texto en la imagen; espacio negativo para la máscara. Sin imagen, placeholder del sistema (§3.3).

| id | uso | descripción | proporción | tamaño | prompt sugerido |
|---|---|---|---|---|---|
| `landing-hero` | `/` héroe, máscara de sello sobre rayos | pareja de treintañeros riendo con confeti de papel picado al fondo, jardín al atardecer | 1:1 | 1600 × 1600 | «Fotografía editorial, pareja mexicana joven riendo al aire libre en una boda en un jardín de hacienda al atardecer, confeti de papel picado de colores en el aire, luz dorada natural, lente 50 mm f/2, fondo desenfocado, sin texto» |
| `evento-boda` | cuadro de tipo de evento y banda | detalle de manos con anillos sobre mantel de lino | 4:3 | 1200 × 900 | «Primer plano de manos entrelazadas con anillos sobre mantel de lino crudo, flores de bugambilia desenfocadas, luz de ventana, fotografía de boda editorial» |
| `evento-xv` | ídem | quinceañera con vestido de color intenso bailando con su padre | 4:3 | 1200 × 900 | «Quinceañera bailando el vals con su padre en un salón con luces cálidas, vestido color mango, movimiento, sonrisa, fotografía documental» |
| `evento-bautizo` | ídem | bebé en brazos con vela y padrinos | 4:3 | 1200 × 900 | «Bautizo en una capilla luminosa, bebé de blanco en brazos, vela encendida, padrinos desenfocados, tonos hueso y añil suave» |
| `evento-comunion` | ídem | niña con vestido blanco y ramo pequeño, exterior | 4:3 | 1200 × 900 | «Niña de primera comunión con ramo pequeño en el atrio de una iglesia de cantera, mañana soleada, fotografía natural» |
| `evento-cumpleanos` | ídem | mesa de pastel con velas, niños y adultos soplando | 4:3 | 1200 × 900 | «Cumpleaños en un patio mexicano, pastel con velas, niños y abuelos alrededor, guirnaldas de papel, luz cálida de noche» |
| `evento-graduacion` | ídem | graduada lanzando el birrete con amigas | 4:3 | 1200 × 900 | «Graduada mexicana lanzando el birrete al aire con amigas, campus con jacarandas, día claro, fotografía de celebración» |
| `evento-corporativo` | ídem | brindis en una cena de empresa en terraza | 4:3 | 1200 × 900 | «Brindis en una cena corporativa en una terraza urbana de noche, luces cálidas, copas, personas de negocios relajadas, sin logotipos» |
| `testimonio-1..3` | testimonios de la landing, avatar circular | retratos de clientas reales o generadas, fondo neutro cálido | 1:1 | 400 × 400 | «Retrato de mujer mexicana de 32 años sonriendo, fondo hueso, luz suave de estudio, mirada a cámara, fotografía de perfil» |
| `paso-1..3` | «Cómo funciona», máscara blob | pantalla del teléfono con el editor, manos escribiendo; enlace compartido en WhatsApp; invitados confirmando | 4:5 | 1000 × 1250 | «Manos sosteniendo un teléfono con una invitación digital colorida en pantalla, mesa de madera con flores, luz natural, sin texto legible» |
| `vacio-*` | estados vacíos | **no llevan foto**: ilustración del sistema (§4.3) | — | — | — |
| `ayuda-hero` | `/ayuda` cabecera, opcional | persona atendiendo con auriculares, sonriendo | 3:2 | 1200 × 800 | «Persona de soporte sonriendo con auriculares en una oficina luminosa con plantas, fondo cálido, fotografía natural» |

---

## 10. Lo que este bloque no pudo determinar (supuestos en `preguntas-abiertas.md`)

- **Nombre de marca y wordmark**: se usa «Invitaciones» como marca de trabajo en Fraunces 800; no se diseña logotipo.
- **Fotografías**: no hay ninguna todavía; el moodboard usa el placeholder del sistema.
- **Elección final de paleta y tipografía**: recomendadas A y pareja 1; el dueño decide sobre las capturas.
- **`prefers-color-scheme`**: el tema oscuro existe como token; si el chrome lo sigue automáticamente o solo por ajuste de usuario queda para el dueño (supuesto: solo por ajuste, claro por defecto).
