# Guía práctica del sistema de diseño (15 minutos)

Cómo usar tokens, formas, iconos y componentes en un módulo nuevo del **producto** (chrome del
editor, web pública, acceso, catálogo, publicación, y cualquier módulo futuro: invitados, panel).
No aplica a las **plantillas de invitación** (`packages/sections`, tokens `--inv-*`): esas tienen su
propio sistema y esta guía no las toca.

Fuente completa: `docs/rediseno-plantillas/diseno/11-sistema-de-diseno.md` (la especificación) y
`frontend/packages/tokens/README.md` (la cadena de mando del CSS generado). Esta guía no repite esa
profundidad: da los pasos y el ejemplo mínimo que compila, con los nombres reales verificados contra
el código el 2026-09-06 (`pnpm --filter web run typecheck` sobre un fichero temporal, borrado al
terminar esta tarea — ver `memoria/bitacora/3c-cierre-guia.md`).

Antes de tocar un componente, pantalla, icono, paleta, tipografía, formulario o texto de interfaz:
carga la skill `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`).

---

## 1. Instalar y montar el layout

```bash
pnpm add @invitaciones/tokens @invitaciones/ui @invitaciones/icons   # workspace:*
```

En el CSS raíz de tu módulo, **después** de Tailwind y en este orden (`packages/tokens/README.md`):

```css
@import "tailwindcss";
@import "@invitaciones/tokens/tokens.css";     /* variables --ui-*, claro y oscuro */
@import "@invitaciones/tokens/tailwind.css";   /* preset: utilidades semánticas bg-ui-*, text-ui-*… */
@import "@invitaciones/ui/estilos.css";        /* fuentes autoalojadas + utilidades tipográficas */
```

Si tu módulo es un paquete aparte del workspace (como `@invitaciones/ui` mismo), añade también, para
que Tailwind 4 descubra las clases que solo usa tu código y no `apps/web` — nunca mira
`node_modules`, y los paquetes del monorepo entran por ahí (compuerta:
`apps/web/test/utilidades-del-paquete-ui.test.ts`, halló 28 utilidades faltantes cuando faltó esto):

```css
@source "../ruta/a/tu/paquete/src";
```

En el `<html>` de tu layout raíz, el tema es una **elección explícita**, no `prefers-color-scheme`
(supuesto `ADR`, `11 §10`; así lo hace `apps/web/app/(chrome)/layout.tsx:42`):

```tsx
<html lang="es-MX" data-theme="light">
```

`data-theme="dark"` en cualquier ancestro cambia los 46 roles de color por debajo sin que ningún
componente sepa en qué tema está (§6 de esta guía tiene el patrón para un conmutador).

---

## 2. Tu primer bloque: tokens de color, tipografía y espaciado

```tsx
<section className="rounded-ui-hero bg-ui-surface-alt p-8 shadow-1">
  <p className="font-ui-label text-ui-label-md uppercase text-ui-ink-muted">
    Invitaciones digitales con RSVP
  </p>
  <h1 className="font-ui-display text-ui-display-xl text-ui-ink">
    Tu invitación, lista en una tarde.
  </h1>
  <p className="font-ui-text text-ui-text-md text-ui-ink-muted">
    Elige plantilla, personaliza y comparte el enlace.
  </p>
</section>
```

Lo que hay que saber de cada pieza:

- **Color**: solo `bg-ui-<rol>` / `text-ui-<rol>` / `ring-ui-<rol>` / `border-ui-<rol>`, nunca un hex
  ni un paso de escala (`bg-primary-600` no existe como utilidad, a propósito: `11 §8.2`). Los 46
  roles están en `frontend/packages/tokens/src/semantica.ts` (`ROLES_COLOR`) y se ven todos, en claro
  y oscuro, en `/design/tokens`. Los más usados: `surface`, `surface-raised`, `surface-alt`, `ink`,
  `ink-muted`, `ink-placeholder`, `border`, `divider`, `primary` / `on-primary`, `primary-hover`,
  `primary-soft` / `on-primary-soft`, `link`, `accent` / `on-accent`, `success`/`danger`/`warning`/
  `info` (cada uno con `on-*`, `*-text`, `*-soft`/`on-*-soft`), `focus`, `support-1`/`support-2` (con
  `-soft`/`-deep`).
