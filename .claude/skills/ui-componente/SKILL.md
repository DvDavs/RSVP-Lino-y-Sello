---
name: ui-componente
description: Crear o modificar un componente del sistema de diseño en frontend/packages/ui/src/componentes. Cárgala cuando el encargo pida un componente nuevo, una variante o un estado nuevo de uno existente, o cambios de aspecto/accesibilidad de un control del chrome del producto.
---

# ui-componente

Antes de nada, carga `identidad-visual` (`.claude/skills/identidad-visual/SKILL.md`). Este skill
asume ya cargado ese contexto y solo añade los pasos mecánicos de `packages/ui`.

## 0. Comprueba que no exista ya
`ls frontend/packages/ui/src/componentes/` (25 componentes hoy: Avatar, Badge, Breadcrumb, Button,
Card, Checkbox, Chip, Combobox, Dialog, EmptyState, Field, Image, Input, ProgressRing, RadioGroup,
Select, Sheet, Skeleton, Switch, Tabs, Textarea, Toast, Tooltip, WizardProgress). Si lo que
necesitas es una variante nueva de uno de estos, edita ese componente y su fichero de historias —
no crees uno nuevo con otro nombre para lo mismo.

## 1. Dónde va el fichero
Dos formas conviven en el paquete, sigue la que ya use el componente más parecido:
- **Con carpeta propia** (la mayoría): `frontend/packages/ui/src/componentes/<Nombre>/<Nombre>.tsx`,
  `<Nombre>.test.tsx`, `<Nombre>.historias.tsx` e `index.ts` que reexporta. Mira
  `packages/ui/src/componentes/Button/` como plantilla.
- **Un solo fichero suelto** en la raíz de `componentes/` (`EmptyState.tsx`, `Skeleton.tsx`,
  `Image.tsx`): úsalo solo para componentes pequeños, sin sub-piezas.

## 2. Cómo se exporta
`frontend/packages/ui/src/componentes/index.ts` es el punto único de export de
`@invitaciones/ui/componentes`. **Tiene tres bloques comentados** (F1 formularios, F2 superficies y
navegación, F3 estados e imagen) que distintos sub-agentes escribieron en worktrees separados — no
los fusiones ni los reordenes, solo añade tu línea `export * from "./<Nombre>/index.ts";` (o el
`export { Nombre, type Props }` explícito si es de un fichero suelto) al bloque temático que le
corresponda. `frontend/packages/ui/src/index.ts` reexporta ese barril completo con
`export * from "./componentes/index.ts";`, así que no toques `index.ts` de la raíz para un
componente nuevo — solo si tu componente es de una familia sin barril propio todavía (formas,
ilustraciones), que no es el caso normal.

## 3. Color, tipografía, radio, sombra — solo tokens
Nunca un hex ni un paso de escala (`bg-primary-600` no existe como utilidad, a propósito). Usa
`bg-ui-<rol>` / `text-ui-<rol>` / `ring-ui-<rol>` / `border-ui-<rol>` de los 46 roles de
`packages/tokens/src/semantica.ts` (`ROLES_COLOR`), tipografía `font-ui-{display,text,label}` con
sus roles de tamaño (`text-ui-display-*`/`heading-*`/`text-*`/`label-*`), radios
`rounded-ui-{control,card,media,hero,pill}`. Mira `Button.tsx` para el patrón de anillo de foco: el
alto y el `box-shadow` de foco se fijan como `style` en línea (medible con `getComputedStyle` en
jsdom, donde no hay Tailwind compilado), el resto del aspecto va en clases de `cva`.

## 4. Estados obligatorios
Todo componente interactivo cubre, según lo que aplique a su tipo (mira cómo lo hace el componente
más parecido de los 25 existentes):
- **reposo**
- **hover** (si es un puntero; nunca el único indicador de estado en móvil)
- **foco visible**: nunca solo el `outline` del navegador ni solo color — anillo con offset medible
  por contraste (`useFoco`/`conAnilloFoco` de `packages/ui/src/utilidades/foco.ts`, ya lo usa
  `Button`); nunca el mismo tratamiento que `hover`.
- **activo** (pulsación: `active:scale-[0.98] active:brightness-[0.92]` es el patrón de `Button`)
- **deshabilitado** (`disabled:opacity-45 disabled:pointer-events-none`, nunca solo un color más
  claro sin cortar la interacción)
- **cargando** (si aplica): `aria-busy="true"` + **texto visible** que diga qué está pasando, nunca
  un spinner mudo como único indicador (patrón `loading`/`loadingText` de `Button.tsx`).
- **error** (si el componente puede estar en un formulario): se comunica por `Field` (ver más abajo),
  no reinventes tu propio mensaje de error dentro del control.

## 5. Accesibilidad
- Base Radix cuando el patrón lo pide (`Dialog`, `Select`, `Switch`, `RadioGroup`, `Tabs`, `Tooltip`,
  `Toast`, `Popover`, `Checkbox`, `Avatar`, `Progress`) — nunca un control nativo sin estilo, nunca
  shadcn sin rediseñar. Revisa qué versión de cada paquete Radix ya está en
  `packages/ui/package.json` antes de añadir una dependencia nueva.
- Si tu componente es un control de formulario, no dupliques `label`/`aria-describedby`: envuélvelo
  con `Field` (`packages/ui/src/componentes/Field/Field.tsx`), que clona el hijo y le añade `id`,
  `aria-invalid` y `aria-describedby` según haya `hint` o `error`. Tu control solo necesita aceptar
  esas tres props.
