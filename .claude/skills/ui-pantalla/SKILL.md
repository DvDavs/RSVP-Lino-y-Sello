---
name: ui-pantalla
description: Crear una página nueva en frontend/apps/web/app. Cárgala cuando el encargo pida una pantalla, ruta o vista nueva del producto (chrome del editor, web pública, acceso, catálogo, un módulo futuro como invitados o panel).
---

# ui-pantalla

Antes de nada, carga `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`). Este skill
asume ya cargado ese contexto.

## 1. Elige el grupo de ruta real
`frontend/apps/web/app/` tiene cuatro grupos, cada uno con su propio `layout.tsx` raíz — nunca
comparten árbol, así que una pantalla nueva vive en UNO solo:
- **`(chrome)`**: shadcn/Tailwind del producto (`--ui-*`). Dentro, **`(sitio)`** es el sub-grupo de
  la web pública NO autenticada (`/`, `/acceso`, `/ayuda`) y `design`/`editor` viven directo bajo
  `(chrome)`. Un módulo de producto nuevo (invitados, panel) casi siempre va aquí.
- **`(public)`**: la invitación que ve el invitado (`/i/[publicToken]`, `/preview/[invitationId]`).
  Sus propios tokens (`--inv-*`), nunca `--ui-*` aquí.
- **`(canvas)`**: el lienzo del editor (`/editor/[invitationId]/canvas`), con CSP propia y
  `next/font/local` (no toques esto salvo que el encargo lo pida explícitamente).
- **`api`**: rutas de servidor (revalidación, etc.), no páginas.
Verifica con `find "frontend/apps/web/app/(chrome)" -maxdepth 2 -type d` (o el grupo que toque)
antes de decidir la carpeta.

## 2. Ficheros de la ruta
Una pantalla completa trae, en su carpeta (`app/(chrome)/(sitio)/tu-ruta/` o similar):
- `page.tsx` — Server Component salvo que necesite estado de cliente real (mira §5).
- `loading.tsx` — estado de carga (Suspense boundary de Next).
- `error.tsx` — frontera de error, marcado `"use client"`. **Ponlo en la carpeta de la pantalla,
  no en la raíz del grupo**: un `error.tsx` en `(chrome)/error.tsx` entra en el JS de primera carga
  de TODAS las rutas del grupo, incluida la portada, que no tiene margen (`149,8`→`160` KB rompía el
  presupuesto de 150 KB — ver `(chrome)/(sitio)/acceso/error.tsx`). Solo la portada, por ser
  estática y sin datos, se conforma con la frontera de Next y no lleva la suya.
- `not-found.tsx` si la ruta puede recibir un id que no exista.

## 3. Composición: formas y layout
Una forma **protagonista** por bloque, de `@invitaciones/ui/shapes` (`Rays`, `Stripes`,
`WaveDivider`, `Blob`, `Triangle`, `RotatedSquare`, `Pill`, `Seal`, `ColorShadow`, `Image`,
`Composition`). Mira `components/sitio/Hero.tsx` como ejemplo real: `Composition` para combinar una
forma de fondo con una foto enmascarada, `Pill` para el eyebrow, nunca dos formas del mismo bloque
compitiendo. Foto siempre con `mask` (nunca rectángulo duro); si la foto real no existe todavía, usa
`imageId="<id>"` en vez de `src` (el componente pinta el placeholder solo) y anota la fila en
`docs/rediseno-plantillas/imagenes-pendientes.md` (detalle completo: `guias/identidad-visual.md §3`).
Contenedor: `max-w-ui-page` / `max-w-(--container-ui-page)` (1200 px).

## 4. Textos: siempre `lib/i18n.ts`, nunca literales
Cero cadenas de interfaz sueltas en el JSX. Añade tu sección a
`frontend/apps/web/lib/i18n.ts` (objeto `es_MX`, es-MX; ya tiene 672 líneas con secciones
`comun`, `errores`, `acceso`, `sitio`, `asistente`, `editor`…) y consume `es_MX.tuSeccion.tuClave`.
Un valor puede ser una función que interpola parámetros (ver `errores.codigo`). Mensajes de error:
en español, y que digan qué hacer (no «algo salió mal» sin acción — mira `errores.algoSalioMal`
como plantilla: título, cuerpo, una acción primaria).

