# Arte del chrome — lenguaje visual medido en gigsalad.com

Playwright + Chrome real, 1440×900 y 390×844, 2026-09-04: portada, listado `/Disc-Jockeys-DJs/Wedding-DJ/IL/Chicago`, ficha `/dj_saxobeat_chicago` y `/quick-quote`. `[V]` medido en estilos computados/hojas de estilo, `[I]` inferido. Evidencia en `../evidencia/fase-3/referencia-chrome/`. **Solo chrome del producto; la invitación queda fuera.** Stack de la referencia: Tailwind 4 (`@theme`) + Filament (`fi-*`) + Livewire. Aviso de medición [V]: hay un factor de escala ≈0.917 en el árbol (un `1px` nominal computa `0.917431px`, un `outline-3` computa `2.75229px`); abajo van los valores nominales corregidos.

## 1. Color [V]

| Rol | Token del sitio | oklch literal | hex |
|---|---|---|---|
| Fondo de página / superficie de tarjeta | blanco | — | `#ffffff` |
| Fondo de sección alterna | `--color-purple-50` | `oklch(97.5% .016 310.1)` | `#faf4ff` |
| Texto primario | `--color-zinc-700` | `oklch(.37 .012 285.8)` | `#3f3f46` |
| Títulos (`text-party-purple`) | `--color-purple-950` | `oklch(.338 .173 305.5)` | `#4e027c` |
| Texto auxiliar / placeholder | zinc-500 / zinc-400 | `oklch(.552 .014 285.9)` / `oklch(.712 .013 286.1)` | `#71717a` / `#a1a1aa` |
| Borde de campo / separador `hr` | zinc-300 / `--color-zinc-200` | `rgb(212,212,216)` / `oklch(92% .004 286.3)` | `#d4d4d8` / `#e4e4e7` |
| **Acento de acción** | `--color-purple-950` | — | `#4e027c` |
| Acento de marca (héroe) / hover de texto | purple-600 / purple-500 | `oklch(.595 .234 304.2)` / `oklch(.657 .215 305.8)` | `#9f49ec` / `#b264f7` |
| Acento tonal (chips) / aro contorneado | purple-100 / purple-800 | `oklch(.933 .039 310.3)` / `oklch(.458 .217 304.9)` | `#f1e2fd` / `#751cb5` |
| Insignia "Featured" (`bg-berry-blue`) | `--color-blue-700` | `oklch(54.2% .191 258.3)` | `#1369db` |
| Éxito / estrella / error / foco | green-400 / yellow-300 / red-600 / blue-600 | `oklch(76.9% .151 152.59)` / `oklch(88.3% .158 91.3)` / `oklch(57.7% .245 27.325)` / `oklch(61.9% .19 254.9)` | `#5ccf84` / `#ffd447` / `#e7000b` / `#1c84f4` |

Custom properties literales [V]: `--spacing: .25rem`; `--radius: 4px`; `--radius-lg: 8px`; `--radius-xl: 16px`; `--radius-2xl: 20px`; `--shadow-gigsalad-sm: 0px 1px 2px 0px #4e027c1a, 0px .5px 4px -1px #4e027c1a`; `--spacing-layout-sm: 64px` / `-md: 96px` / `-lg: 128px` / `-xl: 192px`; `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif`; `--livewire-progress-bar-color: #9e49ec`.

**El acento de acción es `#4e027c`**: relleno sólido de todo botón primario, color de todos los títulos y de los iconos de metadatos. `#9f49ec` **no** se usa como botón — solo como fondo de héroe y bandas decorativas. Ningún gris actúa como color de acción. Estados: hover del sólido → tono 500; hover de texto → `#b264f7`; foco de campo → borde `#1c84f4`. **Deshabilitado: no medido** (no había control deshabilitado en las vistas públicas); solo consta `data-loading:opacity-70` en las clases del botón.

## 2. Tipografía [V]

Ambas **autoalojadas** en `/build/assets/*.woff2`, sin Google Fonts. Garnett se sirve **solo en peso 600**, con `@font-face` de respaldo métricamente ajustado (`Garnett-fallback-arial-bold`, `size-adjust: 106.62%`). Inter en 400/500/600/700 más itálicas. El `body` es Inter **peso 500**, no 400.

