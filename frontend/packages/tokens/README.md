# `@invitaciones/tokens`

Tokens del sistema de diseño del **producto** (chrome del editor, web pública, acceso, catálogo,
publicación). No es el sistema de las **plantillas de invitación**: esas tienen el suyo, con otro
prefijo, en `packages/sections`, y las dos fronteras están vigiladas por pruebas de `grep`
(`test/frontera.test.ts` aquí y `apps/web/test/tokens-no-leak.test.ts` allí).

Fuente: `docs/rediseno-plantillas/diseno/11-sistema-de-diseno.md` §1 (color), §2.2 (escala
tipográfica), §3 (forma), §6 (movimiento) y §8 (arquitectura).

## La cadena de mando

```
src/*.ts  ──node scripts/emit-css.ts──▶  generated/tokens.css    :root y [data-theme] con todo --ui-*
                                    └──▶  generated/tailwind.css  @theme inline, SOLO roles semánticos
```

Nunca al revés. Si un valor no está en TypeScript, no existe: el CSS está **generado y commiteado**,
y `test/css-generado.test.ts` compara byte a byte lo commiteado con lo que sale de la fuente (el
mismo patrón con el que `packages/schema` vigila su JSON Schema). Editar el CSS a mano se pone rojo.

| fichero | qué es |
|---|---|
| `src/oklch.ts` | conversión OKLCH → sRGB y recorte al gamut bajando **solo** el croma |
| `src/paletas.ts` | las tres paletas como definición OKLCH (matiz + croma) y sus escalas derivadas. **Único fichero con literales hex** |
| `src/semantica.ts` | los 46 roles `--ui-*` → paso de escala, por tema, y las 42 parejas con su umbral |
| `src/contraste.ts` | contraste WCAG 2.x y el recorrido que imprime y rompe |
| `src/tipografia.ts` | tres voces, escala modular de `11 §2.2`, pesos y ejes de Fraunces |
| `src/espacio.ts` | espacio base 4, radios, sombras, contenedor, capas, puntos de corte |
| `src/movimiento.ts` | duraciones y curvas |
| `src/css.ts` | la emisión de los dos CSS (funciones puras) |

## Cómo lo consume `apps/web` (o cualquier módulo futuro)

En el CSS raíz del módulo, **después** de Tailwind:

```css
@import "tailwindcss";
@import "@invitaciones/tokens/tokens.css";   /* variables --ui-*, claro y oscuro */
@import "@invitaciones/tokens/tailwind.css"; /* preset: utilidades semánticas */
```

y `data-theme="light|dark"` en `<html>` (claro por defecto; `[data-theme]` también funciona anidado,
que es como `/design` enseña los dos temas en la misma página).

A partir de ahí:

```tsx
<button className="bg-ui-primary text-ui-on-primary rounded-ui-pill font-ui-text
                   focus-visible:ring-ui-focus">Publicar</button>
<h1 className="font-ui-display text-ui-display-xl text-ui-ink">Tu invitación</h1>
```

El preset expone `--color-ui-*` (46 roles), `--radius-ui-{control,card,media,hero,pill}`,
`--shadow-ui-{1,2,color}`, `--container-ui-page` (= `--ui-container-max`, 1200 px), `--font-ui-{display,text,label}`,
`--text-ui-<rol>` con sus modificadores `--line-height`, `--letter-spacing` y `--font-weight`, y
`--ease-ui-{out,in-out,spring,linear}`.

### Lo que NO se expone, y por qué

- **Los pasos de escala** (`--ui-primary-300`, `--ui-neutral-800`) están en `tokens.css` y en TS,
  pero **no** como utilidad de Tailwind (`11 §8.2`). Un paso suelto en un componente es exactamente
  el hueco por donde se cuela una identidad inconsistente: si el sistema no tiene un rol para lo que
  quieres pintar, falta el rol, no la utilidad. Las **formas** de `packages/ui` sí los usan, por
  variable CSS, porque su trabajo es componer color plano en grande.
- **Las duraciones**: Tailwind 4 no tiene espacio de nombres `--duration-*`. Se usan como
  `duration-[var(--ui-dur-2)]` o desde CSS. Las curvas sí (`ease-ui-out`).
- **Los puntos de corte de marca** (`--ui-bp-*`): el chrome ya usa la escala por defecto de Tailwind
  más `ed:` (900 px, punto de corte del editor, ADR-3-8-01). Están como dato, no como variante.
- **El espacio**: la escala por defecto de Tailwind ya es base 4 (`p-4` = 16 px), así que `--ui-space-*`
  existe para CSS a mano, no para duplicar utilidades.

## Compuertas

```
pnpm run verify-contrast    # 3 paletas x 2 temas x 42 parejas = 252 filas; 240 con umbral; 0 fallos
pnpm run emit:css           # regenera generated/*.css   (--check: falla si están desincronizados)
pnpm run escalas            # imprime las escalas OKLCH (--md: tablas para el documento 11)
pnpm run test               # 56 pruebas, incluidos los scripts en subproceso y los dos sabotajes
```

`verify-contrast` sale con **código 1** si una pareja baja de su umbral (4,5 texto normal; 3,0 solo
donde se declara gráfico: borde de control, anillo de foco, icono de acción), y está enganchado a
`build`. Que la compuerta cae de verdad se demuestra saboteándola:

```
node scripts/verify-contrast.ts --sabotear=ink=#fdf9f6   # → FALLA en las tres parejas de ink; exit 1
```

## Reglas que el paquete codifica (no son opiniones)

1. El brillo lo dan las superficies (50-200) y la tipografía los pasos oscuros (600-900). **El 500
   es decorativo**: ni texto ni fondo de texto (`test/semantica.test.ts` lo comprueba pareja a pareja).
2. El **anillo de foco nunca sale del matiz principal** y nunca toca el control: lleva un halo de
   2 px de `surface` (`box-shadow: 0 0 0 2px var(--ui-surface), 0 0 0 5px var(--ui-focus)`). Por eso
   no existe la pareja `focus`/`primary`: medirla sería medir algo que el sistema prohíbe dibujar.
3. El **tema oscuro es un mapa**, no una excepción: `data-theme="dark"` cambia los 46 roles y ningún
   componente sabe en qué tema está.
4. **Cero hex fuera de `src/paletas.ts`**, en todo el paquete y en `packages/ui` e `icons`.
5. La fuente de cuerpo **no titula**: `display-*` y `heading-*` son la voz display, siempre.