## 5. Server vs cliente
Server Component por defecto. Sube a `"use client"` solo lo que de verdad necesita estado o efectos
del navegador (formularios, cualquier `Button`/control interactivo del sistema ya es cliente por su
cuenta). Importa componentes por su **subruta directa**
(`@invitaciones/ui/componentes/Button/index.ts`) en vez del barril `@invitaciones/ui` cuando la
página es mayormente estática: el barril reexporta el catálogo entero —mitad con Radix dentro— y
eso infla el JS propio de la ruta (medido: 92,3 KB → 8,9 KB en la portada al cambiar el import,
`bitacora/3c-5.md §3`). Ver el presupuesto real de tu ruta en §8 antes de decidir.

## 6. Metadatos
```tsx
export const metadata: Metadata = {
  title: { absolute: `${es_MX.comun.marca} · <tu título>` }, // o `template` si hereda del layout
  description: "…",
  robots: { index: true, follow: true }, // false para rutas que no se indexan (/i, /preview, /design)
};
```
Mira `(chrome)/(sitio)/page.tsx` y `(chrome)/layout.tsx` para los dos patrones (página vs layout).

## 7. Estados obligatorios
Vacío, error y carga son parte del entregable, no un extra:
- **Carga**: `loading.tsx`, o un `Skeleton`/`EmptyState` del sistema si el dato tarda dentro del
  propio componente cliente.
- **Error**: `error.tsx` con `PantallaError` (mira el patrón de `components/sitio/PantallaError.tsx`
  usado por `acceso/error.tsx` y `ayuda/error.tsx`) o el componente equivalente de tu grupo — texto
  de `errores.algoSalioMal`, una acción de reintento (`reset()`), nunca dos primarias.
- **Vacío**: `EmptyState` de `@invitaciones/ui` (`ilustracion`, `titulo`, `texto`, `accion` opcional)
  — mira el ejemplo de `guias/identidad-visual.md §5`.

## 8. Presupuesto de peso — cómo se mide hoy
```bash
cd frontend/apps/web
pnpm run build           # necesario antes: la compuerta lee .next/
node scripts/check-budget.mjs
```
Límite 150 KB gz de JS propio de primera carga para toda ruta salvo el editor (`/editor/[id]`, 600
KB). El script suma el runtime común (`rootMainFiles`, sin polyfills — se cuentan aparte, se sirven
`nomodule` y este `browserslist` no los necesita) más los chunks propios de la ruta
(`page_client-reference-manifest.js`). También hay una prueba que corre esto mismo dentro de la
suite (`e2e/presupuesto.spec.ts`, sin recompilar: usa el `.next` que ya construyó el `webServer` de
Playwright) — es la forma de verificarlo sin un build manual aparte si ya vas a correr e2e.

## 9. e2e y axe de la pantalla
- Añade o extiende un spec en `frontend/apps/web/e2e/` que recorra la pantalla contra el backend
  real (nunca mockees la API — política del proyecto, `contratos.md §6`/`04 §20.3`). Sigue el patrón
  de datos de `pruebas-producto` (invitación y usuario propios, nunca la sembrada compartida).
- Si la pantalla es del producto real (no la galería `/design`), súmala a
  `e2e/a11y-producto.spec.ts` (0 violaciones de cualquier impacto) — mira su cabecera para el
  tratamiento de `incomplete`/diálogos modales antes de tocarlo.
- Contraste sobre la pila renderizada con `e2e/util/contraste.ts` (`medirContraste`), reutilizado
  ahí mismo — nunca confíes en `axe` para contraste (deja `incomplete`, no es un aprobado).

## Lista de verificación
- [ ] Grupo de ruta correcto, verificado con `find`/`ls`, no supuesto.
- [ ] `page.tsx` + `loading.tsx` + `error.tsx` (en la carpeta de la pantalla, no en la raíz del grupo) + `not-found.tsx` si aplica.
- [ ] Una forma protagonista por bloque, foto con máscara, `imageId` + fila en `imagenes-pendientes.md` si no hay foto real.
- [ ] Cero literales de interfaz: todo texto en `lib/i18n.ts`.
- [ ] Metadatos con `robots.index` correcto para la ruta.
- [ ] Estados vacío / error / carga presentes y con texto que ayuda, no solo "algo salió mal".
- [ ] Presupuesto verificado con `check-budget.mjs` (o `e2e/presupuesto.spec.ts`) tras `pnpm run build`.
- [ ] e2e nuevo o extendido, con datos propios de la prueba (no la invitación sembrada compartida).
- [ ] `a11y-producto.spec.ts` cubre la pantalla si es parte del producto real.