| Rol | Familia | px / line-height | peso | letter-spacing |
|---|---|---|---|---|
| Título grande (héroe) | Garnett | 48 / 52.8 (1.1) | 600 | normal |
| Título de sección | Garnett | 30 / 34.5 (1.15) | 600 | normal |
| Título de ficha | Garnett | 24 / 30 (1.25) | 600 | normal |
| Título de tarjeta | Inter | 18 / 27 (1.5) | 700 | normal |
| Cuerpo | Inter | 16 / 24 (1.5) | 500 | normal |
| Auxiliar | Inter | 14 / 21 (1.5) | 500 | normal |
| Etiqueta de botón | Inter | 14 / 21 | 600 | normal |
| Eyebrow / insignia | Inter | 12 / 15 | 600 | 1.2px, mayúsculas |

Escala declarada `--text-xs .75rem` … `--text-6xl 3.75rem`, con `line-height` que baja de 1.5 (xs–lg) a 1.35 (xl), 1.25 (2xl), 1.15 (3xl/4xl) y 1.1 (5xl/6xl): cuanto más grande, más apretado.

## 3. Forma y profundidad [V]

Radios: control, campo y botón rectangular **8px**; botón de acción en **píldora** (`9999px`); tarjeta y panel **20px** (`rounded-2xl`); imagen decorativa **16px**; avatar **50%** (`fi-avatar fi-circular size-24`, 96px); insignia colgada del borde superior **0 0 8px 8px**. Sombras computadas: nivel 1 (tarjetas y paneles) `rgba(78,2,124,.07) 0 4px 4px -1px, rgba(78,2,124,.1) 0 2px 12px -2px`; nivel 2 (elevación alta) `rgba(78,2,124,.14) 0 25px 50px -12px, rgba(78,2,124,.09) 0 12px 11px -8px`; aro del botón contorneado `oklch(.458 .217 304.9) 0 0 0 1px` — es sombra, no `border`. **Sombra en vez de borde**: la tarjeta tiene `border-width: 0px` y solo sombra tintada de púrpura; el borde de 1px queda para campos y `hr`.

## 4. Espaciado y ritmo [V]

Unidad base **4px** (`--spacing: .25rem`). Columna de contenido **1329.7px** con canaletas de **48px** a 1440 (`[full-start] 48px [content-start] 1329.7px [content-end] 48px [full-end]`); a 390 el contenido mide **344px** con canaletas de **16px**. Secciones separadas 64 / 96 / 128 / 192px. Rejilla de tarjetas `gap-x 24px`, `gap-y 48px`. Tarjeta: foto a sangre, cuerpo con 24px laterales, 24px entre bloques y 16px dentro de un bloque. Botón `14px 16px` (alto 44–49) y `10px 12px` (alto 41). Campo alto 48, padding lateral 16.

## 5. Tarjeta del listado [V]

`article.h-full.flex.flex-col.gap-y-6.bg-white.rounded-2xl.shadow-gigsalad.overflow-hidden`, **314.4 × 720.2px** a 1440; rejilla de 1 / 2 (≥640) / 3 (≥1024) / **4 (≥1280)** columnas. A 390: una columna, 344 × 742.

1. **Foto** `figure` 314 × 314 → **1:1 exacta**, el **43.6% de la altura** de la tarjeta. Se pinta como `<image>` dentro de un `<svg>` con `clipPath`: el borde inferior es una **onda decorativa**, no una recta.
2. **Insignia "Featured"** absoluta, centrada (`left-1/2`), colgando del borde superior: `#1369db`, blanco 12/15 peso 600, `letter-spacing 1.2px`, padding `4px 12px`, radio `0 0 8px 8px`, alto 23.
3. **Título** `h3` Inter **700 18/27** `#4e027c`, `line-clamp-2`.
4. **Valoración** (estrella 16px `#ffd447` + `5.0 (3)` en 14/21), **prueba social** (check 16px `#5ccf84` + `1 Verified booking` 14/21, `truncate`) y un `hr` de 1px `#e4e4e7`.
5. **Metadatos** en `ul`, 8px entre ítems, siempre en este orden: **ciudad → categoría → rango de precio**; icono 16px `#751cb5` + texto 14/21 `#3f3f46`, `truncate`.
6. **Testimonio** 14px `line-clamp-3`, nombre del cliente en negrita. **CTA** píldora `#4e027c`, blanco 14/21 peso 600, padding `10px 12px`, alto 41, ancho completo.

**Hover: la tarjeta NO cambia** [V] — `transition: all 0s ease`, misma `box-shadow` y `transform: none` antes y después (capturas idénticas byte a byte). Solo transiciona el color del CTA y del título, 0.2s. Es decisión, no olvido: la rejilla no salta.

## 6. Botones y controles [V]