- `asChild` (Radix `Slot`, ver `Button.tsx`) si el componente debe poder renderizarse como otro
  elemento (un `<a>` con aspecto de botón, por ejemplo).
- Objetivo de toque ≥ 24 px reales (lo mide `e2e/design-objetivos.spec.ts` con
  `getBoundingClientRect`, no por clase).
- Iconos: `aria-hidden` si son decorativos; si el icono es el único contenido de un control
  interactivo, el `aria-label` va **en el control**, nunca `title` en el icono.

## 6. Historia en la galería `/design`
Cada componente nuevo (o variante nueva) necesita una historia para entrar en
`/design/componentes/<slug>` y en la regresión visual:
1. Crea `<Nombre>.historias.tsx` junto al componente. Exporta `historias: readonly Historia[]`
   (patrón F1/F3, varias entradas) o `historias: Historia` (patrón F2, una por componente) — mira
   `Button.historias.tsx`: cada entrada lleva `slug`, `nombre`, `familia`
   (`"formularios" | "superficies" | "navegacion" | "estados" | "imagen"`), `descripcion`,
   `variantes` (array de `{ nombre, render, nota? }`) y `estados` opcional con el mismo shape
   (reposo, hover, foco, deshabilitado, cargando, error…).
2. Añádela a `frontend/packages/ui/src/historias/registro.ts`: import arriba (con el resto,
   alfabético por convención de esa lista) y tu `...historias`/`historias` dentro de `ENTRADAS`. El
   orden final de la galería lo da el `sort` por `slug` al final del fichero, no dónde insertes la
   línea.
3. `pnpm --filter @invitaciones/ui run test` corre `historias/metadatos.test.ts`, que compara
   `metadatos.ts` (el gemelo seguro para Server Components) contra `registro.ts` y falla en rojo si
   diverge — así sabes si falta regenerar `metadatos.ts` con el mismo método con el que se generó
   (evaluar `registro.ts` bajo Vitest y volcar `slug`/`nombre`/`familia`/`descripcion`).
4. Si tu historia expone algo que se posiciona contra la ventana (`Dialog`, `Sheet`, cualquier
   overlay con `position: fixed` o `aria-hidden` global), envuélvela en `EscaparateSuperposicion`
   (`packages/ui/src/historias/escaparate.tsx`) con `modal={false}` en el componente Radix. Sin esto
   rompe el conmutador de tema (`pointer-events: none` fuera del panel), `aria-hidden` global (axe) y
   la maquetación de la ficha.

## 7. Regresión visual, contraste y a11y — reales, no opcionales
```bash
cd frontend
pnpm --filter web exec playwright test --config=playwright.design.config.ts --project=design --update-snapshots
```
Regenera las capturas de referencia (`apps/web/e2e/design.spec.ts-snapshots/`) con tu historia
nueva. Luego corre SIN `--update-snapshots` para confirmar que queda en verde:
```bash
pnpm --filter web exec playwright test --config=playwright.design.config.ts --project=design
```
Esto ejecuta a la vez `design.spec.ts` (visual, 390/1440, claro/oscuro), `design-contraste.spec.ts`
(contraste sobre la pila renderizada — `axe` NO es compuerta de contraste, deja `incomplete`),
`design-axe.spec.ts` (0 violaciones) y `design-objetivos.spec.ts` (objetivo ≥ 24 px, foco visible).
El `webServer` de esta config es propio, sin backend (`next build && next start` en :3133) — no
necesitas `dev-backend.sh` para esto.

## 8. Pruebas unitarias del paquete
```bash
cd frontend
pnpm --filter @invitaciones/ui run test        # vitest run --coverage
pnpm --filter @invitaciones/ui run typecheck    # tsc --noEmit
pnpm --filter @invitaciones/ui run lint
```
Escribe `<Nombre>.test.tsx` junto al componente (render, estados, teclado, `jest-axe` si el
componente lo amerita — ya es dependencia del paquete).

## Lista de verificación
- [ ] No existe ya un componente o variante que cubra esto (`ls componentes/`).
- [ ] Fichero en `componentes/<Nombre>/` o suelto, según el patrón del componente más cercano.
- [ ] Export añadido al bloque correcto de `componentes/index.ts` (F1/F2/F3), sin reordenar los otros dos.
- [ ] Cero hex, cero paso de escala; todo color por rol `bg-ui-*`/`text-ui-*`/`ring-ui-*`/`border-ui-*`.
- [ ] Estados que apliquen: reposo, hover, foco visible medible, activo, deshabilitado, cargando (con texto), error (vía `Field`).
- [ ] Radix como base si el patrón lo pide; nunca control nativo sin estilo ni shadcn sin rediseñar.
- [ ] Objetivo de toque ≥ 24 px si es interactivo.
- [ ] `<Nombre>.historias.tsx` creado y sumado a `historias/registro.ts`.
- [ ] `pnpm --filter @invitaciones/ui run test` en verde (incluye `metadatos.test.ts`).
- [ ] Capturas de `/design` regeneradas y luego verificadas en verde sin `--update-snapshots`.
- [ ] Si cambiaste algo de identidad (paleta, tipografía, forma, componente base): ADR en `docs/rediseno-plantillas/memoria/decisiones.md`.