- **Tipografía**: tres voces, nunca mezcladas — `font-ui-display` (Fraunces, títulos y `display-*`/
  `heading-*`), `font-ui-text` (Onest, cuerpo), `font-ui-label` (Red Hat Mono, etiquetas en
  mayúsculas). El tamaño va en `text-ui-<rol>` (`display-2xl`, `display-xl`, `display-lg`,
  `display-md`, `display-sm`, `heading-lg`, `heading-md`, `heading-sm`, `text-lg`, `text-md`,
  `text-sm`, `text-xs`, `label-lg`, `label-md`, `label-sm`); cada uno trae su `line-height`,
  `letter-spacing` y `font-weight` como modificadores del propio token, no hay que fijarlos a mano.
  **Nunca la fuente de cuerpo en un título**: si un texto abre pantalla o tarjeta, es `font-ui-display`
  con un rol `display-*`/`heading-*`, aunque sea pequeño (`heading-sm` es Fraunces a 17-18 px).
- **Radio**: `rounded-ui-control` (8, controles), `rounded-ui-card` (14), `rounded-ui-media` (24,
  fotos), `rounded-ui-hero` (36, bloques grandes), `rounded-ui-pill` (botones, chips, insignias).
- **Sombra**: `shadow-1` / `shadow-2` (tintadas de cacao) o `shadow-[8px_8px_0_0_var(--ui-support-2)]`
  para la sombra de color (una por vista, nunca mezclada con difusa en el mismo elemento, `11 §3.4`).
- **Contenedor**: `max-w-(--container-ui-page)` (1200 px). El espacio base ya es la escala por
  defecto de Tailwind (4 px), así que `p-4`/`gap-6`/… ya son la escala del sistema.

## 3. Formas y fotografía

```tsx
import { Rays, Blob, Image } from "@invitaciones/ui/shapes";

<div className="relative overflow-hidden rounded-ui-hero bg-ui-surface-alt p-8">
  <Rays tone="primary-soft" density={12} radius={160} />
  <Image mask="seal" ratio="1 / 1" alt="Pareja riendo con confeti" imageId="landing-hero" />
</div>
```

- Catálogo completo con parámetros: `Rays`, `Stripes`, `WaveDivider`, `Blob`, `Triangle`,
  `RotatedSquare`, `Pill`, `Seal`, `ColorShadow`, `Composition` — todas en `@invitaciones/ui/shapes`,
  documentadas y con "así sí / así nunca" en `/design/formas`.
- **Reglas que la revisión rechaza si no se cumplen** (`11 §3.4`): una forma protagonista por bloque;
  la forma nunca del mismo matiz que su fondo (salvo los rayos); nunca detrás de un párrafo, campo o
  botón; el paso 500 (`primary-bright`, `support-*` sin sufijo) solo en formas grandes, nunca texto;
  `breathe` solo en formas de fondo y apagado con `prefers-reduced-motion`; el editor (`/editor/[id]`)
  no lleva formas decorativas.
- **Foto sin máscara está prohibido**: `radius-lg` o una de las máscaras (`blob`, `arch`, `seal`,
  `rotated`) en `mask`, nunca un rectángulo duro sobre color plano.
- **Texto nunca sobre foto**: separación por papel opaco, banda o tarjeta; nunca velo, degradado ni
  `text-shadow`.
- **Si la foto todavía no existe**: no pases `src`, pasa `imageId="<id-de-la-tabla>"`. `Image` pinta
  sola el placeholder del sistema (degradado de dos tonos `-soft` + icono `galeria`) y marca el nodo
  con `data-imagen-pendiente="<id>"`. **Cómo pedir la imagen real**: añade una fila a
  `docs/rediseno-plantillas/imagenes-pendientes.md` con id, uso, ruta del componente, máscara/
  proporción, tamaño, descripción y prompt sugerido (sigue el formato de las filas existentes). El
  proxy de este entorno bloquea los bancos de imágenes: nadie descarga la foto desde aquí, entra por
  el dueño o se genera fuera y se sube.
- **Cuando la foto real llega**: pásale `src` al mismo `Image`, confirma que el `alt` sigue
  describiendo lo que se ve, y **borra la fila** de `imagenes-pendientes.md`.

## 4. Iconos

Usar uno que ya existe, dos formas equivalentes:

```tsx
import { IconoGaleria } from "@invitaciones/icons";
import { Icon } from "@invitaciones/icons";

<IconoGaleria size={24} />
<Icon name="galeria" size={24} tone="mono" />
```