| Variante | Fondo | Texto | Forma | Alto | Padding |
|---|---|---|---|---|---|
| Primario sólido | `#4e027c` | blanco 14/600 | píldora (8px en formularios) | 41–49 | 14×16 / 10×12 |
| Contorneado | transparente | `#4e027c` | píldora + aro 1px `#751cb5` | 44 | 14×16 |
| Tonal (chips) | `#f1e2fd` | `#4e027c` | píldora | 41 | 10×12 |
| Fantasma / enlace | transparente | `#4e027c` → hover `#b264f7` | — | — | — |
| Icono | transparente | `#4e027c` | círculo 48 (40/36 en móvil) | 48 | 12 |
| Campo | blanco | 14px `#3f3f46` | 8px, borde 1px `#d4d4d8` | 48 | 16 lateral |

**Foco de teclado**: `outline` nativo de 3px con `outline-offset: 1px` en enlaces y botones — no ponen aro propio; en campos el foco solo cambia el borde a `#1c84f4`. Es el punto más flojo del sistema.

## 7. Navegación [V]

Cabecera **96px a 1440 / 64px a 390**, `position: static` — **no es fija**, se va con el scroll (verificado a scrollY 1200). Fondo transparente sobre blanco, sin borde ni sombra, `z-index: 40`. A 1440: logo, campo de búsqueda 450×48 (radio 8, borde 1px), "Log in" (texto), "List your services" (píldora contorneada 152×44), corazón y hamburguesa (círculos de 48). A 390 se reduce a logo + tres botones de icono de 40/40/36; el menú se despliega desde la hamburguesa.

## 8. Fotografía [V]

**Fotos reales**, candid, gente en fiestas, saturación alta y color cálido; recorte cuadrado en tarjeta y mosaico irregular en portada, esquinas de 16px. **Sin superposición, sin viñeta, sin degradado.** La ilustración plana vectorial se reserva a los héroes de categoría. La legibilidad se resuelve por **separación, no por overlay**: el texto nunca va encima de una foto, va sobre panel púrpura sólido o sobre blanco, al lado. Los fondos con patrón son SVG en `data:` URI sobre color plano.

## 9. Movimiento [V]

`--default-transition-duration: .15s`, `--default-transition-timing-function: cubic-bezier(.4,0,.2,1)`. Botones e insignias transicionan **0.2s `cubic-bezier(.4,0,.2,1)`** sobre color, fondo, borde, sombra y transform. Curvas declaradas: `--ease-in: cubic-bezier(.4,0,1,1)`, `--ease-out: cubic-bezier(0,0,.2,1)`, `--ease-in-out: cubic-bezier(.4,0,.2,1)`. Sin animación de entrada, sin parallax, sin elevación al hover.

## 10. Ánimo

Fiesta ordenada: alegre por el color y las caras, fiable como un banco. Tres decisiones lo consiguen: (1) púrpura casi negro `#4e027c` para todo lo que se pulsa y todo lo que se lee como título, con el púrpura brillante relegado a decoración; (2) foto cuadrada saturada ocupando el tercio superior de una tarjeta blanca de 20px con sombra tintada de púrpura, nunca texto encima; (3) rejilla que no se mueve — sin hover, sin elevación, sin animación de entrada.

## Accesibilidad — WCAG 2.2, calculado sobre los hex medidos

| Par | Ratio | AA normal (4.5) | AA grande (3) |
|---|---|---|---|
| Texto primario `#3f3f46` sobre blanco | **10.44** | ✅ | ✅ |
| Título `#4e027c` sobre blanco / blanco sobre `#4e027c` | **12.93** | ✅ | ✅ |
| Texto auxiliar `#71717a` sobre blanco | **4.83** | ✅ | ✅ |
| Texto auxiliar `#71717a` sobre `#faf4ff` | **4.48** | ❌ por 0.02 | ✅ |
| Blanco sobre héroe `#9f49ec` (h1 de 48px) | **4.53** | ✅ | ✅ |
| `#9f49ec` como texto sobre blanco | **4.53** | ✅ al límite | ✅ |
| Hover de texto `#b264f7` sobre blanco | **3.47** | ❌ | ✅ |
| Blanco sobre insignia `#1369db` (12px) | **5.16** | ✅ | ✅ |
| Placeholder `#a1a1aa` sobre blanco | **2.56** | ❌ | ❌ |
| Check `#5ccf84` / estrella `#ffd447` sobre blanco (gráfico, mín. 3) | **1.96** / **1.42** | ❌ | ❌ |
| Texto sobre imagen | **no aplica**: el sitio nunca pone texto sobre foto | — | — |

