---
name: ui-icono
description: Añadir o modificar un icono en frontend/packages/icons. Cárgala cuando el encargo pida un icono nuevo, un icono que falta en el inventario, o cambios al generador de iconos.
---

# ui-icono

Antes de nada, carga `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`). Este skill
asume ya cargado ese contexto. **Nunca `lucide-react` ni ningún icono suelto fuera de esta
retícula**: se retiró del árbol entero (0 imports); un icono que falta se dibuja aquí.

## 0. Comprueba que no exista ya
82 iconos hoy, buscador real en `/design/iconos` o `frontend/packages/icons/inventario.json`.
Categorías canónicas (`scripts/generar.ts`, constante `CATEGORIAS`): `navegacion`, `edicion`,
`secciones`, `estados`, `rsvp`, `compartir`, `cuenta`, `tipos-evento`. Si tu icono encaja en una
categoría existente y el nombre ya está en `CATEGORIAS`, solo falta el `.svg`; si es un nombre
nuevo fuera de los 82 previstos, añádelo también a la lista de esa categoría en `generar.ts` (paso
3 de abajo).

## 1. Dibuja el SVG a la gramática exacta
Retícula 24×24, margen 1,5 px. El generador **valida y rechaza** cualquier fichero que no cumpla
esto (`validarSvg` en `scripts/generar.ts`), así que síguelo al pie de la letra:
- Raíz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` — los seis atributos son obligatorios y literales (el
  validador busca exactamente `stroke-width="1.75"`, no `1.75px` ni otro grosor).
- **Prohibido en la raíz**: `width`/`height` fijos, `style=`.
- **Prohibido en cualquier elemento**: `style=`, `<image>`, `fill-opacity`, cualquier color hex
  (`fill="#…"`/`stroke="#…"`) — el segundo tono es SIEMPRE `fill="var(--tono)" stroke="none"`
  (mira `svg/galeria.svg` como ejemplo real: rectángulo de trazo + una pieza de relleno con
  `var(--tono)` + un punto con `fill="currentColor"`), nunca `currentColor` para la pieza
  secundaria (perdería el dibujo de línea al pintarse del mismo color que el trazo).
- Nombre en kebab-case español, sin acentos, minúsculas (`RE_KEBAB`: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`)
  — `xv-anos`, no `XV-Años` ni `xv_anos`.

## 2. Guárdalo
`frontend/packages/icons/svg/<nombre>.svg` (un fichero por icono, nombre = el kebab-case del §1).

## 3. Súmalo al catálogo si es un nombre nuevo
Si tu icono NO está ya en la lista de 82 nombres de `CATEGORIAS` (`scripts/generar.ts`), añádelo a
la categoría que le corresponda (edítala ahí mismo, es un array de strings). Si ya está previsto
(nombre en la lista pero sin `.svg` dibujado todavía), sáltate este paso.

## 4. Regenera
```bash
cd frontend/packages/icons
node --experimental-strip-types scripts/generar.ts
```
Esto: valida cada `.svg` de `svg/`, escribe `src/generated/<Nombre>Icon.tsx` (PascalCase del
kebab-case, `aAtributosJsx` convierte los atributos de presentación a camelCase para JSX), reescribe
`src/index.ts` (con el `REGISTRO` que alimenta a `Icon` genérico y `iconNames`) e `inventario.json`
— los tres se generan, **nunca se editan a mano** (regla del proyecto: golden files/CSS/artefactos
generados no se escriben con la mano).

## 5. Cómo se consume
```tsx
import { IconoGaleria, Icon } from "@invitaciones/icons";

<IconoGaleria size={24} />                    // componente específico
<Icon name="galeria" size={24} tone="mono" /> // genérico por nombre
```
- `tone="duo"` (por defecto): la pieza de `--tono` se resuelve a `var(--ui-primary-soft)` — el
  aspecto de dos tonos del sistema.
- `tone="mono"`: `--tono` se resuelve a `transparent` (nunca `currentColor`: eso volvería a pintar
  la pieza secundaria del mismo color que el trazo y perdería el dibujo — es exactamente el defecto
  que corrigió `packages/icons/src/tipos.ts`). Úsalo en texto en línea, listas densas, o dentro de
  un control con su propio color (botón de peligro, deshabilitado).
- Sin `title`: el icono sale `aria-hidden="true"` (decorativo). Con `title`: `role="img"` +
  `<title>` como nombre accesible real. Si el icono es el ÚNICO contenido de un control
  interactivo, el `aria-label` va en el control, no `title` en el icono.

## 6. Prueba
```bash
cd frontend/packages/icons
pnpm run test          # vitest run --coverage: cero SVG inválidos, cero hex, cobertura del generador
pnpm run typecheck
```
`test/svg.test.ts` corre `validarSvg` sobre cada fichero de `svg/` — si tu icono no pasa el §1, esta
prueba te dice exactamente qué atributo falta o qué está prohibido.

## Lista de verificación
- [ ] El icono no existe ya (buscado en `/design/iconos` o `inventario.json`).
- [ ] SVG con los seis atributos de raíz exactos y sin nada prohibido (§1).
- [ ] Nombre kebab-case en español, sin acentos.
- [ ] Guardado en `packages/icons/svg/<nombre>.svg`.
- [ ] Añadido a `CATEGORIAS` de `scripts/generar.ts` si el nombre es nuevo.
- [ ] Regenerado con `node --experimental-strip-types scripts/generar.ts` (nunca editado a mano `src/generated/`, `src/index.ts` ni `inventario.json`).
- [ ] `pnpm --filter @invitaciones/icons run test` en verde.
- [ ] Segundo tono, si lo hay, con `fill="var(--tono)" stroke="none"` — nunca `currentColor` ni hex.