`tone="duo"` (por defecto) pinta la pieza secundaria con `var(--ui-primary-soft)`; `tone="mono"` la
funde con `currentColor` (texto en línea, listas densas). Sin `title`, el icono sale
`aria-hidden="true"`; si es el único contenido de un control, pon `aria-label` **en el control**, no
`title` en el icono. El inventario completo (82 nombres) con buscador vive en `/design/iconos`.

**Añadir un icono nuevo** (`packages/icons/`):

1. Dibuja el SVG a mano o parte de un icono libre y redibújalo a la retícula: `viewBox="0 0 24 24"`,
   margen 1,5 px, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`,
   `stroke-linecap="round"`, `stroke-linejoin="round"`. La pieza de relleno secundaria, si la hay,
   lleva `fill="var(--tono)"`. Nombre en kebab-case español sin acentos (`xv-anos`).
2. Guárdalo en `packages/icons/svg/<nombre>.svg`.
3. Añade el nombre al catálogo de categorías de `scripts/generar.ts` (constante `CATEGORIAS`) si es
   un nombre nuevo fuera de los 82 ya previstos.
4. Regenera: `node --experimental-strip-types scripts/generar.ts` (desde `packages/icons/`). Esto
   valida el SVG, escribe `src/generated/<Nombre>Icon.tsx`, reescribe `src/index.ts` (con el
   `REGISTRO` de `Icon` y `iconNames`) e `inventario.json`. La galería `/design/iconos` lo recoge sin
   tocar nada más.
5. `pnpm --filter @invitaciones/icons run test` — cero SVG inválidos, cero hex.

**Nunca** uses `lucide-react` directamente en el chrome ni ningún icono fuera de esta retícula:
`lucide-react` se retiró del árbol en el bloque 3 (`handoffs/3c-8.md §2.5`); si te falta un icono, se
redibuja a esta gramática (dos tonos, trazo 1,75 redondeado) y entra al inventario, no se importa
suelto.

## 5. Componentes

```tsx
import { Button, Card, Field, Input, EmptyState } from "@invitaciones/ui";

<Card variant="elevada" className="p-6">
  <Field label="Nombre de la invitación" hint="Puedes cambiarlo después.">
    <Input placeholder="Boda de Ana y Luis" />
  </Field>
  <Button variant="primario" size="md">Publicar</Button>
  <Button variant="secundario" size="sm">Cancelar</Button>
</Card>

<EmptyState
  ilustracion="sin-invitaciones"
  titulo="Todavía no tienes invitaciones"
  texto="Crea la primera para empezar a compartirla."
  accion={{ etiqueta: "Empezar mi invitación", href: "/editor" }}
/>
```

Radix es la base accesible (`Dialog`, `Select`, `Switch`, `RadioGroup`, `Tabs`, `Tooltip`, `Toast`…);
el aspecto es 100 % propio, nunca shadcn sin rediseñar y nunca un control nativo sin estilo. El
inventario con anatomía, tokens, estados y teclado/ARIA de cada uno está en `11 §5`; la galería con
todas las variantes y estados en `/design/componentes/[slug]`. Antes de escribir un componente nuevo,
comprueba que no exista ya: si falta uno, se crea en `packages/ui/src/componentes/`, con sus estados
completos, y se suma a la galería (paso siguiente) — nunca se resuelve local, a mano, en tu módulo.

## 6. Conmutar `data-theme`

En producción el tema es estático hoy (`<html data-theme="light">`, §1); no hay conmutador de
usuario todavía (`preguntas-abiertas.md`). Para un conmutador (galería, ajustes futuros), el patrón
real es un `data-theme` en un contenedor con estado de React —
`apps/web/app/(chrome)/design/_componentes/marco-de-tema.tsx` — porque un `[data-theme]` anidado
gana sobre el de un ancestro:

```tsx
"use client";
import { useState } from "react";