El acento de acción `#4e027c` **sí pasa AA** sobre blanco y con texto blanco encima (12.93 en ambos sentidos). Los que **no pasan** son el púrpura de marca `#b264f7` usado como texto (3.47) y el placeholder `#a1a1aa` (2.56). Variantes más oscuras más cercanas que sí pasan, sobre la misma rampa `oklch(L .234 304.2)`: `#9a44e7` (L .58 → **4.82**) como mínimo y **`#8b31d6`** (L .53 → **5.99**) como recomendada. Para el auxiliar sobre `#faf4ff`, `#5f5f68` (≥5.5). Los iconos verde y amarillo solo son admisibles si el significado va **también** en el texto contiguo — en la tarjeta sí lo va ("Verified booking", "5.0 (3)").

## Tokens propuestos — prefijo `--ui-`, jamás mezclar con `--inv-`

```css
:root {
  /* superficie */
  --ui-bg: #ffffff; --ui-bg-alt: #faf4ff; /* purple-50 */ --ui-surface: #ffffff;
  --ui-border: #e4e4e7; --ui-border-field: #d4d4d8;
  /* tinta */
  --ui-ink: #3f3f46; --ui-ink-strong: #09090b; --ui-ink-heading: #4e027c;
  --ui-ink-muted: #5f5f68;       /* corregido; sitio #71717a = 4.48 sobre --ui-bg-alt */
  --ui-ink-placeholder: #6b6b74; /* corregido; sitio #a1a1aa = 2.56, no pasa AA */
  /* acento */
  --ui-accent: #4e027c; --ui-accent-ink: #ffffff; /* 12.93:1 */ --ui-accent-hover: #751cb5;
  --ui-accent-soft: #f1e2fd; --ui-accent-soft-ink: #4e027c; --ui-focus: #1c84f4;
  --ui-accent-brand: #9f49ec;    /* decorativo: héroes y bandas, nunca botón */
  --ui-accent-link: #8b31d6;     /* corregido; sitio #b264f7 = 3.47, no pasa AA */
  /* estado */
  --ui-success: #25944c;  /* corregido; sitio #5ccf84 = 1.96 */   --ui-danger: #e7000b;
  --ui-warning: #ed7308;  /* sitio estrella #ffd447 = 1.42 */      --ui-info: #1369db;
  /* forma y profundidad */
  --ui-radius-control: 8px; --ui-radius-pill: 9999px; --ui-radius-card: 20px; --ui-radius-media: 16px;
  --ui-shadow-1: 0 4px 4px -1px rgb(78 2 124 / .07), 0 2px 12px -2px rgb(78 2 124 / .10);  /* tarjetas */
  --ui-shadow-2: 0 25px 50px -12px rgb(78 2 124 / .14), 0 12px 11px -8px rgb(78 2 124 / .09);
  --ui-ring: inset 0 0 0 1px #751cb5;
  /* espacio, base 4px */  --ui-space-1: 4px; --ui-space-2: 8px; --ui-space-3: 16px; --ui-space-4: 24px; --ui-space-5: 48px; --ui-space-6: 96px;
  --ui-content-max: 1330px; --ui-gutter: 48px; --ui-gutter-sm: 16px; --ui-grid-gap-x: 24px; --ui-grid-gap-y: 48px;
  /* tipografía */
  --ui-font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --ui-font-display: "Garnett", "Inter", ui-sans-serif, system-ui, sans-serif;
  --ui-text-display: 48px; --ui-text-display-lh: 1.1; --ui-text-display-weight: 600; --ui-text-section: 30px;
  --ui-text-section-lh: 1.15; --ui-text-section-weight: 600;
  --ui-text-title: 24px;   --ui-text-title-lh: 1.25;   --ui-text-card: 18px; --ui-text-card-lh: 1.5; --ui-text-card-weight: 700;
  --ui-text-body: 16px;    --ui-text-body-lh: 1.5;     --ui-text-body-weight: 500;
  --ui-text-aux: 14px;     --ui-text-aux-lh: 1.5;      --ui-text-label: 14px; --ui-text-label-weight: 600;
  --ui-text-eyebrow: 12px; --ui-text-eyebrow-lh: 1.25; --ui-text-eyebrow-tracking: 1.2px;
  /* movimiento */
  --ui-duration: 200ms; --ui-ease: cubic-bezier(.4, 0, .2, 1);
}
```

Sin medir: estado deshabilitado de los controles, modo oscuro (no existe en el sitio público) y Garnett en pesos distintos de 600 (solo se sirve ese).