export function MarcoDeTema({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<"light" | "dark">("light");
  return (
    <div data-theme={tema}>
      <button type="button" aria-pressed={tema === "dark"} onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))}>
        Oscuro
      </button>
      {children}
    </div>
  );
}
```

Ningún componente debe leer el tema por su cuenta: el mapa de 46 roles ya resuelve el color correcto
por CSS. Ver los dos temas lado a lado, para las tres paletas: `/design/tokens`.

## 7. Añadir una historia a la galería y regenerar referencias

Cada componente nuevo (o variante nueva de uno existente) necesita una historia para entrar en
`/design/componentes/<slug>` y en la regresión visual.

1. Crea `<Nombre>.historias.tsx` junto al componente, exportando `historias: readonly Historia[]`
   (F1/F3, se expanden con `...`) o `historias: Historia` (F2, una por componente) — mira
   `Button.historias.tsx` como plantilla: `slug`, `nombre`, `familia`
   (`"formularios" | "superficies" | "navegacion" | "estados" | "imagen"`), `descripcion`,
   `variantes` (aspecto: tamaños, jerarquías…) y `estados` opcional (reposo, hover, foco, error,
   deshabilitado, cargando…).
2. Impórtala y añádela a `ENTRADAS` en `packages/ui/src/historias/registro.ts` (import + entrada en
   el array; el orden final lo da el `sort` por slug, no dónde la insertes).
3. Regenera `metadatos.ts` (el gemelo seguro para Server Components, sin `render()`) con el mismo
   método con el que se generó: evaluar `registro.ts` bajo Vitest y volcar `slug`/`nombre`/`familia`/
   `descripcion` — `metadatos.test.ts` falla si diverge de `registro.ts`, así que un `pnpm --filter
   @invitaciones/ui run test` en rojo te dice si falta este paso.
4. Si tu historia expone algo que se posiciona contra la ventana (`Dialog`, `Sheet`, cualquier
   superposición con `position: fixed`/`aria-hidden` global), **no la montes suelta**: envuélvela en
   `EscaparateSuperposicion` (`packages/ui/src/historias/escaparate.tsx`) con `modal={false}` en el
   componente Radix. Sin esto rompe tres cosas a la vez en la galería: `aria-hidden` sobre toda la
   página (violación axe `aria-hidden-focus`), `pointer-events: none` fuera del panel (el conmutador
   de tema deja de poder pulsarse) y el panel tapando la página entera en vez de vivir en su ficha.
5. Regenera las capturas de referencia (playwright, config aparte, sin backend):
   ```bash
   pnpm --filter web exec playwright test --config=playwright.design.config.ts --project=design --update-snapshots
   ```
   Commitea lo que cambie en `apps/web/e2e/design.spec.ts-snapshots/`. Corre sin `--update-snapshots`
   para verificar que quedó en verde antes de terminar.

---

## 8. Reglas duras y sus compuertas

| regla | dónde se hace cumplir |
|---|---|
| Cero emojis en interfaz, textos, iconos, docs de usuario | grep mecánico por código Unicode de emoji sobre `frontend/**`, p. ej. `rg -n '\p{Emoji_Presentation}' apps/web packages --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/coverage/**'` (verificado en esta tarea: única coincidencia real es un comentario de código que **documenta** un defecto histórico ya corregido — `apps/web/app/api/revalidate/tras-publicar/route.ts:3` —, no una emisión a interfaz) |
| Cero hex sueltos en componentes | `grep -rn "#[0-9a-f]\{6\}" packages/ui/src` (verificado en esta tarea: única coincidencia real es un comentario en `componentes/demo-foto.ts:3` que documenta el color de un PNG de demostración en `data:` URI, sin red — usado solo en galería y pruebas, nunca en producto). Los pasos de escala en sí viven en `tokens/src/paletas.ts` (único fichero con literales hex, por diseño) |
| `--ui-` nunca fuera de `app/(chrome)/**`; `--inv-` nunca dentro | `apps/web/test/tokens-no-leak.test.ts` (grep de cadenas, cubre lo que un import-lint no ve); para un paquete nuevo replica el mismo patrón con su propio `test/frontera.test.ts` (ver `packages/tokens/README.md` "La cadena de mando") |
| Las 42 parejas de color con su umbral (4,5 texto normal, 3,0 gráfico) | `pnpm --filter @invitaciones/tokens run verify-contrast` — rompe con **código 1** si una pareja baja; engancha a `prepack`/`build` del paquete y a CI antes de construir `apps/web` |
| Contraste sobre la **pila renderizada**, no sobre parejas de tokens | `apps/web/e2e/design-contraste.spec.ts` (`getComputedStyle`, degradados y opacidades incluidos; `axe` NO vale como compuerta de contraste, su `incomplete` no es un aprobado) |
| a11y del producto (más allá de contraste) | `apps/web/e2e/design-axe.spec.ts` (galería) y `e2e/a11y-producto.spec.ts` (pantallas reales: violations vacío de cualquier impacto) |
| Objetivo de toque ≥ 24 px, foco no obstruido | `apps/web/e2e/design-objetivos.spec.ts` |
| Regresión visual de la galería | proyecto Playwright `design` (`playwright.design.config.ts`), `toHaveScreenshot` con `maxDiffPixelRatio: 0.001`, 390 y 1440, claro y oscuro — comando de regeneración en §7 |
| Movimiento apagado con `prefers-reduced-motion` | las utilidades de movimiento se emiten dentro de `@media (prefers-reduced-motion: no-preference)`; verificado por historia de estado en cada componente animado |
| CSS generado, nunca editado a mano | `packages/tokens/test/css-generado.test.ts` compara byte a byte lo commiteado en `generated/*.css` con lo que emite `scripts/emit-css.ts` desde `src/*.ts` |

Compuertas de conjunto, desde `frontend/`: `pnpm run test`, `pnpm run typecheck`, `pnpm run lint`,
`pnpm run build`. Cifras del cierre de la fase, citadas con su fuente, en `memoria/contratos.md §13`.

---

## 9. Qué NO hacer (antipatrones vistos en esta fase)

- **`--inv-*` en el chrome, o `--ui-*` en una sección de invitación.** Son dos sistemas con dos
  audiencias; mezclarlos fue la primera regla que la fase 3-C blindó con una prueba mecánica
  (`tokens-no-leak.test.ts`) precisamente porque un import no lo detecta.
- **Reintroducir nombres viejos de la capa de compatibilidad** (`bg-ui-bg`, `text-ui-ink-heading`,
  `font-ui-sans`, `text-ui-eyebrow`/`aux`/`body`/`card`/`title`/`section`/`display`…). Existen SOLO
  como deuda intencional para las pantallas que la fase 3 dejó sin migrar (`app/(chrome)/globals.css`,
  bloque "COMPATIBILIDAD FASE 3"); un componente nuevo usa los nombres del sistema (`bg-ui-surface`,
  `text-ui-ink`, `font-ui-display`/`text`/`label`, `text-ui-display-*`/`heading-*`/`text-*`/`label-*`)
  directamente, nunca el puente.
- **`lucide-react`.** Se retiró del árbol entero en el bloque 3 (0 imports verificado,
  `handoffs/3c-8.md §2.5`); no vuelve a entrar suelto. Un icono que falta se dibuja a la retícula del
  sistema y se suma al inventario (§4).
- **Historias de superposición sin vitrina.** Montar un `Dialog`/`Sheet` abierto directo en una
  historia rompe el foco, el `aria-hidden` global y la maquetación de la ficha (§7, punto 4). Usa
  siempre `EscaparateSuperposicion`.
- **Importar `@invitaciones/ui/historias` desde un Server Component.** Ese subpath trae `render()`
  reales, y varias historias son módulos `"use client"`: evaluadas desde un Server Component llegan
  como referencias cliente sin `slug` y rompen `next build`. Un Server Component que solo necesita
  listar o enrutar usa `metadatos` desde la raíz del paquete (`@invitaciones/ui`), nunca el subpath.
- **Un paso de escala como utilidad** (`bg-primary-600`, `text-neutral-800`…). No existe como clase
  de Tailwind a propósito (`11 §8.2`): si el sistema no tiene un rol para lo que quieres pintar, falta
  el rol — se pide o se propone por ADR, no se pinta con el paso crudo.
- **Foto real embebida sin pasar por `imagenes-pendientes.md`**, o placeholder que se queda después
  de subir la foto real (la fila no se borró). El `data-imagen-pendiente` existe para que un `grep`
  encuentre exactamente lo que falta; una fila obsoleta miente sobre el estado real.
- **Texto sobre fotografía con velo, degradado o `text-shadow`.** La única legibilidad válida es por
  separación: papel opaco, banda o tarjeta.

---

## 10. Dónde vive cada cosa

```
frontend/packages/
  tokens/   @invitaciones/tokens   → /tokens.css · /tailwind.css · README.md (la cadena de mando)
  ui/       @invitaciones/ui       → componentes, shapes, ilustraciones, fuentes, historias
  icons/    @invitaciones/icons    → svg/*.svg (fuente) + generado, inventario.json
apps/web/app/(chrome)/design/**    → galería viva: /design, /design/tokens, /design/tipografia,
                                      /design/formas, /design/iconos, /design/componentes/[slug]
```

Detalle a grado de implementación de cada pieza: `docs/rediseno-plantillas/diseno/11-sistema-de-diseno.md`.
Estado y cifras del cierre de la fase: `memoria/contratos.md §13`.
